# Actualizar 5.3 → 5.4 sin perder datos

1. No borres la 5.3 ni su `data/`.
2. Cierra Wonder (ventana y servidor), guarda una copia manual de tu carpeta `data/` si puedes.
3. Extrae el ZIP 5.4 en **una carpeta diferente**.
4. Ejecuta `ACTUALIZAR-MIS-DATOS-WINDOWS.bat` desde la carpeta 5.4.
5. Selecciona tu carpeta antigua 5.3, donde están `server.py`, `VERSION.txt` y la carpeta `data/`.
6. El actualizador verifica la base de datos SQLite, crea un respaldo externo ZIP y copia solo los archivos de programa. No reemplaza `data/` ni `.env`.
7. Abre `INICIAR-ESCRITORIO-WINDOWS.bat` en la carpeta habitual.

Si vas a usar el ejecutable y quieres acceder a esas mismas cuentas y recursos, antes de abrirlo por primera vez ejecuta `MIGRAR-DATOS-A-ESCRITORIO-WINDOWS.bat`. El destino del EXE será `%LOCALAPPDATA%\WonderStudioAI\data`. Si ya existe una base de datos ahí, el migrador se detendrá y debes usar el respaldo ZIP por cuenta para importar.
