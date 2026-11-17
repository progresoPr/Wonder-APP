@echo off
setlocal
cd /d "%~dp0"
title Diagnostico de inicio - Wonder Studio AI

echo ===================================================
echo   DIAGNOSTICO DE INICIO DE WONDER STUDIO AI
 echo ===================================================
echo.
echo Carpeta de la aplicacion: %CD%
if exist "server.py" (echo [OK] server.py encontrado) else (echo [ERROR] No existe server.py en esta carpeta)
if exist "VERSION.txt" (type VERSION.txt) else (echo [ERROR] VERSION.txt no encontrado)
echo.
where py >nul 2>&1
if %errorlevel%==0 (
  echo Python detectado con el lanzador py:
  py -3 --version
  py -3 -c "import sqlite3; print('SQLite disponible:',sqlite3.sqlite_version)"
) else (
  where python >nul 2>&1
  if %errorlevel%==0 (
    echo Python detectado con el comando python:
    python --version
    python -c "import sqlite3; print('SQLite disponible:',sqlite3.sqlite_version)"
  ) else (
    echo [ERROR] Python no se encontro en PATH.
    echo Instalalo desde https://www.python.org/downloads/windows/
  )
)
echo.
echo Comprobando conexiones al puerto 8000:
netstat -ano | findstr ":8000"
if errorlevel 1 echo No se detecta un servicio en el puerto 8000.
echo.
echo Si sale ERR_CONNECTION_REFUSED, inicia INICIAR-WINDOWS.bat.
echo Si el inicio falla, toma una captura del error de la ventana negra.
echo NO ELIMINES TU CARPETA data PARA RESOLVER ESTE ERROR.
echo.
pause
endlocal
