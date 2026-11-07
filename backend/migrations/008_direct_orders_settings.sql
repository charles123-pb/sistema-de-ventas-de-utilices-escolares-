CREATE TABLE configuracion_tienda (
 id INTEGER PRIMARY KEY CHECK(id=1),
 nombre TEXT NOT NULL DEFAULT 'ÚtilVenta Ayacucho',
 direccion TEXT NOT NULL DEFAULT '', telefono TEXT NOT NULL DEFAULT '',
 horario TEXT NOT NULL DEFAULT '', logo TEXT NOT NULL DEFAULT '',
 pedido_horas INTEGER NOT NULL DEFAULT 24 CHECK(pedido_horas BETWEEN 1 AND 72),
 respaldo_automatico INTEGER NOT NULL DEFAULT 1 CHECK(respaldo_automatico IN (0,1)),
 respaldo_horas INTEGER NOT NULL DEFAULT 24 CHECK(respaldo_horas BETWEEN 1 AND 168),
 ultimo_respaldo TEXT NOT NULL DEFAULT '', respaldo_error TEXT NOT NULL DEFAULT '', checkout_secret TEXT NOT NULL DEFAULT ''
);
INSERT INTO configuracion_tienda(id) VALUES(1);
CREATE TABLE configuracion_historial(id INTEGER PRIMARY KEY,usuario_id INTEGER NOT NULL REFERENCES usuarios(id),fecha TEXT NOT NULL,contenido TEXT NOT NULL);
CREATE TABLE pedidos_web (
 id INTEGER PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, codigo_hash TEXT NOT NULL,
 huella TEXT NOT NULL, nombre TEXT NOT NULL, telefono TEXT NOT NULL, observaciones TEXT NOT NULL DEFAULT '',
 items TEXT NOT NULL, total INTEGER NOT NULL CHECK(total>0),
 estado TEXT NOT NULL DEFAULT 'pendiente' CHECK(estado IN ('pendiente','preparando','listo','entregado','cancelado','vencido')),
 fecha TEXT NOT NULL, vence TEXT NOT NULL, venta_id INTEGER UNIQUE REFERENCES ventas(id),
 entrega_fecha TEXT NOT NULL DEFAULT '', entrega_usuario_id INTEGER REFERENCES usuarios(id)
);
CREATE INDEX idx_pedidos_web_telefono ON pedidos_web(telefono,fecha);
CREATE INDEX idx_pedidos_web_vence ON pedidos_web(vence,estado);
CREATE TABLE pedidos_web_eventos(id INTEGER PRIMARY KEY,pedido_id INTEGER NOT NULL REFERENCES pedidos_web(id),usuario_id INTEGER REFERENCES usuarios(id),fecha TEXT NOT NULL,accion TEXT NOT NULL);
