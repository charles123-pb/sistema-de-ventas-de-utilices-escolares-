package handlers

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
	"utilventa/internal/middleware"
	"utilventa/internal/models"
	"utilventa/internal/services"
)

var orderKey = regexp.MustCompile(`^[a-zA-Z0-9-]{16,100}$`)
var phoneFormat = regexp.MustCompile(`^[0-9+() -]{9,30}$`)
var notDigit = regexp.MustCompile(`[^0-9]`)

type webLine struct {
	ProductoID int64 `json:"producto_id"`
	Cantidad   int64 `json:"cantidad"`
}
type webInput struct {
	Nombre        string    `json:"nombre"`
	Telefono      string    `json:"telefono"`
	Observaciones string    `json:"observaciones"`
	Clave         string    `json:"clave"`
	Items         []webLine `json:"items"`
}

func pickupCode(token string) string { return strings.ToUpper(token[len(token)-10:]) }

func (a *App) createWebOrder(w http.ResponseWriter, r *http.Request) {
	var in webInput
	if !Decode(w, r, &in) {
		return
	}
	in.Nombre = strings.TrimSpace(in.Nombre)
	in.Telefono = strings.TrimSpace(in.Telefono)
	in.Observaciones = strings.TrimSpace(in.Observaciones)
	if !phoneFormat.MatchString(in.Telefono) {
		Fail(w, 400, "Indica un teléfono válido de 9 a 15 dígitos")
		return
	}
	in.Telefono = notDigit.ReplaceAllString(in.Telefono, "")
	if len(in.Telefono) < 9 || len(in.Telefono) > 15 || len(in.Nombre) < 2 || len(in.Nombre) > 150 || len(in.Observaciones) > 500 || !orderKey.MatchString(in.Clave) || len(in.Items) < 1 || len(in.Items) > 100 {
		Fail(w, 400, "Revisa nombre, teléfono y productos del pedido")
		return
	}
	sort.Slice(in.Items, func(i, j int) bool { return in.Items[i].ProductoID < in.Items[j].ProductoID })
	for n, it := range in.Items {
		if it.ProductoID < 1 || it.Cantidad < 1 || it.Cantidad > 1000 || (n > 0 && in.Items[n-1].ProductoID == it.ProductoID) {
			Fail(w, 400, "Cantidades inválidas o productos repetidos (máximo 1000 por producto)")
			return
		}
	}
	requestKey := in.Clave
	in.Clave = ""
	fingerprint := middleware.Hash(models.Fingerprint(in))
	var secret string
	if a.DB.QueryRow("SELECT checkout_secret FROM configuracion_tienda WHERE id=1").Scan(&secret) != nil || secret == "" {
		Fail(w, 500, "No se pudo preparar el pedido")
		return
	}
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(requestKey))
	token := hex.EncodeToString(mac.Sum(nil))
	reply := func(status int, id int64) {
		JSON(w, status, map[string]any{"id": id, "enlace": "/pedido/" + token, "codigo_recojo": pickupCode(token)})
	}
	if e := services.ExpireWebOrders(a.DB); e != nil {
		Fail(w, 500, "No se pudieron actualizar los pedidos")
		return
	}
	tx, e := a.DB.Begin()
	if e != nil {
		Fail(w, 500, "No se pudo iniciar el pedido")
		return
	}
	defer tx.Rollback()
	var previousID int64
	var previousFingerprint string
	if tx.QueryRow("SELECT id,huella FROM pedidos_web WHERE token_hash=?", middleware.Hash(token)).Scan(&previousID, &previousFingerprint) == nil {
		if previousFingerprint != fingerprint {
			Fail(w, 409, "El intento anterior contiene otros datos; inicia un nuevo pedido")
			return
		}
		reply(200, previousID)
		return
	}
	var recent int
	if tx.QueryRow("SELECT COUNT(*) FROM pedidos_web WHERE telefono=? AND fecha>?", in.Telefono, time.Now().UTC().Add(-15*time.Minute).Format(time.RFC3339)).Scan(&recent) != nil {
		Fail(w, 500, "No se pudo validar el pedido")
		return
	}
	if recent >= 5 {
		Fail(w, 429, "Demasiados pedidos con este teléfono; espera 15 minutos")
		return
	}
	if tx.QueryRow("SELECT COUNT(*) FROM pedidos_web WHERE huella=? AND vence>? AND estado IN ('pendiente','preparando','listo')", fingerprint, services.Now()).Scan(&recent) != nil {
		Fail(w, 500, "No se pudo validar el pedido")
		return
	}
	if recent > 0 {
		Fail(w, 409, "Ya existe un pedido activo con estos datos. Revisa tu enlace de seguimiento")
		return
	}
	items := []models.Item{}
	var total int64
	for _, line := range in.Items {
		it := models.Item{ProductoID: line.ProductoID, Cantidad: line.Cantidad, Disponible: true}
		var stock int64
		if tx.QueryRow("SELECT codigo,nombre,precio,stock,presentacion,contenido FROM productos WHERE id=? AND activo=1", line.ProductoID).Scan(&it.Codigo, &it.Nombre, &it.Precio, &stock, &it.Presentacion, &it.Contenido) != nil {
			Fail(w, 409, "Un producto ya no está disponible; revisa el carrito")
			return
		}
		if stock < line.Cantidad {
			Fail(w, 409, "Stock insuficiente para "+it.Nombre)
			return
		}
		it.Subtotal = it.Precio * it.Cantidad
		it.Solicitado = it.Nombre
		total += it.Subtotal
		items = append(items, it)
	}
	if total <= 0 || total > models.MaxMoney {
		Fail(w, 400, "El total del pedido excede el límite")
		return
	}
	var hours int
	if tx.QueryRow("SELECT pedido_horas FROM configuracion_tienda WHERE id=1").Scan(&hours) != nil {
		Fail(w, 500, "No se pudo leer la vigencia")
		return
	}
	content, _ := json.Marshal(items)
	result, e := tx.Exec("INSERT INTO pedidos_web(token_hash,codigo_hash,huella,nombre,telefono,observaciones,items,total,fecha,vence) VALUES(?,?,?,?,?,?,?,?,?,?)", middleware.Hash(token), middleware.Hash(pickupCode(token)), fingerprint, in.Nombre, in.Telefono, in.Observaciones, string(content), total, services.Now(), time.Now().UTC().Add(time.Duration(hours)*time.Hour).Format(time.RFC3339))
	if e != nil {
		Fail(w, 409, "No se pudo registrar el pedido; vuelve a intentarlo")
		return
	}
	id, _ := result.LastInsertId()
	if _, e = tx.Exec("INSERT INTO pedidos_web_eventos(pedido_id,fecha,accion) VALUES(?,?,'creado')", id, services.Now()); e != nil {
		Fail(w, 500, "No se pudo guardar el pedido")
		return
	}
	if tx.Commit() != nil {
		Fail(w, 500, "No se pudo confirmar el pedido")
		return
	}
	reply(201, id)
}

const webOrderFields = `p.id,p.nombre,p.telefono,p.observaciones,p.items,p.total,p.estado,p.fecha,p.vence,p.venta_id,p.entrega_fecha,COALESCE(v.estado,'') venta_estado,COALESCE(u.nombre,'') entrega_usuario`

func webItems(rows []map[string]any) error {
	for _, row := range rows {
		var items []models.Item
		if e := json.Unmarshal([]byte(fmt.Sprint(row["items"])), &items); e != nil {
			return e
		}
		row["items"] = items
	}
	return nil
}
func (a *App) publicWebOrder(w http.ResponseWriter, r *http.Request, token string) {
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	if len(token) != 64 {
		Fail(w, 404, "Pedido no encontrado")
		return
	}
	if e := services.ExpireWebOrders(a.DB); e != nil {
		Fail(w, 500, "No se pudo consultar el pedido")
		return
	}
	rows, e := query(a.DB, "SELECT "+webOrderFields+" FROM pedidos_web p LEFT JOIN ventas v ON v.id=p.venta_id LEFT JOIN usuarios u ON u.id=p.entrega_usuario_id WHERE p.token_hash=?", middleware.Hash(token))
	if e != nil || len(rows) != 1 {
		Fail(w, 404, "Pedido no encontrado")
		return
	}
	if webItems(rows) != nil {
		Fail(w, 500, "No se pudo leer el pedido")
		return
	}
	q := rows[0]
	delete(q, "entrega_usuario")
	if q["estado"] != "entregado" && q["estado"] != "cancelado" && q["estado"] != "vencido" {
		q["codigo_recojo"] = pickupCode(token)
	}
	JSON(w, 200, q)
}
func (a *App) webOrders(w http.ResponseWriter, r *http.Request, u User) {
	if e := services.ExpireWebOrders(a.DB); e != nil {
		Fail(w, 500, "No se pudieron actualizar los pedidos")
		return
	}
	if r.Method == "GET" {
		base := "SELECT " + webOrderFields + " FROM pedidos_web p LEFT JOIN ventas v ON v.id=p.venta_id LEFT JOIN usuarios u ON u.id=p.entrega_usuario_id"
		if r.URL.Path != "/api/pedidos-web" {
			rows, err := query(a.DB, base+" WHERE p.id=?", idPath(r, "/api/pedidos-web/"))
			if err != nil || webItems(rows) != nil {
				Fail(w, 500, "No se pudo consultar el pedido")
				return
			}
			if len(rows) != 1 {
				Fail(w, 404, "Pedido no encontrado")
				return
			}
			JSON(w, 200, rows[0])
			return
		}
		where, args, err := orderFilters(r, true)
		if err != nil {
			Fail(w, 400, err.Error())
			return
		}
		lim, off := page(r)
		args = append(args, lim, off)
		rows, err := query(a.DB, base+where+" ORDER BY p.id DESC LIMIT ? OFFSET ?", args...)
		if err != nil || webItems(rows) != nil {
			Fail(w, 500, "No se pudieron consultar los pedidos")
			return
		}
		JSON(w, 200, rows)
		return
	}
	if r.Method != "PUT" {
		unsupported(w)
		return
	}
	id := idPath(r, "/api/pedidos-web/")
	var in struct {
		Estado string `json:"estado"`
		Codigo string `json:"codigo"`
	}
	if !Decode(w, r, &in) {
		return
	}
	if in.Estado != "preparando" && in.Estado != "listo" && in.Estado != "cancelado" && in.Estado != "entregado" {
		Fail(w, 400, "Estado inválido")
		return
	}
	if in.Estado == "entregado" && !a.Limits.Allow(fmt.Sprintf("pickup:%d:%d", u.ID, id), 5) {
		Fail(w, 429, "Demasiados códigos incorrectos; espera 15 minutos")
		return
	}
	tx, e := a.DB.Begin()
	if e != nil {
		Fail(w, 500, "No se pudo actualizar el pedido")
		return
	}
	defer tx.Rollback()
	var state, code, saleState string
	var paid bool
	if tx.QueryRow("SELECT p.estado,p.codigo_hash,p.venta_id IS NOT NULL,COALESCE(v.estado,'') FROM pedidos_web p LEFT JOIN ventas v ON v.id=p.venta_id WHERE p.id=?", id).Scan(&state, &code, &paid, &saleState) != nil {
		Fail(w, 404, "Pedido no encontrado")
		return
	}
	if state == "entregado" || state == "cancelado" || state == "vencido" {
		Fail(w, 409, "El pedido ya está cerrado")
		return
	}
	if in.Estado == "entregado" && (state != "listo" || !paid || saleState != "activa" || !hmac.Equal([]byte(code), []byte(middleware.Hash(strings.ToUpper(strings.TrimSpace(in.Codigo)))))) {
		Fail(w, 409, "Se requiere pedido listo, pago registrado y código de recojo correcto")
		return
	}
	if in.Estado == "cancelado" && paid {
		Fail(w, 409, "Anula la venta como administrador para cancelar un pedido pagado")
		return
	}
	if in.Estado == "listo" && state != "preparando" {
		Fail(w, 409, "Primero marca el pedido en preparación")
		return
	}
	if in.Estado == "preparando" && state != "pendiente" {
		Fail(w, 409, "El pedido ya inició su preparación")
		return
	}
	if in.Estado == "entregado" {
		_, e = tx.Exec("UPDATE pedidos_web SET estado=?,entrega_fecha=?,entrega_usuario_id=?,codigo_hash='' WHERE id=?", in.Estado, services.Now(), u.ID, id)
	} else {
		_, e = tx.Exec("UPDATE pedidos_web SET estado=? WHERE id=?", in.Estado, id)
	}
	if e == nil {
		_, e = tx.Exec("INSERT INTO pedidos_web_eventos(pedido_id,usuario_id,fecha,accion) VALUES(?,?,?,?)", id, u.ID, services.Now(), in.Estado)
	}
	if e != nil || tx.Commit() != nil {
		Fail(w, 500, "No se pudo guardar el cambio")
		return
	}
	JSON(w, 200, map[string]bool{"ok": true})
}
