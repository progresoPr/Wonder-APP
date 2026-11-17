"""Pruebas reales de API local con Ollama y ComfyUI simulados en loopback.
Solo se simula el modelo, no se afirma haber ejecutado pesos reales.
"""
import base64,contextlib,http.server,json,os,socket,subprocess,sys,tempfile,threading,time,unittest,urllib.request,urllib.error,uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
PNG=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/uX0AAAAASUVORK5CYII=')

class Engine(http.server.BaseHTTPRequestHandler):
 def log_message(self,*x):pass
 def send(self,d,status=200,mime='application/json'):
  if not isinstance(d,bytes):d=json.dumps(d).encode()
  self.send_response(status);self.send_header('Content-Length',str(len(d)));self.send_header('Content-Type',mime);self.end_headers();self.wfile.write(d)
 def do_GET(self):
  if self.path=='/api/tags':return self.send({'models':[{'name':'gemma3:1b'},{'name':'gemma3:4b'}]})
  if self.path=='/models/checkpoints':return self.send(['checkpoint-prueba.safetensors'])
  if self.path.startswith('/history/'):
   return self.send({self.path.split('/')[-1]:{'outputs':{'9':{'images':[{'filename':'test.png','type':'output','subfolder':''}]}},'status':{'status_str':'success'}}})
  if self.path.startswith('/view?'):return self.send(PNG,mime='image/png')
  return self.send({},404)
 def do_POST(self):
  obj=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
  if self.path=='/api/chat':
   contents=obj.get('messages',[])
   if any('images' in m for m in contents):
    return self.send({'message':{'content':json.dumps({'categoria':'Fondo','descripcion':'Imagen de prueba','etiquetas':['fondo'],'colores':['#ffffff']})}})
   return self.send({'message':{'content':'CONEXION OK' if any('CONEXION OK' in str(m.get('content','')) for m in contents) else 'Propuesta visual del modelo local'}})
  if self.path=='/prompt':
   assert obj['prompt']['4']['class_type']=='CheckpointLoaderSimple'
   return self.send({'prompt_id':'8fc578c8-60b6-4d13-9731-918d3d987261'})
  return self.send({},404)

class AILocalTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.mock=[]
  for port in (11434,8188):
   server=http.server.ThreadingHTTPServer(('127.0.0.1',port),Engine)
   thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();cls.mock.append(server)
  cls.tmp=tempfile.TemporaryDirectory()
  sock=socket.socket();sock.bind(('127.0.0.1',0));cls.port=sock.getsockname()[1];sock.close()
  cls.base=f'http://127.0.0.1:{cls.port}'
  cls.proc=subprocess.Popen([sys.executable,str(ROOT/'server.py'),'--port',str(cls.port)],
    env={**os.environ,'WS_DATA_DIR':cls.tmp.name},stdout=subprocess.DEVNULL,stderr=subprocess.STDOUT)
  for _ in range(100):
   try:urllib.request.urlopen(cls.base+'/api/health',timeout=.5).close();break
   except Exception:time.sleep(.1)
  else:raise RuntimeError('Servidor no inició')
 @classmethod
 def tearDownClass(cls):
  cls.proc.terminate()
  with contextlib.suppress(Exception):cls.proc.wait(timeout=5)
  cls.tmp.cleanup()
  for server in cls.mock:server.shutdown();server.server_close()
 def setUp(self):
  import http.cookiejar
  self.opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
  r=self.req('POST','/api/register',{'name':'Prueba','email':uuid.uuid4().hex[:10]+'@local.test','password':'12345678'})
  self.csrf=r['csrf'];self.uid=r['user']['user_id']
 def req(self,method,path,obj=None,code=200):
  raw=json.dumps(obj).encode() if obj is not None else None
  headers={'Content-Type':'application/json'}
  if hasattr(self,'csrf') and method in ('PUT','POST'):headers['X-CSRF-Token']=self.csrf
  request=urllib.request.Request(self.base+path,data=raw,headers=headers,method=method)
  try:r=self.opener.open(request,timeout=20);status=r.status;b=r.read()
  except urllib.error.HTTPError as e:status=e.code;b=e.read()
  self.assertEqual(status,code,(path,b[:300]))
  return json.loads(b)
 def test_session_and_local_models(self):
  cfg=self.req('GET','/api/ai/config')
  self.assertTrue(cfg['enabled']);self.assertTrue(cfg['image_ready'])
  self.assertIn('gemma3:1b',cfg['models'])
  self.assertIn('checkpoint-prueba.safetensors',cfg['checkpoints'])
  self.assertNotIn('api_key',cfg)
 def test_local_chat_and_generated_image(self):
  p=uuid.uuid4().hex
  self.req('PUT','/api/records/projects/'+p,{'id':p,'name':'Marca interna'})
  res=self.req('POST','/api/ai/chat',{'project_id':p,'messages':[{'role':'user','content':'Una invitación a una fiesta'}]})
  self.assertEqual(res['engine'],'ollama-local');self.assertIn('Propuesta',res['reply'])
  output=self.req('POST','/api/ai/image',{'project_id':p,'prompt':'Fotografía con luz de estudio', 'ratio':'1/1'})
  self.assertEqual(output['engine'],'comfyui-local')
  self.assertTrue(output['image'].startswith('data:image/png;base64,'))
 def test_vision_local_and_configuration(self):
  p=uuid.uuid4().hex;a=uuid.uuid4().hex
  self.req('PUT','/api/records/projects/'+p,{'id':p,'name':'Prueba'})
  self.req('PUT','/api/records/assets/'+a,{'id':a,'project':p,'name':'foto.png','blobType':'image/png','blob':base64.b64encode(PNG).decode()})
  # In tests other accounts exist: only first account can change shared config.
  with open(Path(self.tmp.name)/'local-models.json','w') as f:
   json.dump({'vision_model':'gemma3:4b'},f)
  res=self.req('POST','/api/ai/analyze',{'asset_id':a})
  self.assertEqual(res['analysis']['categoria'],'Fondo')
  self.assertEqual(res['engine'],'ollama-local')

if __name__=='__main__':unittest.main()
