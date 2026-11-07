package handlers

import (
	"encoding/json"
	"strings"
	"testing"
	"utilventa/internal/services"
)

func TestProductStockFiltersAndSupplierPrivacy(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	_, e := a.DB.Exec("INSERT INTO proveedores(id,nombre) VALUES(1,'Proveedor prueba')")
	if e != nil {
		t.Fatal(e)
	}
	for _, p := range []struct {
		code          string
		stock, active int
	}{{"LOW", 2, 1}, {"ZERO", 0, 1}, {"OFF", 0, 0}, {"NORMAL", 20, 1}} {
		if _, e = a.DB.Exec("INSERT INTO productos(codigo,nombre,categoria_id,costo,precio,stock,stock_minimo,activo,proveedor_id,fecha) VALUES(?,?,2,100,200,?,5,?,1,?)", p.code, p.code, p.stock, p.active, services.Now()); e != nil {
			t.Fatal(e)
		}
	}
	cases := map[string]int{"estado=stock_bajo": 3, "estado=agotados": 1, "estado=inactivos": 1, "proveedor=1": 4, "proveedor=1&estado=agotados&categoria=2": 1, "id=1": 1, "proveedor=0": 1}
	for filter, want := range cases {
		w := request(a, "GET", "/api/productos?"+filter, nil, admin)
		var rows []map[string]any
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil || len(rows) != want {
			t.Fatal(filter, w.Code, w.Body.String())
		}
	}
	for filter, want := range map[string]int{"proveedor=1": 2, "proveedor=0": 1, "proveedor=99": 0} {
		w := request(a, "GET", "/api/reposicion?"+filter, nil, admin)
		var rows []map[string]any
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil || len(rows) != want {
			t.Fatal(filter, w.Code, w.Body.String())
		}
	}
	if w := request(a, "GET", "/api/reposicion?proveedor=texto", nil, admin); w.Code != 400 {
		t.Fatal("proveedor inválido aceptado")
	}
	if w := request(a, "GET", "/api/productos?proveedor=1", nil, seller); w.Code != 403 {
		t.Fatal("proveedor expuesto al vendedor")
	}
	if w := request(a, "GET", "/api/publico/productos?proveedor=1", nil, nil); w.Code != 403 {
		t.Fatal("proveedor público")
	}
	if w := request(a, "GET", "/api/publico/productos?estado=inactivos", nil, nil); w.Code != 400 {
		t.Fatal("estado privado aceptado")
	}
	if w := request(a, "GET", "/api/productos?estado=incorrecto", nil, admin); w.Code != 400 {
		t.Fatal("estado inválido aceptado")
	}
	if w := request(a, "GET", "/api/productos?id=-1", nil, admin); w.Code != 400 {
		t.Fatal("identificador inválido aceptado")
	}
	w := request(a, "GET", "/api/productos?id=1", nil, seller)
	if w.Code != 200 || strings.Contains(w.Body.String(), `"costo"`) || strings.Contains(w.Body.String(), `"proveedor_id"`) {
		t.Fatal("acceso por id filtró datos reservados", w.Body.String())
	}
}
func TestStockAdjustmentKeepsAndRecordsActualCost(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	w := request(a, "POST", "/api/movimientos", map[string]any{"producto_id": 1, "tipo": "ajuste", "cantidad": -1, "costo": "999.00", "motivo": "Diferencia de conteo físico"}, admin)
	if w.Code != 201 || count(t, a, "SELECT costo FROM productos WHERE id=1") != 200 || count(t, a, "SELECT costo FROM movimientos WHERE tipo='ajuste'") != 200 || count(t, a, "SELECT stock FROM productos WHERE id=1") != 4 {
		t.Fatal("el ajuste alteró o falseó el costo", w.Body.String())
	}
}
