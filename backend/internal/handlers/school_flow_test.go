package handlers

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"
	"utilventa/internal/services"
)

func TestQuoteInboxFiltersUseEffectiveStatus(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	for n, state := range []string{"solicitada", "en preparación", "enviada", "aceptada", "convertida", "rechazada", "enviada", "aceptada"} {
		until := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
		if n >= 6 {
			until = time.Now().UTC().Add(-24 * time.Hour).Format(time.RFC3339)
		}
		if _, err := a.DB.Exec("INSERT INTO cotizaciones(token_hash,nombre,telefono,lista,estado,vigencia,fecha) VALUES(?,?,'988765432','Lista',?,?,?)", fmt.Sprint("inbox-", n), fmt.Sprint("Cliente flujo ", n), state, until, services.Now()); err != nil {
			t.Fatal(err)
		}
	}
	for filter, want := range map[string]int{"": 8, "estado=pendientes": 2, "estado=enviada": 1, "estado=aceptada": 1, "estado=cerradas": 4, "q=988765432": 8, "q=Cliente%20flujo%200&estado=pendientes": 1, "q=noexiste": 0} {
		w := request(a, "GET", "/api/cotizaciones?"+filter, nil, admin)
		var rows []map[string]any
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil || len(rows) != want {
			t.Fatal(filter, w.Code, w.Body.String())
		}
	}
	if w := request(a, "GET", "/api/cotizaciones?estado=desconocido", nil, admin); w.Code != 400 {
		t.Fatal("estado inválido aceptado")
	}
	if w := request(a, "GET", "/api/cotizaciones?estado=pendientes", nil, nil); w.Code != 401 {
		t.Fatal("listas privadas expuestas")
	}
}
