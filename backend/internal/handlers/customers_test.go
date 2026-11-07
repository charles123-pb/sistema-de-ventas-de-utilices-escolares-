package handlers

import (
	"encoding/json"
	"fmt"
	"testing"
	"utilventa/internal/models"
)

func TestCheckoutCustomers(t *testing.T) {
	a := fixture(t)
	cookie := login(t, a, "vendedor")
	company := map[string]any{"tipo": "empresa", "nombre": "Empresa de prueba", "documento": "20123456789", "direccion": "Jr. Prueba 123", "telefono": ""}
	for _, doc := range []string{"123", "2012345678a", ""} {
		company["documento"] = doc
		if result := request(a, "POST", "/api/clientes", company, cookie); result.Code != 400 {
			t.Fatalf("documento inválido aceptado: %s", result.Body.String())
		}
	}
	company["documento"] = "20123456789"
	company["direccion"] = ""
	if result := request(a, "POST", "/api/clientes", company, cookie); result.Code != 400 {
		t.Fatal("empresa sin dirección aceptada")
	}
	company["direccion"] = "Jr. Prueba 123"
	result := request(a, "POST", "/api/clientes", company, cookie)
	var created struct {
		ID int64 `json:"id"`
	}
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &created) != nil || created.ID == 0 {
		t.Fatal(result.Body.String())
	}
	if result = request(a, "POST", "/api/clientes", company, cookie); result.Code != 409 {
		t.Fatal("documento repetido aceptado")
	}
	result = request(a, "GET", "/api/clientes?q=20123456789&tipo=empresa", nil, cookie)
	var clients []map[string]any
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &clients) != nil || len(clients) != 1 {
		t.Fatal(result.Body.String())
	}
	result = request(a, "GET", "/api/clientes?q=20123456789&tipo=persona", nil, cookie)
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &clients) != nil || len(clients) != 0 {
		t.Fatal("filtro por tipo incorrecto")
	}
	input := models.SaleInput{ClienteID: &created.ID, Clave: "venta-empresa-prueba-unica", Pago: "efectivo", Recibido: "10.00", Items: []models.Item{{ProductoID: 1, Cantidad: 1}}}
	result = request(a, "POST", "/api/ventas", input, cookie)
	var sale models.Sale
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &sale) != nil || sale.ClienteNombre != "Empresa de prueba" || sale.ClienteDocumento != "20123456789" || sale.ClienteTipo != "empresa" || sale.ClienteDireccion != "Jr. Prueba 123" {
		t.Fatal(result.Body.String())
	}
	company["nombre"] = "Nueva razón social"
	if result = request(a, "PUT", fmt.Sprintf("/api/clientes/%d", created.ID), company, cookie); result.Code != 200 {
		t.Fatal(result.Body.String())
	}
	result = request(a, "GET", fmt.Sprintf("/api/ventas/%d", sale.ID), nil, cookie)
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &sale) != nil || sale.ClienteNombre != "Empresa de prueba" {
		t.Fatal("se alteró el cliente histórico", result.Body.String())
	}
	// A person needs only a name; an anonymous sale does not create a customer profile.
	if result = request(a, "POST", "/api/clientes", map[string]any{"nombre": "Persona ocasional", "tipo": "persona"}, cookie); result.Code != 200 {
		t.Fatal(result.Body.String())
	}
	input.ClienteID = nil
	input.Clave = "venta-consumidor-final-unica"
	result = request(a, "POST", "/api/ventas", input, cookie)
	if result.Code != 200 || json.Unmarshal(result.Body.Bytes(), &sale) != nil || sale.ClienteNombre != "" {
		t.Fatal(result.Body.String())
	}
	if count(t, a, "SELECT COUNT(*) FROM clientes") != 2 {
		t.Fatal("la venta anónima creó un cliente")
	}
	invalid := int64(9999)
	input.ClienteID = &invalid
	input.Clave = "venta-cliente-invalido-unica"
	if result = request(a, "POST", "/api/ventas", input, cookie); result.Code != 409 {
		t.Fatal("cliente inexistente aceptado")
	}
	if count(t, a, "SELECT stock FROM productos WHERE id=1") != 3 {
		t.Fatal("la venta rechazada alteró el stock")
	}
}
