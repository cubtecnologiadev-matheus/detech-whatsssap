// index.js — Validador de WhatsApp (sequencial, sem envio)
// v3: usa getNumberId PRIMEIRO; fallback robusto via api.whatsapp.com; logs de diagnóstico
'use strict';

const fs = require('fs');
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const QRCode = require('qrcode');
const { Client, LocalAuth } = require('whatsapp-web.js');

// ============================== Setup básico ===============================
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const RUNS_DIR = path.join(__dirname, 'runs');
fs.mkdirSync(RUNS_DIR, { recursive: true });
const SNAP_DIR = path.join(RUNS_DIR, 'snapshots');
fs.mkdirSync(SNAP_DIR, { recursive: true });

// ============================ WhatsApp Client ==============================
let waReady = false;
let lastQrDataUrl = null;

const puppeteerConfig = {
  headless: true,
  executablePath: process.env.CHROME_PATH || undefined,
  args: [
    '--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage',
    '--disable-gpu','--no-first-run','--no-default-browser-check'
  ]
};

const waClient = new Client({
  authStrategy: new LocalAuth({ dataPath: path.join(__dirname, '.wwebjs_auth') }),
  puppeteer: puppeteerConfig,
  webVersionCache: { type: 'none' },
});

waClient.on('qr', async (qr) => {
  try {
    lastQrDataUrl = await QRCode.toDataURL(qr);
    io.emit('qr', { dataUrl: lastQrDataUrl });
  } catch (e) { console.error('Erro ao gerar QR:', e); }
});

waClient.on('ready', () => { waReady = true; io.emit('ready'); console.log('WhatsApp pronto.'); });
waClient.on('auth_failure', (m) => { waReady = false; console.error('Falha de autenticação:', m); });
waClient.on('disconnected', (reason) => { waReady = false; console.warn('Desconectado:', reason); });

waClient.initialize().catch((e) => console.error('Falha ao inicializar o WhatsApp:', e));

// ============================== Estado global ==============================
const state = {
  running: false, stopRequested: false,
  startedAt: null, finishedAt: null,
  total: 0, processed: 0, current: null,
  hasWhatsApp: [], noWhatsApp: [], errors: [],
};

function snapshot() {
  return {
    waReady, running: state.running, stopRequested: state.stopRequested,
    startedAt: state.startedAt, finishedAt: state.finishedAt,
    total: state.total, processed: state.processed, current: state.current,
    hasWhatsAppCount: state.hasWhatsApp.length, noWhatsAppCount: state.noWhatsApp.length,
    errorsCount: state.errors.length, progressPct: state.total ? Math.round((state.processed / state.total) * 100) : 0,
    lastQrDataUrl,
  };
}

// ======================= Normalização de números BR ========================
const onlyDigits = (s) => (s || '').replace(/\D+/g, '');
function normalizeBrazilNumber(raw) {
  let d = onlyDigits(raw);
  if (!d) return null;
  if (d.startsWith('55')) { /* ok */ }
  else if (d.length >= 10 && d.length <= 11) d = '55' + d;
  else return null;
  if (d.length < 12 || d.length > 13) return null;
  return d;
}
function parseListToQueue(text) {
  const set = new Set();
  for (const line of (text || '').split(/\r?\n/)) {
    const n = normalizeBrazilNumber(line.trim());
    if (n) set.add(n);
  }
  return Array.from(set).map(d => ({ digits: d }));
}

// ======= Fallback via https://api.whatsapp.com/send/?phone= ===============
async function checkViaClickToChat(digits, saveHtml = false) {
  const url = `https://api.whatsapp.com/send/?phone=${digits}`;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      redirect: 'follow', signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8'
      }
    });
    const html = await res.text();
    const lc = html.toLowerCase();

    if (saveHtml) { try { fs.writeFileSync(path.join(SNAP_DIR, `${digits}.html`), html); } catch {} }

    const negatives = [
      'não está no whatsapp','nao está no whatsapp','nao esta no whatsapp','não esta no whatsapp',
      'o número de telefone que você digitou não está usando o whatsapp',
      'número de telefone compartilhado por url é inválido','numero de telefone compartilhado por url é inválido',
      'phone number shared via url is invalid','not on whatsapp'
    ];
    // Sinais de positivo
    const positives = [
      'continuar para a conversa','continuar para o chat','continue to chat',
      'use whatsapp to chat','conversar no whatsapp','abrir whatsapp','open whatsapp','wa.me/'
    ];
    if (negatives.some(p => lc.includes(p))) return { ok: false, via: 'click-to-chat' };
    if (positives.some(p => lc.includes(p))) return { ok: true, via: 'click-to-chat' };

    // Fallback heurístico: se existe um <form action="/send"> ou link para /send
    if (/<form[^>]+action=\"\/send/i.test(html) || /href=\"\/send/i.test(html)) return { ok: true, via: 'click-to-chat' };

    return { ok: null, via: 'click-to-chat' };
  } catch (e) {
    return { ok: null, error: String(e) };
  } finally { clearTimeout(t); }
}

// ============================== Worker seq. ================================
let queue = [];
async function processQueueSequential() {
  state.running = true; state.stopRequested = false;
  state.processed = 0; state.hasWhatsApp = []; state.noWhatsApp = []; state.errors = [];
  state.startedAt = new Date().toISOString(); state.finishedAt = null;
  io.emit('status', snapshot());

  let snapCount = 0;

  while (queue.length && !state.stopRequested) {
    const item = queue.shift();
    state.current = item.digits; io.emit('status', snapshot());

    try {
      // 1) Checagem principal via WhatsApp Web
      let has = false, via = 'wweb', reason = '';

      try {
        const id = await waClient.getNumberId(item.digits);
        has = !!(id && id._serialized);
        console.log(`[${item.digits}] getNumberId =>`, has ? 'OK' : 'NULL');
      } catch (e) {
        console.warn(`[${item.digits}] getNumberId erro:`, e?.message || e);
        reason = 'getNumberId erro';
      }

      // 2) Se não tiver certeza, tentar api.whatsapp.com e salvar HTML das primeiras 5 para diagnóstico
      if (!has) {
        const fb = await checkViaClickToChat(item.digits, snapCount < 5);
        if (fb.ok === true) { has = true; via = fb.via; }
        else if (fb.ok === false) { has = false; via = fb.via; reason = 'Sem WhatsApp'; }
        else { reason = reason || 'Indeterminado'; }
        snapCount++;
        console.log(`[${item.digits}] click-to-chat =>`, fb.ok);
      }

      if (has) {
        state.hasWhatsApp.push(item.digits);
        io.emit('progress', { type: 'ok', digits: item.digits, via });
      } else {
        state.noWhatsApp.push(item.digits);
        io.emit('progress', { type: 'no', digits: item.digits, via, reason: reason || 'Sem WhatsApp' });
      }
    } catch (err) {
      const reason = String(err?.message || err);
      state.errors.push({ digits: item.digits, reason });
      state.noWhatsApp.push(item.digits);
      io.emit('progress', { type: 'error', digits: item.digits, reason });
    }

    state.processed += 1; state.current = null; io.emit('status', snapshot());
    await new Promise(r => setTimeout(r, 30));
  }

  state.running = false; state.finishedAt = new Date().toISOString();
  io.emit('done', { reportFile: persistRunReport() }); io.emit('status', snapshot());
}

function persistRunReport() {
  try {
    const payload = {
      startedAt: state.startedAt, finishedAt: state.finishedAt,
      total: state.total, processed: state.processed,
      hasWhatsApp: state.hasWhatsApp, noWhatsApp: state.noWhatsApp, errors: state.errors,
    };
    const name = `run_${Date.now()}.json`;
    const full = path.join(RUNS_DIR, name);
    fs.writeFileSync(full, JSON.stringify(payload, null, 2), 'utf8');
    return name;
  } catch (e) { console.error('Falha ao salvar relatório:', e); return null; }
}

// ================================= API =====================================
app.get('/health', (_, res) => res.json({ ok: true, waReady }));
app.get('/status', (_, res) => res.json(snapshot()));
app.post('/start', async (req, res) => {
  try {
    if (!waReady) return res.status(409).json({ error: 'WhatsApp não está pronto. Escaneie o QR.' });
    if (state.running) return res.status(409).json({ error: 'Uma verificação já está em andamento.' });
    const { numbersText } = req.body || {};
    const list = parseListToQueue(numbersText);
    if (!list.length) return res.status(400).json({ error: 'Nenhum número válido foi encontrado.' });
    queue = list.slice(); state.total = queue.length;
    setTimeout(processQueueSequential, 0);
    res.json({ ok: true, total: state.total });
  } catch (e) { console.error(e); res.status(500).json({ error: 'Falha ao iniciar a verificação.' }); }
});
app.post('/stop', (_, res) => { state.stopRequested = true; res.json({ ok: true }); });

io.on('connection', (socket) => {
  if (lastQrDataUrl && !waReady) socket.emit('qr', { dataUrl: lastQrDataUrl });
  socket.emit('status', snapshot());
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Servidor em http://localhost:${PORT}`));
