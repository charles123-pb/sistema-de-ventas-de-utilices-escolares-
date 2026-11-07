package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
	_ "time/tzdata"
	"utilventa/internal/middleware"
	"utilventa/internal/models"
	"utilventa/internal/repository"
	"utilventa/internal/services"
)

func fixture(t *testing.T) *App {
	t.Helper()
	db, e := repository.Open(filepath.Join(t.TempDir(), "test.db"))
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() {
		db.Close()
	})
	hash, _ := bcrypt.GenerateFromPassword([]byte("prueba-segura-123"), bcrypt.MinCost)
	for _, role := range []string{
		"administrador", "vendedor"} {
		if _, e = db.Exec("INSERT INTO usuarios(nombre,usuario,password_hash,rol,fecha) VALUES(?,?,?,?,?)", role, role, string(hash), role, services.Now()); e != nil {
			t.Fatal(e)
		}
	}
	_, e = db.Exec("INSERT INTO productos(codigo,nombre,categoria_id,costo,precio,stock,fecha) VALUES('P1','Cuaderno',1,200,350,5,?)", services.Now())
	if e != nil {
		t.Fatal(e)
	}
	return &App{
		DB: db, Origin: "http://localhost:5173"}
}
func request(a *App, method, path string, body any, cookie *http.Cookie) *httptest.ResponseRecorder {
	var b bytes.Buffer
	if body != nil {
		json.NewEncoder(&b).Encode(body)
	}
	r := httptest.NewRequest(method, path, &b)
	r.RemoteAddr = "127.0.0.1:1234"
	if body != nil {
		r.Header.Set("Content-Type", "application/json")
		r.Header.Set("Origin", a.Origin)
	}
	if cookie != nil {
		r.AddCookie(cookie)
	}
	w := httptest.NewRecorder()
	a.ServeHTTP(w, r)
	return w
}
func login(t *testing.T, a *App, role string) *http.Cookie {
	t.Helper()
	w := request(a, "POST", "/api/login", map[string]string{
		"usuario": role, "password": "prueba-segura-123"}, nil)
	if w.Code != 200 {
		t.Fatal(w.Code, w.Body.String())
	}
	return w.Result().Cookies()[0]
}
func TestAuthPermissionsAndExpiry(t *testing.T) {
	a := fixture(t)
	if w := request(a, "GET", "/api/me", nil, nil); w.Code != 401 {
		t.Fatal(w.Code)
	}
	if w := request(a, "POST", "/api/login", map[string]string{
		"usuario": "administrador", "password": "mala"}, nil); w.Code != 401 {
		t.Fatal(w.Code)
	}
	c := login(t, a, "administrador")
	if !c.HttpOnly || c.SameSite != http.SameSiteLaxMode {
		t.Fatal("cookie insegura")
	}
	if w := request(a, "GET", "/api/me", nil, c); w.Code != 200 {
		t.Fatal(w.Code)
	}
	seller := login(t, a, "vendedor")
	for _, p := range []string{
		"/api/usuarios", "/api/movimientos"} {
		if w := request(a, "GET", p, nil, seller); w.Code != 403 {
			t.Fatal(p, w.Code)
		}
	}
	w := request(a, "GET", "/api/productos", nil, seller)
	if strings.Contains(w.Body.String(), `"costo"`) {
		t.Fatal("costo expuesto al vendedor")
	}
	a.DB.Exec("UPDATE sesiones SET expira='2000-01-01T00:00:00Z'")
	if w := request(a, "GET", "/api/me", nil, c); w.Code != 401 {
		t.Fatal("sesión vencida aceptada")
	}
}
func input(key string, qty int64) models.SaleInput {
	return models.SaleInput{
		Items: []models.Item{
			{
				ProductoID: 1, Cantidad: qty, Precio: 1}}, Clave: key, Pago: "efectivo", Recibido: "100.00"}
}
func count(t *testing.T, a *App, q string) int64 {
	t.Helper()
	var n int64
	if e := a.DB.QueryRow(q).Scan(&n); e != nil {
		t.Fatal(e)
	}
	return n
}
func TestSaleAndHistoricalPrices(t *testing.T) {
	a := fixture(t)
	in := input("idempotencia-correcta", 2)
	id, e := services.Sell(a.DB, 1, in)
	if e != nil {
		t.Fatal(e)
	}
	if count(t, a, "SELECT stock FROM productos WHERE id=1") != 3 || count(t, a, "SELECT total FROM ventas") != 700 {
		t.Fatal("stock o total incorrecto")
	}
	retry, e := services.Sell(a.DB, 1, in)
	if e != nil || retry != id || count(t, a, "SELECT COUNT(*) FROM ventas") != 1 {
		t.Fatal("reintento duplicado")
	}
	in.Items[0].Cantidad = 1
	if _, e = services.Sell(a.DB, 1, in); e == nil {
		t.Fatal("misma clave con otro cuerpo aceptada")
	}
	a.DB.Exec("UPDATE productos SET precio=900,costo=800,nombre='Nuevo nombre' WHERE id=1")
	if count(t, a, "SELECT precio FROM detalle_venta") != 350 || count(t, a, "SELECT costo FROM detalle_venta") != 200 {
		t.Fatal("historia modificada")
	}
	var name string
	a.DB.QueryRow("SELECT nombre FROM detalle_venta").Scan(&name)
	if name != "Cuaderno" {
		t.Fatal(name)
	}
}
func TestSaleValidationRollback(t *testing.T) {
	for _, tc := range []struct {
		name     string
		qty      int64
		inactive bool
	}{
		{
			"insuficiente", 6, false}, {
			"cero", 0, false}, {
			"negativa", -1, false}, {
			"inactivo", 1, true}} {
		t.Run(tc.name, func(t *testing.T) {
			a := fixture(t)
			if tc.inactive {
				a.DB.Exec("UPDATE productos SET activo=0")
			}
			if _, e := services.Sell(a.DB, 1, input("validacion-carrito-"+tc.name, tc.qty)); e == nil {
				t.Fatal("se aceptó venta inválida")
			}
			if count(t, a, "SELECT COUNT(*) FROM ventas") != 0 || count(t, a, "SELECT stock FROM productos") != 5 || count(t, a, "SELECT COUNT(*) FROM movimientos") != 0 {
				t.Fatal("cambios parciales")
			}
		})
	}
	a := fixture(t)
	in := input("rollback-multiple-123", 1)
	in.Items = append(in.Items, models.Item{
		ProductoID: 999, Cantidad: 1})
	if _, e := services.Sell(a.DB, 1, in); e == nil {
		t.Fatal("producto inexistente aceptado")
	}
	if count(t, a, "SELECT stock FROM productos") != 5 {
		t.Fatal("stock alterado")
	}
}
func TestConcurrentSales(t *testing.T) {
	a := fixture(t)
	var wg sync.WaitGroup
	results := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			_, e := services.Sell(a.DB, 1, input(fmt.Sprintf("concurrente-clave-%d", i), 4))
			results <- e
		}(i)
	}
	wg.Wait()
	close(results)
	ok := 0
	for e := range results {
		if e == nil {
			ok++
		}
	}
	if ok != 1 || count(t, a, "SELECT stock FROM productos") != 1 || count(t, a, "SELECT COUNT(*) FROM ventas") != 1 {
		t.Fatal("venta concurrente no protegida")
	}
}
func quoteFixture(t *testing.T, a *App, c *http.Cookie) (int64, string) {
	t.Helper()
	w := request(a, "POST", "/api/publico/solicitudes", map[string]any{
		"nombre": "Cliente de prueba", "telefono": "999123456", "lista": "2 cuadernos"}, nil)
	if w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	var created struct {
		ID     int64  `json:"id"`
		Enlace string `json:"enlace"`
	}
	json.Unmarshal(w.Body.Bytes(), &created)
	return created.ID, "/api/publico/seguimiento/" + strings.TrimPrefix(created.Enlace, "/seguimiento/")
}
func TestQuoteRevisionExpiryConversionAndOrder(t *testing.T) {
	a := fixture(t)
	c := login(t, a, "administrador")
	id, private := quoteFixture(t, a, c)
	if w := request(a, "GET", "/api/publico/seguimiento/"+strings.Repeat("0", 64), nil, nil); w.Code != 404 {
		t.Fatal("token ajeno aceptado")
	}
	expires := time.Now().UTC().AddDate(0, 0, 2).Format("2006-01-02")
	proposal := map[string]any{
		"items": []models.Item{
			{
				ProductoID: 1, Cantidad: 2, Solicitado: "Cuadernos"}}, "vigencia": expires, "enviar": true, "revision": 1}
	path := fmt.Sprintf("/api/cotizaciones/%d", id)
	if w := request(a, "PUT", path, proposal, c); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if count(t, a, "SELECT stock FROM productos") != 5 {
		t.Fatal("cotización descontó stock")
	}
	if w := request(a, "POST", private, map[string]any{
		"accion": "aceptada", "revision": 1}, nil); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	w := request(a, "POST", "/api/pedidos", map[string]any{
		"cotizacion_id": id}, c)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w := request(a, "PUT", "/api/pedidos/1", map[string]string{
		"estado": "entregado"}, c); w.Code != 409 {
		t.Fatal("entregado sin pago")
	}
	if w := request(a, "PUT", path, proposal, c); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w := request(a, "POST", private, map[string]any{
		"accion": "aceptada", "revision": 1}, nil); w.Code != 409 {
		t.Fatal("aceptación de revisión antigua")
	}
	a.DB.Exec("UPDATE cotizaciones SET vigencia='2000-01-01T00:00:00Z' WHERE id=?", id)
	if w := request(a, "POST", private, map[string]any{
		"accion": "aceptada", "revision": 2}, nil); w.Code != 409 {
		t.Fatal("aceptación vencida")
	}
	proposal["revision"] = 2
	if w := request(a, "PUT", path, proposal, c); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w := request(a, "POST", private, map[string]any{
		"accion": "aceptada", "revision": 3}, nil); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	a.DB.Exec("UPDATE productos SET precio=999 WHERE id=1")
	sale := input("convertir-cotizacion-123", 1)
	sale.Items = nil
	sale.CotizacionID = &id
	if _, e := services.Sell(a.DB, 1, sale); e != nil {
		t.Fatal(e)
	}
	if count(t, a, "SELECT total FROM ventas") != 700 {
		t.Fatal("no respetó precio cotizado")
	}
	sale.Clave = "segunda-conversion-123"
	if _, e := services.Sell(a.DB, 1, sale); e == nil {
		t.Fatal("doble conversión")
	}
	if w := request(a, "PUT", "/api/pedidos/1", map[string]string{
		"estado": "entregado"}, c); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
}
func TestLimaRangeCSVAndCSRF(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/ventas?desde=2026-10-27&hasta=2026-10-27", nil)
	from, to, e := DateRange(r)
	if e != nil || from != "2026-10-27T05:00:00Z" || to != "2026-10-28T05:00:00Z" {
		t.Fatal(from, to, e)
	}
	for _, s := range []string{
		"=1+2", " @SUM(A1)", "\tcmd", "-1"} {
		if !strings.HasPrefix(CSVSafe(s), "'") {
			t.Fatal("fórmula CSV no protegida")
		}
	}
	a := fixture(t)
	c := login(t, a, "administrador")
	req := httptest.NewRequest("POST", "/api/logout", strings.NewReader("{}"))
	req.Header.Set("Origin", "https://otro.example")
	req.Header.Set("Content-Type", "application/json")
	req.AddCookie(c)
	w := httptest.NewRecorder()
	a.ServeHTTP(w, req)
	if w.Code != 403 {
		t.Fatal("CSRF aceptado")
	}
	var hash string
	a.DB.QueryRow("SELECT hash FROM sesiones").Scan(&hash)
	if hash == c.Value || hash != middleware.Hash(c.Value) {
		t.Fatal("token sin proteger")
	}
}
func TestInventoryWeightedCostAndPermissions(t *testing.T) {
	a := fixture(t)
	c := login(t, a, "administrador")
	body := map[string]any{
		"producto_id": 1, "tipo": "entrada", "cantidad": 5, "costo": "3.01", "motivo": "Compra"}
	if w := request(a, "POST", "/api/movimientos", body, c); w.Code != 201 {
		t.Fatal(w.Body.String())
	}
	if count(t, a, "SELECT stock FROM productos") != 10 || count(t, a, "SELECT costo FROM productos") != 251 {
		t.Fatal("promedio ponderado incorrecto")
	}
	body["tipo"] = "ajuste"
	body["cantidad"] = -11
	if w := request(a, "POST", "/api/movimientos", body, c); w.Code != 409 {
		t.Fatal(w.Body.String())
	}
	if count(t, a, "SELECT stock FROM productos") != 10 {
		t.Fatal("stock alterado")
	}
	seller := login(t, a, "vendedor")
	if w := request(a, "POST", "/api/movimientos", body, seller); w.Code != 403 {
		t.Fatal("permiso inválido")
	}
	pub := request(a, "GET", "/api/publico/productos", nil, nil)
	if strings.Contains(pub.Body.String(), `"costo"`) {
		t.Fatal("costo público")
	}
}
func TestFailureAfterStockWriteRollsBack(t *testing.T) {
	a := fixture(t)
	if _, e := a.DB.Exec("CREATE TRIGGER fallo_movimiento BEFORE INSERT ON movimientos BEGIN SELECT RAISE(ABORT,'fallo controlado'); END"); e != nil {
		t.Fatal(e)
	}
	if _, e := services.Sell(a.DB, 1, input("fallo-transaccion-123", 2)); e == nil {
		t.Fatal("se esperaba fallo")
	}
	if count(t, a, "SELECT stock FROM productos") != 5 || count(t, a, "SELECT COUNT(*) FROM ventas") != 0 || count(t, a, "SELECT COUNT(*) FROM detalle_venta") != 0 {
		t.Fatal("la transacción dejó cambios parciales")
	}
}

func TestStructuredAlternativesPreserveSnapshot(t *testing.T) {
	a := fixture(t)
	cookie := login(t, a, "administrador")
	id, private := quoteFixture(t, a, cookie)
	_, err := a.DB.Exec("INSERT INTO productos(codigo,nombre,categoria_id,costo,precio,stock,fecha) VALUES('P2','Otra marca',1,100,250,5,?)", services.Now())
	if err != nil {
		t.Fatal(err)
	}
	path := fmt.Sprintf("/api/cotizaciones/%d", id)
	input := map[string]any{
		"revision": 1, "vigencia": time.Now().AddDate(0, 0, 2).Format("2006-01-02"), "enviar": true,
		"items": []models.Item{{ProductoID: 1, Cantidad: 2, Solicitado: "Cuadernos", Opciones: []models.Opcion{{ProductoID: 1, Precio: 1}, {ProductoID: 2, Precio: 1}}}},
	}
	response := request(a, "PUT", path, input, cookie)
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	var result struct {
		Items []models.Item `json:"items"`
	}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if len(result.Items) != 1 || len(result.Items[0].Opciones) != 2 || result.Items[0].Opciones[0].Precio != 350 || result.Items[0].Opciones[1].Precio != 250 {
		t.Fatal("precios de alternativas no calculados por servidor")
	}
	a.DB.Exec("UPDATE productos SET precio=999 WHERE id=1")
	response = request(a, "GET", private, nil, nil)
	if response.Code != 200 {
		t.Fatal(response.Body.String())
	}
	json.Unmarshal(response.Body.Bytes(), &result)
	if result.Items[0].Precio != 350 || result.Items[0].Opciones[0].Precio != 350 {
		t.Fatal("se alteró la fotografía histórica")
	}
	input["items"] = []models.Item{{ProductoID: 2, Cantidad: 1, Solicitado: "Cuadernos", Opciones: []models.Opcion{{ProductoID: 1}}}}
	if response = request(a, "PUT", path, input, cookie); response.Code != 400 {
		t.Fatal("se eligió un producto ajeno a las alternativas", response.Body.String())
	}
	if count(t, a, "SELECT revision FROM cotizaciones") != 1 {
		t.Fatal("la validación fallida dejó una revisión parcial")
	}
}

func TestCustomerHistoryPagination(t *testing.T) {
	a := fixture(t)
	cookie := login(t, a, "administrador")
	if _, err := a.DB.Exec("INSERT INTO clientes(id,nombre,telefono) VALUES(1,'Historial','999123456')"); err != nil {
		t.Fatal(err)
	}
	for i := 1; i <= 61; i++ {
		_, err := a.DB.Exec("INSERT INTO ventas(usuario_id,cliente_id,fecha,total,costo,pago,recibido,clave,huella) VALUES(1,1,?,100,50,'efectivo',100,?,'prueba')", services.Now(), fmt.Sprintf("historial-%d", i))
		if err != nil {
			t.Fatal(err)
		}
		_, err = a.DB.Exec("INSERT INTO cotizaciones(token_hash,cliente_id,nombre,telefono,lista,fecha) VALUES(?,1,'Historial','999123456','Cuadernos',?)", fmt.Sprintf("hash-%d", i), services.Now())
		if err != nil {
			t.Fatal(err)
		}
	}
	for _, test := range []struct{ page, size int }{{1, 30}, {2, 30}, {3, 1}, {4, 0}} {
		response := request(a, "GET", fmt.Sprintf("/api/clientes/1?pagina=%d", test.page), nil, cookie)
		if response.Code != 200 {
			t.Fatal(response.Body.String())
		}
		var result struct {
			Ventas       []map[string]any `json:"ventas"`
			Cotizaciones []map[string]any `json:"cotizaciones"`
		}
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if len(result.Ventas) != test.size || len(result.Cotizaciones) != test.size {
			t.Fatalf("página %d: cantidades incorrectas", test.page)
		}
	}
}
