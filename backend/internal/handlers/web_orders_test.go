package handlers

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"utilventa/internal/models"
	"utilventa/internal/services"
)

func webBody(key string) map[string]any {
	return map[string]any{"nombre": "Cliente web", "telefono": "999111222", "observaciones": "Por la tarde", "clave": key, "items": []map[string]any{{"producto_id": 1, "cantidad": 2}}}
}
func createWeb(t *testing.T, a *App, key string) (int64, string, string) {
	t.Helper()
	w := request(a, "POST", "/api/publico/pedidos", webBody(key), nil)
	var result struct {
		ID     int64  `json:"id"`
		Enlace string `json:"enlace"`
		Codigo string `json:"codigo_recojo"`
	}
	if w.Code != 201 || json.Unmarshal(w.Body.Bytes(), &result) != nil {
		t.Fatal(w.Code, w.Body.String())
	}
	return result.ID, result.Enlace, result.Codigo
}
func TestWebOrderSecureCheckoutAndPickup(t *testing.T) {
	a := fixture(t)
	seller := login(t, a, "vendedor")
	id, link, code := createWeb(t, a, "checkout-idempotent-key-0001")
	if len(code) != 10 || count(t, a, "SELECT stock FROM productos WHERE id=1") != 5 || count(t, a, "SELECT total FROM pedidos_web") != 700 || count(t, a, "SELECT COUNT(*) FROM ventas") != 0 {
		t.Fatal("pedido cambió stock o pago")
	}
	w := request(a, "POST", "/api/publico/pedidos", webBody("checkout-idempotent-key-0001"), nil)
	if w.Code != 200 || count(t, a, "SELECT COUNT(*) FROM pedidos_web") != 1 || !strings.Contains(w.Body.String(), link) {
		t.Fatal("reintento duplicado", w.Body.String())
	}
	changed := webBody("checkout-idempotent-key-0001")
	changed["nombre"] = "Otra persona"
	if w = request(a, "POST", "/api/publico/pedidos", changed, nil); w.Code != 409 {
		t.Fatal("reutilizó clave para otros datos")
	}
	if w = request(a, "POST", "/api/publico/pedidos", webBody("another-checkout-key-0002"), nil); w.Code != 409 {
		t.Fatal("duplicado activo aceptado")
	}
	tampered := webBody("invalid-price-request-0003")
	tampered["pago"] = "confirmado"
	if w = request(a, "POST", "/api/publico/pedidos", tampered, nil); w.Code != 400 {
		t.Fatal("aceptó pago declarado por cliente")
	}
	publicPath := "/api/publico/pedidos/" + strings.TrimPrefix(link, "/pedido/")
	if w = request(a, "GET", publicPath, nil, nil); w.Code != 200 || !strings.Contains(w.Body.String(), code) || strings.Contains(w.Body.String(), "codigo_hash") || strings.Contains(w.Body.String(), "token_hash") {
		t.Fatal(w.Body.String())
	}
	if w = request(a, "GET", "/api/publico/pedidos/"+strings.Repeat("0", 64), nil, nil); w.Code != 404 {
		t.Fatal("enlace ajeno aceptado")
	}
	path := fmt.Sprintf("/api/pedidos-web/%d", id)
	for _, state := range []string{"preparando", "listo"} {
		if w = request(a, "PUT", path, map[string]string{"estado": state}, seller); w.Code != 200 {
			t.Fatal(w.Body.String())
		}
	}
	if w = request(a, "PUT", path, map[string]string{"estado": "entregado", "codigo": code}, seller); w.Code != 409 {
		t.Fatal("entrega sin pago")
	}
	a.DB.Exec("UPDATE productos SET precio=999 WHERE id=1")
	input := models.SaleInput{PedidoWebID: &id, Clave: "pago-pedido-web-000001", Pago: "yape"}
	w = request(a, "POST", "/api/ventas", input, seller)
	if w.Code != 200 || count(t, a, "SELECT stock FROM productos WHERE id=1") != 3 || count(t, a, "SELECT total FROM ventas") != 700 {
		t.Fatal(w.Body.String())
	}
	if w = request(a, "POST", "/api/ventas", input, seller); w.Code != 200 || count(t, a, "SELECT COUNT(*) FROM ventas") != 1 {
		t.Fatal("pago duplicado")
	}
	a.DB.Exec("UPDATE pedidos_web SET vence='2000-01-01T00:00:00Z'")
	if err := services.ExpireWebOrders(a.DB); err != nil {
		t.Fatal(err)
	}
	if count(t, a, "SELECT COUNT(*) FROM pedidos_web WHERE estado='listo'") != 1 {
		t.Fatal("venció un pedido pagado")
	}
	input.Clave = "otro-pago-mismo-pedido"
	if w = request(a, "POST", "/api/ventas", input, seller); w.Code != 409 {
		t.Fatal("doble venta")
	}
	if w = request(a, "PUT", path, map[string]string{"estado": "cancelado"}, seller); w.Code != 409 {
		t.Fatal("canceló pedido pagado")
	}
	if w = request(a, "PUT", path, map[string]string{"estado": "entregado", "codigo": "INCORRECTO"}, seller); w.Code != 409 {
		t.Fatal("código inválido aceptado")
	}
	if w = request(a, "PUT", path, map[string]string{"estado": "entregado", "codigo": code}, seller); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w = request(a, "PUT", path, map[string]string{"estado": "entregado", "codigo": code}, seller); w.Code != 409 {
		t.Fatal("entrega repetida")
	}
	if count(t, a, "SELECT COUNT(*) FROM pedidos_web WHERE codigo_hash='' AND entrega_usuario_id=2 AND entrega_fecha<>''") != 1 {
		t.Fatal("falta consumo de código o responsable")
	}
	if w = request(a, "GET", publicPath, nil, nil); strings.Contains(w.Body.String(), code) {
		t.Fatal("código consumido expuesto")
	}
}
func TestWebOrderExpiryStockAndCancellation(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	id, link, _ := createWeb(t, a, "web-expiry-checkout-key")
	a.DB.Exec("UPDATE pedidos_web SET vence='2000-01-01T00:00:00Z'")
	path := "/api/publico/pedidos/" + strings.TrimPrefix(link, "/pedido/")
	if w := request(a, "GET", path, nil, nil); w.Code != 200 || !strings.Contains(w.Body.String(), "vencido") {
		t.Fatal(w.Body.String())
	}
	services.ExpireWebOrders(a.DB)
	if count(t, a, "SELECT COUNT(*) FROM pedidos_web_eventos WHERE accion='vencido'") != 1 || count(t, a, "SELECT stock FROM productos WHERE id=1") != 5 {
		t.Fatal("vencimiento repetido o modificó stock")
	}
	if _, e := services.Sell(a.DB, 1, models.SaleInput{PedidoWebID: &id, Clave: "expired-order-sale-key", Pago: "efectivo", Recibido: "20.00"}); e == nil {
		t.Fatal("cobró pedido vencido")
	}
	id, _, _ = createWeb(t, a, "web-stock-checkout-key-2")
	a.DB.Exec("UPDATE productos SET stock=1 WHERE id=1")
	in := models.SaleInput{PedidoWebID: &id, Clave: "stock-order-sale-key", Pago: "efectivo", Recibido: "20.00"}
	if _, e := services.Sell(a.DB, 1, in); e == nil || count(t, a, "SELECT COUNT(*) FROM ventas") != 0 {
		t.Fatal("venta sin stock")
	}
	a.DB.Exec("UPDATE productos SET stock=5 WHERE id=1")
	saleID, e := services.Sell(a.DB, 1, in)
	if e != nil {
		t.Fatal(e)
	}
	w := request(a, "POST", fmt.Sprintf("/api/ventas/%d/anular", saleID), map[string]any{"motivo": "Cancelado por el cliente", "productos_devueltos": true}, admin)
	if w.Code != 200 || count(t, a, "SELECT COUNT(*) FROM pedidos_web WHERE estado='cancelado'") != 1 || count(t, a, "SELECT stock FROM productos WHERE id=1") != 5 {
		t.Fatal(w.Body.String())
	}
}
func TestWebOrderConcurrentDuplicatesAndPhoneLimit(t *testing.T) {
	a := fixture(t)
	var wg sync.WaitGroup
	codes := make(chan int, 2)
	for _, key := range []string{"parallel-order-key-one", "parallel-order-key-two"} {
		wg.Add(1)
		go func(key string) {
			defer wg.Done()
			codes <- request(a, "POST", "/api/publico/pedidos", webBody(key), nil).Code
		}(key)
	}
	wg.Wait()
	close(codes)
	success := 0
	for code := range codes {
		if code == 201 {
			success++
		} else if code != 409 {
			t.Fatal(code)
		}
	}
	if success != 1 || count(t, a, "SELECT COUNT(*) FROM pedidos_web") != 1 {
		t.Fatal("duplicado concurrente")
	}
	for n := 0; n < 4; n++ {
		body := webBody(fmt.Sprintf("phone-limit-checkout-%d", n))
		body["observaciones"] = fmt.Sprint(n)
		if w := request(a, "POST", "/api/publico/pedidos", body, nil); w.Code != 201 {
			t.Fatal(w.Body.String())
		}
	}
	body := webBody("phone-limit-checkout-final")
	body["observaciones"] = "final"
	if w := request(a, "POST", "/api/publico/pedidos", body, nil); w.Code != 429 {
		t.Fatal("sin límite por teléfono", w.Body.String())
	}
}
func TestStoreSettingsAndAutomaticBackups(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	if w := request(a, "GET", "/api/configuracion", nil, seller); w.Code != 403 {
		t.Fatal("configuración privada expuesta")
	}
	body := map[string]any{"nombre": "Librería de prueba", "direccion": "Dirección de prueba", "telefono": "999111333", "horario": "Lunes a sábado", "logo": "", "pedido_horas": 12, "respaldo_automatico": true, "respaldo_horas": 24}
	if w := request(a, "PUT", "/api/configuracion", body, seller); w.Code != 403 {
		t.Fatal("vendedor editó configuración")
	}
	if w := request(a, "PUT", "/api/configuracion", body, admin); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if count(t, a, "SELECT COUNT(*) FROM configuracion_historial WHERE usuario_id=1") != 1 {
		t.Fatal("sin auditoría")
	}
	w := request(a, "GET", "/api/publico/configuracion", nil, nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "Librería de prueba") || strings.Contains(w.Body.String(), "checkout_secret") || strings.Contains(w.Body.String(), "respaldo") {
		t.Fatal("configuración pública inválida", w.Body.String())
	}
	body["logo"] = "javascript:alert(1)"
	if w = request(a, "PUT", "/api/configuracion", body, admin); w.Code != 400 {
		t.Fatal("logo inseguro")
	}
	a.BackupDir = filepath.Join(t.TempDir(), "backups")
	if e := a.Maintenance(); e != nil {
		t.Fatal(e)
	}
	files, _ := os.ReadDir(a.BackupDir)
	if len(files) != 1 {
		t.Fatal("sin respaldo automático")
	}
	info, _ := files[0].Info()
	if os.PathSeparator == '/' && info.Mode().Perm() != 0600 {
		t.Fatal("respaldo no privado")
	}
	if e := a.Maintenance(); e != nil {
		t.Fatal(e)
	}
	files, _ = os.ReadDir(a.BackupDir)
	if len(files) != 1 {
		t.Fatal("respaldo repetido antes del intervalo")
	}
	a.DB.Exec("UPDATE configuracion_tienda SET ultimo_respaldo='2000-01-01T00:00:00Z',respaldo_automatico=0")
	if e := a.Maintenance(); e != nil {
		t.Fatal(e)
	}
	files, _ = os.ReadDir(a.BackupDir)
	if len(files) != 1 {
		t.Fatal("respaldo desactivado ejecutado")
	}
	a.DB.Exec("UPDATE configuracion_tienda SET respaldo_automatico=1")
	a.BackupDir = filepath.Join(t.TempDir(), "not-a-directory")
	os.WriteFile(a.BackupDir, []byte("test"), 0600)
	if e := a.Maintenance(); e == nil {
		t.Fatal("fallo de respaldo ignorado")
	}
	settings, _ := services.ReadSettings(a.DB)
	if settings.RespaldoError == "" {
		t.Fatal("fallo no visible")
	}
}

func TestWebOrderConcurrentPayments(t *testing.T) {
	a := fixture(t)
	id, _, _ := createWeb(t, a, "concurrent-pay-order-key")
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for _, key := range []string{"concurrent-payment-one", "concurrent-payment-two"} {
		wg.Add(1)
		go func(key string) {
			defer wg.Done()
			_, e := services.Sell(a.DB, 1, models.SaleInput{PedidoWebID: &id, Clave: key, Pago: "efectivo", Recibido: "10.00"})
			results <- e
		}(key)
	}
	wg.Wait()
	close(results)
	success := 0
	for e := range results {
		if e == nil {
			success++
		}
	}
	if success != 1 || count(t, a, "SELECT COUNT(*) FROM ventas") != 1 || count(t, a, "SELECT stock FROM productos WHERE id=1") != 3 {
		t.Fatal("cobro concurrente descontó dos veces")
	}
}
