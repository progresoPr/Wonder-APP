# Actualizar Wonder Studio AI 5.0/5.1 a 5.2 sin perder tu trabajo

## No borres nada de la instalación donde ya trabajaste

Tu cuenta, tus proyectos, tus diseños, las categorías, las etiquetas y las imágenes viven en la carpeta `data/` de la instalación anterior (o en la ruta `WS_DATA_DIR` si la configuraste). **No la borres ni la reemplaces por una carpeta nueva vacía.**

## Actualización protegida en Windows (recomendada)

1. **Cierra** la ventana negra del servidor Wonder Studio AI 5.0/5.1. Antes de hacerlo, comprueba que la interfaz marque «Guardado en servidor».
2. Guarda una copia manual de la carpeta anterior en otro disco, si es posible.
3. Descomprime `Wonder-Studio-AI-5.2.zip` en una **carpeta nueva**. No extraigas los archivos directamente sobre los anteriores.
4. Dentro de la carpeta 5.2, haz doble clic en **`ACTUALIZAR-MIS-DATOS-WINDOWS.bat`**.
5. Selecciona en la ventana la **carpeta anterior donde ya trabajaste**, la que contiene `server.py`, `VERSION.txt` y `data/`.
6. El actualizador verifica que exista una base de datos válida y que estén presentes los archivos de imagen asociados. Crea un **ZIP de respaldo verificado fuera de la carpeta anterior**, con la base SQLite, las imágenes y los archivos antiguos del programa.
7. Después cambia **solo los archivos del programa** dentro de la carpeta anterior. **No modifica ni sustituye** `data/`, `wonder.db`, `uploads/`, `backups/` ni `.env`.
8. Si ves `ACTUALIZACIÓN CORRECTA`, vuelve a abrir **`INICIAR-WINDOWS.bat` desde tu carpeta habitual (la antigua)**. Inicia sesión con el mismo correo y contraseña. Comprueba proyectos, recursos y diseños.
9. Conserva el ZIP de respaldo creado por el actualizador y la carpeta nueva 5.2 hasta confirmar que todo funciona.

**Si la actualización indica algún error, se detiene sin modificar tu base de datos.** Si no consigue crear y verificar el respaldo, no sustituye archivos del programa. Si falla la sustitución, intenta restaurar automáticamente los archivos anteriores.

### Si el navegador dice `ERR_CONNECTION_REFUSED`

La dirección `127.0.0.1:8000` no está recibiendo conexiones: **no indica que se hayan borrado los proyectos**. La ventana negra del servidor debe permanecer abierta. Haz doble clic en `INICIAR-WINDOWS.bat` en la carpeta actualizada. Si la consola muestra un error, toma una captura de **la consola**, no solamente del navegador. Como alternativa, abre CMD dentro de la carpeta de la aplicación y ejecuta `py -3 server.py` (o `python server.py`); deja esa ventana abierta mientras usas Wonder Studio AI.

### Para comprobar Python

Necesitas una versión estable de Python 3.11 o más reciente. Evita versiones alfa. En CMD puedes ejecutar `py -3 --version` y después `py -3 server.py`. Si necesitas un puerto diferente usa `py -3 server.py --port 8500 --open-browser`, y abre `http://127.0.0.1:8500`.

## Instalación nueva (sin trabajos anteriores)

Descomprime el ZIP en una carpeta y abre `INICIAR-WINDOWS.bat`. Se creará una carpeta `data/` nueva. **No sigas este método si lo que quieres es continuar trabajando con tus datos existentes sin migrarlos**.

## Para continuar sin el actualizador

Con el servidor anterior completamente cerrado, copia la carpeta **completa** `data/` de la instalación anterior a la carpeta 5.2 y también tu `.env` si lo configuraste. No copies una base `wonder.db` aislada sin las imágenes de `data/uploads/`. Verifica que se puedan abrir tus archivos antes de eliminar cualquier carpeta vieja.

## Recordatorio de seguridad

El almacenamiento es local al servidor que se inicia: cerrar y reabrir el navegador conserva los datos, pero borrar `data/` o perder el equipo sin respaldos puede hacerlos irrecuperables. Guarda respaldos ZIP en otro disco o ubicación segura.
