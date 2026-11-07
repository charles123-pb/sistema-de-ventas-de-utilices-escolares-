CREATE TABLE proveedores (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL,
  ruc TEXT NOT NULL DEFAULT '',
  contacto TEXT NOT NULL DEFAULT '',
  telefono TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  direccion TEXT NOT NULL DEFAULT '',
  ciudad TEXT NOT NULL DEFAULT 'Huamanga',
  notas TEXT NOT NULL DEFAULT '',
  activo INTEGER NOT NULL DEFAULT 1 CHECK(activo IN (0,1))
);
CREATE UNIQUE INDEX idx_proveedores_ruc ON proveedores(ruc) WHERE ruc<>'';
CREATE TABLE proveedor_marcas (
  proveedor_id INTEGER NOT NULL REFERENCES proveedores(id),
  marca TEXT NOT NULL COLLATE NOCASE,
  PRIMARY KEY(proveedor_id,marca)
);
ALTER TABLE productos ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id);
ALTER TABLE movimientos ADD COLUMN proveedor_id INTEGER REFERENCES proveedores(id);
ALTER TABLE movimientos ADD COLUMN comprobante TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_productos_proveedor ON productos(proveedor_id);
CREATE INDEX idx_productos_marca ON productos(marca COLLATE NOCASE);
