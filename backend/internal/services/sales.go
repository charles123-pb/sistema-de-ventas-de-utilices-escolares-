package services

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
	"utilventa/internal/models"
)

// ErrConflict identifica operaciones reutilizadas con datos incompatibles.
var ErrConflict = errors.New("conflicto")

// Now normaliza fechas internas al formato UTC usado por la base de datos.
func Now() string {
	return time.Now().UTC().Format(time.RFC3339)
}

// Sell valida el carrito y registra venta, stock y movimientos en una sola transacción.
func Sell(db *sql.DB, uid int64, in models.SaleInput) (int64, error) {
	if len(in.Clave) < 16 || len(in.Clave) > 100 {
		return 0, fmt.Errorf("clave de idempotencia inválida")
	}
	if in.Pago != "efectivo" && in.Pago != "yape" && in.Pago != "plin" && in.Pago != "transferencia" {
		return 0, fmt.Errorf("medio de pago inválido")
	}
	tx, e := db.Begin()
	if e != nil {
		return 0, e
	}
	// Cualquier retorno anterior al Commit deshace toda la operación; tras confirmar, Rollback no hace cambios.
	defer tx.Rollback()
	// Una conexión serializa las escrituras de esta tienda; el UPDATE condicional protege el stock.
	var oldID, oldUser int64
	var oldFingerprint string
	fingerprint := models.Fingerprint(in)
	e = tx.QueryRow("SELECT id,usuario_id,huella FROM ventas WHERE clave=?", in.Clave).Scan(&oldID, &oldUser, &oldFingerprint)
	// Reenviar la misma clave y datos devuelve la venta existente sin volver a descontar stock.
	if e == nil {
		if oldUser != uid || oldFingerprint != fingerprint {
			return 0, fmt.Errorf("%w: clave utilizada con otra operación", ErrConflict)
		}
		return oldID, nil
	}
	if e != sql.ErrNoRows {
		return 0, e
	}
	if e = CheckCashOpen(tx, LimaDay(Now())); e != nil {
		return 0, e
	}
	// Una cotización aceptada aporta sus artículos históricos; una venta directa usa el carrito recibido.
	items := in.Items
	if in.PedidoWebID != nil {
		if in.CotizacionID != nil {
			return 0, fmt.Errorf("seleccione un solo pedido")
		}
		var state, expires, content string
		var paid sql.NullInt64
		e = tx.QueryRow("SELECT estado,vence,items,venta_id FROM pedidos_web WHERE id=?", *in.PedidoWebID).Scan(&state, &expires, &content, &paid)
		if e != nil || paid.Valid || state == "cancelado" || state == "vencido" || state == "entregado" || expires <= Now() {
			return 0, fmt.Errorf("pedido vencido, cancelado o ya pagado")
		}
		if e = json.Unmarshal([]byte(content), &items); e != nil {
			return 0, e
		}
		in.ClienteID = nil
	}
	if in.CotizacionID != nil {
		var status, expires, content string
		var rev int
		var clientID sql.NullInt64
		e = tx.QueryRow("SELECT estado,COALESCE(vigencia,''),revision,cliente_id FROM cotizaciones WHERE id=?", *in.CotizacionID).Scan(&status, &expires, &rev, &clientID)
		if e != nil || status != "aceptada" || expires < Now() {
			return 0, fmt.Errorf("cotización no aceptada, vencida o ya convertida")
		}
		if e = tx.QueryRow("SELECT contenido FROM propuestas WHERE cotizacion_id=? AND revision=?", *in.CotizacionID, rev).Scan(&content); e != nil {
			return 0, e
		}
		if e = json.Unmarshal([]byte(content), &items); e != nil {
			return 0, e
		}
		if clientID.Valid {
			in.ClienteID = &clientID.Int64
		}
	}
	if len(items) == 0 || len(items) > 100 {
		return 0, fmt.Errorf("el carrito debe contener entre 1 y 100 artículos")
	}
	// Dos artículos solicitados pueden elegir el mismo producto alternativo.
	// Se unifican antes de validar existencias y registrar el detalle de venta.
	if in.CotizacionID != nil {
		merged := []models.Item{}
		positions := map[int64]int{}
		for _, it := range items {
			if !it.Disponible {
				continue
			}
			if it.Cantidad < 1 || it.Cantidad > models.MaxQty {
				return 0, fmt.Errorf("cantidad cotizada inválida")
			}
			if pos, exists := positions[it.ProductoID]; exists {
				merged[pos].Cantidad += it.Cantidad
			} else {
				positions[it.ProductoID] = len(merged)
				merged = append(merged, it)
			}
		}
		items = merged
	}
	seen := map[int64]bool{}
	var total, cost int64
	valid := []models.Item{}
	for _, it := range items {
		if in.CotizacionID != nil && !it.Disponible {
			continue
		}
		if it.Cantidad < 1 || it.Cantidad > models.MaxQty || seen[it.ProductoID] {
			return 0, fmt.Errorf("cantidades inválidas o productos repetidos")
		}
		seen[it.ProductoID] = true
		var p models.Item
		var stock, active int64
		e = tx.QueryRow("SELECT id,codigo,nombre,precio,costo,stock,activo,presentacion,contenido FROM productos WHERE id=?", it.ProductoID).Scan(&p.ProductoID, &p.Codigo, &p.Nombre, &p.Precio, &p.Costo, &stock, &active, &p.Presentacion, &p.Contenido)
		if e != nil || active != 1 {
			return 0, fmt.Errorf("producto no disponible")
		}
		if stock < it.Cantidad {
			return 0, fmt.Errorf("stock insuficiente para %s", p.Nombre)
		}
		// Se respeta el precio cotizado y se conserva el costo actual leído de SQLite para el margen.
		if in.CotizacionID != nil || in.PedidoWebID != nil {
			p.Precio = it.Precio
			p.Nombre = it.Nombre
			p.Codigo = it.Codigo
			if it.Presentacion != "" {
				p.Presentacion = it.Presentacion
				p.Contenido = it.Contenido
			}
		}
		p.Cantidad = it.Cantidad
		p.Subtotal = p.Cantidad * p.Precio
		total += p.Subtotal
		cost += p.Cantidad * p.Costo
		if total > models.MaxMoney {
			return 0, fmt.Errorf("total excede el límite")
		}
		valid = append(valid, p)
	}
	if total <= 0 {
		return 0, fmt.Errorf("no hay artículos disponibles en la propuesta")
	}
	received := total
	if in.Pago == "efectivo" {
		received, e = models.Money(in.Recibido)
		if e != nil || received < total {
			return 0, fmt.Errorf("efectivo insuficiente o inválido")
		}
	}
	var clientName, clientDocument, clientAddress, clientType string
	if in.ClienteID != nil {
		if e = tx.QueryRow("SELECT nombre,documento,direccion,tipo FROM clientes WHERE id=?", *in.ClienteID).Scan(&clientName, &clientDocument, &clientAddress, &clientType); e != nil {
			return 0, fmt.Errorf("cliente no encontrado; selecciona otro cliente")
		}
	}
	if in.PedidoWebID != nil {
		if e = tx.QueryRow("SELECT nombre FROM pedidos_web WHERE id=?", *in.PedidoWebID).Scan(&clientName); e != nil {
			return 0, e
		}
		clientType = "persona"
	}
	// Preserve the customer data shown on the internal receipt, even after profile edits.
	res, e := tx.Exec("INSERT INTO ventas(usuario_id,cliente_id,cotizacion_id,fecha,total,costo,pago,recibido,clave,huella,cliente_nombre,cliente_documento,cliente_direccion,cliente_tipo) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", uid, in.ClienteID, in.CotizacionID, Now(), total, cost, in.Pago, received, in.Clave, fingerprint, clientName, clientDocument, clientAddress, clientType)
	if e != nil {
		return 0, fmt.Errorf("%w: no se pudo registrar la venta", ErrConflict)
	}
	id, _ := res.LastInsertId()
	// Cada salida guarda también el detalle histórico y un movimiento ligado a la venta.
	for _, p := range valid {
		r, e := tx.Exec("UPDATE productos SET stock=stock-? WHERE id=? AND activo=1 AND stock>=?", p.Cantidad, p.ProductoID, p.Cantidad)
		if e != nil {
			return 0, e
		}
		n, _ := r.RowsAffected()
		if n != 1 {
			return 0, fmt.Errorf("stock insuficiente")
		}
		if _, e = tx.Exec("INSERT INTO detalle_venta(venta_id,producto_id,codigo,nombre,cantidad,precio,costo,subtotal,presentacion,contenido) VALUES(?,?,?,?,?,?,?,?,?,?)", id, p.ProductoID, p.Codigo, p.Nombre, p.Cantidad, p.Precio, p.Costo, p.Subtotal, p.Presentacion, p.Contenido); e != nil {
			return 0, e
		}
		if _, e = tx.Exec("INSERT INTO movimientos(producto_id,usuario_id,fecha,tipo,cantidad,motivo,costo,venta_id) VALUES(?,?,?,'venta',?,'Venta confirmada',?,?)", p.ProductoID, uid, Now(), -p.Cantidad, p.Costo, id); e != nil {
			return 0, e
		}
	}
	if in.CotizacionID != nil {
		if _, e = tx.Exec("UPDATE cotizaciones SET estado='convertida' WHERE id=?", *in.CotizacionID); e != nil {
			return 0, e
		}
		if _, e = tx.Exec("UPDATE pedidos SET venta_id=? WHERE cotizacion_id=?", id, *in.CotizacionID); e != nil {
			return 0, e
		}
	}
	if in.PedidoWebID != nil {
		result, err := tx.Exec("UPDATE pedidos_web SET venta_id=? WHERE id=? AND venta_id IS NULL AND estado IN ('pendiente','preparando','listo') AND vence>?", id, *in.PedidoWebID, Now())
		if err != nil {
			return 0, err
		}
		n, _ := result.RowsAffected()
		if n != 1 {
			return 0, fmt.Errorf("pedido cambió; revise su estado")
		}
		if _, e = tx.Exec("INSERT INTO pedidos_web_eventos(pedido_id,usuario_id,fecha,accion) VALUES(?,?,?,'pago registrado')", *in.PedidoWebID, uid, Now()); e != nil {
			return 0, e
		}
	}
	// Solo aquí quedan persistidos, juntos, el cobro, los artículos, el stock y el pedido asociado.
	return id, tx.Commit()
}
