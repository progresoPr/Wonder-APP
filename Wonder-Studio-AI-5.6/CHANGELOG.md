# Registro de cambios

## 5.6 — Edición híbrida, 17 de noviembre de 2026

- Rediseño visual global del editor, biblioteca, proyectos y diseños.
- Tarjetas de proyecto con portadas y menús secundarios; galería de diseños más espaciosa.
- Ventanas de creación, cambio de nombre, información y confirmación dentro de Wonder.
- Exportación en panel contextual (PNG/JPG/WebP/PDF raster/SVG con raster incrustado), escalas 1-4, calidad y nombre editable.
- Preparación de edición web para GitHub y Vercel, compilación estática y persistencia separada en Supabase RLS/Storage privado.
- Asistente de instalación Windows con acceso directo y configuración guiada de motores de IA.
- Actualización sin borrar datos locales. La edición de escritorio usa el mismo directorio de datos de la 5.5.
- Los servicios IA locales permanecen opcionales y no se hacen públicos en Vercel.

### Limitaciones conocidas

- No se ha completado un instalador autónomo que incluya Python; el lanzador EXE requiere Python ya instalado.
- Las funciones fotográficas generativas requieren modelos externos instalados en escritorio y un backend de cómputo aparte para la web.
- No se ha verificado con una cuenta Supabase real ni probado el EXE físicamente en Windows.
- El PDF es un lienzo raster, el SVG incrusta un raster; no se exportan SVG totalmente vectorial, PPTX editable ni vídeo.
- Sin sincronización automática bidireccional entre SQLite local y Supabase.
