@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 migrar_desktop.py
) else (
  python migrar_desktop.py
)
pause
