@echo off
cd /d "%~dp0"
echo Motor opcional de recorte de fondo local. No requiere clave API.
where py >nul 2>nul
if %errorlevel%==0 (py -3 -m pip install "rembg[cpu]" pillow) else (python -m pip install "rembg[cpu]" pillow)
echo Si aparecen errores de compatibilidad, utiliza una version estable compatible de Python.
pause
