# Actualizar Wonder Studio AI a 5.5 sin borrar tus proyectos

1. **No elimines** la instalación anterior ni su carpeta `data`.
2. Cierra el servidor o la ventana de Wonder Studio AI anterior.
3. Extrae el ZIP de la 5.5 en **una carpeta nueva**.
4. Si trabajabas con Wonder 5.4 desde archivos y `INICIAR-WINDOWS.bat`, ejecuta `ACTUALIZAR-MIS-DATOS-WINDOWS.bat` desde la carpeta nueva y selecciona la instalación anterior. Este proceso respalda y sustituye solo archivos del programa; no sobrescribe `data/` ni `.env`.
5. Si usabas el ejecutable de escritorio 5.4, abre el nuevo `WonderStudioAI-5.5-Windows.exe`: usa `%LOCALAPPDATA%\WonderStudioAI\data`, la misma ubicación de datos de la versión 5.4 empaquetada.
6. Si vas a pasar los datos de una instalación antigua por carpetas a la aplicación EXE, ejecuta `MIGRAR-DATOS-A-ESCRITORIO-WINDOWS.bat` desde la versión 5.5 antes de abrirla. Solo funciona cuando el destino aún no contiene una base de datos; si ya existen datos allí, exporta/importa respaldos ZIP por cuenta en la interfaz.
7. Guarda también un respaldo ZIP fuera de la computadora.

No modifiques manualmente la base `wonder.db` ni muevas archivos internos de `uploads/`. La carpeta de diseños `.wonder.json` es una copia de trabajo, no sustituye el almacenamiento SQLite.
