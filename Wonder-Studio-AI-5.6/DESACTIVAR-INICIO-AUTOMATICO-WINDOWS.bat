@echo off
setlocal
set "WS_LINK=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\WonderStudioAI.lnk"
if exist "%WS_LINK%" (
 del /f /q "%WS_LINK%"
 echo Inicio automatico desactivado. Tu aplicacion y datos se conservaron.
) else (
 echo No habia inicio automatico configurado.
)
pause
endlocal
