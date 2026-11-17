# Publicar Wonder Studio AI 5.6 — GitHub + Vercel + Supabase

Esta edición comparte **la interfaz del editor**, pero utiliza una infraestructura diferente de la versión de escritorio: **Vercel sirve la web y Supabase almacena usuarios, proyectos, diseños y archivos privados**. No subas `wonder.db`, `data/`, `.env` ni contraseñas a GitHub.

## Pasos

1. **Crea un proyecto en Supabase.** En SQL Editor ejecuta íntegramente `supabase/schema.sql`. El script crea `wonder_records` con Row Level Security (RLS) y un bucket privado `wonder-assets` con reglas por usuario. Activa Authentication → Email; configura si quieres confirmar correos al registrarte.
2. En Supabase → Project Settings → API copia la **Project URL** y la clave **publishable/anon** (nunca `service_role`, `sb_secret_` ni una clave privada).
3. En Supabase → Authentication → URL Configuration añade el dominio final de Vercel a **Site URL** y Redirect URLs si vas a utilizar recuperación de contraseña por correo.
4. En GitHub crea un repositorio nuevo y sube el contenido de la carpeta `Wonder-Studio-AI-5.6` (con `package.json`, `vercel.json`, `web/`, `supabase/` y `build-web.mjs` en la raíz). Un repositorio **privado** es conveniente durante las pruebas. **No subas los datos privados.**
5. En Vercel elige **Add New → Project → Import Git Repository**. Selecciona el repositorio. Framework Preset: **Other** (proyecto estático).
6. En Environment Variables agrega `SUPABASE_URL` y `SUPABASE_ANON_KEY` con los valores del paso 2. Son configuraciones públicas del cliente; la protección real la hacen Auth y RLS. **Nunca uses una service-role key.**
7. Build Command: `npm run build`. Output Directory: `dist`. Haz clic en Deploy. Cada nuevo push a GitHub generará una actualización.
8. Regístrate en la web, confirma tu correo si Supabase lo solicita y crea tu primer proyecto. Los visitantes no pueden leer los proyectos de otras cuentas por las políticas RLS.

## Cambiar desde escritorio sin perder diseños

Desde **Wonder Desktop** inicia sesión en tu cuenta original y usa **Respaldo → Exportar respaldo JSON**. Después, entra con tu cuenta web y usa **Configuración → Importar respaldo** para trasladar proyectos, diseños y recursos. Importar puede sobrescribir IDs coincidentes: exporta antes un respaldo desde el destino. Los usuarios/contraseñas locales no se migran a Supabase.

## Límites importantes

- **IA:** Ollama y ComfyUI instalados en una PC no están disponibles automáticamente para visitantes de Vercel. La web permite crear composiciones editables a partir de imágenes y formas; para generar imágenes nuevas necesitarás desplegar e integrar un servicio de IA remoto con autenticación y recursos de cómputo. **Este paquete no lo incluye.** No expongas puertos de Ollama/ComfyUI directamente a Internet.
- **Almacenamiento:** el guardado web depende de Supabase y de Internet. El guardado de escritorio depende de SQLite y de carpetas locales. La sincronización bidireccional automática entre ambos **no está implementada**; usa respaldo/importación.
- **Formatos:** PNG, JPG, WebP, PDF con imagen y SVG con imagen raster incrustada. No convierte diseños a vectores editables ni exporta video en esta versión.
- **Cuotas:** Supabase, Vercel y los modelos remotos pueden tener límites y costos asociados. Verifica las condiciones de tu plan.
- **Seguridad:** la aplicación web está diseñada para cuentas separadas. Antes de compartirla ampliamente, realiza pruebas con varias cuentas y revisa los permisos RLS, el tamaño de archivos y las políticas de respaldo.

## Compilación local de la edición web

```bash
SUPABASE_URL="https://TU-PROYECTO.supabase.co" SUPABASE_ANON_KEY="TU_CLAVE_PUBLICA" npm run build
```

Después, sirve `dist/` con cualquier servidor estático HTTP. Nunca publiques el contenido de `data/`.
