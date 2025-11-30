@echo off
setlocal
title WA Campaign Panel - instalar e iniciar

rem 1) Ir para a pasta deste .BAT (sem caminho absoluto)
cd /d "%~dp0"

rem 2) REINSTALAR PENDENCIAS (seu bloco)
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json

rem **deixe vazio** para permitir o download do Chromium do Puppeteer
set PUPPETEER_SKIP_DOWNLOAD=

npm i || goto :erro
npm i puppeteer --save-dev || goto :erro

rem 3) Abrir o navegador DEPOIS de iniciar o servidor:
rem    lanço um processo paralelo que espera 3s e abre o localhost
start "" cmd /c "timeout /t 3 /nobreak >nul & start "" ""http://localhost:3000"""

rem 4) Iniciar o painel (fica ABERTO nesta mesma janela)
echo.
echo === Iniciando o servidor (CTRL+C para parar) ===
npm start

echo.
echo Servidor finalizado. Pressione uma tecla para fechar.
pause >nul
goto :eof

:erro
echo.
echo [ERRO] Alguma etapa de instalacao falhou. Veja as mensagens acima.
pause
