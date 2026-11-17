# Restaurar Wonder Studio AI 5.3 (edición local)

La carpeta `data/` contiene la base `wonder.db`, los archivos `uploads/`, respaldos automáticos y, si la configuraste, la clave de IA `ai-config.json`. Para restaurar una instalación completa, **cierra el servidor antes de manipular archivos**.

1. Identifica el ZIP de respaldo externo generado por el actualizador o el respaldo local en `data/backups/`.
2. Conserva una copia del estado actual antes de restaurar.
3. Extrae `wonder.db` y `uploads/` del respaldo en la carpeta `data/` de la instalación que quieres recuperar. **No sobrescribas datos de otra cuenta o instalación sin confirmar qué contenido contienen.**
4. Para recuperaciones portátiles entre cuentas, usa el botón **Importar ZIP** dentro de la aplicación; ese ZIP no contiene credenciales ni claves API.
5. Si habías configurado una API, la clave se restaura desde tu copia privada de `.env` o `data/ai-config.json`; nunca compartas esas credenciales.
6. Ejecuta `INICIAR-WINDOWS.bat` y comprueba proyectos, biblioteca y versiones.

La restauración de SQLite y archivos debe hacerse como conjunto. Copiar solo la base sin `uploads/` puede dejar imágenes perdidas. No elimines la carpeta antigua hasta verificar todos los proyectos.
