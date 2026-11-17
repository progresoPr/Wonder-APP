"""Pruebas de integración HTTP — ejecutar: python -m unittest discover -s tests -v"""
import base64
import contextlib
import http.cookiejar
import io
import json
import os
import pathlib
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request
import uuid
import zipfile

ROOT=pathlib.Path(__file__).resolve().parents[1]
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/uX0AAAAASUVORK5CYII=')

def free_port():
 with socket.socket() as s:s.bind(('127.0.0.1',0));return s.getsockname()[1]

class WonderAPITest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory(prefix='wonder-studio-tests-')
  cls.port=free_port()
  cls.base=f'http://127.0.0.1:{cls.port}'
  cls.env={**os.environ,'WS_PORT':str(cls.port),'WS_DATA_DIR':cls.temp.name,'WS_HOST':'127.0.0.1','OPENAI_API_KEY':''}
  cls.proc=subprocess.Popen([sys.executable,str(ROOT/'server.py')],env=cls.env,stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
  for i in range(60):
   try:
    urllib.request.urlopen(cls.base+'/api/health',timeout=1).close();break
   except Exception:time.sleep(.1)
  else:raise RuntimeError('No pudo iniciar servidor de pruebas')
 @classmethod
 def tearDownClass(cls):
  cls.proc.terminate()
  with contextlib.suppress(Exception):cls.proc.wait(timeout=4)
  cls.temp.cleanup()
 def client(self):
  return Client(self.base)
 def register(self,client):
  r=client.send('POST','/api/register',{'name':'Usuario prueba','email':str(uuid.uuid4())[:8]+'@example.com','password':'SecurePass1234!'},expect=200)
  client.csrf=r['csrf'];return r
 def test_health(self):
  self.assertEqual(self.client().send('GET','/api/health')['storage'],'sqlite')
 def test_users_are_separated_and_private_files(self):
  owner=self.client();self.register(owner)
  other=self.client();self.register(other)
  pid=uuid.uuid4().hex;aid=uuid.uuid4().hex
  owner.send('PUT','/api/records/projects/'+pid,{'id':pid,'name':'Privado','description':'test'},expect=200)
  owner.send('PUT','/api/records/assets/'+aid,{'id':aid,'project':pid,'name':'logo.png','type':'image/png','blobType':'image/png','blob':base64.b64encode(PNG).decode()},expect=200)
  self.assertEqual(len(owner.send('GET','/api/records/projects')['items']),1)
  self.assertEqual(other.send('GET','/api/records/projects')['items'],[])
  self.assertEqual(owner.get_raw('/api/assets/'+aid+'/file')[0],200)
  self.assertEqual(other.get_raw('/api/assets/'+aid+'/file')[0],404)
  self.assertEqual(other.send('PUT','/api/records/designs/'+uuid.uuid4().hex,{'id':uuid.uuid4().hex,'project':pid,'layers':[]},expect=400).get('error') is not None,True)
 def test_saved_design_versions_and_restore(self):
  c=self.client();self.register(c)
  p=uuid.uuid4().hex;d=uuid.uuid4().hex
  c.send('PUT','/api/records/projects/'+p,{'id':p,'name':'Prueba'},expect=200)
  c.send('PUT','/api/records/designs/'+d,{'id':d,'project':p,'name':'original','layers':[]},expect=200)
  c.send('PUT','/api/records/designs/'+d,{'id':d,'project':p,'name':'editado','layers':[{'text':'Hola'}]},expect=200)
  versions=c.send('GET','/api/revisions/'+d)['items']
  self.assertGreaterEqual(len(versions),1)
  restored=c.send('POST','/api/revisions/'+d+'/restore',{'revision_id':versions[0]['id']},expect=200)
  self.assertEqual(restored['design']['name'],'original')
  self.assertEqual(len(c.send('GET','/api/records/designs')['items']),1)
 def test_rejects_bad_uploads_and_csrf(self):
  c=self.client();self.register(c);p=uuid.uuid4().hex
  self.assertEqual(c.send('PUT','/api/records/projects/'+p,{'id':p,'name':'Unprotected'},csrf='wrong',expect=403)['error'].startswith('Token'),True)
  c.send('PUT','/api/records/projects/'+p,{'id':p,'name':'Protected'},expect=200)
  a=uuid.uuid4().hex
  bad={'id':a,'project':p,'name':'fake.png','blobType':'image/png','blob':base64.b64encode(b'Not a PNG').decode()}
  self.assertEqual(c.send('PUT','/api/records/assets/'+a,bad,expect=400)['error'],'PNG inválido')
  svg=b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
  bad.update(name='danger.svg',blobType='image/svg+xml',blob=base64.b64encode(svg).decode())
  self.assertIn('SVG',c.send('PUT','/api/records/assets/'+a,bad,expect=400)['error'])
 def test_portable_zip_export_import_and_isolation(self):
  c=self.client();self.register(c)
  pid=uuid.uuid4().hex;aid=uuid.uuid4().hex
  c.send('PUT','/api/records/projects/'+pid,{'id':pid,'name':'Marca'},expect=200)
  c.send('PUT','/api/records/assets/'+aid,{'id':aid,'project':pid,'name':'marca.png','blobType':'image/png','blob':base64.b64encode(PNG).decode()},expect=200)
  status,payload=c.get_raw('/api/backup/archive')
  self.assertEqual(status,200)
  with zipfile.ZipFile(io.BytesIO(payload)) as z:
   manifest=json.loads(z.read('manifest.json'))
   self.assertEqual(manifest['format'],'wonder-studio-ai-archive')
   self.assertEqual(z.read('assets/'+aid),PNG)
  c2=self.client();self.register(c2)
  self.assertEqual(c2.send('GET','/api/records/projects')['items'],[])
  result=c2.send_bytes('POST','/api/backup/archive',payload,expect=200)
  self.assertEqual(result['count'],2)
  self.assertEqual(c2.send('GET','/api/records/projects')['items'][0]['name'],'Marca')
  self.assertEqual(c2.get_raw('/api/assets/'+aid+'/file')[1],PNG)
 def test_custom_categories_and_backup_roundtrip(self):
  """Las categorías nuevas se guardan por proyecto y viajan con el respaldo ZIP."""
  owner=self.client();self.register(owner)
  project_id=uuid.uuid4().hex;asset_id=uuid.uuid4().hex;custom_id='custom_'+uuid.uuid4().hex
  categories=[{'id':custom_id,'name':'Promociones','color':'#f27c69','keywords':['promo','descuento']}]
  project={'id':project_id,'name':'Marca v5.1','customCategories':categories}
  owner.send('PUT','/api/records/projects/'+project_id,project,expect=200)
  owner.send('PUT','/api/records/assets/'+asset_id,{
   'id':asset_id,'project':project_id,'name':'promo.png','kind':custom_id,
   'tags':['campaña'],'blobType':'image/png','blob':base64.b64encode(PNG).decode()
  },expect=200)
  saved=owner.send('GET','/api/records/projects')['items'][0]
  self.assertEqual(saved['customCategories'][0]['name'],'Promociones')
  archive_code,archive=owner.get_raw('/api/backup/archive');self.assertEqual(archive_code,200)
  with zipfile.ZipFile(io.BytesIO(archive)) as z:
   manifest=json.loads(z.read('manifest.json'))
   self.assertEqual(manifest['projects'][0]['customCategories'][0]['keywords'],['promo','descuento'])
  new=self.client();self.register(new)
  new.send_bytes('POST','/api/backup/archive',archive,expect=200)
  restored=new.send('GET','/api/records/projects')['items'][0]
  file_=new.send('GET','/api/records/assets')['items'][0]
  self.assertEqual(restored['customCategories'][0]['id'],custom_id)
  self.assertEqual(file_['kind'],custom_id)
  self.assertEqual(file_['tags'],['campaña'])
  # Renombrar la categoría no exige actualizar todos los archivos: IDs estables.
  restored['customCategories'][0]['name']='Campañas';new.send('PUT','/api/records/projects/'+project_id,restored,expect=200)
  self.assertEqual(new.send('GET','/api/records/assets')['items'][0]['kind'],custom_id)
 def test_folder_paths_and_manual_category_persist_in_zip(self):
  c=self.client();self.register(c)
  pid=uuid.uuid4().hex;aid=uuid.uuid4().hex
  cid='custom_'+uuid.uuid4().hex
  c.send('PUT','/api/records/projects/'+pid,{
   'id':pid,'name':'Agencia','customCategories':[{'id':cid,'name':'Fotografías de productos','color':'#6688cc','keywords':['foto']}]
  },expect=200)
  c.send('PUT','/api/records/assets/'+aid,{
   'id':aid,'project':pid,'name':'producto.png','kind':cid,
   'folderPath':'Campañas/2026/Fotografías','relativePath':'Campañas/2026/Fotografías/producto.png',
   'tags':['lanzamiento'], 'blobType':'image/png','blob':base64.b64encode(PNG).decode()
  },expect=200)
  # Close/reopen simulated by requesting fresh HTTP records, not JS in-memory state.
  saved=c.send('GET','/api/records/assets')['items'][0]
  self.assertEqual(saved['folderPath'],'Campañas/2026/Fotografías')
  self.assertEqual(saved['kind'],cid)
  code,archive=c.get_raw('/api/backup/archive');self.assertEqual(code,200)
  imported=self.client();self.register(imported)
  imported.send_bytes('POST','/api/backup/archive',archive,expect=200)
  restored=imported.send('GET','/api/records/assets')['items'][0]
  self.assertEqual(restored['relativePath'],'Campañas/2026/Fotografías/producto.png')
  self.assertEqual(restored['kind'],cid)
  self.assertEqual(restored['tags'],['lanzamiento'])
  self.assertEqual(imported.get_raw('/api/assets/'+aid+'/file')[1],PNG)
 def test_session_logout_and_login(self):
  c=self.client();response=self.register(c)
  self.assertIsNotNone(c.send('GET','/api/session')['user'])
  c.send('POST','/api/logout',{},expect=200)
  self.assertIsNone(c.send('GET','/api/session')['user'])
  again=c.send('POST','/api/login',{'email':response['user']['email'],'password':'SecurePass1234!'},expect=200)
  self.assertEqual(again['user']['user_id'],response['user']['user_id'])
 def test_backup_contains_database(self):
  c=self.client();self.register(c)
  output=subprocess.check_output([sys.executable,str(ROOT/'server.py'),'--backup'],env=self.env,text=True).strip()
  self.assertTrue(pathlib.Path(output).is_file())
  with zipfile.ZipFile(output) as z:self.assertIn('wonder.db',z.namelist())

class Client:
 def __init__(self,base):
  self.base=base;self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()));self.csrf=None
 def send_bytes(self,method,path,body,expect=200):
  req=urllib.request.Request(self.base+path,data=body,headers={'Content-Type':'application/zip','X-CSRF-Token':self.csrf},method=method)
  try:r=self.opener.open(req,timeout=15);code=r.status;data=r.read()
  except urllib.error.HTTPError as e:code=e.code;data=e.read()
  assert code==expect,(code,data[:100]);return json.loads(data)
 def get_raw(self,path):
  try:
   resp=self.opener.open(self.base+path,timeout=5)
   return resp.status,resp.read()
  except urllib.error.HTTPError as e:return e.code,e.read()
 def send(self,method,path,obj=None,expect=200,csrf=None):
  body=None if obj is None else json.dumps(obj).encode()
  headers={}
  if body is not None:headers['Content-Type']='application/json'
  if method in ('POST','PUT','DELETE') and self.csrf is not None and not path.endswith(('login','register')):
   headers['X-CSRF-Token']=self.csrf if csrf is None else csrf
  req=urllib.request.Request(self.base+path,data=body,headers=headers,method=method)
  try:
   resp=self.opener.open(req,timeout=10);status=resp.status;data=resp.read()
  except urllib.error.HTTPError as e:status=e.code;data=e.read()
  assert status==expect,(method,path,status,data)
  return json.loads(data)

if __name__=='__main__':unittest.main()
