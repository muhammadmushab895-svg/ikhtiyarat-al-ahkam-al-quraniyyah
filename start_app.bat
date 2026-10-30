@echo off
title Ikhtiyarat Quran App
cd /d "%~dp0"

where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo Starting local Turath book server...
    start "Turath Book Server" /MIN node server.js
    ping 127.0.0.1 -n 2 >nul
    start "" "http://localhost:3000"
) else (
    start "" "index.html"
)
exit
