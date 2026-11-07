package services

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
	"utilventa/internal/models"
)

func LimaDay(timestamp string) string {
	t, err := time.Parse(time.RFC3339, timestamp)
	if err != nil {
		return ""
	}
	loc, _ := time.LoadLocation("America/Lima")
	return t.In(loc).Format("2006-01-02")
}

func DayBounds(day string) (string, string, error) {
	loc, _ := time.LoadLocation("America/Lima")
	t, e := time.ParseInLocation("2006-01-02", day, loc)
	if e != nil || t.Format("2006-01-02") != day {
		return "", "", fmt.Errorf("fecha inválida")
	}
	return t.UTC().Format(time.RFC3339), t.AddDate(0, 0, 1).UTC().Format(time.RFC3339), nil
}

func CheckCashOpen(tx *sql.Tx, day string) error {
	var closed int
	if e := tx.QueryRow("SELECT COUNT(*) FROM cierres_caja WHERE dia=? AND reapertura_fecha=''", day).Scan(&closed); e != nil {
		return e
	}
	if closed > 0 {
		return fmt.Errorf("la caja de ese día está cerrada; el administrador debe reabrirla con un motivo")
	}
	return nil
}

type CashTotals struct {
	Efectivo      int64 `json:"efectivo"`
	Yape          int64 `json:"yape"`
	Plin          int64 `json:"plin"`
	Transferencia int64 `json:"transferencia"`
	Ventas        int64 `json:"ventas"`
}
type rowQuerier interface{ QueryRow(string, ...any) *sql.Row }

func CashSummary(db rowQuerier, day string) (CashTotals, error) {
	var totals CashTotals
	from, to, e := DayBounds(day)
	if e != nil {
		return totals, e
	}
	e = db.QueryRow(`SELECT COALESCE(SUM(CASE WHEN pago='efectivo' THEN total ELSE 0 END),0),
 COALESCE(SUM(CASE WHEN pago='yape' THEN total ELSE 0 END),0),COALESCE(SUM(CASE WHEN pago='plin' THEN total ELSE 0 END),0),
 COALESCE(SUM(CASE WHEN pago='transferencia' THEN total ELSE 0 END),0),COUNT(*) FROM ventas WHERE estado='activa' AND fecha>=? AND fecha<?`, from, to).Scan(&totals.Efectivo, &totals.Yape, &totals.Plin, &totals.Transferencia, &totals.Ventas)
	return totals, e
}

type CloseInput struct {
	Dia           string `json:"dia"`
	Fondo         string `json:"fondo_inicial"`
	Gastos        string `json:"gastos"`
	Retiros       string `json:"retiros"`
	Contado       string `json:"contado"`
	Observaciones string `json:"observaciones"`
}

func CloseCash(db *sql.DB, uid int64, in CloseInput) (int64, error) {
	if _, _, e := DayBounds(in.Dia); e != nil {
		return 0, e
	}
	if in.Dia > LimaDay(Now()) {
		return 0, fmt.Errorf("no se puede cerrar una fecha futura")
	}
	amounts := []int64{}
	for _, v := range []string{in.Fondo, in.Gastos, in.Retiros, in.Contado} {
		a, e := models.Money(v)
		if e != nil {
			return 0, e
		}
		amounts = append(amounts, a)
	}
	if len(in.Observaciones) > 1000 {
		return 0, fmt.Errorf("observaciones demasiado largas")
	}
	tx, e := db.Begin()
	if e != nil {
		return 0, e
	}
	defer tx.Rollback()
	if e = CheckCashOpen(tx, in.Dia); e != nil {
		return 0, e
	}
	totals, e := CashSummary(tx, in.Dia)
	if e != nil {
		return 0, e
	}
	expected := amounts[0] + totals.Efectivo - amounts[1] - amounts[2]
	if expected < 0 {
		return 0, fmt.Errorf("los gastos y retiros superan el efectivo disponible")
	}
	difference := amounts[3] - expected
	if difference != 0 && strings.TrimSpace(in.Observaciones) == "" {
		return 0, fmt.Errorf("indica una observación para explicar la diferencia de caja")
	}
	result, e := tx.Exec(`INSERT INTO cierres_caja(dia,usuario_id,fecha,fondo_inicial,gastos,retiros,contado,esperado,diferencia,efectivo,yape,plin,transferencia,ventas,observaciones) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, in.Dia, uid, Now(), amounts[0], amounts[1], amounts[2], amounts[3], expected, difference, totals.Efectivo, totals.Yape, totals.Plin, totals.Transferencia, totals.Ventas, strings.TrimSpace(in.Observaciones))
	if e != nil {
		return 0, e
	}
	id, _ := result.LastInsertId()
	return id, tx.Commit()
}

func CancelSale(db *sql.DB, uid, id int64, reason string) error {
	reason = strings.TrimSpace(reason)
	if len(reason) < 5 || len(reason) > 500 {
		return fmt.Errorf("indica un motivo de entre 5 y 500 caracteres")
	}
	tx, e := db.Begin()
	if e != nil {
		return e
	}
	defer tx.Rollback()
	var state, date string
	if tx.QueryRow("SELECT estado,fecha FROM ventas WHERE id=?", id).Scan(&state, &date) != nil {
		return fmt.Errorf("venta no encontrada")
	}
	if state != "activa" {
		return fmt.Errorf("la venta ya está anulada; no se volvió a modificar el stock")
	}
	if e = CheckCashOpen(tx, LimaDay(date)); e != nil {
		return e
	}
	rows, e := tx.Query("SELECT producto_id,cantidad,costo FROM detalle_venta WHERE venta_id=?", id)
	if e != nil {
		return e
	}
	type returned struct{ id, quantity, cost int64 }
	items := []returned{}
	for rows.Next() {
		var i returned
		if e = rows.Scan(&i.id, &i.quantity, &i.cost); e != nil {
			rows.Close()
			return e
		}
		items = append(items, i)
	}
	e = rows.Err()
	rows.Close()
	if e != nil {
		return e
	}
	for _, i := range items {
		if _, e = tx.Exec("UPDATE productos SET stock=stock+? WHERE id=?", i.quantity, i.id); e != nil {
			return e
		}
		if _, e = tx.Exec("INSERT INTO movimientos(producto_id,usuario_id,fecha,tipo,cantidad,motivo,costo,venta_id) VALUES(?,?,?,'anulacion',?,?,?,?)", i.id, uid, Now(), i.quantity, reason, i.cost, id); e != nil {
			return e
		}
	}
	if _, e = tx.Exec("UPDATE ventas SET estado='anulada',anulacion_motivo=?,anulacion_fecha=?,anulacion_usuario_id=? WHERE id=? AND estado='activa'", reason, Now(), uid, id); e != nil {
		return e
	}
	// Preserve the converted quotation and its history; the paid order can no longer be delivered.
	if _, e = tx.Exec("UPDATE pedidos SET estado='cancelado' WHERE venta_id=?", id); e != nil {
		return e
	}
	if _, e = tx.Exec("INSERT INTO pedidos_web_eventos(pedido_id,usuario_id,fecha,accion) SELECT id,?,?,'venta anulada' FROM pedidos_web WHERE venta_id=?", uid, Now(), id); e != nil {
		return e
	}
	if _, e = tx.Exec("UPDATE pedidos_web SET estado='cancelado' WHERE venta_id=?", id); e != nil {
		return e
	}
	return tx.Commit()
}
