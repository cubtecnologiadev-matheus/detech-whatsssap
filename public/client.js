// client.js — front-end do validador
'use strict';
const socket = io();

const waStatus = document.getElementById('wa-status');
const qrWrap = document.getElementById('qr-wrap');
const qrImg  = document.getElementById('qr');

const numbersEl = document.getElementById('numbers');
const startBtn  = document.getElementById('start');
const stopBtn   = document.getElementById('stop');
const startMsg  = document.getElementById('start-msg');

const counters  = document.getElementById('counters');
const bar       = document.getElementById('bar');

const okListEl  = document.getElementById('ok-list');
const noListEl  = document.getElementById('no-list');
const okCountEl = document.getElementById('ok-count');
const noCountEl = document.getElementById('no-count');
const copyOkBtn = document.getElementById('copy-ok');
const copyNoBtn = document.getElementById('copy-no');
const dlOkBtn   = document.getElementById('dl-ok');
const dlNoBtn   = document.getElementById('dl-no');

let ok = [];
let no = [];

function setStatus(s) {
  const parts = [];
  parts.push(s.waReady ? 'WhatsApp: ✅ pronto' : 'WhatsApp: ⌛ aguardando QR/login');
  if (s.current) parts.push(`Checando: ${s.current}`);
  waStatus.textContent = parts.join(' · ');
  if (!s.waReady && s.lastQrDataUrl) {
    qrWrap.classList.remove('hidden');
    qrImg.src = s.lastQrDataUrl;
  } else if (s.waReady) {
    qrWrap.classList.add('hidden');
  }

  counters.textContent = `${s.processed}/${s.total} — OK:${s.hasWhatsAppCount} · Sem:${s.noWhatsAppCount}`;
  bar.style.width = `${s.progressPct}%`;
}

socket.on('status', setStatus);

socket.on('qr', (p) => {
  if (p && p.dataUrl) {
    qrWrap.classList.remove('hidden');
    qrImg.src = p.dataUrl;
  }
});

socket.on('ready', () => {
  qrWrap.classList.add('hidden');
});

socket.on('progress', (ev) => {
  if (ev.type === 'ok') {
    ok.push(ev.digits);
    okListEl.textContent = ok.join('\n');
    okCountEl.textContent = `(${ok.length})`;
  } else if (ev.type === 'no') {
    no.push(ev.digits);
    noListEl.textContent = no.join('\n');
    noCountEl.textContent = `(${no.length})`;
  } else if (ev.type === 'error') {
    no.push(ev.digits);
    noListEl.textContent = no.join('\n');
    noCountEl.textContent = `(${no.length})`;
  }
});

socket.on('done', (p) => {
  if (p && p.reportFile) {
    startMsg.textContent = `Finalizado. Relatório salvo em /runs/${p.reportFile}`;
  } else {
    startMsg.textContent = 'Finalizado.';
  }
});

startBtn.addEventListener('click', async () => {
  ok = []; no = [];
  okListEl.textContent = '';
  noListEl.textContent = '';
  okCountEl.textContent = '(0)';
  noCountEl.textContent = '(0)';
  startMsg.textContent = '';

  const numbersText = numbersEl.value || '';
  const res = await fetch('/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ numbersText })
  });
  const data = await res.json();
  if (!res.ok) {
    startMsg.textContent = (data && data.error) ? data.error : 'Falha ao iniciar.';
  } else {
    startMsg.textContent = `Iniciando verificação de ${data.total} números...`;
  }
});

stopBtn.addEventListener('click', async () => {
  await fetch('/stop', { method: 'POST' });
});

function downloadTxt(filename, content) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

dlOkBtn.addEventListener('click', () => {
  downloadTxt('tem_whatsapp.txt', ok.join('\n'));
});

dlNoBtn.addEventListener('click', () => {
  downloadTxt('sem_whatsapp.txt', no.join('\n'));
});

copyOkBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(ok.join('\n'));
});

copyNoBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(no.join('\n'));
});
