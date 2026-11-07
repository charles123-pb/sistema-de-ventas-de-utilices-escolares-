ALTER TABLE clientes ADD COLUMN tipo TEXT NOT NULL DEFAULT 'persona' CHECK(tipo IN ('persona','empresa'));
UPDATE clientes SET tipo='empresa' WHERE length(documento)=11 AND documento NOT GLOB '*[^0-9]*';
ALTER TABLE ventas ADD COLUMN cliente_nombre TEXT NOT NULL DEFAULT '';
ALTER TABLE ventas ADD COLUMN cliente_documento TEXT NOT NULL DEFAULT '';
ALTER TABLE ventas ADD COLUMN cliente_direccion TEXT NOT NULL DEFAULT '';
ALTER TABLE ventas ADD COLUMN cliente_tipo TEXT NOT NULL DEFAULT '';
UPDATE ventas SET cliente_nombre=COALESCE((SELECT nombre FROM clientes WHERE id=ventas.cliente_id),''),
  cliente_documento=COALESCE((SELECT documento FROM clientes WHERE id=ventas.cliente_id),''),
  cliente_direccion=COALESCE((SELECT direccion FROM clientes WHERE id=ventas.cliente_id),''),
  cliente_tipo=COALESCE((SELECT tipo FROM clientes WHERE id=ventas.cliente_id),'');
CREATE INDEX IF NOT EXISTS idx_clientes_documento ON clientes(documento);
