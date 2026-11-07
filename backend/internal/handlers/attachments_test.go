package handlers

import (
	"bytes"
	"encoding/json"
	"strings"
	"testing"
	"utilventa/internal/models"
)

func TestSchoolAttachmentAndStockCoverage(t *testing.T) {
	a := fixture(t)
	file := []byte(strings.Repeat("Cuadernos y lápices\n", 5000))
	body := map[string]any{"nombre": "Familia escolar", "telefono": "999000111", "lista": "7 cuadernos y 2 compases", "adjunto": map[string]any{"nombre": "lista.txt", "tipo": "image/png", "datos": file}, "seleccion": []models.SchoolSelection{{ProductoID: 1, Cantidad: 7}, {Solicitado: "Compás metálico", Cantidad: 2}}}
	w := request(a, "POST", "/api/publico/solicitudes", body, nil)
	if w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var created struct {
		ID     int64  `json:"id"`
		Enlace string `json:"enlace"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &created); err != nil {
		t.Fatal(err)
	}
	w = request(a, "GET", "/api/publico"+created.Enlace, nil, nil)
	var detail struct {
		Seleccion []models.SchoolLine `json:"solicitud_items"`
		Adjunto   struct {
			Nombre, Tipo, URL string
			Tamano            int
		} `json:"adjunto"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &detail) != nil {
		t.Fatal(w.Code, w.Body.String())
	}
	if len(detail.Seleccion) != 2 || detail.Seleccion[0].Disponibles != 5 || detail.Seleccion[0].Faltantes != 2 || detail.Seleccion[0].Precio != 350 || detail.Seleccion[1].Faltantes != 2 {
		t.Fatalf("cobertura incorrecta: %+v", detail.Seleccion)
	}
	if detail.Adjunto.Tipo != "text/plain" || detail.Adjunto.Tamano != len(file) {
		t.Fatal("se confió en el tipo declarado")
	}
	w = request(a, "GET", detail.Adjunto.URL, nil, nil)
	if w.Code != 200 || !bytes.Equal(w.Body.Bytes(), file) || !strings.HasPrefix(w.Header().Get("Content-Disposition"), "attachment") || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("archivo incorrecto o sin protección")
	}
	if w = request(a, "GET", "/api/cotizaciones/1/adjunto", nil, nil); w.Code != 401 {
		t.Fatal("archivo privado sin sesión", w.Code)
	}
	if w = request(a, "GET", "/api/publico/seguimiento/"+strings.Repeat("a", 64)+"/adjunto", nil, nil); w.Code != 404 {
		t.Fatal("archivo expuesto con enlace ajeno", w.Code)
	}
	seller := login(t, a, "vendedor")
	if w = request(a, "GET", "/api/cotizaciones/1/adjunto", nil, seller); w.Code != 200 {
		t.Fatal("el personal no pudo leer el archivo", w.Code)
	}
	if count(t, a, "SELECT stock FROM productos WHERE id=1") != 5 || count(t, a, "SELECT COUNT(*) FROM movimientos") != 0 {
		t.Fatal("cotizar cambió existencias")
	}
}

func TestAttachmentValidationAndAtomicity(t *testing.T) {
	for name, data := range map[string][]byte{"vacio": {}, "html": []byte("<html><script>alert(1)</script></html>"), "svg": []byte("<svg xmlns='http://www.w3.org/2000/svg'></svg>"), "grande": bytes.Repeat([]byte("a"), maxSchoolAttachment+1)} {
		t.Run(name, func(t *testing.T) {
			a := fixture(t)
			body := map[string]any{"nombre": "Prueba", "telefono": "999000123", "lista": "Cuadernos", "adjunto": map[string]any{"nombre": "lista.txt", "tipo": "text/plain", "datos": data}}
			if w := request(a, "POST", "/api/publico/solicitudes", body, nil); w.Code != 400 {
				t.Fatal(w.Code, w.Body.String())
			}
			if count(t, a, "SELECT COUNT(*) FROM cotizaciones") != 0 || count(t, a, "SELECT COUNT(*) FROM clientes") != 0 {
				t.Fatal("solicitud inválida dejó datos")
			}
		})
	}
	a := fixture(t)
	if _, err := a.DB.Exec("CREATE TRIGGER fallo_adjunto BEFORE INSERT ON cotizacion_adjuntos BEGIN SELECT RAISE(ABORT,'fallo simulado'); END;"); err != nil {
		t.Fatal(err)
	}
	body := map[string]any{"nombre": "Prueba", "telefono": "999000123", "lista": "", "adjunto": map[string]any{"nombre": "lista.txt", "tipo": "text/plain", "datos": []byte("2 cuadernos")}}
	if w := request(a, "POST", "/api/publico/solicitudes", body, nil); w.Code != 500 {
		t.Fatal(w.Code, w.Body.String())
	}
	if count(t, a, "SELECT COUNT(*) FROM cotizaciones") != 0 || count(t, a, "SELECT COUNT(*) FROM clientes") != 0 {
		t.Fatal("falló la reversión de archivo, cliente y solicitud")
	}
}

func TestAttachmentOnlyAndSelectionValidation(t *testing.T) {
	a := fixture(t)
	body := map[string]any{"nombre": "Prueba", "telefono": "999000123", "lista": "", "adjunto": map[string]any{"nombre": "../lista.pdf", "tipo": "application/pdf", "datos": []byte("%PDF-1.7\ncontenido de prueba\n%%EOF")}}
	if w := request(a, "POST", "/api/publico/solicitudes", body, nil); w.Code != 201 {
		t.Fatal(w.Code, w.Body.String())
	}
	var filename string
	if err := a.DB.QueryRow("SELECT nombre FROM cotizacion_adjuntos").Scan(&filename); err != nil || filename != "lista.pdf" {
		t.Fatal("nombre no normalizado", filename, err)
	}
	for _, selection := range [][]models.SchoolSelection{{{ProductoID: 999, Cantidad: 1}}, {{ProductoID: 1, Cantidad: 0}}, {{Solicitado: "", Cantidad: 1}}, {{ProductoID: 1, Cantidad: 1}, {ProductoID: 1, Cantidad: 1}}} {
		body["seleccion"] = selection
		if w := request(a, "POST", "/api/publico/solicitudes", body, nil); w.Code != 400 {
			t.Fatal(w.Code, w.Body.String())
		}
	}
	if count(t, a, "SELECT COUNT(*) FROM cotizaciones") != 1 {
		t.Fatal("selección inválida persistió")
	}
}
