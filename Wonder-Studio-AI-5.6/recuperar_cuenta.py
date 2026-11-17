#!/usr/bin/env python3
"""Restaurar acceso desde la propia computadora, sin email ni servicios externos.
No cambia contraseñas ni abre archivos de proyectos; entrega un nuevo código de recuperación.
Solo se debe ejecutar con acceso al equipo que contiene la base de datos local.
"""
from __future__ import annotations
import getpass
import sys
from server import DB_LOCK,db_connect,new_recovery,DB_PATH

def main():
    print('==============================================')
    print(' WONDER STUDIO AI - RECUPERAR CUENTA LOCAL')
    print('==============================================\n')
    if not DB_PATH.is_file():
        print('No se encuentra la base de datos:',DB_PATH)
        return 1
    with db_connect() as c:
        users=c.execute('SELECT email,name FROM users ORDER BY created').fetchall()
    if not users:
        print('No hay cuentas creadas en esta instalación. Comprueba que sea tu carpeta habitual.')
        return 1
    print('Cuentas disponibles en esta computadora:')
    for x in users:print('  -',x['email'],'(',x['name'],')')
    email=input('\nCorreo de la cuenta a recuperar: ').strip().lower()
    with db_connect() as c:row=c.execute('SELECT id,email FROM users WHERE email=?',(email,)).fetchone()
    if not row:
        print('Cuenta no encontrada. No se modificó nada.')
        return 1
    confirm=input('Generar un NUEVO código de recuperación para '+row['email']+'? (escribe SI): ').strip().upper()
    if confirm!='SI':
        print('Cancelado.');return 1
    with DB_LOCK,db_connect() as c:
        code=new_recovery(c,row['id'])
    print('\n================================================')
    print('NUEVO CÓDIGO:',code)
    print('================================================')
    print('Guárdalo en un lugar privado. El código anterior queda invalidado.')
    print('Abre Wonder Studio AI > Recuperar contraseña > escribe este código.')
    print('Tu cuenta, contraseña actual y proyectos permanecen sin cambios hasta que elijas una nueva contraseña.')
    return 0
if __name__=='__main__':sys.exit(main())
