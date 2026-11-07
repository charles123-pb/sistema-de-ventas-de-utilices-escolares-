package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"utilventa/internal/services"
)

// cashStatus exposes only today's open/closed state to authenticated cashiers.
func (a *App) cashStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	day := services.LimaDay(services.Now())
	var closed bool
	if err := a.DB.QueryRow("SELECT EXISTS(SELECT 1 FROM cierres_caja WHERE dia=? AND reapertura_fecha='')", day).Scan(&closed); err != nil {
		Fail(w, 500, "No se pudo consultar el estado de caja")
		return
	}
	JSON(w, 200, map[string]any{"dia": day, "cerrada": closed})
}

func (a *App) cash(w http.ResponseWriter, r *http.Request, u User) {
	if !admin(w, u) {
		return
	}
	if r.Method == "GET" {
		day := r.URL.Query().Get("dia")
		if day == "" {
			day = services.LimaDay(services.Now())
		}
		totals, e := services.CashSummary(a.DB, day)
		if e != nil {
			Fail(w, 400, e.Error())
			return
		}
		closings, e := query(a.DB, `SELECT c.*,u.nombre usuario,COALESCE(a.nombre,'') reapertura_usuario FROM cierres_caja c JOIN usuarios u ON u.id=c.usuario_id LEFT JOIN usuarios a ON a.id=c.reapertura_usuario_id WHERE dia=? ORDER BY c.id DESC`, day)
		if e != nil {
			Fail(w, 500, "No se pudo consultar el cierre")
			return
		}
		JSON(w, 200, map[string]any{"dia": day, "totales": totals, "cierres": closings})
		return
	}
	if r.Method != "POST" {
		unsupported(w)
		return
	}
	if strings.HasSuffix(r.URL.Path, "/reabrir") {
		var in struct {
			ID     int64  `json:"id"`
			Motivo string `json:"motivo"`
		}
		if !Decode(w, r, &in) {
			return
		}
		in.Motivo = strings.TrimSpace(in.Motivo)
		if len(in.Motivo) < 5 || len(in.Motivo) > 500 {
			Fail(w, 400, "Indica un motivo de 5 a 500 caracteres.")
			return
		}
		res, e := a.DB.Exec("UPDATE cierres_caja SET reapertura_fecha=?,reapertura_motivo=?,reapertura_usuario_id=? WHERE id=? AND reapertura_fecha=''", services.Now(), in.Motivo, u.ID, in.ID)
		if e != nil {
			Fail(w, 409, "No se pudo reabrir la caja")
			return
		}
		n, _ := res.RowsAffected()
		if n != 1 {
			Fail(w, 409, "Ese cierre no existe o ya está reabierto")
			return
		}
		JSON(w, 200, map[string]bool{"ok": true})
		return
	}
	var in services.CloseInput
	if !Decode(w, r, &in) {
		return
	}
	id, e := services.CloseCash(a.DB, u.ID, in)
	if e != nil {
		Fail(w, 409, e.Error())
		return
	}
	JSON(w, 200, map[string]any{"id": id})
}

func (a *App) replenishment(w http.ResponseWriter, r *http.Request, u User) {
	if !admin(w, u) {
		return
	}
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	q := "%" + r.URL.Query().Get("q") + "%"
	supplier := r.URL.Query().Get("proveedor")
	if supplier != "" {
		if id, err := strconv.ParseInt(supplier, 10, 64); err != nil || id < 0 {
			Fail(w, 400, "Proveedor inválido")
			return
		}
	}
	rows, e := query(a.DB, `SELECT p.id,p.codigo,p.nombre,p.marca,p.stock,p.stock_minimo,p.stock_minimo-p.stock+1 cantidad_sugerida,p.costo,
 COALESCE(s.id,0) proveedor_id,COALESCE(s.nombre,'Sin proveedor asignado') proveedor,COALESCE(s.telefono,'') telefono,COALESCE(s.activo,0) proveedor_activo
 FROM productos p LEFT JOIN proveedores s ON s.id=p.proveedor_id WHERE p.activo=1 AND p.stock<=p.stock_minimo
 AND (p.nombre LIKE ? OR p.codigo LIKE ? OR p.marca LIKE ?) AND (?='' OR COALESCE(s.id,0)=CAST(? AS INTEGER)) ORDER BY proveedor,p.marca,p.nombre LIMIT 10000`, q, q, q, supplier, supplier)
	if e != nil {
		Fail(w, 500, "No se pudo consultar la reposición")
		return
	}
	if r.URL.Query().Get("csv") == "1" {
		writeCSV(w, rows, "reposicion.csv")
		return
	}
	JSON(w, 200, rows)
}
