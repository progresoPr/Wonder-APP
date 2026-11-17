@echo off
setlocal
cd /d "%~dp0"
title Diagnostico y arranque - Wonder Studio AI 5.5.1
set "WS_DATA_DIR=%LOCALAPPDATA%\WonderStudioAI\data"
echo ================================================
echo  WONDER STUDIO AI - INICIO ASISTIDO
 echo ================================================
echo.
echo Carpeta de datos (NO la borres): %WS_DATA_DIR%
echo.
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 desktop.py
) else (
  python desktop.py
)
if errorlevel 1 (
  echo.
  echo ERROR: el arranque fallo.
  echo Mira el mensaje anterior y el archivo:
  echo %WS_DATA_DIR%\inicio-wonder.log
  echo.
  pause
)
