package handlers

import (
	"encoding/json"
	"net/url"
	"strings"
	"testing"
)

func TestBrandsSearchFiltersAndPrivacy(t *testing.T) {
	a := fixture(t)
	_, err := a.DB.Exec("UPDATE productos SET marca='Trazo' WHERE id=1; INSERT INTO productos(codigo,nombre,marca,categoria_id,costo,precio,stock,activo,fecha) VALUES('P2','Lápiz','Aula',2,100,200,4,1,'2026-10-28'),('P3','Cuaderno antiguo','Oculta',1,100,200,0,0,'2026-10-28')")
	if err != nil {
		t.Fatal(err)
	}
	admin := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	for _, path := range []string{"/api/publico/productos?q=trazo", "/api/publico/productos?marca=TRAZO", "/api/publico/productos?q=Cuaderno&categoria=1&marca=Trazo"} {
		w := request(a, "GET", path, nil, nil)
		var products []map[string]any
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &products) != nil || len(products) != 1 || products[0]["codigo"] != "P1" {
			t.Fatalf("%s: %d %s", path, w.Code, w.Body.String())
		}
		for _, key := range []string{"costo", "proveedor", "proveedor_id"} {
			if _, ok := products[0][key]; ok {
				t.Fatal("dato interno expuesto", key)
			}
		}
	}
	w := request(a, "GET", "/api/publico/productos?marca=Trazo&categoria=2", nil, nil)
	if strings.TrimSpace(w.Body.String()) != "[]" {
		t.Fatal(w.Body.String())
	}
	w = request(a, "GET", "/api/publico/marcas", nil, nil)
	if w.Code != 200 || strings.Contains(w.Body.String(), "Oculta") || !strings.Contains(w.Body.String(), "Trazo") {
		t.Fatal(w.Body.String())
	}
	if w = request(a, "GET", "/api/marcas", nil, admin); w.Code != 200 || !strings.Contains(w.Body.String(), "Oculta") {
		t.Fatal(w.Body.String())
	}
	if w = request(a, "GET", "/api/productos?q=trazo", nil, seller); w.Code != 200 || strings.Contains(w.Body.String(), "costo") {
		t.Fatal(w.Body.String())
	}
}

func TestSupplierLifecycleAndReceiving(t *testing.T) {
	a := fixture(t)
	c := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	body := map[string]any{"nombre": "Distribuidora de prueba", "ruc": "20123456789", "ciudad": "Huamanga", "marcas": "Trazo, Aula, trazo", "activo": true, "email": "contacto@example.com"}
	if w := request(a, "POST", "/api/proveedores", body, seller); w.Code != 403 {
		t.Fatal(w.Code)
	}
	if w := request(a, "GET", "/api/proveedores", nil, nil); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := request(a, "POST", "/api/proveedores", body, c); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if count(t, a, "SELECT COUNT(*) FROM proveedor_marcas") != 2 {
		t.Fatal("marcas duplicadas")
	}
	if w := request(a, "POST", "/api/proveedores", body, c); w.Code != 409 {
		t.Fatal("RUC duplicado aceptado", w.Code)
	}
	for _, key := range []string{"ruc", "email", "ciudad"} {
		bad := map[string]any{}
		for k, v := range body {
			bad[k] = v
		}
		bad[key] = "inválido"
		if key == "ciudad" {
			bad[key] = " "
		}
		if w := request(a, "PUT", "/api/proveedores/1", bad, c); w.Code != 400 {
			t.Fatal(key, w.Code, w.Body.String())
		}
	}
	product := map[string]any{"codigo": "P1", "nombre": "Cuaderno", "marca": "Color", "categoria_id": 1, "costo": "2.00", "precio": "3.50", "stock": 5, "stock_minimo": 5, "activo": true, "proveedor_id": 1}
	if w := request(a, "PUT", "/api/productos/1", product, c); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	for _, search := range []string{"Trazo", "Color", "Huamanga", "20123456789"} {
		w := request(a, "GET", "/api/proveedores?q="+url.QueryEscape(search), nil, c)
		if w.Code != 200 || !strings.Contains(w.Body.String(), `"productos":1`) || !strings.Contains(w.Body.String(), "Color") {
			t.Fatal(search, w.Code, w.Body.String())
		}
	}
	receiving := map[string]any{"producto_id": 1, "tipo": "entrada", "cantidad": 5, "costo": "4.00", "motivo": "Compra de prueba", "proveedor_id": 1, "comprobante": "F001-123"}
	if w := request(a, "POST", "/api/movimientos", receiving, c); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	if count(t, a, "SELECT stock FROM productos WHERE id=1") != 10 || count(t, a, "SELECT costo FROM productos WHERE id=1") != 300 {
		t.Fatal("costo promedio incorrecto")
	}
	if count(t, a, "SELECT COUNT(*) FROM movimientos WHERE proveedor_id=1 AND comprobante='F001-123'") != 1 {
		t.Fatal("entrada sin referencia")
	}
	if w := request(a, "GET", "/api/movimientos", nil, c); w.Code != 200 || !strings.Contains(w.Body.String(), "Distribuidora de prueba") {
		t.Fatal(w.Body.String())
	}
	body["activo"] = false
	if w := request(a, "PUT", "/api/proveedores/1", body, c); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := request(a, "POST", "/api/movimientos", receiving, c); w.Code != 400 {
		t.Fatal("entrada con proveedor inactivo", w.Code)
	}
	if count(t, a, "SELECT stock FROM productos WHERE id=1") != 10 {
		t.Fatal("entrada rechazada alteró stock")
	}
	// Un proveedor inactivo se conserva al editar su producto; no se asigna a productos nuevos.
	product["stock"] = 10
	product["costo"] = "3.00"
	if w := request(a, "PUT", "/api/productos/1", product, c); w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	product["codigo"] = "P2"
	if w := request(a, "POST", "/api/productos", product, c); w.Code != 400 {
		t.Fatal("producto con proveedor inactivo", w.Code)
	}
	receiving["proveedor_id"] = 999
	if w := request(a, "POST", "/api/movimientos", receiving, c); w.Code != 400 {
		t.Fatal(w.Code)
	}
	receiving["tipo"] = "ajuste"
	receiving["proveedor_id"] = nil
	if w := request(a, "POST", "/api/movimientos", receiving, c); w.Code != 400 {
		t.Fatal("ajuste con comprobante aceptado")
	}
	for _, path := range []string{"/api/proveedores", "/api/proveedores?opciones=1"} {
		if w := request(a, "GET", path, nil, seller); w.Code != 403 {
			t.Fatal(path, w.Code)
		}
	}
	if w := request(a, "PUT", "/api/proveedores/999", body, c); w.Code != 404 {
		t.Fatal(w.Code)
	}
}
