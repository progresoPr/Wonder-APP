"""Comprobar que actualizar no borra archivos ni BD y migración protege destino."""
import os,sys,sqlite3,tempfile,shutil,unittest,zipfile
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import actualizar_5_5, migrar_desktop

class MigrationTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory()
  self.root=Path(self.tmp.name)
  self.old=self.root/'Wonder5.3'
  self.old.mkdir()
  (self.old/'server.py').write_text('# legacy server')
  (self.old/'VERSION.txt').write_text('WONDER STUDIO AI\nVersión: 5.3')
  self.data=self.old/'data';self.data.mkdir()
  conn=sqlite3.connect(self.data/'wonder.db')
  conn.executescript('''
  CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,salt TEXT,password_hash TEXT,created INTEGER);
  CREATE TABLE records(user_id TEXT,store TEXT,id TEXT,project_id TEXT,body TEXT,file_name TEXT,file_mime TEXT,file_size INTEGER,modified INTEGER);
  INSERT INTO users VALUES('u','test@example.com','A','','',0);
  INSERT INTO records VALUES('u','projects','p','p','{"id":"p","name":"Trabajo importante"}',NULL,NULL,0,0);
  INSERT INTO records VALUES('u','assets','a','p','{"id":"a","project":"p","name":"logo.png"}','aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','image/png',8,0);
  ''')
  conn.commit();conn.close()
  resource=self.data/'uploads'/'u';resource.mkdir(parents=True)
  (resource/'a'*32) if False else None
  (resource/('a'*32)).write_bytes(b'12345678')
 def tearDown(self):self.tmp.cleanup()
 def test_updater_preserves_existing_database(self):
  old_bytes=(self.data/'wonder.db').read_bytes()
  backup=actualizar_5_5.apply_update(self.old)
  self.assertTrue(backup.is_file())
  self.assertEqual((self.data/'wonder.db').read_bytes(),old_bytes)
  self.assertEqual((self.data/'uploads'/'u'/('a'*32)).read_bytes(),b'12345678')
  self.assertIn('5.6',(self.old/'VERSION.txt').read_text())
  self.assertTrue((self.old/'local_ai.py').is_file())
  with zipfile.ZipFile(backup) as z:self.assertIsNone(z.testzip())
 def test_desktop_copy_and_refuses_overwrite(self):
  dest=self.root/'AppData'/'WonderStudioAI'/'data'
  result=migrar_desktop.migrate(self.old,dest)
  self.assertEqual(result,dest)
  with sqlite3.connect(dest/'wonder.db') as conn:
   n=conn.execute('SELECT body FROM records WHERE store="projects"').fetchone()[0]
  self.assertIn('Trabajo importante',n)
  self.assertEqual((dest/'uploads'/'u'/('a'*32)).read_bytes(),b'12345678')
  with self.assertRaisesRegex(RuntimeError,'YA tiene'):migrar_desktop.migrate(self.old,dest)

if __name__=='__main__':unittest.main()
