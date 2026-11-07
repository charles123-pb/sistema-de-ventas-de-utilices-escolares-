package handlers

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
	"utilventa/internal/middleware"
	"utilventa/internal/models"
	"utilventa/internal/services"
)

// public controla el catálogo y las solicitudes accesibles sin iniciar sesión.
func (a *App) public(w http.ResponseWriter, r *http.Request) {
	p := strings.TrimPrefix(r.URL.Path, "/api/publico/")
	if p == "productos" && r.Method == "GET" {
		a.products(w, r, User{}, true)
		return
	}
	if p == "marcas" && r.Method == "GET" {
		a.brands(w, r, true)
		return
	}
	if p == "categorias" && r.Method == "GET" {
		list(w, a.DB, "SELECT id,nombre FROM categorias WHERE activo=1 ORDER BY nombre")
		return
	}
	if p == "configuracion" && r.Method == "GET" {
		a.settings(w, r, User{}, true)
		return
	}
	if strings.HasPrefix(p, "pedidos/") && r.Method == "GET" {
		a.publicWebOrder(w, r, strings.TrimPrefix(p, "pedidos/"))
		return
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if r.Method != "GET" && !a.Limits.Allow("public:"+ip, 20) {
		Fail(w, 429, "Límite de solicitudes alcanzado; espere 15 minutos")
		return
	}
	if p == "pedidos" && r.Method == "POST" {
		a.createWebOrder(w, r)
		return
	}
	if p == "solicitudes" && r.Method == "POST" {
		a.createQuote(w, r)
		return
	}
	if strings.HasPrefix(p, "seguimiento/") {
		// El enlace privado actúa como credencial de seguimiento y se busca mediante su hash.
		attachment := strings.HasSuffix(p, "/adjunto")
		token := strings.TrimPrefix(strings.TrimSuffix(p, "/adjunto"), "seguimiento/")
		if len(token) != 64 {
			Fail(w, 404, "Enlace no encontrado")
			return
		}
		var id int64
		if a.DB.QueryRow("SELECT id FROM cotizaciones WHERE token_hash=?", middleware.Hash(token)).Scan(&id) != nil {
			Fail(w, 404, "Enlace no encontrado")
			return
		}
		if attachment {
			a.quoteAttachment(w, r, id)
			return
		}
		if r.Method == "GET" {
			a.quoteDetail(w, r, id, true)
			return
		}
		if r.Method == "POST" {
			var in struct {
				Accion   string `json:"accion"`
				Revision int    `json:"revision"`
			}
			if !Decode(w, r, &in) {
				return
			}
			if in.Accion != "aceptada" && in.Accion != "rechazada" {
				Fail(w, 400, "Acción inválida")
				return
			}
			// Solo se acepta o rechaza la revisión enviada que siga vigente; evita responder una versión antigua.
			res, e := a.DB.Exec("UPDATE cotizaciones SET estado=? WHERE id=? AND estado='enviada' AND revision=? AND vigencia>?", in.Accion, id, in.Revision, services.Now())
			if e != nil {
				Fail(w, 500, "No se pudo responder")
				return
			}
			n, _ := res.RowsAffected()
			if n != 1 {
				Fail(w, 409, "La propuesta cambió, venció o ya fue respondida")
				return
			}
			a.quoteDetail(w, r, id, true)
			return
		}
	}
	Fail(w, 404, "Ruta no encontrada")
}

// createQuote valida la lista y crea o reutiliza el cliente sin crear credenciales de acceso.
func (a *App) createQuote(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Nombre        string                   `json:"nombre"`
		Telefono      string                   `json:"telefono"`
		Lista         string                   `json:"lista"`
		Observaciones string                   `json:"observaciones"`
		Presupuesto   string                   `json:"presupuesto"`
		ClienteID     *int64                   `json:"cliente_id"`
		Adjunto       *schoolAttachment        `json:"adjunto"`
		Seleccion     []models.SchoolSelection `json:"seleccion"`
	}
	if !decodeLimit(w, r, &in, 8*1024*1024) {
		return
	}
	if !validateAttachment(in.Adjunto) || len(in.Seleccion) > 100 {
		Fail(w, 400, "Adjunte una imagen JPG, PNG, WebP, PDF o TXT de hasta 5 MB; máximo 100 artículos")
		return
	}
	if strings.TrimSpace(in.Lista) == "" && in.Adjunto != nil {
		in.Lista = "Lista escolar adjunta: " + in.Adjunto.Nombre
	}
	if strings.TrimSpace(in.Nombre) == "" || len(in.Nombre) > 150 || len(in.Telefono) < 6 || len(in.Telefono) > 30 || strings.TrimSpace(in.Lista) == "" || len(in.Lista) > 10000 || len(in.Observaciones) > 2000 {
		Fail(w, 400, "Indique nombre, teléfono y lista (máximo 10 000 caracteres)")
		return
	}
	var budget int64
	var e error
	if in.Presupuesto != "" {
		budget, e = models.Money(in.Presupuesto)
		if e != nil {
			Fail(w, 400, "Presupuesto inválido")
			return
		}
	}
	if strings.HasPrefix(r.URL.Path, "/api/publico/") {
		in.ClienteID = nil
	}
	token := middleware.Token()
	tx, e := a.DB.Begin()
	if e != nil {
		Fail(w, 500, "No se pudo iniciar la solicitud")
		return
	}
	defer tx.Rollback()
	selection := []models.SchoolLine{}
	selected := map[int64]bool{}
	for _, s := range in.Seleccion {
		s.Solicitado = strings.TrimSpace(s.Solicitado)
		if s.Cantidad < 1 || s.Cantidad > models.MaxQty || s.ProductoID < 0 || len(s.Solicitado) > 300 || (s.ProductoID == 0 && s.Solicitado == "") || (s.ProductoID > 0 && selected[s.ProductoID]) {
			Fail(w, 400, "Revise cantidades y artículos de su lista")
			return
		}
		line := models.SchoolLine{ProductoID: s.ProductoID, Solicitado: s.Solicitado, Nombre: s.Solicitado, Cantidad: s.Cantidad, Faltantes: s.Cantidad}
		line.PorRevisar = s.ProductoID == 0 && s.PorRevisar
		if s.ProductoID > 0 {
			selected[s.ProductoID] = true
			var stock int64
			if tx.QueryRow("SELECT nombre,marca,precio,stock,presentacion,contenido FROM productos WHERE id=? AND activo=1", s.ProductoID).Scan(&line.Nombre, &line.Marca, &line.Precio, &stock, &line.Presentacion, &line.Contenido) != nil {
				Fail(w, 400, "Un producto ya no está disponible; revise su lista")
				return
			}
			if line.Solicitado == "" {
				line.Solicitado = line.Nombre
			}
			line.Disponibles = min(stock, s.Cantidad)
			line.Faltantes = s.Cantidad - line.Disponibles
		}
		selection = append(selection, line)
	}
	selectedJSON, err := json.Marshal(selection)
	if err != nil {
		Fail(w, 500, "No se pudo preparar la lista")
		return
	}
	// Una solicitud crea o reutiliza una ficha de cliente; nunca una cuenta de acceso.
	if in.ClienteID == nil {
		var clientID int64
		e = tx.QueryRow("SELECT id FROM clientes WHERE nombre=? AND telefono=? ORDER BY id LIMIT 1", strings.TrimSpace(in.Nombre), strings.TrimSpace(in.Telefono)).Scan(&clientID)
		if e != nil {
			res, ce := tx.Exec("INSERT INTO clientes(nombre,telefono) VALUES(?,?)", strings.TrimSpace(in.Nombre), strings.TrimSpace(in.Telefono))
			if ce != nil {
				Fail(w, 500, "No se pudo registrar el cliente")
				return
			}
			clientID, _ = res.LastInsertId()
		}
		in.ClienteID = &clientID
	}
	res, e := tx.Exec("INSERT INTO cotizaciones(token_hash,cliente_id,nombre,telefono,lista,observaciones,presupuesto,fecha,solicitud_items) VALUES(?,?,?,?,?,?,?,?,?)", middleware.Hash(token), in.ClienteID, in.Nombre, in.Telefono, in.Lista, in.Observaciones, budget, services.Now(), string(selectedJSON))
	if e != nil {
		Fail(w, 400, "No se pudo registrar la solicitud")
		return
	}
	id, _ := res.LastInsertId()
	if in.Adjunto != nil {
		if _, e = tx.Exec("INSERT INTO cotizacion_adjuntos(cotizacion_id,nombre,tipo,tamano,contenido) VALUES(?,?,?,?,?)", id, in.Adjunto.Nombre, in.Adjunto.Tipo, len(in.Adjunto.Datos), in.Adjunto.Datos); e != nil {
			Fail(w, 500, "No se pudo guardar el archivo")
			return
		}
	}
	if tx.Commit() != nil {
		Fail(w, 500, "No se pudo confirmar la solicitud")
		return
	}
	// El token original se entrega una sola vez; no puede reconstruirse desde el hash guardado.
	JSON(w, 201, map[string]any{
		"id": id, "enlace": "/seguimiento/" + token})
}

// quoteDetail combina datos de la cotización, propuesta, vigencia y pedidos asociados.
func (a *App) quoteDetail(w http.ResponseWriter, r *http.Request, id int64, public bool) {
	rows, e := query(a.DB, "SELECT id,cliente_id,nombre,telefono,lista,observaciones,presupuesto,CASE WHEN estado IN ('enviada','aceptada') AND vigencia<=? THEN 'vencida' ELSE estado END estado,revision,vigencia,fecha,solicitud_items FROM cotizaciones WHERE id=?", services.Now(), id)
	if e != nil || len(rows) == 0 {
		Fail(w, 404, "Cotización no encontrada")
		return
	}
	q := rows[0]
	var selection []models.SchoolLine
	json.Unmarshal([]byte(fmt.Sprint(q["solicitud_items"])), &selection)
	if selection == nil {
		selection = []models.SchoolLine{}
	}
	q["solicitud_items"] = selection
	attachments, err := query(a.DB, "SELECT nombre,tipo,tamano FROM cotizacion_adjuntos WHERE cotizacion_id=?", id)
	if err != nil {
		Fail(w, 500, "No se pudo consultar el archivo")
		return
	}
	q["adjunto"] = nil
	if len(attachments) > 0 {
		attachments[0]["url"] = r.URL.Path + "/adjunto"
		q["adjunto"] = attachments[0]
	}

	var content string
	items := []models.Item{}
	a.DB.QueryRow("SELECT contenido FROM propuestas WHERE cotizacion_id=? AND revision=?", id, q["revision"]).Scan(&content)
	json.Unmarshal([]byte(content), &items)
	// El cliente puede seguir su solicitud, pero no ve artículos de un borrador sin enviar.
	if public && (q["estado"] == "solicitada" || q["estado"] == "en preparación") {
		items = []models.Item{}
	}
	q["items"] = items
	orders, _ := query(a.DB, "SELECT p.id,p.estado,p.venta_id,COALESCE(v.estado,'') venta_estado FROM pedidos p LEFT JOIN ventas v ON v.id=p.venta_id WHERE p.cotizacion_id=?", id)
	q["pedidos"] = orders
	JSON(w, 200, q)
}

// quotes administra el listado privado y permite preparar o enviar propuestas.
func (a *App) quotes(w http.ResponseWriter, r *http.Request, u User) {
	if r.URL.Path == "/api/cotizaciones" {
		if r.Method == "POST" {
			a.createQuote(w, r)
			return
		}
		if r.Method == "GET" {
			lim, off := page(r)
			state := r.URL.Query().Get("estado")
			where := ""
			switch state {
			case "":
			case "pendientes":
				where = " AND estado IN ('solicitada','en preparación')"
			case "enviada", "aceptada":
				where = " AND estado=?"
			case "cerradas":
				where = " AND estado IN ('convertida','rechazada','vencida')"
			default:
				Fail(w, 400, "Estado de cotización inválido")
				return
			}
			search := "%" + r.URL.Query().Get("q") + "%"
			args := []any{services.Now(), search, search, search}
			if state == "enviada" || state == "aceptada" {
				args = append(args, state)
			}
			args = append(args, lim, off)
			list(w, a.DB, "SELECT * FROM (SELECT id,nombre,telefono,CASE WHEN estado IN ('enviada','aceptada') AND vigencia<=? THEN 'vencida' ELSE estado END estado,revision,vigencia,fecha FROM cotizaciones) WHERE (nombre LIKE ? OR telefono LIKE ? OR CAST(id AS TEXT) LIKE ?)"+where+" ORDER BY id DESC LIMIT ? OFFSET ?", args...)
			return
		}
		unsupported(w)
		return
	}
	if strings.HasSuffix(r.URL.Path, "/adjunto") {
		id, err := strconv.ParseInt(strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/api/cotizaciones/"), "/adjunto"), 10, 64)
		if err != nil || id < 1 {
			Fail(w, 404, "Archivo no encontrado")
			return
		}
		a.quoteAttachment(w, r, id)
		return
	}
	id := idPath(r, "/api/cotizaciones/")
	if r.Method == "GET" {
		a.quoteDetail(w, r, id, false)
		return
	}
	if r.Method != "PUT" {
		unsupported(w)
		return
	}
	var in struct {
		Items    []models.Item `json:"items"`
		Vigencia string        `json:"vigencia"`
		Enviar   bool          `json:"enviar"`
		Revision int           `json:"revision"`
	}
	if !Decode(w, r, &in) {
		return
	}
	loc, _ := time.LoadLocation("America/Lima")
	expires, e := time.ParseInLocation("2006-01-02", in.Vigencia, loc)
	// La fecha elegida vence a las 23:59:59 de Lima y luego se almacena en UTC.
	expires = expires.Add(24*time.Hour - time.Second)
	if e != nil || !expires.After(time.Now()) || expires.After(time.Now().AddDate(1, 0, 0)) || len(in.Items) > 100 || (in.Enviar && len(in.Items) == 0) {
		Fail(w, 400, "Indique artículos y vigencia futura (máximo un año)")
		return
	}
	tx, e := a.DB.Begin()
	if e != nil {
		Fail(w, 500, "No se pudo iniciar la propuesta")
		return
	}
	defer tx.Rollback()
	var state string
	var rev int
	if tx.QueryRow("SELECT estado,revision FROM cotizaciones WHERE id=?", id).Scan(&state, &rev) != nil {
		Fail(w, 404, "Cotización no encontrada")
		return
	}
	if rev != in.Revision || state == "convertida" {
		Fail(w, 409, "La cotización cambió o ya se convirtió")
		return
	}
	// Editar una propuesta ya respondida o enviada crea una revisión que necesita nueva aceptación.
	if state == "enviada" || state == "aceptada" || state == "rechazada" {
		rev++
	}
	valid := []models.Item{}
	var total int64
	for _, it := range in.Items {
		if it.Cantidad < 1 || it.Cantidad > models.MaxQty || len(it.Solicitado) > 300 || len(it.Alternativa) > 500 {
			Fail(w, 400, "Artículo o cantidad inválida")
			return
		}
		// Los nombres y precios se leen de SQLite; los importes enviados por la interfaz no se usan.
		if it.ProductoID > 0 {
			if tx.QueryRow("SELECT nombre,codigo,precio,presentacion,contenido FROM productos WHERE id=? AND activo=1", it.ProductoID).Scan(&it.Nombre, &it.Codigo, &it.Precio, &it.Presentacion, &it.Contenido) != nil {
				Fail(w, 400, "Producto inactivo o inexistente")
				return
			}
			it.Disponible = true
			it.PorRevisar = false
			it.Subtotal = it.Precio * it.Cantidad
			total += it.Subtotal
		} else {
			if strings.TrimSpace(it.Solicitado) == "" {
				Fail(w, 400, "Describa el artículo no disponible")
				return
			}
			it.Disponible = false
			it.Nombre = it.Solicitado
			it.Precio = 0
			it.Subtotal = 0
		}

		if len(it.Opciones) > 10 {
			Fail(w, 400, "Máximo diez alternativas por artículo")
			return
		}
		options := []models.Opcion{}
		seenOptions := map[int64]bool{}
		// El precio de las opciones también proviene del servidor.
		for _, candidate := range it.Opciones {
			if seenOptions[candidate.ProductoID] {
				Fail(w, 400, "Alternativa repetida")
				return
			}
			seenOptions[candidate.ProductoID] = true
			var option models.Opcion
			if tx.QueryRow("SELECT id,nombre,codigo,marca,precio,presentacion,contenido FROM productos WHERE id=? AND activo=1", candidate.ProductoID).Scan(&option.ProductoID, &option.Nombre, &option.Codigo, &option.Marca, &option.Precio, &option.Presentacion, &option.Contenido) != nil {
				Fail(w, 400, "Alternativa inactiva o inexistente")
				return
			}
			options = append(options, option)
		}
		if len(options) > 0 && it.ProductoID > 0 && !seenOptions[it.ProductoID] {
			Fail(w, 400, "El producto elegido debe pertenecer a las alternativas")
			return
		}
		it.Opciones = options
		it.Costo = 0
		valid = append(valid, it)
	}
	if total > models.MaxMoney || (in.Enviar && total == 0) {
		Fail(w, 400, "La propuesta debe incluir productos y un total válido")
		return
	}
	b, _ := json.Marshal(valid)
	state = "en preparación"
	if in.Enviar {
		state = "enviada"
	}
	_, e = tx.Exec("INSERT INTO propuestas(cotizacion_id,revision,contenido,fecha) VALUES(?,?,?,?) ON CONFLICT(cotizacion_id,revision) DO UPDATE SET contenido=excluded.contenido,fecha=excluded.fecha", id, rev, string(b), services.Now())
	if e == nil {
		_, e = tx.Exec("UPDATE cotizaciones SET revision=?,estado=?,vigencia=? WHERE id=?", rev, state, expires.UTC().Format(time.RFC3339), id)
	}
	if e == nil {
		_, e = tx.Exec("UPDATE pedidos SET estado='cancelado' WHERE cotizacion_id=? AND venta_id IS NULL", id)
	}
	if e != nil || tx.Commit() != nil {
		Fail(w, 500, "No se pudo guardar la propuesta")
		return
	}
	a.quoteDetail(w, r, id, false)
}

// orders gestiona la preparación sin reservar stock; la entrega exige una venta vinculada.
func (a *App) orders(w http.ResponseWriter, r *http.Request, u User) {
	if r.Method == "GET" {
		base := `SELECT p.*,c.nombre,c.telefono,COALESCE(v.estado,'') venta_estado,
            COALESCE(v.total,(SELECT SUM(CAST(json_extract(item.value,'$.subtotal') AS INTEGER)) FROM json_each(COALESCE(pr.contenido,'[]')) item),0) total
            FROM pedidos p JOIN cotizaciones c ON c.id=p.cotizacion_id
            LEFT JOIN ventas v ON v.id=p.venta_id
            LEFT JOIN propuestas pr ON pr.cotizacion_id=c.id AND pr.revision=c.revision`
		if r.URL.Path != "/api/pedidos" {
			rows, err := query(a.DB, base+" WHERE p.id=?", idPath(r, "/api/pedidos/"))
			if err != nil {
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
		where, args, err := orderFilters(r, false)
		if err != nil {
			Fail(w, 400, err.Error())
			return
		}
		lim, off := page(r)
		args = append(args, lim, off)
		list(w, a.DB, base+where+" ORDER BY p.id DESC LIMIT ? OFFSET ?", args...)
		return
	}
	var in struct {
		Cotizacion int64  `json:"cotizacion_id"`
		Estado     string `json:"estado"`
	}
	if !Decode(w, r, &in) {
		return
	}
	if r.Method == "POST" {
		res, e := a.DB.Exec("INSERT INTO pedidos(cotizacion_id,fecha) SELECT id,? FROM cotizaciones WHERE id=? AND estado='aceptada' AND vigencia>?", services.Now(), in.Cotizacion, services.Now())
		if e != nil {
			Fail(w, 409, "Ya existe un pedido para esta cotización")
			return
		}
		n, _ := res.RowsAffected()
		if n != 1 {
			Fail(w, 409, "Se necesita una cotización aceptada y vigente")
			return
		}
		mutation(w, res, nil)
		return
	}
	if r.Method != "PUT" {
		unsupported(w)
		return
	}
	if in.Estado != "pendiente" && in.Estado != "preparando" && in.Estado != "listo" && in.Estado != "entregado" && in.Estado != "cancelado" {
		Fail(w, 400, "Estado inválido")
		return
	}
	id := idPath(r, "/api/pedidos/")
	res, e := a.DB.Exec("UPDATE pedidos SET estado=? WHERE id=? AND (venta_id IS NULL OR venta_id IN (SELECT id FROM ventas WHERE estado='activa')) AND (?!='entregado' OR venta_id IN (SELECT id FROM ventas WHERE estado='activa')) AND (venta_id IS NOT NULL OR cotizacion_id IN (SELECT id FROM cotizaciones WHERE estado='aceptada' AND vigencia>?))", in.Estado, id, in.Estado, services.Now())
	if e != nil {
		Fail(w, 500, "No se pudo actualizar el pedido")
		return
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		Fail(w, 409, "Se requiere cotización vigente y, para entregar, una venta pagada")
		return
	}
	JSON(w, 200, map[string]bool{
		"ok": true})
}
