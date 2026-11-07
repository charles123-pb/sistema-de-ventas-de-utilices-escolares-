package handlers

import (
	"encoding/json"
	"fmt"
	"net/url"
	"testing"
	"utilventa/internal/models"
)

func TestSchoolProductSearchAndPackaging(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	for _, p := range []struct{ name, brand, code string }{
		{"Lápiz técnico con borrador", "Artesco", "LAP-1"}, {"Colores jumbo triangulares · 12 + 2 lápices", "Faber-Castell", "COL-1"},
		{"Témperas · 7 colores + pincel", "Artesco", "TEM-1"}, {"Tijera escolar clásica", "Vinifan", "TIJ-1"},
		{"Cuaderno Cuadrimax 1x1 A4 · 80 hojas", "Standford", "CUA-1"},
	} {
		w := request(a, "POST", "/api/productos", map[string]any{"codigo": p.code, "nombre": p.name, "marca": p.brand, "categoria_id": 1, "costo": "1.00", "precio": "2.00", "stock": 30, "stock_minimo": 1, "activo": true}, admin)
		if w.Code != 201 {
			t.Fatal(w.Body.String())
		}
	}
	for _, c := range []struct{ query, code string }{
		{"cuadernos", "P1"}, {"lapiz", "LAP-1"}, {"lapices Artesco", "LAP-1"}, {"Faber Castell", "COL-1"},
		{"caja de colores Faber Castell de 12", "COL-1"}, {"tijeras escolares", "TIJ-1"}, {"cuadernos cuadriculados A4", "CUA-1"},
	} {
		path := "/api/publico/productos?q=" + url.QueryEscape(c.query)
		w := request(a, "GET", path, nil, nil)
		var rows []map[string]any
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil {
			t.Fatal(w.Body.String())
		}
		found := false
		for _, p := range rows {
			if p["codigo"] == c.code {
				found = true
			}
		}
		if !found {
			t.Fatalf("búsqueda %q sin %s: %s", c.query, c.code, w.Body.String())
		}
		for _, p := range rows {
			if _, ok := p["costo"]; ok {
				t.Fatal("costo público")
			}
		}
	}
	for _, q := range []string{"borrador Artesco", "lápiz Faber Castell", "pincel Artesco", "colores de 24"} {
		w := request(a, "GET", "/api/publico/productos?q="+url.QueryEscape(q), nil, nil)
		var rows []any
		json.Unmarshal(w.Body.Bytes(), &rows)
		if len(rows) != 0 {
			t.Fatalf("producto accesorio o tamaño distinto para %s: %s", q, w.Body.String())
		}
	}
	w := request(a, "GET", "/api/publico/productos?q=colores", nil, nil)
	var rows []map[string]any
	json.Unmarshal(w.Body.Bytes(), &rows)
	if len(rows) != 1 || rows[0]["presentacion"] != "caja" || rows[0]["contenido"] != float64(12) {
		t.Fatal("presentación no inferida", w.Body.String())
	}
	id := int64(rows[0]["id"].(float64))
	input := models.SaleInput{Items: []models.Item{{ProductoID: id, Cantidad: 2}}, Clave: "cajas-colores-historico-001", Pago: "efectivo", Recibido: "10.00"}
	w = request(a, "POST", "/api/ventas", input, seller)
	var sale models.Sale
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &sale) != nil || sale.Items[0].Presentacion != "caja" || sale.Items[0].Contenido != 12 || sale.Total != 400 {
		t.Fatal(w.Body.String())
	}
	a.DB.Exec("UPDATE productos SET contenido=24 WHERE id=?", id)
	w = request(a, "GET", fmt.Sprintf("/api/ventas/%d", sale.ID), nil, seller)
	json.Unmarshal(w.Body.Bytes(), &sale)
	if sale.Items[0].Contenido != 12 {
		t.Fatal("el cambio alteró el comprobante histórico")
	}
}
