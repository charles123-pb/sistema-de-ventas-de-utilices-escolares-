package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"
	"utilventa/internal/models"
	"utilventa/internal/services"
)

// DateRange convierte las fechas locales a un intervalo UTC de días completos.
func DateRange(r *http.Request) (string, string, error) {
	loc, e := time.LoadLocation("America/Lima")
	if e != nil {
		return "", "", e
	}
	now := time.Now().In(loc)
	from := r.URL.Query().Get("desde")
	to := r.URL.Query().Get("hasta")
	if from == "" {
		from = now.Format("2006-01-02")
	}
	if to == "" {
		to = now.Format("2006-01-02")
	}
	start, e := time.ParseInLocation("2006-01-02", from, loc)
	if e != nil {
		return "", "", e
	}
	end, e := time.ParseInLocation("2006-01-02", to, loc)
	if e != nil || end.Before(start) {
		return "", "", fmt.Errorf("rango inválido")
	}
	// El límite final es el inicio del día siguiente: SQL usa fecha >= inicio y fecha < fin.
	return start.UTC().Format(time.RFC3339), end.AddDate(0, 0, 1).UTC().Format(time.RFC3339), nil
}

// saleDetail obtiene el encabezado y los artículos de una venta según los permisos del usuario.
func (a *App) saleDetail(w http.ResponseWriter, id int64, u User) {
	var v models.Sale
	var cost int64
	e := a.DB.QueryRow("SELECT v.id,v.fecha,v.total,v.costo,v.pago,v.recibido,v.cliente_nombre,v.cliente_documento,v.cliente_direccion,v.cliente_tipo,v.estado,v.anulacion_motivo,v.anulacion_fecha,u.nombre,COALESCE(a.nombre,'') FROM ventas v JOIN usuarios u ON u.id=v.usuario_id LEFT JOIN usuarios a ON a.id=v.anulacion_usuario_id WHERE v.id=?", id).Scan(&v.ID, &v.Fecha, &v.Total, &cost, &v.Pago, &v.Recibido, &v.ClienteNombre, &v.ClienteDocumento, &v.ClienteDireccion, &v.ClienteTipo, &v.Estado, &v.AnulacionMotivo, &v.AnulacionFecha, &v.Vendedor, &v.AnulacionUsuario)
	if e != nil {
		Fail(w, 404, "Venta no encontrada")
		return
	}
	if u.Rol == "administrador" {
		v.Costo = &cost
	}
	// Se consulta el detalle histórico guardado al cobrar, aunque el catálogo haya cambiado.
	rows, e := a.DB.Query("SELECT producto_id,codigo,nombre,cantidad,precio,costo,subtotal,presentacion,contenido FROM detalle_venta WHERE venta_id=?", id)
	if e != nil {
		Fail(w, 500, "No se pudo consultar la venta")
		return
	}
	defer rows.Close()
	v.Items = []models.Item{}
	for rows.Next() {
		var it models.Item
		if e = rows.Scan(&it.ProductoID, &it.Codigo, &it.Nombre, &it.Cantidad, &it.Precio, &it.Costo, &it.Subtotal, &it.Presentacion, &it.Contenido); e != nil {
			Fail(w, 500, "No se pudo consultar el detalle")
			return
		}
		if u.Rol != "administrador" {
			it.Costo = 0
		}
		v.Items = append(v.Items, it)
	}
	JSON(w, 200, v)
}

// sales crea ventas o entrega listados y detalles según el método y la ruta solicitados.
func (a *App) sales(w http.ResponseWriter, r *http.Request, u User) {
	if strings.HasSuffix(r.URL.Path, "/anular") {
		if !admin(w, u) {
			return
		}
		if r.Method != "POST" {
			unsupported(w)
			return
		}
		id, e := strconv.ParseInt(strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/ventas/"), "/anular"), 10, 64)
		if e != nil || id < 1 {
			Fail(w, 404, "Venta no encontrada")
			return
		}
		var in struct {
			Motivo    string `json:"motivo"`
			Devueltos bool   `json:"productos_devueltos"`
		}
		if !Decode(w, r, &in) {
			return
		}
		if !in.Devueltos {
			Fail(w, 400, "Confirma que los productos no se entregaron o ya fueron devueltos.")
			return
		}
		if e = services.CancelSale(a.DB, u.ID, id, in.Motivo); e != nil {
			Fail(w, 409, e.Error())
			return
		}
		a.saleDetail(w, id, u)
		return
	}
	if r.Method == "POST" && r.URL.Path == "/api/ventas" {
		var in models.SaleInput
		if !Decode(w, r, &in) {
			return
		}
		id, e := services.Sell(a.DB, u.ID, in)
		if e != nil {
			Fail(w, 409, e.Error())
			return
		}
		a.saleDetail(w, id, u)
		return
	}
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	if r.URL.Path != "/api/ventas" {
		a.saleDetail(w, idPath(r, "/api/ventas/"), u)
		return
	}
	from, to, e := DateRange(r)
	if e != nil {
		Fail(w, 400, "Fechas inválidas")
		return
	}
	lim, off := page(r)
	fields := "v.id,v.fecha,v.total,v.pago,v.recibido,v.estado,COALESCE(NULLIF(v.cliente_nombre,''),'Consumidor final') cliente,u.nombre vendedor"
	if u.Rol == "administrador" {
		fields += ",v.costo,v.total-v.costo margen"
	}
	q := "%" + r.URL.Query().Get("q") + "%"
	state := r.URL.Query().Get("estado")
	list(w, a.DB, "SELECT "+fields+" FROM ventas v JOIN usuarios u ON u.id=v.usuario_id WHERE v.fecha>=? AND v.fecha<? AND (CAST(v.id AS TEXT) LIKE ? OR v.cliente_nombre LIKE ? OR v.cliente_documento LIKE ? OR u.nombre LIKE ?) AND (?='' OR v.estado=?) ORDER BY v.id DESC LIMIT ? OFFSET ?", from, to, q, q, q, q, state, state, lim, off)
}

// summary reúne indicadores diarios y una serie de ventas para el panel principal.
func (a *App) summary(w http.ResponseWriter, r *http.Request, u User) {
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	loc, _ := time.LoadLocation("America/Lima")
	now := time.Now().In(loc)
	start := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, loc)
	out := map[string]any{}
	var total, count, cost, pending, ready, low int64
	a.DB.QueryRow("SELECT COALESCE(SUM(total),0),COUNT(*),COALESCE(SUM(costo),0) FROM ventas WHERE estado='activa' AND fecha>=? AND fecha<?", start.UTC().Format(time.RFC3339), start.AddDate(0, 0, 1).UTC().Format(time.RFC3339)).Scan(&total, &count, &cost)
	a.DB.QueryRow("SELECT COUNT(*) FROM cotizaciones WHERE estado IN ('solicitada','en preparación')").Scan(&pending)
	a.DB.QueryRow("SELECT COUNT(*) FROM pedidos WHERE estado='listo'").Scan(&ready)
	a.DB.QueryRow("SELECT COUNT(*) FROM productos WHERE activo=1 AND stock<=stock_minimo").Scan(&low)
	out["total"] = total
	out["cantidad"] = count
	out["pendientes"] = pending
	var directReady, directPending int64
	a.DB.QueryRow("SELECT COUNT(*) FROM pedidos_web WHERE estado='listo' AND (venta_id IS NOT NULL OR vence>?)", services.Now()).Scan(&directReady)
	a.DB.QueryRow("SELECT COUNT(*) FROM pedidos_web WHERE estado IN ('pendiente','preparando','listo') AND (venta_id IS NOT NULL OR vence>?)", services.Now()).Scan(&directPending)
	out["pedidos_web_pendientes"] = directPending
	out["listos"] = ready + directReady
	out["stock_bajo"] = low
	if u.Rol == "administrador" {
		out["costo"] = cost
		out["margen"] = total - cost
	}
	latest, _ := query(a.DB, "SELECT id,fecha,total FROM ventas WHERE estado='activa' ORDER BY id DESC LIMIT 5")
	out["ultimas"] = latest
	chart := []map[string]any{}
	for i := 6; i >= 0; i-- {
		day := start.AddDate(0, 0, -i)
		var n int64
		a.DB.QueryRow("SELECT COALESCE(SUM(total),0) FROM ventas WHERE estado='activa' AND fecha>=? AND fecha<?", day.UTC().Format(time.RFC3339), day.AddDate(0, 0, 1).UTC().Format(time.RFC3339)).Scan(&n)
		chart = append(chart, map[string]any{
			"dia": day.Format("02/01"), "total": n})
	}
	out["grafico"] = chart
	JSON(w, 200, out)
}

// CSVSafe antepone una comilla a textos que podrían interpretarse como fórmulas en hojas de cálculo.
func CSVSafe(s string) string {
	trim := strings.TrimLeft(s, " \t\r\n")
	if strings.HasPrefix(trim, "=") || strings.HasPrefix(trim, "+") || strings.HasPrefix(trim, "-") || strings.HasPrefix(trim, "@") || strings.HasPrefix(s, "\t") || strings.HasPrefix(s, "\r") {
		return "'" + s
	}
	return s
}

// reports consulta el tipo solicitado y exporta el resultado como CSV seguro.
func (a *App) reports(w http.ResponseWriter, r *http.Request, u User) {
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	from, to, e := DateRange(r)
	if e != nil {
		Fail(w, 400, "Fechas inválidas")
		return
	}
	kind := r.URL.Query().Get("tipo")
	var q string
	var args []any
	switch kind {
	case "stock":
		q = "SELECT codigo,nombre,stock,stock_minimo FROM productos WHERE activo=1 AND stock<=stock_minimo ORDER BY nombre"
	case "productos":
		q = "SELECT d.codigo,d.nombre,SUM(d.cantidad) cantidad,SUM(d.subtotal) total FROM detalle_venta d JOIN ventas v ON v.id=d.venta_id WHERE v.estado='activa' AND v.fecha>=? AND v.fecha<? GROUP BY d.producto_id,d.codigo,d.nombre ORDER BY cantidad DESC"
		args = []any{
			from, to}
	case "movimientos":
		if !admin(w, u) {
			return
		}
		q = "SELECT m.fecha,p.codigo,p.nombre,m.tipo,m.cantidad,m.motivo,u.nombre usuario FROM movimientos m JOIN productos p ON p.id=m.producto_id JOIN usuarios u ON u.id=m.usuario_id WHERE m.fecha>=? AND m.fecha<? ORDER BY m.id DESC"
		args = []any{
			from, to}
	default:
		q = "SELECT id,fecha,total,pago FROM ventas WHERE estado='activa' AND fecha>=? AND fecha<? ORDER BY id DESC"
		if u.Rol == "administrador" {
			q = "SELECT id,fecha,total,costo,total-costo margen,pago FROM ventas WHERE estado='activa' AND fecha>=? AND fecha<? ORDER BY id DESC"
		}
		args = []any{
			from, to}
	}
	lim, off := page(r)
	if r.URL.Query().Get("csv") == "1" {
		q += " LIMIT 10000"
	} else {
		q += " LIMIT ? OFFSET ?"
		args = append(args, lim, off)
	}
	rows, e := query(a.DB, q, args...)
	if e != nil {
		Fail(w, 500, "No se pudo generar el reporte")
		return
	}
	if r.URL.Query().Get("csv") != "1" {
		JSON(w, 200, rows)
		return
	}
	writeCSV(w, rows, "reporte.csv")
}

func writeCSV(w http.ResponseWriter, rows []map[string]any, name string) {
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename="+name)
	writer := csv.NewWriter(w)
	defer writer.Flush()
	cols := []string{}
	if len(rows) > 0 {
		for k := range rows[0] {
			cols = append(cols, k)
		}
	}
	// Ordenar las claves mantiene las columnas del CSV estables entre ejecuciones.
	sort.Strings(cols)
	writer.Write(cols)
	for _, row := range rows {
		line := []string{}
		for _, c := range cols {
			line = append(line, CSVSafe(fmt.Sprint(row[c])))
		}
		writer.Write(line)
	}
}
