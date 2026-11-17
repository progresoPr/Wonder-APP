@echo off
setlocal
cd /d "%~dp0"
title Recuperar cuenta Wonder Studio AI EXE
set "WS_DATA_DIR=%LOCALAPPDATA%\WonderStudioAI\data"
echo Buscando cuentas y proyectos en: %WS_DATA_DIR%
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 recuperar_cuenta.py
) else (
  python recuperar_cuenta.py
)
pause
