package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"testing"
	"time"
	"utilventa/internal/services"
)

func TestOrderInboxFiltersPaginationAndDetail(t *testing.T) {
	for _, direct := range []bool{false, true} {
		t.Run(fmt.Sprint(direct), func(t *testing.T) {
			a := fixture(t)
			seller := login(t, a, "vendedor")
			now := services.Now()
			expires := time.Now().UTC().Add(24 * time.Hour).Format(time.RFC3339)
			items := `[{"producto_id":1,"nombre":"Cuaderno","cantidad":1,"precio":350,"subtotal":350,"disponible":true}]`
			for i := 1; i <= 34; i++ {
				state := "pendiente"
				if i == 31 {
					state = "preparando"
				}
				if i == 32 {
					state = "listo"
				}
				if i >= 33 {
					state = "cancelado"
				}
				name := fmt.Sprintf("Familia %02d", i)
				phone := fmt.Sprintf("999000%03d", i)
				if direct {
					_, err := a.DB.Exec("INSERT INTO pedidos_web(id,token_hash,codigo_hash,huella,nombre,telefono,items,total,estado,fecha,vence) VALUES(?,?,?,?,?,?,?,350,?,?,?)", i, fmt.Sprint(i), "privado", "huella", name, phone, items, state, now, expires)
					if err != nil {
						t.Fatal(err)
					}
				} else {
					_, err := a.DB.Exec("INSERT INTO cotizaciones(id,token_hash,nombre,telefono,lista,estado,revision,vigencia,fecha) VALUES(?,?,?,?,?,'aceptada',1,?,?)", i, fmt.Sprint(i), name, phone, "1 cuaderno", expires, now)
					if err != nil {
						t.Fatal(err)
					}
					_, err = a.DB.Exec("INSERT INTO propuestas(cotizacion_id,revision,contenido,fecha) VALUES(?,1,?,?)", i, items, now)
					if err != nil {
						t.Fatal(err)
					}
					_, err = a.DB.Exec("INSERT INTO pedidos(id,cotizacion_id,estado,fecha) VALUES(?,?,?,?)", i, i, state, now)
					if err != nil {
						t.Fatal(err)
					}
				}
			}
			path := "/api/pedidos"
			if direct {
				path += "-web"
			}
			for _, check := range []struct {
				query  string
				length int
			}{
				{"", 30}, {"?pagina=2", 4}, {"?estado=preparando", 1}, {"?estado=listo", 1}, {"?estado=finalizados", 2}, {"?q=999000031&estado=preparando", 1}, {"?q=999000031&estado=listo", 0}, {"?q=Familia%2001", 1},
			} {
				w := request(a, "GET", path+check.query, nil, seller)
				var rows []map[string]any
				if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil || len(rows) != check.length {
					t.Fatalf("%s: %d %s", path+check.query, w.Code, w.Body.String())
				}
				for _, row := range rows {
					if row["total"] != float64(350) || row["token_hash"] != nil || row["codigo_hash"] != nil {
						t.Fatalf("total o privacidad: %+v", row)
					}
				}
			}
			if w := request(a, "GET", path+"?estado=desconocido", nil, seller); w.Code != 400 {
				t.Fatal(w.Body.String())
			}
			for _, id := range []int{1, 34} {
				w := request(a, "GET", fmt.Sprintf("%s/%d", path, id), nil, seller)
				var row map[string]any
				if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &row) != nil || row["id"] != float64(id) || row["total"] != float64(350) || row["token_hash"] != nil || row["codigo_hash"] != nil {
					t.Fatalf("detalle: %d %s", w.Code, w.Body.String())
				}
			}
			if w := request(a, "GET", path+"/999", nil, seller); w.Code != http.StatusNotFound {
				t.Fatal(w.Body.String())
			}
			if w := request(a, "GET", path+"/1", nil, nil); w.Code != http.StatusUnauthorized {
				t.Fatal(w.Body.String())
			}
		})
	}
}
