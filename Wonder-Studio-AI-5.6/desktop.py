#!/usr/bin/env python3
"""Wonder Studio AI 5.6 desktop host.

The local HTTP service stays active while its owner (this launcher) is running.
Browser startup is intentionally decoupled from server shutdown, because Edge/Chrome
may transfer a window to a preexisting browser process and exit its short-lived
launcher immediately.
"""
from __future__ import annotations
import os
import shutil
import subprocess
import sys
import threading
import time
import traceback
import urllib.request
import webbrowser
from pathlib import Path


def data_root():
    if os.environ.get('WS_DATA_DIR'):
        return Path(os.environ['WS_DATA_DIR']).expanduser().resolve()
    if getattr(sys, 'frozen', False):
        base = Path(os.environ.get('LOCALAPPDATA', Path.home()/'AppData'/'Local'))
        return base/'WonderStudioAI'/'data'
    return Path(__file__).resolve().parent/'data'


def record_error(root: Path, message: str):
    try:
        root.mkdir(parents=True, exist_ok=True)
        logfile = root/'inicio-wonder.log'
        from datetime import datetime
        with logfile.open('a', encoding='utf-8') as log:
            log.write(f'[{datetime.now().isoformat(timespec="seconds")}] {message}\n')
    except OSError:
        pass


def await_server(url: str, thread: threading.Thread, attempts: int = 40):
    """Do not display a webview until the server actually serves the index."""
    for _ in range(attempts):
        if not thread.is_alive():
            raise RuntimeError('El servidor local se detuvo antes de estar disponible.')
        try:
            with urllib.request.urlopen(url, timeout=1.0) as response:
                if response.status == 200:
                    return
        except (OSError, ValueError):
            time.sleep(0.2)
    raise RuntimeError('El servidor local no respondió a la comprobación de arranque.')


def find_browser():
    if os.name != 'nt':
        return None
    base = [
        str(Path(os.environ.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)'))/'Microsoft/Edge/Application/msedge.exe'),
        str(Path(os.environ.get('PROGRAMFILES', 'C:/Program Files'))/'Microsoft/Edge/Application/msedge.exe'),
        str(Path(os.environ.get('PROGRAMFILES', 'C:/Program Files'))/'Google/Chrome/Application/chrome.exe'),
        shutil.which('msedge') or '',
        shutil.which('chrome') or '',
    ]
    return next((x for x in base if x and Path(x).is_file()), None)


def open_app_window(url: str, root: Path):
    browser = find_browser()
    if browser:
        # Persistent profile keeps remembered login. Other browser instances may
        # cause Chromium/Edge to immediately exit this command after handing off
        # the app window. Never tie the server lifecycle to Popen.wait().
        profile = root.parent/'app-window-profile'
        profile.mkdir(parents=True, exist_ok=True)
        command = [browser, '--app='+url, '--new-window', '--no-first-run',
                   '--user-data-dir='+str(profile)]
        try:
            subprocess.Popen(command, stdin=subprocess.DEVNULL,
                             stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            print('Ventana de Wonder abierta. No cierres esta consola mientras trabajas.', flush=True)
            return
        except OSError as exc:
            record_error(root, f'No se pudo abrir Edge/Chrome: {exc}')
            print('No se pudo abrir la ventana de Edge/Chrome:', exc, flush=True)
    if not webbrowser.open(url):
        print('Abre manualmente esta direccion en tu navegador:', url, flush=True)
    print('Deja esta consola abierta mientras utilizas Wonder.', flush=True)


def run():
    root = data_root()
    root.mkdir(parents=True, exist_ok=True)
    os.environ['WS_DATA_DIR'] = str(root)
    import server
    from http.server import ThreadingHTTPServer
    srv = ThreadingHTTPServer(('127.0.0.1', 0), server.Handler)
    srv.daemon_threads = True
    port = srv.server_address[1]
    url = f'http://127.0.0.1:{port}/'
    thread = threading.Thread(target=srv.serve_forever, daemon=True, name='wonder-local-server')
    thread.start()
    try:
        await_server(url, thread)
        record_error(root, f'Inicio servidor local correcto: {url}')
        print('Wonder Studio AI 5.6 — servidor local disponible en:', url, flush=True)
        print('Tus datos permanecen en:', root, flush=True)
        threading.Thread(target=server.backup_loop, daemon=True, name='wonder-backup').start()
        try:
            import webview
        except ImportError:
            open_app_window(url, root)
            print('Para cerrar Wonder completamente, cierra esta consola o pulsa Ctrl+C.', flush=True)
            # Important: do not wait for the spawned Edge process. It may exit
            # immediately even though the UI is still visible.
            while thread.is_alive():
                thread.join(timeout=1.0)
        else:
            webview.settings['ALLOW_DOWNLOADS'] = True
            try:
                webview.create_window('Wonder Studio AI · Escritorio', url,
                                      width=1440, height=900, min_size=(970,650),
                                      background_color='#0b1020', text_select=True)
                webview.start(debug=False, private_mode=False,
                              storage_path=str(root.parent/'webview-profile'))
            except Exception as exc:
                # If WebView2 initialization fails, keep the local server alive
                # and fall back to a browser window rather than showing a dead page.
                record_error(root, f'WebView2 no disponible; usando navegador: {exc}')
                print('WebView2 no pudo iniciar; abriendo Wonder en Edge/Chrome...',flush=True)
                open_app_window(url, root)
                while thread.is_alive():
                    thread.join(timeout=1.0)
    except Exception:
        message = traceback.format_exc()
        record_error(root, message)
        print(message, file=sys.stderr, flush=True)
        raise
    finally:
        srv.shutdown()
        srv.server_close()


if __name__ == '__main__':
    try:
        run()
    except KeyboardInterrupt:
        print('\nWonder Studio AI cerrado. Tus proyectos permanecen guardados.', flush=True)
    except Exception as error:
        print('No se pudo iniciar Wonder Studio AI:', error, flush=True)
        print('Consulta el archivo inicio-wonder.log dentro de la carpeta de datos.', flush=True)
        sys.exit(1)
