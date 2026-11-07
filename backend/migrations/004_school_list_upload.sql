ALTER TABLE cotizaciones ADD COLUMN solicitud_items TEXT NOT NULL DEFAULT '[]';
CREATE TABLE cotizacion_adjuntos (
  cotizacion_id INTEGER PRIMARY KEY REFERENCES cotizaciones(id),
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  tamano INTEGER NOT NULL CHECK(tamano>0 AND tamano<=5242880),
  contenido BLOB NOT NULL
);
