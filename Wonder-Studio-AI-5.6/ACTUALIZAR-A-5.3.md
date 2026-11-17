# Actualizar Wonder Studio AI a 5.3 SIN BORRAR DATOS

Si ya trabajaste con 5.0, 5.1 o 5.2, **NO BORRES NI REEMPLACES** tu carpeta habitual.

1. Cierra el servidor Wonder (ventana negra) y deja de editar archivos.
2. Descarga y extrae el ZIP **5.3** a una carpeta NUEVA.
3. Ejecuta `ACTUALIZAR-MIS-DATOS-WINDOWS.bat` **desde esa nueva carpeta**.
4. Selecciona la carpeta ANTERIOR donde realmente están tus proyectos (contiene `server.py`, `VERSION.txt` y `data/wonder.db`).
5. El actualizador hace una copia ZIP externa de la base de datos SQLite, imágenes y código anterior, comprueba los archivos y reemplaza **solo los archivos del programa**.
6. Si sale `ACTUALIZACIÓN CORRECTA`, abre `INICIAR-WINDOWS.bat` desde tu **carpeta habitual**, no desde el ZIP recién extraído.
7. Inicia sesión con tu cuenta de siempre. Tus proyectos y diseños deben seguir ahí.

Los archivos `.env`, `data/`, `uploads/`, `wonder.db`, `data/ai-config.json` NO son eliminados ni sobrescritos. La base se amplía automáticamente de forma no destructiva para los códigos de recuperación.

**Importante:** una instalación nueva en otra carpeta no importará automáticamente los datos antiguos. Usa el actualizador para conservar el mismo servidor y carpeta de datos. Guarda el respaldo generado en otro disco.

## Recuperar la contraseña de una cuenta antigua

Si no tienes código de recuperación, ejecuta `RECUPERAR-CUENTA-WINDOWS.bat` desde la carpeta habitual, elige tu cuenta y conserva el código que se muestra. Entra a la app → **Recuperar contraseña** → coloca el correo y el código → define contraseña de 8 o más caracteres.

## Primer inicio y conexión IA

- Ejecuta `INICIAR-WINDOWS.bat` y entra en `http://127.0.0.1:8000`.
- En **Configuración → Conectar inteligencia artificial**, la primera cuenta creada en esta instalación puede guardar la clave API y los modelos.
- Pulsa **Probar conexión**; solo este paso comprueba si la API realmente responde. La IA requiere Internet y credenciales propias, **no viene conectada por defecto**.

La aplicación está limitada a `127.0.0.1`: no se publica ni comparte por red.
