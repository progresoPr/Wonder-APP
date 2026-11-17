#!/usr/bin/env python3
"""Wonder Studio AI — motor de escritorio y web local.
SQLite + archivos privados; IA opcional en Ollama/ComfyUI por loopback.
"""
from __future__ import annotations
import argparse
import base64
import datetime as dt
import hashlib
import hmac
import json
import mimetypes
import os
import re
import secrets
import shutil
import tempfile
import io
import sqlite3
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
import uuid
import zipfile
import xml.etree.ElementTree as ET
import local_ai
from http import cookies
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def load_env():
    env = ROOT / '.env'
    if not env.exists(): return
    for line in env.read_text('utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k, v = line.split('=', 1)
        if k.strip() not in os.environ:
            os.environ[k.strip()] = v.strip().strip('"').strip("'")
load_env()
DATA_DIR = Path(os.getenv('WS_DATA_DIR', str(ROOT / 'data'))).expanduser().resolve()
DATA_DIR.mkdir(parents=True, exist_ok=True)
UPLOAD_DIR = DATA_DIR / 'uploads'
BACKUP_DIR = DATA_DIR / 'backups'
UPLOAD_DIR.mkdir(exist_ok=True)
BACKUP_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / 'wonder.db'
AI_CONFIG_FILE = DATA_DIR / 'local-models.json'
AI_CONFIG_LOCK = threading.RLock() if 'threading' in globals() else None

MAX_REQUEST = 85 * 1024 * 1024
MAX_FILE = 20 * 1024 * 1024
STORES = {'projects', 'assets', 'designs', 'settings'}
STATIC = {'/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js',
          '/storage.js': 'storage.js', '/style.css': 'style.css', '/auth.js': 'auth.js',
          '/favicon.svg': 'favicon.svg', '/ui56.css':'ui56.css', '/ui56.js':'ui56.js', '/export-ui56.js':'export-ui56.js'}
DB_LOCK = threading.RLock()
AUTH_FAILURES = {}

def now(): return int(time.time())
def db_connect():
    c = sqlite3.connect(DB_PATH, timeout=30)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    c.execute('PRAGMA journal_mode=WAL')
    c.execute('PRAGMA busy_timeout=10000')
    return c

def setup_db():
    with db_connect() as c:
        c.executescript('''
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            name TEXT NOT NULL, salt TEXT NOT NULL, password_hash TEXT NOT NULL, created INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS recovery_codes (
            user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            salt TEXT NOT NULL, code_hash TEXT NOT NULL, created INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS sessions (
            token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            csrf TEXT NOT NULL, expires INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS records (
            user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            store TEXT NOT NULL, id TEXT NOT NULL, project_id TEXT,
            body TEXT NOT NULL, file_name TEXT, file_mime TEXT, file_size INTEGER DEFAULT 0,
            modified INTEGER NOT NULL, PRIMARY KEY(user_id,store,id));
          CREATE INDEX IF NOT EXISTS records_project ON records(user_id,store,project_id);
          CREATE TABLE IF NOT EXISTS revisions (
            id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            design_id TEXT NOT NULL, saved INTEGER NOT NULL, body TEXT NOT NULL);
          CREATE INDEX IF NOT EXISTS revisions_index ON revisions(user_id,design_id,saved DESC);
        ''')
setup_db()

def passwd_hash(password, salt):
    return hashlib.pbkdf2_hmac('sha256', password.encode('utf8'), bytes.fromhex(salt), 310000).hex()

def valid_password(password):
    # 8 characters are accepted; longer passwords remain allowed and recommended.
    return isinstance(password,str) and 8<=len(password)<=256

def new_recovery(conn, user_id):
    code='-'.join(secrets.token_hex(12).upper()[i:i+6] for i in range(0,24,6))
    salt=secrets.token_hex(16)
    conn.execute('''INSERT INTO recovery_codes(user_id,salt,code_hash,created) VALUES(?,?,?,?)
      ON CONFLICT(user_id) DO UPDATE SET salt=excluded.salt,code_hash=excluded.code_hash,created=excluded.created''',
      (user_id,salt,passwd_hash(code.replace('-',''),salt),now()))
    return code

def ai_available():
    # Solo Ollama en loopback: una API HTTP local, sin claves ni servicios externos.
    return local_ai.status(AI_CONFIG_FILE)['chat_ready']

def first_account_id():
    with db_connect() as c:
        r=c.execute('SELECT id FROM users ORDER BY created ASC, rowid ASC LIMIT 1').fetchone()
    return r['id'] if r else None

def parse_json(b):
    try: return json.loads(b.decode('utf-8'))
    except (UnicodeError, ValueError): raise ValueError('JSON inválido')

def valid_id(value):
    return isinstance(value, str) and bool(re.fullmatch(r'[a-zA-Z0-9_-]{1,100}', value))

def clean_content(value):
    if not isinstance(value, dict) or not valid_id(value.get('id')): raise ValueError('Registro inválido')
    if len(json.dumps(value, ensure_ascii=False)) > 120000: raise ValueError('Metadatos demasiado grandes')
    return value

def image_check(blob, mime):
    if not blob or len(blob)>MAX_FILE: raise ValueError('Archivo vacío o mayor a 20 MB')
    if mime=='image/png' and not blob.startswith(b'\x89PNG\r\n\x1a\n'): raise ValueError('PNG inválido')
    if mime=='image/jpeg' and not blob.startswith(b'\xff\xd8'): raise ValueError('JPEG inválido')
    if mime=='image/gif' and not blob.startswith((b'GIF87a', b'GIF89a')): raise ValueError('GIF inválido')
    if mime=='image/webp' and not (blob[:4]==b'RIFF' and blob[8:12]==b'WEBP'): raise ValueError('WebP inválido')
    if mime=='image/svg+xml':
        if b'<!DOCTYPE' in blob.upper() or b'<!ENTITY' in blob.upper(): raise ValueError('SVG con entidades no permitido')
        try: root=ET.fromstring(blob)
        except ET.ParseError: raise ValueError('SVG no válido')
        if root.tag.rsplit('}',1)[-1]!='svg':raise ValueError('Archivo SVG inválido')
        forbidden={'script','foreignObject','iframe','object','embed','image','audio','video','animate','set','animateMotion','animateTransform','use'}
        for el in root.iter():
            if el.tag.rsplit('}',1)[-1] in forbidden:raise ValueError('SVG con elementos no permitidos')
            for key,val in el.attrib.items():
                k=key.rsplit('}',1)[-1].lower()
                lowered=val.lower()
                if k.startswith('on') or k in ('href','src') or 'javascript:' in lowered or 'data:' in lowered or '@import' in lowered or '<' in lowered:
                    raise ValueError('SVG con referencias o código no permitido')
                if 'url(' in lowered:
                    for ref in re.findall(r'url\(\s*[\"\']?([^\)\"\']+)',lowered):
                        if not ref.strip().startswith('#'):raise ValueError('SVG con recursos externos no permitido')
            if el.tag.rsplit('}',1)[-1]=='style' and el.text and (('@import' in el.text.lower()) or 'http:' in el.text.lower() or 'https:' in el.text.lower()):
                raise ValueError('SVG con hojas de estilo externas no permitido')
    if mime in ('font/ttf','font/otf','font/woff','font/woff2','application/x-font-ttf','application/octet-stream'):
        if blob.startswith((b'\x00\x01\x00\x00',b'OTTO',b'wOFF',b'wOF2')): return
        raise ValueError('Archivo de fuente no reconocido')
    # Archivos de referencia adicionales: solo se descargan, nunca se ejecutan en el navegador.
    checks = {
        'application/pdf': blob.startswith(b'%PDF-'),
        'image/vnd.adobe.photoshop': blob.startswith(b'8BPS'),
        'video/mp4': len(blob)>12 and blob[4:8]==b'ftyp',
        'video/quicktime': len(blob)>12 and blob[4:8]==b'ftyp',
        'video/webm': blob.startswith(b'\x1a\x45\xdf\xa3'),
        'audio/mpeg': blob.startswith(b'ID3') or (len(blob)>2 and blob[0]==255 and (blob[1] & 224)==224),
        'audio/wav': blob.startswith(b'RIFF') and blob[8:12]==b'WAVE',
    }
    if mime in checks:
        if not checks[mime]: raise ValueError('Firma del archivo no coincide con su formato')
        return
    if mime not in ('image/png','image/jpeg','image/gif','image/webp','image/svg+xml'):
        raise ValueError('Tipo de archivo no permitido')

# 5.5: Copias editables adicionales en carpetas del equipo. SQLite sigue siendo la fuente principal.
def safe_filename(value):
    name = re.sub(r'[\\/:*?"<>|\x00-\x1f]', '_', str(value or 'Diseño')).strip(' .')
    name = re.sub(r'\s+', ' ', name)[:90]
    return name or 'Diseño'

def project_export_root(conn, uid, project_id):
    row=conn.execute('SELECT body FROM records WHERE user_id=? AND store=? AND id=?',(uid,'projects',project_id)).fetchone()
    if not row: raise ValueError('Proyecto inexistente')
    project=json.loads(row['body'])
    specified=str(project.get('storagePath') or '').strip()
    if specified:
        path=Path(specified).expanduser()
        if not path.is_absolute(): raise ValueError('La ruta del proyecto debe ser absoluta')
    else:
        path=Path.home()/'Documents'/'Wonder Studio AI'/safe_filename(project.get('name','Proyecto'))
    # Avoid writing to filesystem root or application folder via project settings.
    if path == Path(path.anchor) or path == ROOT or str(path).startswith(str(ROOT) + os.sep):
        raise ValueError('Elige una carpeta de trabajo fuera del directorio del programa')
    return path

def ensure_project_export(conn,uid,project):
    # Only filesystem changes for a confirmed project belonging to this account.
    path=project_export_root(conn,uid,project['id'])
    for folder in ('Diseños editables','Imágenes exportadas','Recursos originales','Recursos IA','Versiones'):
        (path/folder).mkdir(parents=True,exist_ok=True)
    return path

def mirror_design(conn,uid,design):
    # Safe, atomic .wonder.json: file name is stable per design id; avoids deleting renamed files.
    project_id=design.get('project')
    if not valid_id(project_id):return
    root=project_export_root(conn,uid,project_id)
    target=root/'Diseños editables'
    target.mkdir(parents=True,exist_ok=True)
    created=design.get('created',int(time.time()*1000))
    try:stamp=dt.datetime.fromtimestamp(float(created)/1000).strftime('%Y-%m-%d')
    except (ValueError,TypeError,OverflowError):stamp=dt.datetime.today().strftime('%Y-%m-%d')
    filename=f'{stamp} - {safe_filename(design.get("name"))} - {design["id"][:8]}.wonder.json'
    path=target/filename
    temp=target/(filename+'.tmp')
    temp.write_text(json.dumps(design,ensure_ascii=False,indent=2),encoding='utf-8')
    os.replace(temp,path)
    return path

def store_record(conn, user_id, store, record):
    """Call within a database transaction. Returns old file path, if replaced."""
    record = dict(record)
    if store not in STORES: raise ValueError('Colección inválida')
    rid = record.get('id')
    if not valid_id(rid): raise ValueError('ID inválido')
    pid = rid if store=='projects' else record.get('project')
    if store in ('assets','designs'):
        if not valid_id(pid): raise ValueError('Proyecto no válido')
        exists = conn.execute('SELECT 1 FROM records WHERE user_id=? AND store=? AND id=?', (user_id,'projects',pid)).fetchone()
        if not exists: raise ValueError('El proyecto no existe o no te pertenece')
    old = conn.execute('SELECT file_name,file_mime,file_size,body FROM records WHERE user_id=? AND store=? AND id=?', (user_id,store,rid)).fetchone()
    filename = old['file_name'] if old else None
    mime = old['file_mime'] if old else None
    file_size = old['file_size'] if old else 0
    if store=='assets' and isinstance(record.get('blob'),str):
        b64 = record.pop('blob')
        # Only the client upload uses blob as base64, never stored within SQLite
        try: binary = base64.b64decode(b64, validate=True)
        except Exception: raise ValueError('Archivo Base64 no válido')
        mime = record.pop('blobType', None) or record.get('type') or 'application/octet-stream'
        image_check(binary,mime)
        newfile = uuid.uuid4().hex
        target_dir=UPLOAD_DIR/user_id
        target_dir.mkdir(mode=0o700, exist_ok=True)
        temp=target_dir/(newfile+'.tmp')
        temp.write_bytes(binary)
        os.replace(temp,target_dir/newfile)
        filename=newfile
        file_size=len(binary)
    record.pop('blobType',None)
    record.pop('data',None)
    if store=='assets':
        record['size']=file_size
        record['type']=mime or record.get('type') or 'application/octet-stream'
    clean_content(record)
    if store=='designs' and old and old['body'] != json.dumps(record,ensure_ascii=False,separators=(',',':')):
        last=conn.execute('SELECT saved FROM revisions WHERE user_id=? AND design_id=? ORDER BY saved DESC LIMIT 1',(user_id,rid)).fetchone()
        if not last or now()-last['saved']>=15:
            conn.execute('INSERT INTO revisions(id,user_id,design_id,saved,body) VALUES(?,?,?,?,?)',
                         (uuid.uuid4().hex,user_id,rid,now(),old['body']))
            conn.execute('DELETE FROM revisions WHERE id IN (SELECT id FROM revisions WHERE user_id=? AND design_id=? ORDER BY saved DESC LIMIT -1 OFFSET 50)',(user_id,rid))
    conn.execute('''INSERT INTO records(user_id,store,id,project_id,body,file_name,file_mime,file_size,modified)
            VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,store,id) DO UPDATE SET
            project_id=excluded.project_id,body=excluded.body,file_name=excluded.file_name,
            file_mime=excluded.file_mime,file_size=excluded.file_size,modified=excluded.modified''',
            (user_id,store,rid,pid,json.dumps(record,ensure_ascii=False,separators=(',',':')),filename,mime,file_size,now()))
    if store=='projects':
        # Ensure the project folder is actually available; changing location never deletes old files.
        ensure_project_export(conn,user_id,record)
    if store=='designs':
        mirror_design(conn,user_id,record)
    if store=='assets' and filename:
        # Human-readable copy in the project's working folder. SQLite/uploads stay canonical.
        try:
            root=project_export_root(conn,user_id,pid)
            destdir=root/('Recursos IA' if record.get('origin') in ('ai','generated') else 'Recursos originales')
            destdir.mkdir(parents=True,exist_ok=True)
            date_value=dt.datetime.fromtimestamp(float(record.get('created',time.time()*1000))/1000).strftime('%Y-%m-%d')
            outfile=destdir/f'{date_value} - {safe_filename(record.get("name","recurso"))} - {rid[:8]}'
            if not outfile.exists():shutil.copy2(UPLOAD_DIR/user_id/filename,outfile)
        except (OSError,ValueError,OverflowError) as exc:
            # Asset remains safely stored in canonical uploads; disk mirror is secondary.
            print('Aviso: copia de recurso en carpeta del proyecto no disponible:',exc,flush=True)
    return old['file_name'] if old and old['file_name']!=filename else None

def delete_record(conn,uid,store,rid):
    if store not in STORES or not valid_id(rid): raise ValueError('Registro inválido')
    rows=conn.execute('SELECT store,id,file_name FROM records WHERE user_id=? AND store=? AND id=?',(uid,store,rid)).fetchall()
    if store=='projects':
        rows += conn.execute('SELECT store,id,file_name FROM records WHERE user_id=? AND project_id=? AND store IN (\'designs\',\'assets\',\'settings\')',(uid,rid)).fetchall()
    for row in rows:
        conn.execute('DELETE FROM records WHERE user_id=? AND store=? AND id=?',(uid,row['store'],row['id']))
        if row['store']=='designs': conn.execute('DELETE FROM revisions WHERE user_id=? AND design_id=?',(uid,row['id']))
    return [row['file_name'] for row in rows if row['file_name']]

def cleanup_paths(uid, names):
    for name in names:
        if not re.fullmatch(r'[a-f0-9]{32}',name): continue
        try: (UPLOAD_DIR/uid/name).unlink(missing_ok=True)
        except OSError: pass

def query_records(conn,uid,store):
    rows=conn.execute('SELECT body,file_size FROM records WHERE user_id=? AND store=? ORDER BY modified ASC',(uid,store)).fetchall()
    return [json.loads(r['body']) for r in rows]

def ai_project_context(conn,uid,pid):
    row=conn.execute('SELECT body FROM records WHERE user_id=? AND store=? AND id=?',(uid,'projects',pid)).fetchone()
    if not row: raise ValueError('Proyecto no disponible')
    project=json.loads(row['body'])
    resources=query_records(conn,uid,'assets')
    resources=[x for x in resources if x.get('project')==pid]
    inventory=[]
    category_names={x.get('id'):x.get('name','') for x in project.get('customCategories',[]) if isinstance(x,dict)}
    for a in resources[:100]:
        inventory.append({'id':a['id'],'nombre':a.get('name',''), 'tipo':category_names.get(a.get('kind'),a.get('kind','General')),
                          'oficial':bool(a.get('logo')), 'revisado':a.get('reviewStatus')=='approved',
                          'colores':(a.get('meta') or {}).get('palette',[])[:5], 'etiquetas':a.get('tags',[])[:10]})
    return project,inventory

class Handler(BaseHTTPRequestHandler):
    server_version='WonderStudio/1.0'
    protocol_version='HTTP/1.1'
    def log_message(self,fmt,*args):
        print('%s - %s' % (self.address_string(),fmt%args),flush=True)
    def send_bytes(self, status, raw, mimetype='application/json; charset=utf-8', extra=None):
        self.send_response(status)
        for k,v in {'Content-Type':mimetype,'Content-Length':str(len(raw)),
              'X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY',
              'Referrer-Policy':'no-referrer','Cache-Control':'no-store',
              'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'"}.items(): self.send_header(k,v)
        for k,v in extra or []: self.send_header(k,v)
        self.end_headers()
        if self.command!='HEAD': self.wfile.write(raw)
    def response(self,status,data,extra=None):
        self.send_bytes(status,json.dumps(data,ensure_ascii=False).encode('utf8'),extra=extra)
    def fail(self,status,message): self.response(status,{'error':str(message)})
    def get_cookie(self):
        jar=cookies.SimpleCookie()
        try: jar.load(self.headers.get('Cookie',''))
        except cookies.CookieError: pass
        return jar['wsa_session'].value if 'wsa_session' in jar else None
    def auth(self):
        token=self.get_cookie()
        if not token: return None
        with db_connect() as c:
            row=c.execute('''SELECT sessions.user_id,sessions.csrf,users.name,users.email
               FROM sessions JOIN users ON sessions.user_id=users.id
               WHERE token_hash=? AND expires>?''',(hashlib.sha256(token.encode()).hexdigest(),now())).fetchone()
        return dict(row) if row else None
    def require(self,mutating=False):
        user=self.auth()
        if not user: self.fail(401,'Inicia sesión para continuar'); return None
        if mutating and self.headers.get('X-CSRF-Token')!=user['csrf']:
            self.fail(403,'Token de seguridad inválido. Recarga la página.');return None
        return user
    def read_body(self):
        try: size=int(self.headers.get('Content-Length','0'))
        except ValueError: raise ValueError('Longitud inválida')
        if size<0 or size>MAX_REQUEST: raise ValueError('La solicitud supera el tamaño máximo de 85 MB')
        return parse_json(self.rfile.read(size))
    def check_origin(self):
        origin=self.headers.get('Origin','')
        if origin:
            expected=f"{'https' if self.headers.get('X-Forwarded-Proto')=='https' else 'http'}://{self.headers.get('Host','')}"
            if origin!=expected:
                self.fail(403,'Origen no autorizado');return False
        return True
    def valid_local_host(self):
        host=self.headers.get('Host','').split(':')[0].strip('[]').lower()
        if host not in ('127.0.0.1','localhost','::1'):
            self.fail(403,'Solo se permite acceso desde esta computadora');return False
        return True
    def do_HEAD(self): self.do_GET()
    def do_GET(self):
        if not self.valid_local_host():return
        path=urllib.parse.urlparse(self.path).path
        if path in STATIC:
            dest=ROOT/STATIC[path]
            if not dest.is_file(): self.fail(404,'Archivo no encontrado');return
            typ=mimetypes.guess_type(dest.name)[0] or 'application/octet-stream'
            if dest.suffix=='.js': typ='text/javascript; charset=utf-8'
            if dest.suffix=='.html': typ='text/html; charset=utf-8'
            self.send_bytes(200,dest.read_bytes(),typ);return
        if path=='/api/health': self.response(200,{'ok':True,'version':'5.6','storage':'sqlite','local':True});return
        if path=='/api/session':
            user=self.auth()
            self.response(200,{'user':({k:user[k] for k in ('user_id','name','email')} if user else None),
                               'csrf':(user['csrf'] if user else None),'ai_enabled':ai_available(), 'local_only':True})
            return
        user=self.require()
        if not user:return
        uid=user['user_id']
        if path=='/api/ai/config':
            settings=local_ai.status(AI_CONFIG_FILE)
            settings['can_manage']=uid==first_account_id()
            self.response(200,settings)
            return
        if path=='/api/backup/archive':
            # Portable per-user backup. Never includes other users or account secrets.
            with db_connect() as c:
                manifest={'format':'wonder-studio-ai-archive','schema':2,
                          'created':dt.datetime.now(dt.timezone.utc).isoformat()}
                for st in ('projects','assets','designs','settings'):
                    manifest[st]=query_records(c,uid,st)
                blobrows=c.execute('SELECT id,file_name FROM records WHERE user_id=? AND store=? AND file_name IS NOT NULL',(uid,'assets')).fetchall()
            with tempfile.SpooledTemporaryFile(max_size=6*1024*1024) as f:
                with zipfile.ZipFile(f,'w',compression=zipfile.ZIP_DEFLATED) as z:
                    z.writestr('manifest.json',json.dumps(manifest,ensure_ascii=False))
                    for r in blobrows:
                        if not re.fullmatch(r'[a-f0-9]{32}',r['file_name']):continue
                        pathfile=UPLOAD_DIR/uid/r['file_name']
                        if pathfile.is_file():z.write(pathfile,'assets/'+r['id'])
                f.seek(0,2);size=f.tell();f.seek(0)
                name=f'wonder-studio-respaldo-{dt.datetime.now().strftime("%Y-%m-%d")}.zip'
                self.send_response(200)
                for key,value in [('Content-Type','application/zip'),('Content-Length',str(size)),('Content-Disposition',f'attachment; filename="{name}"'),
                                  ('Cache-Control','no-store'),('X-Content-Type-Options','nosniff')]:self.send_header(key,value)
                self.end_headers()
                if self.command!='HEAD':
                    while True:
                        chunk=f.read(1024*1024)
                        if not chunk:break
                        self.wfile.write(chunk)
            return
        if path=='/api/folder-export':
            params=urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            project_id=(params.get('project_id') or [''])[0]
            folder=(params.get('folder') or [''])[0]
            category=(params.get('category') or [''])[0]
            if not valid_id(project_id):self.fail(400,'Proyecto inválido');return
            with db_connect() as c:
                row=c.execute('SELECT 1 FROM records WHERE user_id=? AND store=? AND id=?',(uid,'projects',project_id)).fetchone()
                if not row:self.fail(404,'Proyecto no encontrado');return
                rows=c.execute('SELECT body,file_name FROM records WHERE user_id=? AND store=? AND project_id=?',(uid,'assets',project_id)).fetchall()
            with tempfile.SpooledTemporaryFile(max_size=6*1024*1024) as temp:
                count=0
                with zipfile.ZipFile(temp,'w',compression=zipfile.ZIP_DEFLATED) as z:
                    for r in rows:
                        item=json.loads(r['body'])
                        if category and item.get('kind')!=category:continue
                        if folder and not (str(item.get('folderPath') or '')==folder or str(item.get('folderPath') or '').startswith(folder+'/')):continue
                        f=r['file_name']
                        if not f or not re.fullmatch(r'[a-f0-9]{32}',f):continue
                        source=UPLOAD_DIR/uid/f
                        if not source.is_file():continue
                        filename=str(item.get('name') or 'archivo')
                        filename=safe_filename(filename)
                        z.write(source,f'{count+1:04d} - {filename}')
                        count+=1
                temp.seek(0);blob=temp.read()
            self.send_bytes(200,blob,'application/zip',[('Content-Disposition','attachment; filename="carpeta-wonder.zip"')]);return
        match=re.fullmatch(r'/api/records/(projects|assets|designs|settings)',path)
        if match:
            with db_connect() as c: data=query_records(c,uid,match.group(1))
            self.response(200,{'items':data});return
        match=re.fullmatch(r'/api/assets/([a-zA-Z0-9_-]{1,100})/file',path)
        if match:
            with db_connect() as c:
                row=c.execute('SELECT file_name,file_mime,body FROM records WHERE user_id=? AND store=? AND id=?',(uid,'assets',match.group(1))).fetchone()
            if not row or not row['file_name']: self.fail(404,'Archivo no encontrado');return
            if not re.fullmatch(r'[a-f0-9]{32}',row['file_name']):self.fail(404,'Archivo inválido');return
            pathfile=UPLOAD_DIR/uid/row['file_name']
            try: blob=pathfile.read_bytes()
            except OSError: self.fail(404,'Archivo perdido');return
            mime=row['file_mime'] or 'application/octet-stream'
            extras=[]
            if mime not in ('image/png','image/jpeg','image/gif','image/webp','image/svg+xml'):
                original=json.loads(row['body']).get('name','archivo')
                safe=re.sub(r'[^a-zA-Z0-9_.-]','_',str(original))[:120]
                extras=[('Content-Disposition',f'attachment; filename="{safe}"')]
            self.send_bytes(200,blob,mime,extras);return
        match=re.fullmatch(r'/api/revisions/([a-zA-Z0-9_-]{1,100})',path)
        if match:
            with db_connect() as c:
                okay=c.execute('SELECT 1 FROM records WHERE user_id=? AND store=? AND id=?',(uid,'designs',match.group(1))).fetchone()
                if not okay:self.fail(404,'Diseño no disponible');return
                result=[{'id':r['id'],'saved':r['saved']} for r in c.execute('SELECT id,saved FROM revisions WHERE user_id=? AND design_id=? ORDER BY saved DESC LIMIT 50',(uid,match.group(1)))]
            self.response(200,{'items':result});return
        self.fail(404,'Ruta no disponible')
    def do_POST(self): self.write_method('POST')
    def do_PUT(self): self.write_method('PUT')
    def do_DELETE(self): self.write_method('DELETE')
    def write_method(self,method):
        if not self.valid_local_host() or not self.check_origin(): return
        path=urllib.parse.urlparse(self.path).path
        try:
            if path=='/api/recovery/reset' and method=='POST':
                attempts=[x for x in AUTH_FAILURES.get(self.client_address[0],[]) if now()-x<900]
                if len(attempts)>=12:self.fail(429,'Demasiados intentos. Intenta después.');return
                payload=self.read_body()
                email=str(payload.get('email','')).strip().lower()
                code=re.sub(r'[\s-]','',str(payload.get('code',''))).upper()
                password=str(payload.get('new_password',''))
                if not valid_password(password):raise ValueError('La nueva contraseña debe tener al menos 8 caracteres')
                if len(code)!=24 or not re.fullmatch(r'[0-9A-F]{24}',code):
                    AUTH_FAILURES[self.client_address[0]]=attempts+[now()]
                    self.fail(400,'Código de recuperación incorrecto');return
                with DB_LOCK,db_connect() as c:
                    row=c.execute('''SELECT users.id,recovery_codes.salt,recovery_codes.code_hash
                            FROM users LEFT JOIN recovery_codes ON recovery_codes.user_id=users.id
                            WHERE users.email=?''',(email,)).fetchone()
                    if not row or not row['salt'] or not hmac.compare_digest(passwd_hash(code,row['salt']),row['code_hash']):
                        AUTH_FAILURES[self.client_address[0]]=attempts+[now()]
                        self.fail(400,'Correo o código de recuperación incorrecto. Si tu cuenta es anterior, usa RECUPERAR-CUENTA-WINDOWS.bat.');return
                    salt=secrets.token_hex(16)
                    c.execute('UPDATE users SET salt=?,password_hash=? WHERE id=?',(salt,passwd_hash(password,salt),row['id']))
                    c.execute('DELETE FROM sessions WHERE user_id=?',(row['id'],))
                    next_code=new_recovery(c,row['id'])
                AUTH_FAILURES.pop(self.client_address[0],None)
                self.response(200,{'ok':True,'new_recovery_code':next_code});return
            if path in ('/api/register','/api/login') and method=='POST':
                attempts=[x for x in AUTH_FAILURES.get(self.client_address[0],[]) if now()-x<900]
                if len(attempts)>=12: self.fail(429,'Demasiados intentos. Vuelve a intentarlo después.');return
                payload=self.read_body()
                if not isinstance(payload,dict):raise ValueError('Datos inválidos')
                email=str(payload.get('email','')).strip().lower()
                password=str(payload.get('password',''))
                if not re.fullmatch(r'[^\s@]{1,100}@[^\s@]{1,120}\.[^\s@]{2,30}',email):raise ValueError('Correo electrónico inválido')
                if path=='/api/register':
                    name=str(payload.get('name','')).strip()[:80]
                    if not name or not valid_password(password): raise ValueError('Indica tu nombre y una contraseña de al menos 8 caracteres')
                    uid=uuid.uuid4().hex
                    salt=secrets.token_hex(16)
                    with DB_LOCK, db_connect() as c:
                        try:c.execute('INSERT INTO users VALUES(?,?,?,?,?,?)',(uid,email,name,salt,passwd_hash(password,salt),now()))
                        except sqlite3.IntegrityError: self.fail(409,'Este correo ya está registrado');return
                        recovery_code=new_recovery(c,uid)
                with db_connect() as c:
                    row=c.execute('SELECT * FROM users WHERE email=?',(email,)).fetchone()
                if not row or not hmac.compare_digest(passwd_hash(password,row['salt']),row['password_hash']):
                    AUTH_FAILURES[self.client_address[0]]=attempts+[now()]
                    self.fail(401,'Credenciales incorrectas');return
                AUTH_FAILURES.pop(self.client_address[0],None)
                token=secrets.token_urlsafe(40)
                csrf=secrets.token_urlsafe(32)
                remember=payload.get('remember',True) is not False
                lifetime=86400*90 if remember else 86400
                with DB_LOCK, db_connect() as c:
                    c.execute('DELETE FROM sessions WHERE expires<?',(now(),))
                    c.execute('INSERT INTO sessions VALUES(?,?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),row['id'],csrf,now()+lifetime))
                secure='; Secure' if self.headers.get('X-Forwarded-Proto')=='https' else ''
                remember_cookie=f'; Max-Age={lifetime}' if remember else ''
                cookie=f'wsa_session={token}; Path=/; HttpOnly; SameSite=Strict'+remember_cookie+secure
                answer={'ok':True,'user':{'user_id':row['id'],'name':row['name'],'email':row['email']},'csrf':csrf,'remembered':remember}
                if path=='/api/register':answer['recovery_code']=recovery_code
                self.response(200,answer,[('Set-Cookie',cookie)])
                return
            user=self.require(mutating=True)
            if not user:return
            uid=user['user_id']
            match=re.fullmatch(r'/api/project-folder/([a-zA-Z0-9_-]{1,100})/(open|location)',path)
            if match and method=='POST':
                with db_connect() as c:
                    folder=project_export_root(c,uid,match.group(1))
                    folder.mkdir(parents=True,exist_ok=True)
                if match.group(2)=='open':
                    if os.name=='nt': os.startfile(str(folder))
                    self.response(200,{'ok':True,'path':str(folder)});return
                self.response(200,{'path':str(folder)});return
            match=re.fullmatch(r'/api/design-export/([a-zA-Z0-9_-]{1,100})',path)
            if match and method=='POST':
                payload=self.read_body()
                raw=payload.get('image','')
                if not isinstance(raw,str) or len(raw)>24*1024*1024: raise ValueError('Exportación demasiado grande')
                try: content=base64.b64decode(raw,validate=True)
                except Exception:raise ValueError('Imagen no válida')
                typ=payload.get('type','png')
                if typ=='png' and not content.startswith(b'\x89PNG\r\n\x1a\n'):raise ValueError('Imagen PNG no válida')
                if typ=='jpg' and not content.startswith(b'\xff\xd8'):raise ValueError('Imagen JPG no válida')
                if typ not in ('png','jpg'):raise ValueError('Formato no permitido')
                with db_connect() as c:
                    row=c.execute('SELECT body FROM records WHERE user_id=? AND store=? AND id=?',(uid,'designs',match.group(1))).fetchone()
                    if not row:raise ValueError('Diseño no encontrado')
                    design=json.loads(row['body']);root=project_export_root(c,uid,design['project'])
                    output=root/'Imágenes exportadas';output.mkdir(parents=True,exist_ok=True)
                    date_created=dt.datetime.fromtimestamp(float(design.get('created',time.time()*1000))/1000).strftime('%Y-%m-%d')
                    dest=output/f'{date_created} - {safe_filename(design.get("name"))} - {design["id"][:8]}.{typ}'
                    tmp=dest.with_suffix('.tmp');tmp.write_bytes(content);os.replace(tmp,dest)
                self.response(200,{'ok':True,'path':str(dest)});return
            if path=='/api/recovery/regenerate' and method=='POST':
                payload=self.read_body()
                password=str(payload.get('password',''))
                with DB_LOCK,db_connect() as c:
                    row=c.execute('SELECT salt,password_hash FROM users WHERE id=?',(uid,)).fetchone()
                    if not row or not hmac.compare_digest(passwd_hash(password,row['salt']),row['password_hash']):
                        self.fail(403,'La contraseña actual es incorrecta');return
                    code=new_recovery(c,uid)
                self.response(200,{'recovery_code':code});return
            if path=='/api/ai/config' and method=='POST':
                if uid!=first_account_id():
                    self.fail(403,'Solo la primera cuenta administra los modelos locales compartidos.');return
                payload=self.read_body()
                if not isinstance(payload,dict):raise ValueError('Configuración inválida')
                local_ai.set_config(AI_CONFIG_FILE,payload)
                self.response(200,{'ok':True,**local_ai.status(AI_CONFIG_FILE)});return
            if path=='/api/ai/test' and method=='POST':
                setting=local_ai.status(AI_CONFIG_FILE)
                answer=local_ai.chat([{'role':'user','content':'Responde exactamente: CONEXION OK'}],
                                   'Responde en español.',setting['text_model'])
                self.response(200,{'ok':True,'reply':answer[:300]});return
            if path=='/api/logout' and method=='POST':
                token=self.get_cookie()
                with DB_LOCK,db_connect() as c:c.execute('DELETE FROM sessions WHERE token_hash=?',(hashlib.sha256(token.encode()).hexdigest(),))
                self.response(200,{'ok':True},[('Set-Cookie','wsa_session=; Path=/; HttpOnly; Max-Age=0; SameSite=Strict')]);return
            match=re.fullmatch(r'/api/records/(projects|assets|designs|settings)/([a-zA-Z0-9_-]{1,100})',path)
            if match and method=='PUT':
                value=self.read_body()
                if not isinstance(value,dict) or value.get('id')!=match.group(2):raise ValueError('El identificador del registro no coincide')
                with DB_LOCK,db_connect() as c: oldfile=store_record(c,uid,match.group(1),value)
                if oldfile:cleanup_paths(uid,[oldfile])
                self.response(200,{'ok':True});return
            if match and method=='DELETE':
                with DB_LOCK,db_connect() as c: oldfiles=delete_record(c,uid,match.group(1),match.group(2))
                cleanup_paths(uid,oldfiles)
                self.response(200,{'ok':True});return
            if path=='/api/backup/archive' and method=='POST':
                try: size=int(self.headers.get('Content-Length','0'))
                except ValueError: raise ValueError('Tamaño inválido')
                if size<20 or size>85*1024*1024:raise ValueError('Respaldo ZIP vacío o mayor a 85 MB')
                blob=self.rfile.read(size)
                try: z=zipfile.ZipFile(io.BytesIO(blob))
                except zipfile.BadZipFile:raise ValueError('Archivo ZIP no válido')
                with z:
                    files=z.namelist()
                    if 'manifest.json' not in files or len(files)>2500:raise ValueError('El respaldo no corresponde a Wonder Studio AI')
                    manifest_info=z.getinfo('manifest.json')
                    if manifest_info.file_size>5*1024*1024:raise ValueError('Manifiesto demasiado grande')
                    manifest=parse_json(z.read('manifest.json'))
                    if manifest.get('format')!='wonder-studio-ai-archive' or manifest.get('schema')!=2:raise ValueError('Formato de respaldo incompatible')
                    resource_names={i.filename:i for i in z.infolist()}
                    if sum(i.file_size for i in z.infolist())>512*1024*1024:raise ValueError('El respaldo excede 512 MB descomprimidos')
                    operations=[]
                    for store in ('projects','assets','designs','settings'):
                        rows=manifest.get(store,[])
                        if not isinstance(rows,list) or len(rows)>2000:raise ValueError('Recursos inválidos en respaldo')
                        for obj in rows:
                            if not isinstance(obj,dict) or not valid_id(obj.get('id')):raise ValueError('Identificador inválido en respaldo')
                            obj=dict(obj)
                            if store=='assets':
                                filename='assets/'+obj['id']
                                if filename in resource_names:
                                    if resource_names[filename].file_size>MAX_FILE:raise ValueError('Un recurso supera los 20 MB')
                                    pic=z.read(filename)
                                    obj['blobType']=obj.get('type') or 'application/octet-stream'
                                    image_check(pic,obj['blobType'])
                                    obj['blob']=base64.b64encode(pic).decode()
                                else:raise ValueError('Falta el contenido del recurso '+obj.get('name',obj['id']))
                            operations.append((store,obj))
                    with DB_LOCK,db_connect() as c:
                        for store,obj in operations:store_record(c,uid,store,obj)
                self.response(200,{'ok':True,'count':len(operations)});return
            if path=='/api/batch' and method=='POST':
                payload=self.read_body()
                ops=payload.get('operations',[]) if isinstance(payload,dict) else []
                if not isinstance(ops,list) or len(ops)>2000:raise ValueError('Lote inválido')
                files_to_remove=[]
                # Import ordered by project first; rollback DB on invalid entry.
                with DB_LOCK,db_connect() as c:
                    for op in ops:
                        store=op.get('store');kind=op.get('kind')
                        if store not in STORES:raise ValueError('Colección inválida en el lote')
                        if kind=='delete': files_to_remove+=delete_record(c,uid,store,op.get('id'))
                        else: files_to_remove.extend([x for x in [store_record(c,uid,store,op.get('value'))] if x])
                cleanup_paths(uid,files_to_remove)
                self.response(200,{'ok':True,'count':len(ops)});return
            match=re.fullmatch(r'/api/revisions/([a-zA-Z0-9_-]{1,100})/restore',path)
            if match and method=='POST':
                payload=self.read_body();rev_id=payload.get('revision_id')
                if not valid_id(rev_id):raise ValueError('Versión inválida')
                with DB_LOCK,db_connect() as c:
                    rev=c.execute('SELECT body FROM revisions WHERE user_id=? AND design_id=? AND id=?',(uid,match.group(1),rev_id)).fetchone()
                    old=c.execute('SELECT body FROM records WHERE user_id=? AND store=? AND id=?',(uid,'designs',match.group(1))).fetchone()
                    if not rev or not old:self.fail(404,'Versión no encontrada');return
                    restored=json.loads(rev['body']);restored['updated']=int(time.time()*1000)
                    # Always preserve current state before restoring, even if last save was just now.
                    c.execute('INSERT INTO revisions(id,user_id,design_id,saved,body) VALUES(?,?,?,?,?)',
                              (uuid.uuid4().hex,uid,match.group(1),now(),old['body']))
                    store_record(c,uid,'designs',restored)
                self.response(200,{'ok':True,'design':restored});return
            if path=='/api/ai/remove-bg' and method=='POST':
                payload=self.read_body();asset_id=payload.get('asset_id')
                if not valid_id(asset_id):raise ValueError('Recurso no válido')
                with db_connect() as c:
                    row=c.execute('SELECT file_name,file_mime FROM records WHERE user_id=? AND store=? AND id=?',(uid,'assets',asset_id)).fetchone()
                if not row or row['file_mime'] not in ('image/png','image/jpeg','image/webp'):raise ValueError('Solo imágenes compatibles')
                try:
                    from rembg import remove as remove_background
                except ImportError:
                    self.fail(503,'Instala el módulo local opcional rembg[cpu] para quitar fondos. No requiere clave API.');return
                binary=(UPLOAD_DIR/uid/row['file_name']).read_bytes()
                try:output=remove_background(binary)
                except Exception as exc:raise RuntimeError('El modelo local para recorte de fondo no está listo: '+str(exc)[:180])
                if len(output)>MAX_FILE:raise ValueError('Resultado demasiado grande')
                self.response(200,{'image':base64.b64encode(output).decode('ascii'),'mime':'image/png'});return
            if path=='/api/ai/edit-plan' and method=='POST':
                payload=self.read_body();pid=payload.get('project_id')
                with db_connect() as c:project,resources=ai_project_context(c,uid,pid)
                setting=local_ai.status(AI_CONFIG_FILE)
                layers=payload.get('layers',[])
                if not isinstance(layers,list) or len(layers)>120:raise ValueError('Demasiadas capas')
                inventory=[{'id':l.get('id'),'tipo':l.get('type'),'texto':str(l.get('text',''))[:140]} for l in layers if isinstance(l,dict)][:60]
                system=('Eres una IA que CONTROLA el editor. Tu salida debe ser SOLO JSON sin explicaciones. '
                        'Forma: {"acciones":[{"op":"set","id":"ID","props":{"x":25,"y":20,"w":70,"h":20,"fontSize":38,"color":"#ff0000","opacity":0.7,"rotation":0}},{"op":"add_text","text":"Promoción","fontSize":36,"x":20,"y":20}],"resumen":"..."}. '
                        'Operaciones permitidas: set, add_text, add_shape, front, back. Nunca modifiques el logo oficial. '
                        'Usa los ID de las capas que existen. Coordenadas y tamaños en porcentaje 0-100. '
                        'No inventes assets. SI no entiendes la instrucción devuelve acciones vacías. '                        'Capas: '+json.dumps(inventory,ensure_ascii=False)[:4500])
                message=str(payload.get('instruction',''))[:1600]
                if not message:raise ValueError('Instrucción vacía')
                raw=local_ai.chat([{'role':'user','content':message}],system,setting['text_model']).strip()
                if raw.startswith('```'):raw=re.sub(r'^```(?:json)?\s*|\s*```$','',raw)
                try:plan=json.loads(raw)
                except ValueError:self.fail(422,'La IA local no devolvió acciones válidas. Intenta otra instrucción.');return
                acts=plan.get('acciones',[]) if isinstance(plan,dict) else []
                if not isinstance(acts,list) or len(acts)>15:raise ValueError('Plan demasiado grande')
                allowed={'x','y','w','h','fontSize','color','text','rotation','opacity','fit','flipH','flipV','radius','strokeWidth','strokeColor','effect','align','bold','italic','underline','strike'}
                ids={l['id'] for l in inventory if l.get('id')}
                clean=[]
                for a in acts:
                    if not isinstance(a,dict) or a.get('op') not in ('set','add_text','add_shape','front','back'):continue
                    if a['op'] in ('set','front','back') and a.get('id') not in ids:continue
                    props={k:v for k,v in (a.get('props') or {}).items() if k in allowed and isinstance(v,(int,float,str,bool))}
                    clean.append({'op':a['op'],'id':a.get('id'),'props':props,'text':str(a.get('text',''))[:300]})
                self.response(200,{'actions':clean,'summary':str(plan.get('resumen',''))[:500]});return
            if path=='/api/ai/chat' and method=='POST':
                payload=self.read_body();pid=payload.get('project_id')
                with db_connect() as c:project,resources=ai_project_context(c,uid,pid)
                messages=payload.get('messages',[])
                if not isinstance(messages,list) or len(messages)>25:raise ValueError('Conversación demasiado larga')
                mode=str(payload.get('personality','both'))[:20]
                system=("Eres Wonder, directora de arte y diseñadora gráfica profesional. "
                        "Respondes en español. No digas que generaste imágenes si no lo hiciste. "
                        "No inventes personajes o logotipos oficiales. Da acciones concretas y buenas decisiones visuales. "
                        f"Perfil {mode}. Proyecto: {json.dumps(project,ensure_ascii=False)[:2000]}. "
                        f"Recursos: {json.dumps(resources,ensure_ascii=False)[:8000]}. ")
                setting=local_ai.status(AI_CONFIG_FILE)
                answer=local_ai.chat(messages,system,setting['text_model'])
                self.response(200,{'reply':answer,'engine':'ollama-local'});return
            if path=='/api/ai/analyze' and method=='POST':
                payload=self.read_body();asset_id=payload.get('asset_id')
                with db_connect() as c:
                    row=c.execute('SELECT body,file_name,file_mime,file_size FROM records WHERE user_id=? AND store=? AND id=?',
                                  (uid,'assets',asset_id)).fetchone()
                if not row or not row['file_name']:self.fail(404,'Recurso no disponible');return
                if row['file_size']>5*1024*1024:raise ValueError('Máximo 5 MB para visión local')
                if row['file_mime'] not in ('image/png','image/jpeg','image/webp','image/gif'):
                    raise ValueError('Formato no compatible con visión')
                pic=(UPLOAD_DIR/uid/row['file_name']).read_bytes()
                setting=local_ai.status(AI_CONFIG_FILE)
                analysis=local_ai.analyze(pic,row['file_mime'],setting['vision_model'])
                self.response(200,{'analysis':analysis,'engine':'ollama-local'});return
            if path=='/api/ai/image' and method=='POST':
                payload=self.read_body();pid=payload.get('project_id')
                with db_connect() as c:project,resources=ai_project_context(c,uid,pid)
                prompt=str(payload.get('prompt','')).strip()
                if not 5<=len(prompt)<=2000:raise ValueError('Describe el fondo con 5 a 2000 caracteres')
                ratio=str(payload.get('ratio','1/1'))
                setting=local_ai.status(AI_CONFIG_FILE)
                instruction=(f"Fotografía o ilustración publicitaria para {project.get('name','')}. "
                    "Sin tipografía, sin logotipos, sin letras. " +prompt)
                image=local_ai.generate(instruction,ratio,setting['image_model'])
                self.response(200,{'image':image,'prompt':prompt,'engine':'comfyui-local'});return
            self.fail(404,'Operación no disponible')
        except ValueError as e: self.fail(400,e)
        except RuntimeError as e: self.fail(503,e)
        except (BrokenPipeError,ConnectionResetError): pass
        except Exception as e:
            print('Error interno:',repr(e),flush=True)
            self.fail(500,'Error inesperado del servidor. Consulta el registro.')

def snapshot_backup():
    """Copia íntegra local de DB+archivos; mantener copias también fuera de este equipo."""
    with DB_LOCK:
        stamp=dt.datetime.now().strftime('%Y%m%d-%H%M%S')
        tmp=BACKUP_DIR/(stamp+'.sqlite')
        with db_connect() as src,sqlite3.connect(tmp) as dst:src.backup(dst)
        dest=BACKUP_DIR/(f'wonder-backup-{stamp}.zip')
        with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED) as z:
            z.write(tmp,'wonder.db')
            for f in UPLOAD_DIR.rglob('*'):
                if f.is_file() and re.fullmatch(r'[a-f0-9]{32}',f.name):
                    z.write(f,'uploads/'+str(f.relative_to(UPLOAD_DIR)))
        tmp.unlink(missing_ok=True)
        for old in sorted(BACKUP_DIR.glob('wonder-backup-*.zip'))[:-14]:old.unlink(missing_ok=True)
        return dest

def backup_loop():
    # First snapshot at startup if no recent backup; then every 24h.
    while True:
        try:
            previous=list(BACKUP_DIR.glob('wonder-backup-*.zip'))
            if not previous or time.time()-max(p.stat().st_mtime for p in previous)>23*3600:
                backup=snapshot_backup()
                print('Respaldo local creado:',backup,flush=True)
        except Exception as e:print('Error de respaldo:',e,flush=True)
        time.sleep(3600)

def main():
    parser=argparse.ArgumentParser(description='Wonder Studio AI — servidor propio con SQLite y archivos persistentes')
    parser.add_argument('--host',default=os.getenv('WS_HOST','127.0.0.1'))
    parser.add_argument('--port',type=int,default=int(os.getenv('WS_PORT','8000')))
    parser.add_argument('--backup',action='store_true',help='Crear respaldo del servidor y salir')
    parser.add_argument('--open-browser',action='store_true',help='Abrir la aplicacion cuando el servidor este listo')
    args=parser.parse_args()
    if args.backup:print(snapshot_backup());return
    if args.host not in ('127.0.0.1','localhost','::1'):
        parser.error('Versión local: el servidor solo puede escucharse en 127.0.0.1, localhost o ::1')
    threading.Thread(target=backup_loop,daemon=True).start()
    server=ThreadingHTTPServer((args.host,args.port),Handler)
    if args.open_browser:
        import webbrowser
        target_host='127.0.0.1' if args.host in ('0.0.0.0','::') else args.host
        threading.Thread(target=lambda:webbrowser.open('http://'+target_host+':'+str(args.port)+'/'),daemon=True).start()
    print(f'Wonder Studio AI 5.6 en http://{args.host}:{args.port} | datos: {DATA_DIR} | IA: {"configurada" if ai_available() else "sin configurar"}',flush=True)
    if args.host!='127.0.0.1':print('AVISO: para uso público utiliza proxy HTTPS y controles de seguridad adicionales.',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':main()
