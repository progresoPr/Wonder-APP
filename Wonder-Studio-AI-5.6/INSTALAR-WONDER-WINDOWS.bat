@echo off
setlocal
cd /d "%~dp0"
set "EXE=%~dp0WonderStudioAI-5.6-Windows.exe"
set "BIN=%LOCALAPPDATA%\WonderStudioAI\bin"
echo ======================================================
echo  WONDER STUDIO AI 5.6 - ASISTENTE DE INSTALACION
 echo ======================================================
echo.
echo Este instalador NO modifica ni elimina tus proyectos.
echo Datos existentes: %%LOCALAPPDATA%%\WonderStudioAI\data
echo.
if not exist "%EXE%" (
  echo ERROR: No encuentro WonderStudioAI-5.6-Windows.exe en esta carpeta.
  pause
  exit /b 1
)
if not exist "%BIN%" mkdir "%BIN%"
copy /Y "%EXE%" "%BIN%\WonderStudioAI.exe" >nul
if errorlevel 1 (
  echo No se pudo copiar el EXE. Comprueba los permisos.
  pause
  exit /b 1
)
powershell -NoProfile -Command "$s=New-Object -ComObject WScript.Shell; $p=[Environment]::GetFolderPath('Desktop'); $l=$s.CreateShortcut([IO.Path]::Combine($p,'Wonder Studio AI.lnk')); $l.TargetPath=[IO.Path]::Combine($env:LOCALAPPDATA,'WonderStudioAI\bin\WonderStudioAI.exe'); $l.IconLocation=$l.TargetPath; $l.Save()"
if errorlevel 1 echo AVISO: No pude crear el acceso directo. El EXE queda en %BIN%.
echo.
echo Aplicacion instalada. Ejecutable: %BIN%\WonderStudioAI.exe
where py >nul 2>nul
if not errorlevel 1 goto python_ok
where python >nul 2>nul
if not errorlevel 1 goto python_ok
 echo.
 echo IMPORTANTE: este EXE requiere Python instalado para iniciar el servidor local.
 where winget >nul 2>nul
 if errorlevel 1 goto python_manual
 choice /C SN /M "No se detecta Python. Instalar Python 3.13 estable usando winget"
 if errorlevel 2 goto python_manual
 winget install -e --id Python.Python.3.13 --accept-package-agreements --accept-source-agreements
 if errorlevel 1 goto python_manual
 echo Python instalado. Reinicia la terminal o el equipo si Windows aun no lo reconoce.
 goto python_ok
:python_manual
 echo Abriendo la descarga oficial de Python para Windows.
 start "" "https://www.python.org/downloads/windows/"
:python_ok
 echo.

choice /C SN /M "Quieres configurar herramientas de IA local"
if errorlevel 2 goto end
:ollama
where ollama >nul 2>nul
if %errorlevel%==0 goto model
where winget >nul 2>nul
if %errorlevel%==0 (
  choice /C SN /M "No encuentro Ollama. Quieres instalarlo con winget"
  if errorlevel 2 goto comfy
  winget install -e --id Ollama.Ollama --accept-package-agreements --accept-source-agreements
  if errorlevel 1 echo No se completo la instalacion de Ollama. Puedes instalarlo desde https://ollama.com/download/windows
) else (
  echo No se encontro winget. Abriendo descarga oficial de Ollama.
  start "" "https://ollama.com/download/windows"
)
:model
choice /C SN /M "Quieres descargar un modelo de conversacion ligero (gemma3:1b)"
if errorlevel 2 goto comfy
where ollama >nul 2>nul
if errorlevel 1 (
 echo Abre una terminal nueva al terminar de instalar Ollama y ejecuta: ollama pull gemma3:1b
) else (
 ollama pull gemma3:1b
)
:comfy
choice /C SN /M "Quieres abrir la pagina oficial de ComfyUI para configurar generacion de imagenes"
if errorlevel 2 goto end
start "" "https://www.comfy.org/download"
echo ComfyUI requiere modelos separados y un equipo con recursos suficientes.
:end
echo.
echo La edicion basica funciona sin motores de IA.
echo Para abrir el programa usa el acceso directo de Wonder Studio AI.
pause
endlocal
