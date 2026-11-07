"""Respaldo consistente de SQLite mediante la API online backup (Python 3)."""
import argparse
import os
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('origen', type=Path)
parser.add_argument('destino', type=Path)
args = parser.parse_args()
if not args.origen.is_file():
    parser.error('La base de origen no existe.')
# Crear un archivo nuevo evita sobrescribir un respaldo anterior.
descriptor = os.open(args.destino, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
os.close(descriptor)
try:
    with sqlite3.connect(args.origen.resolve().as_uri() + '?mode=ro', uri=True) as source:
        with sqlite3.connect(args.destino) as destination:
            source.backup(destination)
            if destination.execute('PRAGMA integrity_check').fetchone()[0] != 'ok':
                raise RuntimeError('El respaldo no superó la comprobación de integridad.')
    print(f'Respaldo íntegro creado: {args.destino}')
except Exception:
    print('El respaldo falló; no utilice el archivo de destino.')
    raise
