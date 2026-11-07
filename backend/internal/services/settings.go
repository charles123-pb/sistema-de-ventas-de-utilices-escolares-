package services

import "database/sql"

type StoreSettings struct {
	Nombre             string `json:"nombre"`
	Direccion          string `json:"direccion"`
	Telefono           string `json:"telefono"`
	Horario            string `json:"horario"`
	Logo               string `json:"logo"`
	PedidoHoras        int    `json:"pedido_horas"`
	RespaldoAutomatico bool   `json:"respaldo_automatico"`
	RespaldoHoras      int    `json:"respaldo_horas"`
	UltimoRespaldo     string `json:"ultimo_respaldo"`
	RespaldoError      string `json:"respaldo_error"`
}

func ReadSettings(db *sql.DB) (StoreSettings, error) {
	var s StoreSettings
	e := db.QueryRow(`SELECT nombre,direccion,telefono,horario,logo,pedido_horas,respaldo_automatico,respaldo_horas,ultimo_respaldo,respaldo_error FROM configuracion_tienda WHERE id=1`).Scan(&s.Nombre, &s.Direccion, &s.Telefono, &s.Horario, &s.Logo, &s.PedidoHoras, &s.RespaldoAutomatico, &s.RespaldoHoras, &s.UltimoRespaldo, &s.RespaldoError)
	return s, e
}

// ExpireWebOrders never expires a paid order and never changes inventory.
func ExpireWebOrders(db *sql.DB) error {
	tx, e := db.Begin()
	if e != nil {
		return e
	}
	defer tx.Rollback()
	now := Now()
	_, e = tx.Exec(`INSERT INTO pedidos_web_eventos(pedido_id,fecha,accion) SELECT id,?,'vencido' FROM pedidos_web WHERE venta_id IS NULL AND vence<=? AND estado IN ('pendiente','preparando','listo')`, now, now)
	if e != nil {
		return e
	}
	_, e = tx.Exec(`UPDATE pedidos_web SET estado='vencido' WHERE venta_id IS NULL AND vence<=? AND estado IN ('pendiente','preparando','listo')`, now)
	if e != nil {
		return e
	}
	return tx.Commit()
}
