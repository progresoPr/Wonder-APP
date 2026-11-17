# Solución del mensaje «127.0.0.1 rechazó la conexión»

Esta versión corrige una causa del problema en Windows: Edge/Chrome pueden mantener una ventana visible mientras el proceso usado para abrirla se cierra; la versión anterior terminaba entonces su servidor local. La versión **5.5.1 mantiene activo el servidor mientras la consola esté abierta**.

1. Cierra las ventanas anteriores de Wonder Studio AI, pero no borres proyectos ni la carpeta `data`.
2. Ejecuta `WonderStudioAI-5.5.1-Windows.exe`. Necesita Python 3.11+ estable instalado en el equipo.
3. Deja abierta la consola (puedes minimizarla) y trabaja en la ventana que se abre.
4. Si se vuelve a presentar el error, usa `REPARAR-INICIO-WINDOWS.bat` de la carpeta fuente. El archivo `inicio-wonder.log` en `%LOCALAPPDATA%\WonderStudioAI\data` guarda el arranque y los errores.
5. Si el inicio falla, envía el texto del error o el contenido reciente de ese registro (sin contraseñas ni datos personales).

**Importante:** esta actualización mantiene la misma carpeta `%LOCALAPPDATA%\WonderStudioAI\data` de la 5.5. No reinstales ni borres las versiones antiguas para corregir la conexión.

La IA local con Ollama/ComfyUI sigue siendo opcional y no interviene en el arranque básico del editor.
