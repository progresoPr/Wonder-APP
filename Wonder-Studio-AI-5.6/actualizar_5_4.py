#!/usr/bin/env python3
"""Actualizador seguro de Wonder Studio AI 5.0/5.1/5.2/5.3 → 5.4.

Nunca copia encima de data/, uploads/, wonder.db, backups/ ni .env.
El respaldo verificado se guarda FUERA de la carpeta instalada.
"""
from __future__ import annotations
import argparse
from contextlib import closing
import datetime as dt
import json
import os
import re
import shutil
import sqlite3
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

RELEASE = Path(__file__).resolve().parent
APP_FILES = (
    'index.html','app.js','auth.js','storage.js','style.css','favicon.svg',
    'server.py','desktop.py','local_ai.py',
    'INICIAR-WINDOWS.bat','INICIAR-ESCRITORIO-WINDOWS.bat','INICIAR-MAC-LINUX.sh',
    'CONSTRUIR-EXE-WINDOWS.bat','README.md','CHANGELOG.md','COMPROBACIONES.md','VERSION.txt',
    'RESTAURAR-SERVIDOR.md','ACTUALIZAR-A-5.4.md','actualizar_5_4.py',
    'ACTUALIZAR-MIS-DATOS-WINDOWS.bat','REVISAR-INICIO-WINDOWS.bat',
    'recuperar_cuenta.py','RECUPERAR-CUENTA-WINDOWS.bat',
    'ACTIVAR-INICIO-AUTOMATICO-WINDOWS.bat','DESACTIVAR-INICIO-AUTOMATICO-WINDOWS.bat',
    'MIGRAR-DATOS-A-ESCRITORIO-WINDOWS.bat','migrar_desktop.py',
    'RECUPERAR-CUENTA-ESCRITORIO-WINDOWS.bat','INSTALAR-CHAT-LOCAL-WINDOWS.bat',
)


def choose_directory():
    try:
        import tkinter
        from tkinter import filedialog
        root=tkinter.Tk()
        root.withdraw()
        root.attributes('-topmost',True)
        path=filedialog.askdirectory(title='Selecciona la carpeta de Wonder Studio AI anterior donde YA trabajaste')
        root.destroy()
        if path:return Path(path)
    except Exception:
        pass
    raw=input('Pega aquí la ruta completa de tu carpeta Wonder Studio AI anterior: ').strip().strip('"')
    return Path(raw) if raw else None

def configured_data_path(target):
    config={}
    envfile=target/'.env'
    if envfile.is_file():
        for line in envfile.read_text(encoding='utf-8-sig').splitlines():
            text=line.strip()
            if not text or text.startswith('#') or '=' not in text:continue
            key,value=text.split('=',1)
            config[key.strip()]=value.strip().strip('"\'')
    custom=config.get('WS_DATA_DIR')
    if custom:
        path=Path(os.path.expandvars(custom)).expanduser()
        if not path.is_absolute():path=target/path
        return path.resolve(),config
    return (target/'data').resolve(),config

def running(port):
    try:
        with urllib.request.urlopen(f'http://127.0.0.1:{port}/api/health',timeout=1.5) as response:
            result=json.load(response)
        return bool(result.get('ok') and result.get('storage')=='sqlite')
    except Exception:return False

def create_protected_backup(target,data_dir,dest):
    """Return counts. Snapshot DB with SQLite's online backup API to avoid WAL races."""
    database=data_dir/'wonder.db'
    if not database.is_file():raise RuntimeError('No se encontró wonder.db. Se detuvo la actualización para no perder los datos.')
    with tempfile.TemporaryDirectory(prefix='wonder54-backup-') as work:
        db_copy=Path(work)/'wonder.db'
        with closing(sqlite3.connect(f'file:{database.as_posix()}?mode=ro',uri=True)) as source, closing(sqlite3.connect(db_copy)) as output:
            source.backup(output)
        with closing(sqlite3.connect(db_copy)) as c:
            integrity=c.execute('PRAGMA integrity_check').fetchone()[0]
            if integrity!='ok':raise RuntimeError('La base de datos actual no pasó su comprobación de integridad.')
            count={name:c.execute('SELECT count(*) FROM records WHERE store=?',(name,)).fetchone()[0] for name in ('projects','assets','designs','settings')}
            count['users']=c.execute('SELECT count(*) FROM users').fetchone()[0]
            links=c.execute('SELECT user_id,file_name FROM records WHERE store=? AND file_name IS NOT NULL',('assets',)).fetchall()
        missing=[]
        for uid,fname in links:
            if not re.fullmatch(r'[a-f0-9]{32}',fname):missing.append(f'{uid}/{fname}');continue
            if not (data_dir/'uploads'/uid/fname).is_file():missing.append(f'{uid}/{fname}')
        if missing:
            raise RuntimeError(f'Se encontraron {len(missing)} recursos ya faltantes en la instalación original. La actualización se detuvo sin modificar nada: '+', '.join(missing[:3]))
        total_blobs=0
        with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as z:
            z.write(db_copy,'wonder.db')
            uploads=data_dir/'uploads'
            if uploads.is_dir():
                for f in uploads.rglob('*'):
                    if f.is_file():
                        z.write(f, 'uploads/'+f.relative_to(uploads).as_posix())
                        total_blobs+=1
            for name in APP_FILES:
                old=target/name
                if old.is_file():z.write(old,'app-anterior/'+name)
            z.writestr('MANIFIESTO-ACTUALIZACION.json',json.dumps({
                'fecha':dt.datetime.now().isoformat(),
                'origen':str(target), 'ruta_datos':str(data_dir),
                'version':'antes de 5.4', 'registros':count,'archivos':total_blobs,
                'nota':'Respaldar fuera del equipo. El archivo .env se conserva en la instalación original.'
            },ensure_ascii=False,indent=2))
        # Ensure a readable archive, not just a file that happens to exist.
        with zipfile.ZipFile(dest) as z:
            if z.testzip():raise RuntimeError('El archivo de respaldo no pasó su verificación ZIP.')
            if 'wonder.db' not in z.namelist():raise RuntimeError('Respaldo incompleto: falta wonder.db.')
        count['uploads']=total_blobs
        return count

def apply_update(target):
    if target is None:raise RuntimeError('No seleccionaste ninguna carpeta.')
    target=target.expanduser().resolve()
    if target==RELEASE:raise RuntimeError('Esta es la carpeta nueva. Selecciona tu instalación anterior con datos.')
    if not (target/'server.py').is_file() or not (target/'VERSION.txt').is_file():
        raise RuntimeError('Esta carpeta no parece ser una instalación de Wonder Studio AI. No se modificó nada.')
    old_version=(target/'VERSION.txt').read_text(encoding='utf-8-sig')
    if all(v not in old_version for v in ('5.0','5.1','5.2','5.3')):
        raise RuntimeError('Este actualizador acepta versiones 5.0, 5.1, 5.2 o 5.3; no se sobrescribirá una instalación distinta.')
    data_dir,config=configured_data_path(target)
    port=config.get('WS_PORT','8000')
    if running(port):
        raise RuntimeError(f'Hay un servidor Wonder Studio AI activo en el puerto {port}. Cierra su ventana negra antes de actualizar para proteger tus archivos.')
    for name in APP_FILES:
        if not (RELEASE/name).is_file():raise RuntimeError('El instalador está incompleto: '+name)
    stamp=dt.datetime.now().strftime('%Y%m%d-%H%M%S')
    backup_path=target.parent/f'WonderStudio-RESPALDO-ANTES-5.4-{stamp}.zip'
    if backup_path.exists():raise RuntimeError('Ya existe un archivo de respaldo con ese nombre, vuelve a intentarlo.')
    print('\n1/3 - Creando un respaldo externo de tus datos y tus archivos anteriores…',flush=True)
    try:
        count=create_protected_backup(target,data_dir,backup_path)
    except Exception:
        backup_path.unlink(missing_ok=True)
        raise
    print('  Respaldo verificado:',backup_path,flush=True)
    print('  Contenido:',', '.join(f'{name}: {number}' for name,number in count.items()),flush=True)
    print('2/3 - Copiando solo los archivos de la aplicación (nunca data/ ni .env)…',flush=True)
    # Backup previous individual application files in memory/staging for local rollback if copy fails.
    with tempfile.TemporaryDirectory(prefix='wonder54-rollback-') as rollback:
        rollback_path=Path(rollback)
        existed={}
        for name in APP_FILES:
            old=target/name
            existed[name]=old.exists()
            if old.exists():
                if not old.is_file():raise RuntimeError('No se puede reemplazar esta ruta: '+str(old))
                (rollback_path/name).parent.mkdir(parents=True,exist_ok=True)
                shutil.copy2(old,rollback_path/name)
        copied=[]
        try:
            for name in APP_FILES:
                dest=target/name
                source=RELEASE/name
                tmp=dest.with_name(dest.name+'.wonder54-new')
                shutil.copy2(source,tmp)
                os.replace(tmp,dest)
                copied.append(name)
        except Exception as e:
            for name in reversed(copied):
                dest=target/name
                if existed[name]:shutil.copy2(rollback_path/name,dest)
                else:dest.unlink(missing_ok=True)
            raise RuntimeError('Falló la copia y se restauraron los archivos anteriores. '+str(e)) from e
    print('3/3 - Verificando que los datos permanezcan en su ubicación…',flush=True)
    if not (data_dir/'wonder.db').is_file():raise RuntimeError('La base de datos dejó de estar disponible. Restaura desde: '+str(backup_path))
    print('\nACTUALIZACIÓN CORRECTA: Wonder Studio AI 5.4',flush=True)
    print('  Tus datos no fueron borrados, sustituidos ni movidos:',data_dir,flush=True)
    print('  Respaldo fuera de la aplicación:',backup_path,flush=True)
    print('  Ejecuta INICIAR-WINDOWS.bat en tu carpeta habitual:',target,flush=True)
    return backup_path

def main():
    parser=argparse.ArgumentParser(description='Actualizar Wonder Studio AI sin modificar tus datos')
    parser.add_argument('--target',help='Ruta a la carpeta actual 5.2, donde ya trabajaste')
    args=parser.parse_args()
    try:
        apply_update(Path(args.target) if args.target else choose_directory())
    except Exception as exc:
        print('\nACTUALIZACIÓN DETENIDA. Tu carpeta de datos original no se eliminó.\n'+str(exc),file=sys.stderr,flush=True)
        return 1
    return 0

if __name__=='__main__':sys.exit(main())
