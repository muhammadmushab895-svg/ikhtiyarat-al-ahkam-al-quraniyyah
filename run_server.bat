@echo off
title Turath Proxy Server (Port 3000)
cd /d "%~dp0"
echo Starting Turath Proxy Server on http://localhost:3000 ...
start "" "http://localhost:3000"
node server.js
pause
