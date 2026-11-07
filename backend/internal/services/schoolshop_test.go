package services

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSchoolShopRealCatalogAndRepeatability(t *testing.T) {
	db := demoDB(t)
	first, err := SeedSchoolShop(db, 1)
	if err != nil {
		t.Fatal(err)
	}
	if first.Productos != 44 || first.Proveedores != 6 || first.Clientes != 8 || first.Ventas != 14 || first.Cotizaciones != 6 || len(first.Links) != 6 {
		t.Fatalf("resumen inesperado: %+v", first)
	}
	if scalar(t, db, "SELECT COUNT(*) FROM productos WHERE imagen NOT LIKE '/productos/%' OR nombre LIKE '%DEMO%' OR marca LIKE '%DEMO%' OR proveedor_id IS NULL") != 0 {
		t.Fatal("referencias incompletas")
	}
	if scalar(t, db, "SELECT COUNT(DISTINCT marca) FROM productos") != 8 {
		t.Fatal("faltan marcas")
	}
	if scalar(t, db, "SELECT COUNT(*) FROM productos p WHERE p.stock<>COALESCE((SELECT SUM(cantidad) FROM movimientos WHERE producto_id=p.id),0)") != 0 {
		t.Fatal("stock distinto del historial")
	}
	if scalar(t, db, "SELECT COUNT(*) FROM ventas v WHERE total<>(SELECT SUM(subtotal) FROM detalle_venta WHERE venta_id=v.id)") != 0 {
		t.Fatal("importes incorrectos")
	}
	if scalar(t, db, "SELECT COUNT(*) FROM movimientos WHERE tipo='entrada' AND proveedor_id IS NOT NULL AND comprobante<>''") != 6 {
		t.Fatal("faltan entradas por proveedor")
	}
	if scalar(t, db, "SELECT COUNT(*) FROM proveedores WHERE nombre LIKE 'DISUM%' AND ciudad LIKE '%Ayacucho%' AND telefono<>''") != 1 {
		t.Fatal("falta Disum")
	}
	if _, err = db.Exec("UPDATE productos SET nombre='Producto editado',precio=999 WHERE codigo='ART-PR452593'"); err != nil {
		t.Fatal(err)
	}
	stock := scalar(t, db, "SELECT SUM(stock) FROM productos")
	again, err := SeedSchoolShop(db, 1)
	if err != nil {
		t.Fatal(err)
	}
	if again.Productos+again.Proveedores+again.Clientes+again.Ventas+again.Cotizaciones != 0 || len(again.Links) != 0 {
		t.Fatal("la recarga duplicó información")
	}
	if scalar(t, db, "SELECT SUM(stock) FROM productos") != stock || scalar(t, db, "SELECT precio FROM productos WHERE codigo='ART-PR452593'") != 999 {
		t.Fatal("se alteró trabajo existente")
	}
}

func TestSchoolCatalogLocalPhotographsExist(t *testing.T) {
	var catalog SchoolCatalog
	if err := json.Unmarshal(schoolCatalogJSON, &catalog); err != nil {
		t.Fatal(err)
	}
	for _, p := range catalog.Productos {
		if !strings.HasPrefix(p.Imagen, "/productos/") {
			t.Fatal("foto remota", p.Codigo)
		}
		data, err := os.ReadFile(filepath.Join("..", "..", "..", "frontend", "public", p.Imagen))
		if err != nil {
			t.Fatal(p.Codigo, err)
		}
		if len(data) < 1000 {
			t.Fatal("foto vacía", p.Codigo)
		}
		if p.Costo <= 0 || p.Precio <= p.Costo {
			t.Fatal("importes incorrectos", p.Codigo)
		}
	}
}
