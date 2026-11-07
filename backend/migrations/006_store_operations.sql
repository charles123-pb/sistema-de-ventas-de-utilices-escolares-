ALTER TABLE ventas ADD COLUMN estado TEXT NOT NULL DEFAULT 'activa' CHECK(estado IN ('activa','anulada'));
ALTER TABLE ventas ADD COLUMN anulacion_motivo TEXT NOT NULL DEFAULT '';
ALTER TABLE ventas ADD COLUMN anulacion_fecha TEXT NOT NULL DEFAULT '';
ALTER TABLE ventas ADD COLUMN anulacion_usuario_id INTEGER REFERENCES usuarios(id);
CREATE INDEX idx_ventas_estado_fecha ON ventas(estado,fecha);
CREATE TABLE cierres_caja(
 id INTEGER PRIMARY KEY, dia TEXT NOT NULL, usuario_id INTEGER NOT NULL REFERENCES usuarios(id), fecha TEXT NOT NULL,
 fondo_inicial INTEGER NOT NULL CHECK(fondo_inicial>=0), gastos INTEGER NOT NULL CHECK(gastos>=0), retiros INTEGER NOT NULL CHECK(retiros>=0),
 contado INTEGER NOT NULL CHECK(contado>=0), esperado INTEGER NOT NULL, diferencia INTEGER NOT NULL,
 efectivo INTEGER NOT NULL, yape INTEGER NOT NULL, plin INTEGER NOT NULL, transferencia INTEGER NOT NULL, ventas INTEGER NOT NULL,
 observaciones TEXT NOT NULL DEFAULT '', reapertura_fecha TEXT NOT NULL DEFAULT '', reapertura_motivo TEXT NOT NULL DEFAULT '',
 reapertura_usuario_id INTEGER REFERENCES usuarios(id)
);
CREATE UNIQUE INDEX idx_cierre_dia_vigente ON cierres_caja(dia) WHERE reapertura_fecha='';
