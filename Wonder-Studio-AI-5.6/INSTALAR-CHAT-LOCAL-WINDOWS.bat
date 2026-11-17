@echo off
setlocal
cd /d "%~dp0"
title Configurar Chat de IA Local - Wonder Studio AI
echo ===========================================
echo IA LOCAL PARA CHAT: OLLAMA (SIN CLAVE API)
echo ===========================================
echo Esta instalacion descarga el modelo gemma3:1b una sola vez.
echo Despues puedes utilizar el modelo sin Internet.
echo En computadoras lentas el procesamiento puede tardar mas.
echo.
where ollama >nul 2>nul
if errorlevel 1 (
 echo No se encontro Ollama.
 echo Abriendo sitio OFICIAL para que puedas instalarlo.
 start "" "https://ollama.com/download/windows"
 echo Instala Ollama y vuelve a ejecutar este archivo.
 pause
 exit /b 1
)
echo Ollama detectado.
ollama pull gemma3:1b
if errorlevel 1 (
 echo No fue posible descargar el modelo. Revisa Internet o espacio disponible.
 pause
 exit /b 1
)
echo.
echo Chat local listo. Abre Wonder ^> Configuracion ^> Detectar modelos.
ollama list
pause
