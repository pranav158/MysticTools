@echo off
title MysticTools - Private PDF ^& Image Studio
cd /d "%~dp0"
echo Starting MysticTools... the browser will open automatically.
node scripts\serve.mjs --open
pause
