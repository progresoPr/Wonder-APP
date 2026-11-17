# Comprobaciones de Wonder Studio AI 5.6

Comprobaciones realizadas en el entorno Linux de desarrollo (17 de noviembre de 2026):

- `python -m unittest discover -s tests -q`: **17 pruebas superadas**. Incluye cuentas, acceso separado, persistencia, respaldos y actualización sin borrar archivos.
- `node --check app.js`, `web/app.js`, `ui56.js`, `export-ui56.js`, `web/auth.js`, `web/storage.js`: sin errores de sintaxis.
- `node tests/check_formats_56.mjs`: PDF de una página y archivo ZIP con estructura verificable.
- `npm run build`: compilación estática para Vercel correcta. Los datos de Supabase deben configurarse en Vercel.
- Prueba de navegador con un servidor de almacenamiento simulado: creación de proyecto, Estudio Creativo, panel de exportación y galería; sin errores JavaScript observados en ese recorrido. **No sustituye una prueba contra Supabase real**.
- Servidor Python local iniciado en puerto de prueba: respuesta `/api/health` 200 y archivos de interfaz 200.
- Compilación cruzada Go a PE64 para Windows: ejecutable construido, **no ejecutado ni validado en Windows**.

## Pendientes de validar en Windows / servicios reales

1. Ejecutar `WonderStudioAI-5.6-Windows.exe` en Windows 10/11 con Python y un proyecto de prueba.
2. Comprobar Ollama y ComfyUI con modelos locales reales (no se incluyen modelos).
3. Crear un proyecto Supabase y comprobar Auth, RLS y Storage con dos cuentas reales antes de compartir la web.
4. Comprobar exportaciones complejas con imágenes remotas, fuentes instaladas y dispositivos variados.
5. Construir y probar en Windows la variante autónoma de PyInstaller.

La entrega es una versión funcional de desarrollo, **no una certificación de producción**.
