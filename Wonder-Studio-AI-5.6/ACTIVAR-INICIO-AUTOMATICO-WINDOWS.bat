@echo off
setlocal
cd /d "%~dp0"
set "WS_APP_FOLDER=%~dp0"
set "WS_TARGET=%~dp0INICIAR-ESCRITORIO-WINDOWS.bat"
if exist "%~dp0dist\WonderStudioAI.exe" set "WS_TARGET=%~dp0dist\WonderStudioAI.exe"
if exist "%~dp0WonderStudioAI.exe" set "WS_TARGET=%~dp0WonderStudioAI.exe"
set "WS_LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\WonderStudioAI.lnk"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $l=$ws.CreateShortcut($env:WS_LINK); $l.TargetPath=$env:WS_TARGET; $l.WorkingDirectory=$env:WS_APP_FOLDER; $l.WindowStyle=7; $l.Description='Iniciar Wonder Studio AI local al entrar a Windows'; $l.Save()"
if errorlevel 1 (
 echo ERROR: Windows no pudo crear el acceso directo de inicio.
) else (
 echo INICIO AUTOMATICO ACTIVADO.
 echo Wonder Studio AI se iniciara al entrar a Windows con esta cuenta.
 echo No mueve ni elimina tus datos.
)
echo.
pause
endlocal
