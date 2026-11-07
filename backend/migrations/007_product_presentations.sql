ALTER TABLE productos ADD COLUMN familia TEXT NOT NULL DEFAULT '';
ALTER TABLE productos ADD COLUMN presentacion TEXT NOT NULL DEFAULT 'unidad';
ALTER TABLE productos ADD COLUMN contenido INTEGER NOT NULL DEFAULT 1 CHECK(contenido>=0 AND contenido<=1000000);
UPDATE productos SET familia=school_family(nombre),presentacion=school_pack(nombre),contenido=school_content(nombre);
ALTER TABLE detalle_venta ADD COLUMN presentacion TEXT NOT NULL DEFAULT 'unidad';
ALTER TABLE detalle_venta ADD COLUMN contenido INTEGER NOT NULL DEFAULT 1;
UPDATE detalle_venta SET presentacion=COALESCE((SELECT presentacion FROM productos WHERE id=producto_id),'unidad'),contenido=COALESCE((SELECT contenido FROM productos WHERE id=producto_id),1);
