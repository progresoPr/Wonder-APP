"""Regression tests for the desktop launcher (Windows Edge handoff issue)."""
import importlib
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import desktop

class BrowserExitTest(unittest.TestCase):
    def test_browser_process_can_exit_while_server_stays_ready(self):
        """Browser command can exit immediately, but it must not stop HTTP service."""
        class Health(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'OK')
            def log_message(self,*args): pass
        srv=ThreadingHTTPServer(('127.0.0.1',0),Health)
        worker=threading.Thread(target=srv.serve_forever,daemon=True)
        worker.start()
        url=f'http://127.0.0.1:{srv.server_address[1]}/'
        try:
            desktop.await_server(url,worker)
            with tempfile.TemporaryDirectory() as root:
                with patch.object(desktop,'find_browser',return_value=sys.executable), patch.object(desktop.subprocess,'Popen') as spawn:
                    # Simulate Edge exiting immediately after handing off to a running instance.
                    instance=spawn.return_value
                    instance.poll.return_value=0
                    desktop.open_app_window(url,Path(root))
                    instance.wait.assert_not_called()
                with urllib.request.urlopen(url,timeout=2) as response:
                    self.assertEqual(response.status,200)
        finally:
            srv.shutdown()
            srv.server_close()

if __name__=='__main__': unittest.main()
