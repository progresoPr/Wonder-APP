# Wonder Studio AI 5.6 — Edición de escritorio y edición web

Esta versión parte de Wonder Studio AI 5.5.1 y conserva el editor de capas, la biblioteca, las cuentas y los archivos existentes. **Ahora trae dos ediciones** que comparten aspecto y funciones de creación, pero guardan los datos en lugares distintos.

## Descargas incluidas

- `WonderStudioAI-5.6-Windows.exe`: lanzador de escritorio compilado para Windows 64 bits. **Requiere Python 3.11 o superior instalado** y Edge o Chrome. Los motores de IA siguen siendo opcionales.
- `INSTALAR-WONDER-WINDOWS.bat`: copia el ejecutable a `%LOCALAPPDATA%\WonderStudioAI\bin`, crea acceso directo y ofrece instalar/configurar Ollama y abrir la descarga oficial de ComfyUI. No borra `data/`.
- `web/`, `package.json`, `vercel.json`, `supabase/schema.sql`: edición web para GitHub/Vercel/Supabase. Consulta `PUBLICAR-EN-VERCEL.md`.
- `CONSTRUIR-EXE-WINDOWS.bat`: script para **construir en Windows** un ejecutable alternativo que incluya Python utilizando PyInstaller. Requiere conexión y herramientas de construcción; no es el EXE entregado.

## Cambios de la versión 5.6

1. **Interfaz visual:** nuevas proporciones, tipografía, paleta, espacios, paneles, editor más amplio, tarjetas con logotipo/monograma, menú de acciones por tarjeta y galería más legible.
2. **Exportación:** botón principal Compartir / Exportar, panel con nombre, escala, calidad y transparencia. Exporta PNG, JPG, WebP, PDF basado en imagen y SVG con imagen incrustada. Los archivos descargados se guardan en la ubicación de descargas elegida por el navegador. El escritorio también guarda adicionalmente PNG/JPG en la carpeta local del proyecto.
3. **Ventanas propias:** creación/renombrado de proyectos, diseños, carpetas, mensajes de confirmación e información sin ventanas `prompt/confirm/alert` del navegador.
4. **GitHub y Vercel:** front-end web compilable con `npm run build`; autenticación y almacenamiento privado en Supabase mediante políticas RLS. Requiere configurar un proyecto Supabase antes de usarla.
5. **IA local:** mantiene Ollama y ComfyUI, con un asistente de configuración para Windows. Generar fotografías nuevas requiere motores y modelos instalados; la edición manual/composiciones rápidas no.
6. **Persistencia:** el lanzador sigue utilizando la misma carpeta `%LOCALAPPDATA%\WonderStudioAI\data` de versiones anteriores. El EXE separa código (`app/5.6`) y datos (`data`). No borres la carpeta de datos.

## Instalar en Windows sin perder lo anterior

1. Conserva como respaldo tu carpeta de Wonder 5.5/5.5.1, y **no elimines** `%LOCALAPPDATA%\WonderStudioAI\data`.
2. Haz una copia adicional de `%LOCALAPPDATA%\WonderStudioAI\data` en otro disco o exporta un respaldo desde la versión anterior.
3. Ejecuta `INSTALAR-WONDER-WINDOWS.bat` junto al EXE, o ejecuta el EXE directamente.
4. Abre Wonder Studio AI y verifica que aparecen tus proyectos y diseños.
5. Si tu versión anterior guardaba los datos en una carpeta distinta, usa las herramientas de migración antiguas o importa un respaldo, sin sobrescribir tu instalación anterior.

## Local vs. web

| | Escritorio Windows | Web (Vercel) |
|---|---|---|
| Guardado | SQLite, archivos privados y carpetas por proyecto | Supabase PostgreSQL + Storage privado |
| Uso sin Internet | Sí, para editar | No, necesita red para guardar |
| Inicio de sesión | Local y código de recuperación | Supabase Auth, recuperación por correo |
| IA | Ollama/ComfyUI local, opcionales | Sin generador remoto en esta entrega |
| Mover proyectos entre ediciones | Exportar/importar respaldos | Exportar/importar respaldos |

## Pruebas

La suite heredada del servidor pasa con `python -m unittest discover -s tests -v`. Se verifica la sintaxis JavaScript, la compilación web y la compilación cruzada del lanzador Windows. **No hemos podido probar el ejecutable directamente en Windows ni conectar un Supabase real desde este entorno.** Por esa razón se recomienda probar primero con un proyecto de prueba y respaldar los archivos de producción.

## Seguridad

No subas las carpetas `data`, `.env`, archivos ZIP de respaldo o bases SQLite a GitHub. El archivo `.gitignore` ya excluye esas rutas. Para Vercel usa exclusivamente la clave pública `SUPABASE_ANON_KEY`, con RLS habilitado; nunca la clave `service_role`.
