@echo off
setlocal
cd /d "%~dp0"
title Crear Wonder Studio AI.exe - Windows
where py >nul 2>nul
if %errorlevel%==0 (
  set "PY=py -3"
) else (
  set "PY=python"
)
echo ==============================================
echo CREAR APLICACION DE ESCRITORIO AUTONOMA (.EXE)
echo ==============================================
echo Requiere Windows, Python y acceso temporal a Internet para instalar
 echo pywebview + PyInstaller (SOLO para construir el EXE, NO para usarlo).
echo Los motores de IA (Ollama y ComfyUI) se instalan por separado.
echo.
%PY% --version
if errorlevel 1 goto fail
%PY% -m pip install --upgrade pyinstaller pywebview
if errorlevel 1 goto fail
%PY% -m PyInstaller --noconfirm --clean --onefile --windowed --name WonderStudioAI --add-data "index.html;." --add-data "app.js;." --add-data "auth.js;." --add-data "storage.js;." --add-data "style.css;." --add-data "favicon.svg;." --add-data "ui56.css;." --add-data "ui56.js;." --add-data "export-ui56.js;." --collect-all webview --hidden-import webview.platforms.edgechromium desktop.py
if errorlevel 1 goto fail
echo.
echo ==============================================
echo EXE CREADO: %cd%\dist\WonderStudioAI.exe
echo ==============================================
echo Copia este EXE a la ubicacion que quieras. Tus datos estaran en:
echo %%LOCALAPPDATA%%\WonderStudioAI\data
echo Guarda respaldos ZIP tambien fuera del equipo.
pause
exit /b 0
:fail
echo.
echo La creacion del EXE fallo. Revisa el mensaje anterior.
echo Si Python no tiene pip, instala Python estable 3.11-3.14 con pip habilitado.
pause
exit /b 1
