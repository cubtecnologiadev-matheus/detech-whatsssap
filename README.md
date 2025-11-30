# 📱 detech-whatsssap

Ferramenta em **Node.js** para detectar quais números de telefone possuem **WhatsApp ativo**.

Ideal para:
- Validar base de leads
- Conferir quais números podem ser contatados via WhatsApp
- Preparar campanhas de atendimento ou marketing

---

## ⚙️ Tecnologias Utilizadas

- **Node.js**
- **npm**
- **Puppeteer / WhatsApp Web** (automação de navegador)
- JavaScript

---

## 📦 Requisitos

- Node.js instalado (versão LTS recomendada)
- npm funcionando
- Acesso à internet (usa WhatsApp Web)
- Navegador suportado pelo Puppeteer

---

## 🔧 Instalação das dependências

No Windows, você pode usar o script `instalar pendencias.bat`  
**ou** rodar os comandos manualmente:

```bat
:: Ir até a pasta do projeto (ajuste se o caminho for diferente)
cd /d "C:\Users\usuario\Desktop\detech whatsssap\detech whatsssap"

:: Limpar instalações antigas (opcional)
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

:: Deixar vazio para permitir o download do Chromium do Puppeteer
set PUPPETEER_SKIP_DOWNLOAD=

:: Instalar dependências
npm install
npm install puppeteer --save-dev
