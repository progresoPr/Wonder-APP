# Actualizar Wonder Studio AI 5.0 → 5.1 sin perder información

La 5.1 conserva el formato de datos y los archivos privados de 5.0. Las categorías nuevas se guardan dentro de cada proyecto como `customCategories`; **no es necesario convertir ni borrar** el contenido anterior.

## Si ya usabas la versión 5.0 y tenías proyectos

1. Cierra el servidor 5.0 (ventana negra) antes de manipular datos.
2. Conserva una copia íntegra de la carpeta 5.0 (incluida `data/`).
3. Extrae el ZIP 5.1 en una carpeta **nueva**. No reemplaces los archivos de la versión anterior.
4. Copia **toda la carpeta** `data/` de la versión 5.0 a la carpeta raíz de 5.1, **antes de iniciar 5.1**. Si 5.1 ya tiene contenido propio, no sobrescribas: utiliza el respaldo ZIP de la aplicación en lugar de copiarla.
5. Abre `INICIAR-WINDOWS.bat`, inicia sesión con el mismo correo y contraseña de 5.0.
6. Verifica que aparezcan tus proyectos, diseños e imágenes; haz un nuevo respaldo ZIP desde **Configuración → Respaldo ZIP del servidor**.

La carpeta `data/` incluye `wonder.db` (cuentas, proyectos, categorías, diseños), `uploads/` (archivos) y `backups/` (copias). Copiar solamente la base de datos **no recupera** las imágenes.

## Alternativa: respaldo ZIP

Si todavía puedes entrar a 5.0, utiliza **Configuración → Respaldo ZIP del servidor**. En la 5.1 crea una cuenta nueva o inicia sesión y elige **Importar ZIP**. Los identificadores de los registros importados se mantienen.

## Si nunca arrancó 5.0

Simplemente extrae el ZIP de la 5.1 en una carpeta nueva e inicia con `INICIAR-WINDOWS.bat`. No tienes datos previos que transferir.

## Si la 5.1 no abre

Abre CMD dentro de la carpeta de la aplicación y escribe `py -3 server.py`; si no reconoce `py`, prueba `python server.py`. Mantén esa ventana abierta y entra a `http://127.0.0.1:8000/`. Comprueba en la consola si falta Python o si el puerto está ocupado. No abras `index.html` directamente.
