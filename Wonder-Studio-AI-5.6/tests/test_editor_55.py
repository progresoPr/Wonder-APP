import os, tempfile, pathlib, sys, unittest, uuid, json, time
sys.path.insert(0,str(pathlib.Path(__file__).resolve().parents[1]))

class Editor55StorageTests(unittest.TestCase):
 def test_project_folders_and_editable_design_mirror(self):
  import server
  with tempfile.TemporaryDirectory() as td:
   uid=uuid.uuid4().hex;pid=uuid.uuid4().hex;did=uuid.uuid4().hex
   root=pathlib.Path(td)/'Trabajo cliente'
   with server.db_connect() as c:
    salt='ab'*16
    c.execute('INSERT INTO users(id,email,name,salt,password_hash,created) VALUES(?,?,?,?,?,?)',(uid,uid+'@example.com','Test',salt,server.passwd_hash('Passw0rd!',salt),server.now()))
    project={'id':pid,'name':'Campaña 55','created':int(time.time()*1000),'storagePath':str(root)}
    server.store_record(c,uid,'projects',project)
    design={'id':did,'project':pid,'name':'Gran Apertura','created':int(time.time()*1000),'updated':int(time.time()*1000),'layers':[{'id':'t1','type':'text','text':'Apertura','x':20,'y':25,'w':70}],'bg':'#ffffff','ratio':'1/1'}
    server.store_record(c,uid,'designs',design)
   files=list((root/'Diseños editables').glob('*.wonder.json'))
   self.assertEqual(len(files),1)
   self.assertIn('Gran Apertura',files[0].name)
   self.assertEqual(json.loads(files[0].read_text())['layers'][0]['text'],'Apertura')
   self.assertTrue((root/'Imágenes exportadas').is_dir())
   self.assertTrue((root/'Recursos IA').is_dir())
   with server.db_connect() as c:
    rows=c.execute('SELECT COUNT(*) FROM records WHERE user_id=? AND store=?',(uid,'designs')).fetchone()[0]
   self.assertEqual(rows,1)
 def test_name_sanitization(self):
  import server
  name=server.safe_filename('Nombre:/?\\*<>| archivo')
  for x in '/\\:*?"<>|':self.assertNotIn(x,name)
