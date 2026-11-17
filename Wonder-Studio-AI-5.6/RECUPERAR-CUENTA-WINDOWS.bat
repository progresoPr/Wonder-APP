@echo off
setlocal
cd /d "%~dp0"
title Wonder Studio AI - Recuperar cuenta local
where py >nul 2>&1
if %errorlevel%==0 (
  py -3 recuperar_cuenta.py
) else (
  python recuperar_cuenta.py
)
echo.
pause
endlocal
