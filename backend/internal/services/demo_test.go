package services

import (
	"database/sql"
	"path/filepath"
	"testing"
	_ "time/tzdata"
	"utilventa/internal/middleware"
	"utilventa/internal/repository"
)

func demoDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := repository.Open(filepath.Join(t.TempDir(), "demo.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if _, err = db.Exec("INSERT INTO usuarios(id,nombre,usuario,password_hash,rol,fecha) VALUES(1,'Prueba','test','hash-solo-test','administrador',?)", Now()); err != nil {
		t.Fatal(err)
	}
	return db
}
func scalar(t *testing.T, db *sql.DB, q string) int64 {
	t.Helper()
	var n int64
	if err := db.QueryRow(q).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}
func TestDemoIsRepeatableAndPreservesEdits(t *testing.T) {
	db := demoDB(t)
	if _, err := db.Exec("INSERT INTO productos(codigo,nombre,categoria_id,costo,precio,stock,fecha) VALUES('PROPIO','Trabajo existente',1,100,200,9,?)", Now()); err != nil {
		t.Fatal(err)
	}
	first, err := SeedDemo(db, 1)
	if err != nil {
		t.Fatal(err)
	}
	if first.Productos != 40 || first.Clientes != 8 || first.Cotizaciones != 13 || first.Ventas != 14 {
		t.Fatalf("resumen inesperado: productos=%d clientes=%d listas=%d ventas=%d", first.Productos, first.Clientes, first.Cotizaciones, first.Ventas)
	}
	if len(first.Links) != 13 {
		t.Fatal("faltan enlaces privados de ejemplos")
	}
	link := first.Links[0]
	token := link.Enlace[len("/seguimiento/"):]
	var hash string
	if err = db.QueryRow("SELECT token_hash FROM cotizaciones WHERE id=?", link.ID).Scan(&hash); err != nil {
		t.Fatal(err)
	}
	if hash == token || hash != middleware.Hash(token) {
		t.Fatal("token de ejemplo sin proteger")
	}
	before := scalar(t, db, "SELECT SUM(stock) FROM productos")
	if _, err = db.Exec("UPDATE productos SET nombre='[DEMO] Editado por el usuario',precio=999 WHERE codigo='DEMO-01'"); err != nil {
		t.Fatal(err)
	}
	again, err := SeedDemo(db, 1)
	if err != nil {
		t.Fatal(err)
	}
	if again.Productos+again.Clientes+again.Cotizaciones+again.Ventas != 0 || len(again.Links) != 0 {
		t.Fatal("la recarga duplicó ejemplos")
	}
	if scalar(t, db, "SELECT SUM(stock) FROM productos") != before || scalar(t, db, "SELECT precio FROM productos WHERE codigo='DEMO-01'") != 999 || scalar(t, db, "SELECT stock FROM productos WHERE codigo='PROPIO'") != 9 {
		t.Fatal("se alteró trabajo existente")
	}
}
func TestDemoLedgerQuotesAndHistoricalTotals(t *testing.T) {
	db := demoDB(t)
	if _, err := SeedDemo(db, 1); err != nil {
		t.Fatal(err)
	}
	if scalar(t, db, "SELECT COUNT(*) FROM productos p WHERE p.stock<>COALESCE((SELECT SUM(cantidad) FROM movimientos m WHERE m.producto_id=p.id),0)") != 0 {
		t.Fatal("el stock no coincide con los movimientos")
	}
	if scalar(t, db, "SELECT COUNT(*) FROM productos WHERE stock<0") != 0 {
		t.Fatal("stock negativo")
	}
	if scalar(t, db, "SELECT COUNT(*) FROM ventas v WHERE total<>(SELECT SUM(subtotal) FROM detalle_venta WHERE venta_id=v.id) OR costo<>(SELECT SUM(cantidad*costo) FROM detalle_venta WHERE venta_id=v.id)") != 0 {
		t.Fatal("totales históricos inconsistentes")
	}
	if scalar(t, db, "SELECT COUNT(*) FROM pedidos WHERE estado='entregado' AND venta_id IS NULL") != 0 {
		t.Fatal("pedido entregado sin venta")
	}
	if scalar(t, db, "SELECT COUNT(DISTINCT date(fecha,'-5 hours')) FROM ventas") < 6 {
		t.Fatal("faltan ejemplos en los últimos siete días")
	}
	if scalar(t, db, "SELECT COUNT(*) FROM cotizaciones WHERE estado='aceptada'") != 3 || scalar(t, db, "SELECT COUNT(*) FROM pedidos WHERE estado='listo' AND venta_id IS NULL") != 1 {
		t.Fatal("faltan escenarios sin reserva ni pago")
	}
	rows, err := db.Query("PRAGMA foreign_key_check")
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	if rows.Next() {
		t.Fatal("referencia rota")
	}
}
