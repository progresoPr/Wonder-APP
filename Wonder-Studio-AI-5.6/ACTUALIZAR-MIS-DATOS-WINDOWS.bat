@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (py -3 actualizar_5_5.py) else (python actualizar_5_5.py)
pause
