package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"utilventa/internal/models"
	"utilventa/internal/repository"
	"utilventa/internal/services"
)

func makeOperationSale(t *testing.T, a *App, cookie *http.Cookie, key, payment string, quantity int64) models.Sale {
	t.Helper()
	w := request(a, "POST", "/api/ventas", models.SaleInput{Items: []models.Item{{ProductoID: 1, Cantidad: quantity}}, Clave: key, Pago: payment, Recibido: "100.00"}, cookie)
	var v models.Sale
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil {
		t.Fatal(w.Body.String())
	}
	return v
}
func TestCancelSaleAccountingAndPermissions(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	v := makeOperationSale(t, a, seller, "venta-para-anular-0001", "efectivo", 2)
	path := fmt.Sprintf("/api/ventas/%d/anular", v.ID)
	body := map[string]any{"motivo": "Venta con cantidad equivocada", "productos_devueltos": true}
	if w := request(a, "POST", path, body, seller); w.Code != 403 {
		t.Fatal(w.Body.String())
	}
	body["productos_devueltos"] = false
	if w := request(a, "POST", path, body, admin); w.Code != 400 {
		t.Fatal("no confirmó la devolución")
	}
	body["productos_devueltos"] = true
	w := request(a, "POST", path, body, admin)
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil || v.Estado != "anulada" || v.AnulacionUsuario != "administrador" || v.AnulacionFecha == "" {
		t.Fatal(w.Body.String())
	}
	if count(t, a, "SELECT stock FROM productos WHERE id=1") != 5 || count(t, a, "SELECT COUNT(*) FROM movimientos WHERE tipo='anulacion'") != 1 {
		t.Fatal("no se restituyó el inventario una sola vez")
	}
	if w = request(a, "POST", path, body, admin); w.Code != 409 {
		t.Fatal("se anuló dos veces")
	}
	if count(t, a, "SELECT stock FROM productos WHERE id=1") != 5 {
		t.Fatal("doble restitución")
	}
	for _, path := range []string{"/api/reportes?tipo=ventas", "/api/reportes?tipo=productos"} {
		w = request(a, "GET", path, nil, admin)
		var rows []any
		if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil || len(rows) != 0 {
			t.Fatal("reporte incluye venta anulada", w.Body.String())
		}
	}
	w = request(a, "GET", "/api/resumen", nil, admin)
	var summary map[string]any
	json.Unmarshal(w.Body.Bytes(), &summary)
	if summary["total"] != float64(0) || summary["cantidad"] != float64(0) {
		t.Fatal(w.Body.String())
	}
	w = request(a, "GET", "/api/ventas?estado=anulada&q=vendedor", nil, admin)
	var history []map[string]any
	json.Unmarshal(w.Body.Bytes(), &history)
	if len(history) != 1 {
		t.Fatal("se perdió el historial", w.Body.String())
	}
	w = request(a, "GET", fmt.Sprintf("/api/ventas/%d", v.ID), nil, seller)
	if strings.Contains(w.Body.String(), `"costo"`) {
		t.Fatal("costo visible para vendedor")
	}
}
func TestCancellationRollbackAndCancelledOrder(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	v := makeOperationSale(t, a, admin, "venta-rollback-anulacion", "efectivo", 2)
	_, e := a.DB.Exec("CREATE TRIGGER fail_cancel BEFORE INSERT ON movimientos WHEN NEW.tipo='anulacion' BEGIN SELECT RAISE(ABORT,'fallo de prueba'); END;")
	if e != nil {
		t.Fatal(e)
	}
	body := map[string]any{"motivo": "Productos devueltos de prueba", "productos_devueltos": true}
	path := fmt.Sprintf("/api/ventas/%d/anular", v.ID)
	if w := request(a, "POST", path, body, admin); w.Code != 409 {
		t.Fatal(w.Body.String())
	}
	if count(t, a, "SELECT stock FROM productos WHERE id=1") != 3 || count(t, a, "SELECT COUNT(*) FROM ventas WHERE estado='activa'") != 1 {
		t.Fatal("la anulación fallida dejó cambios parciales")
	}
	a.DB.Exec("DROP TRIGGER fail_cancel")
	_, e = a.DB.Exec("INSERT INTO cotizaciones(id,token_hash,nombre,telefono,lista,estado,fecha) VALUES(1,'prueba','Prueba','999000000','lista','convertida',?)", services.Now())
	if e != nil {
		t.Fatal(e)
	}
	_, e = a.DB.Exec("INSERT INTO pedidos(cotizacion_id,venta_id,estado,fecha) VALUES(1,?,'entregado',?)", v.ID, services.Now())
	if e != nil {
		t.Fatal(e)
	}
	if w := request(a, "POST", path, body, admin); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w := request(a, "PUT", "/api/pedidos/1", map[string]string{"estado": "entregado"}, admin); w.Code != 409 {
		t.Fatal("se entregó una venta anulada")
	}
}
func TestCashCloseAndReopen(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	cash := makeOperationSale(t, a, seller, "caja-efectivo-prueba-01", "efectivo", 1)
	makeOperationSale(t, a, seller, "caja-yape-prueba-00001", "yape", 1)
	input := services.CloseInput{Dia: services.LimaDay(services.Now()), Fondo: "10.00", Gastos: "1.00", Retiros: "1.00", Contado: "11.00"}
	if w := request(a, "GET", "/api/cierres-caja", nil, seller); w.Code != 403 {
		t.Fatal("vendedor accedió al cierre")
	}
	if w := request(a, "POST", "/api/cierres-caja", input, admin); w.Code != 409 {
		t.Fatal("diferencia sin observación aceptada")
	}
	input.Observaciones = "Falta de efectivo por revisar"
	w := request(a, "POST", "/api/cierres-caja", input, admin)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	var result struct {
		ID int64 `json:"id"`
	}
	json.Unmarshal(w.Body.Bytes(), &result)
	if count(t, a, "SELECT esperado FROM cierres_caja") != 1150 || count(t, a, "SELECT diferencia FROM cierres_caja") != -50 || count(t, a, "SELECT yape FROM cierres_caja") != 350 {
		t.Fatal("cálculo de caja incorrecto")
	}
	if w = request(a, "POST", "/api/cierres-caja", input, admin); w.Code != 409 {
		t.Fatal("cierre duplicado")
	}
	body := models.SaleInput{Items: []models.Item{{ProductoID: 1, Cantidad: 1}}, Clave: "caja-cerrada-prueba-01", Pago: "efectivo", Recibido: "10.00"}
	if w = request(a, "POST", "/api/ventas", body, seller); w.Code != 409 {
		t.Fatal("se vendió con caja cerrada")
	}
	cancellation := fmt.Sprintf("/api/ventas/%d/anular", cash.ID)
	if w = request(a, "POST", cancellation, map[string]any{"motivo": "Corrección de prueba", "productos_devueltos": true}, admin); w.Code != 409 {
		t.Fatal("se anuló con caja cerrada")
	}
	reopen := map[string]any{"id": result.ID, "motivo": "Corregir una venta equivocada"}
	if w = request(a, "POST", "/api/cierres-caja/reabrir", reopen, seller); w.Code != 403 {
		t.Fatal("vendedor reabrió caja")
	}
	if w = request(a, "POST", "/api/cierres-caja/reabrir", reopen, admin); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if w = request(a, "POST", cancellation, map[string]any{"motivo": "Corrección de prueba", "productos_devueltos": true}, admin); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	input.Contado = "8.00"
	input.Observaciones = "Cierre corregido"
	if w = request(a, "POST", "/api/cierres-caja", input, admin); w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	if count(t, a, "SELECT COUNT(*) FROM cierres_caja") != 2 || count(t, a, "SELECT esperado FROM cierres_caja WHERE reapertura_fecha=''") != 800 {
		t.Fatal("no se conservó el cierre histórico")
	}
}
func TestReplenishmentAndBackups(t *testing.T) {
	a := fixture(t)
	a.BackupDir = filepath.Join(t.TempDir(), "respaldos")
	admin := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	for _, path := range []string{"/api/reposicion", "/api/respaldos"} {
		if w := request(a, "GET", path, nil, seller); w.Code != 403 {
			t.Fatal("acceso del vendedor", path)
		}
	}
	w := request(a, "GET", "/api/reposicion", nil, admin)
	var rows []map[string]any
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &rows) != nil || len(rows) != 1 || rows[0]["cantidad_sugerida"] != float64(1) {
		t.Fatal(w.Body.String())
	}
	a.DB.Exec("UPDATE productos SET nombre='=Fórmula de prueba'")
	w = request(a, "GET", "/api/reposicion?csv=1", nil, admin)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "'=Fórmula") {
		t.Fatal("CSV inseguro", w.Body.String())
	}
	w = request(a, "POST", "/api/respaldos", map[string]any{}, admin)
	var b struct {
		Nombre string `json:"nombre"`
	}
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &b) != nil || !backupName.MatchString(b.Nombre) {
		t.Fatal(w.Body.String())
	}
	path := "/api/respaldos/" + b.Nombre
	if w = request(a, "GET", path, nil, seller); w.Code != 403 {
		t.Fatal("vendedor descargó respaldo")
	}
	w = request(a, "GET", path, nil, admin)
	if w.Code != 200 || !strings.HasPrefix(w.Body.String(), "SQLite format 3") || w.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("respaldo no descargable")
	}
	copied := filepath.Join(t.TempDir(), "restaurada.db")
	if e := os.WriteFile(copied, w.Body.Bytes(), 0600); e != nil {
		t.Fatal(e)
	}
	db, e := repository.Open(copied)
	if e != nil {
		t.Fatal(e)
	}
	defer db.Close()
	var integrity string
	db.QueryRow("PRAGMA integrity_check").Scan(&integrity)
	if integrity != "ok" {
		t.Fatal("respaldo corrupto")
	}
	var stock int
	db.QueryRow("SELECT stock FROM productos WHERE id=1").Scan(&stock)
	if stock != 5 {
		t.Fatal("respaldo incompleto")
	}
	if w = request(a, "GET", "/api/respaldos/no-permitido.db", nil, admin); w.Code != 404 {
		t.Fatal("archivo arbitrario descargable")
	}
}

func TestCashStatusPrivacyAndLifecycle(t *testing.T) {
	a := fixture(t)
	admin := login(t, a, "administrador")
	seller := login(t, a, "vendedor")
	if w := request(a, "GET", "/api/caja/estado", nil, nil); w.Code != http.StatusUnauthorized {
		t.Fatal("estado de caja sin sesión", w.Code)
	}
	if w := request(a, "POST", "/api/caja/estado", map[string]any{}, seller); w.Code != http.StatusMethodNotAllowed {
		t.Fatal("se permitió modificar el estado por la ruta de consulta", w.Code)
	}
	assertStatus := func(closed bool) {
		t.Helper()
		w := request(a, "GET", "/api/caja/estado", nil, seller)
		var data map[string]any
		if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &data) != nil {
			t.Fatal(w.Body.String())
		}
		if len(data) != 2 || data["cerrada"] != closed || data["dia"] != services.LimaDay(services.Now()) {
			t.Fatalf("estado o privacidad incorrectos: %+v", data)
		}
	}
	assertStatus(false)
	w := request(a, "POST", "/api/cierres-caja", services.CloseInput{Dia: services.LimaDay(services.Now()), Fondo: "0.00", Gastos: "0.00", Retiros: "0.00", Contado: "0.00"}, admin)
	var closing struct {
		ID int64 `json:"id"`
	}
	if w.Code != http.StatusOK || json.Unmarshal(w.Body.Bytes(), &closing) != nil {
		t.Fatal(w.Body.String())
	}
	assertStatus(true)
	w = request(a, "POST", "/api/cierres-caja/reabrir", map[string]any{"id": closing.ID, "motivo": "Reapertura de prueba"}, admin)
	if w.Code != http.StatusOK {
		t.Fatal(w.Body.String())
	}
	assertStatus(false)
}
