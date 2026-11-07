"""Comprobación parcial de migración, restricciones SQL y respaldo; no ejecuta Go."""
from pathlib import Path
import sqlite3
import os
import stat
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parent.parent
schema = '\n'.join(p.read_text() for p in sorted((root / 'backend/migrations').glob('*.sql')))
with tempfile.TemporaryDirectory() as folder:
    path = Path(folder) / 'prueba.db'
    db = sqlite3.connect(path)
    db.execute('PRAGMA foreign_keys=ON')
    db.execute('PRAGMA journal_mode=WAL')
    # La migración 007 usa funciones registradas por Go. Aquí se migra una base
    # vacía: declarar sus firmas permite preparar el UPDATE, pero fallar si se
    # invocan evita simular o validar por accidente la lógica de productos.
    def go_only_function(_value):
        raise RuntimeError('Las funciones de productos se comprueban con go test ./...')
    for name in ('school_family', 'school_pack', 'school_content'):
        db.create_function(name, 1, go_only_function, deterministic=True)
    db.executescript(schema)
    db.execute("INSERT INTO usuarios VALUES(1,'Prueba','prueba','hash-solo-test','administrador',1,'2026-10-27T05:00:00Z')")
    db.execute("INSERT INTO productos(codigo,nombre,categoria_id,costo,precio,stock,fecha) VALUES('P1','Prueba',1,100,200,3,'2026-10-27T05:00:00Z')")
    db.commit()
    for sql in [
        'UPDATE productos SET stock=-1 WHERE id=1',
        'UPDATE productos SET categoria_id=999 WHERE id=1',
        'UPDATE productos SET contenido=-1 WHERE id=1',
        "INSERT INTO productos(codigo,nombre,categoria_id,costo,precio,fecha) VALUES('P1','Duplicado',1,1,2,'2026-10-27T05:00:00Z')",
    ]:
        try:
            db.execute(sql)
        except sqlite3.IntegrityError:
            db.rollback()
        else:
            raise AssertionError('Una restricción no se aplicó: ' + sql)
    db.execute('BEGIN')
    db.execute('UPDATE productos SET stock=stock-2 WHERE id=1 AND stock>=2')
    db.rollback()
    assert db.execute('SELECT stock FROM productos WHERE id=1').fetchone()[0] == 3
    destination = Path(folder) / 'respaldo.db'
    subprocess.run([sys.executable, str(root / 'scripts/backup.py'), str(path), str(destination)], check=True)
    if os.name == 'posix':
        assert stat.S_IMODE(destination.stat().st_mode) == 0o600
    original_backup = destination.read_bytes()
    rejected = subprocess.run(
        [sys.executable, str(root / 'scripts/backup.py'), str(path), str(destination)],
        capture_output=True,
    )
    assert rejected.returncode != 0, 'No se debe sobrescribir un respaldo existente'
    assert destination.read_bytes() == original_backup
    restored_path = Path(folder) / 'restaurada.db'
    subprocess.run(
        [sys.executable, str(root / 'scripts/backup.py'), str(destination), str(restored_path)],
        check=True,
    )
    with sqlite3.connect(restored_path) as restored:
        assert restored.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert restored.execute('SELECT stock FROM productos WHERE id=1').fetchone()[0] == 3
    db.close()
print('SQLite: esquema vacío, restricciones, rollback, respaldo privado, rechazo de sobrescritura y restauración verificados.')
