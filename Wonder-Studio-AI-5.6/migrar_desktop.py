#!/usr/bin/env python3
"""Importador de cuentas y recursos v5.0-5.3 a datos del EXE Windows.
Nunca sobrescribe una DB de escritorio existente, ni borra los originales.
"""
from pathlib import Path
import argparse
import datetime as dt
import os
import shutil
import sqlite3
import tempfile
import zipfile
from contextlib import closing
from actualizar_5_5 import choose_directory, configured_data_path, running

def migrate(source, destination=None):
    source=Path(source).resolve()
    old_dir,config=configured_data_path(source)
    old_db=old_dir/'wonder.db'
    if not old_db.is_file():raise RuntimeError('No se encontró wonder.db en la carpeta elegida. No se modificó nada.')
    if running(config.get('WS_PORT','8000')):raise RuntimeError('Cierra Wonder anterior antes de migrar.')
    if destination is None:
        base=Path(os.environ.get('LOCALAPPDATA',Path.home()/'AppData'/'Local'))
        destination=base/'WonderStudioAI'/'data'
    destination=Path(destination).resolve()
    if (destination/'wonder.db').exists():
        raise RuntimeError('El escritorio YA tiene una base de datos. No se sobrescribirá. Usa respaldo ZIP por cuenta para fusionar.')
    if destination==old_dir:raise RuntimeError('Origen y destino son iguales')
    destination.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='wonder-migracion-') as work:
        temp_db=Path(work)/'wonder.db'
        with closing(sqlite3.connect(f'file:{old_db.as_posix()}?mode=ro',uri=True)) as src, closing(sqlite3.connect(temp_db)) as dst:
            src.backup(dst)
        with sqlite3.connect(temp_db) as c:
            if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RuntimeError('DB original inconsistente. No se migra.')
            count=c.execute('SELECT count(*) FROM records').fetchone()[0]
        uploads=old_dir/'uploads'
        backup=source.parent/('Wonder-ORIGINAL-ANTES-ESCRITORIO-'+dt.datetime.now().strftime('%Y%m%d-%H%M%S')+'.zip')
        with zipfile.ZipFile(backup,'w',zipfile.ZIP_DEFLATED) as z:
            z.write(temp_db,'wonder.db')
            if uploads.exists():
                for f in uploads.rglob('*'):
                    if f.is_file():z.write(f,'uploads/'+f.relative_to(uploads).as_posix())
        with zipfile.ZipFile(backup) as z:
            if z.testzip():raise RuntimeError('Respaldo incorrecto. No se migra.')
        if uploads.exists():shutil.copytree(uploads,destination/'uploads',dirs_exist_ok=True)
        shutil.copy2(temp_db,destination/'wonder.db')
        print('MIGRACIÓN CORRECTA:',count,'registros; destino:',destination)
        print('Original intacto:',old_dir,'\nRespaldo:',backup)
        print('Tu contraseña y las cuentas se conservaron. Debes iniciar sesión de nuevo.')
        return destination

def main():
    a=argparse.ArgumentParser()
    a.add_argument('--source')
    a.add_argument('--destination')
    args=a.parse_args()
    old=Path(args.source) if args.source else choose_directory()
    if old is None:raise RuntimeError('No se eligió carpeta de origen')
    migrate(old,args.destination)

if __name__=='__main__':
    try:main()
    except Exception as exc:
        print('MIGRACIÓN DETENIDA:',exc)
        raise SystemExit(1)
