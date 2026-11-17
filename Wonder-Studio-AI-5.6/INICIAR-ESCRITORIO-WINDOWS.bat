@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 desktop.py
) else (
  python desktop.py
)
if errorlevel 1 (
  echo No se pudo iniciar Wonder Studio AI. Comprueba la version estable de Python.
  pause
)
