package handlers

import (
	"golang.org/x/crypto/bcrypt"
	"net/http"
	"strconv"
	"strings"
	"utilventa/internal/models"
	"utilventa/internal/services"
)

// products consulta el catálogo y permite al administrador crear o actualizar productos.
func (a *App) products(w http.ResponseWriter, r *http.Request, u User, public bool) {
	if r.Method == "GET" {
		lim, off := page(r)
		q := r.URL.Query().Get("q")
		if len(q) > 300 {
			Fail(w, 400, "La búsqueda admite hasta 300 caracteres")
			return
		}
		fields := "p.id,p.codigo,p.nombre,p.marca,p.descripcion,p.categoria_id,p.imagen,p.precio,p.stock,p.stock_minimo,p.activo,p.familia,p.presentacion,p.contenido,c.nombre categoria"
		// El costo de compra solo se incluye en consultas internas de administradores.
		if u.Rol == "administrador" && !public {
			fields += ",p.costo,p.proveedor_id,COALESCE(s.nombre,'') proveedor"
		}
		where := " WHERE school_search(p.nombre,p.marca,p.codigo,p.familia,?)=1"
		args := []any{q}
		if public {
			where += " AND p.activo=1"
		}
		if c := r.URL.Query().Get("categoria"); c != "" {
			where += " AND p.categoria_id=?"
			args = append(args, c)
		}
		if b := r.URL.Query().Get("marca"); b != "" {
			where += " AND TRIM(p.marca)=? COLLATE NOCASE"
			args = append(args, strings.TrimSpace(b))
		}
		if raw := r.URL.Query().Get("id"); raw != "" {
			id, e := strconv.ParseInt(raw, 10, 64)
			if e != nil || id < 1 {
				Fail(w, 400, "Producto inválido")
				return
			}
			where += " AND p.id=?"
			args = append(args, id)
		}
		if raw := r.URL.Query().Get("proveedor"); raw != "" {
			if public || u.Rol != "administrador" {
				Fail(w, 403, "El filtro de proveedor requiere administrador")
				return
			}
			id, e := strconv.ParseInt(raw, 10, 64)
			if e != nil || id < 0 {
				Fail(w, 400, "Proveedor inválido")
				return
			}
			where += " AND COALESCE(p.proveedor_id,0)=?"
			args = append(args, id)
		}
		if state := r.URL.Query().Get("estado"); state != "" {
			if public {
				Fail(w, 400, "Filtro solo disponible para el personal")
				return
			}
			switch state {
			case "stock_bajo":
				where += " AND p.activo=1 AND p.stock<=p.stock_minimo"
			case "agotados":
				where += " AND p.activo=1 AND p.stock=0"
			case "inactivos":
				where += " AND p.activo=0"
			case "activos":
				where += " AND p.activo=1"
			default:
				Fail(w, 400, "Estado de producto inválido")
				return
			}
		}
		args = append(args, lim, off)
		list(w, a.DB, "SELECT "+fields+" FROM productos p JOIN categorias c ON c.id=p.categoria_id LEFT JOIN proveedores s ON s.id=p.proveedor_id"+where+" ORDER BY p.nombre LIMIT ? OFFSET ?", args...)
		return
	}
	if !admin(w, u) {
		return
	}
	if r.Method != "POST" && r.Method != "PUT" {
		unsupported(w)
		return
	}
	var in struct {
		Codigo       string  `json:"codigo"`
		Nombre       string  `json:"nombre"`
		Marca        string  `json:"marca"`
		Proveedor    *int64  `json:"proveedor_id"`
		Descripcion  string  `json:"descripcion"`
		Categoria    int64   `json:"categoria_id"`
		Imagen       string  `json:"imagen"`
		Costo        string  `json:"costo"`
		Precio       string  `json:"precio"`
		Stock        int64   `json:"stock"`
		Min          int64   `json:"stock_minimo"`
		Activo       bool    `json:"activo"`
		Familia      *string `json:"familia"`
		Presentacion *string `json:"presentacion"`
		Contenido    *int64  `json:"contenido"`
	}
	if !Decode(w, r, &in) {
		return
	}
	in.Marca = strings.TrimSpace(in.Marca)
	family := models.SchoolFamily(in.Nombre)
	presentation, content := models.SchoolPackaging(in.Nombre)
	if r.Method == "PUT" {
		_ = a.DB.QueryRow("SELECT familia,presentacion,contenido FROM productos WHERE id=?", idPath(r, "/api/productos/")).Scan(&family, &presentation, &content)
	}
	if in.Familia != nil {
		family = models.SchoolFamily(*in.Familia)
		if family == "" {
			family = models.SchoolNormalize(*in.Familia)
		}
		if family == "" {
			family = models.SchoolFamily(in.Nombre)
		}
	}
	if in.Presentacion != nil {
		presentation = *in.Presentacion
	}
	if in.Contenido != nil {
		content = *in.Contenido
	}
	validPresentation := false
	for _, p := range []string{"unidad", "caja", "paquete", "estuche", "juego", "frasco", "rollo", "resma"} {
		if p == presentation {
			validPresentation = true
		}
	}
	if len(family) > 60 || !validPresentation || content < 0 || content > models.MaxQty || (presentation == "unidad" && content != 1) {
		Fail(w, 400, "Revisa la presentación y el contenido; una unidad debe tener contenido 1.")
		return
	}
	if in.Proveedor != nil {
		var active bool
		if a.DB.QueryRow("SELECT activo=1 OR EXISTS(SELECT 1 FROM productos WHERE id=? AND proveedor_id=proveedores.id) FROM proveedores WHERE id=?", idPath(r, "/api/productos/"), *in.Proveedor).Scan(&active) != nil || !active {
			Fail(w, 400, "Seleccione un proveedor activo")
			return
		}
	}
	price, e := models.Money(in.Precio)
	cost, ce := models.Money(in.Costo)
	if len(in.Marca) > 150 || e != nil || ce != nil || price <= 0 || strings.TrimSpace(in.Nombre) == "" || len(in.Nombre) > 150 || strings.TrimSpace(in.Codigo) == "" || len(in.Codigo) > 60 || in.Stock < 0 || in.Stock > models.MaxQty || in.Min < 0 || in.Min > models.MaxQty || len(in.Descripcion) > 2000 || len(in.Imagen) > 1000 || !models.ValidProductImage(in.Imagen) {
		Fail(w, 400, "Revise nombre, código, importes, stock y foto local o HTTPS opcional")
		return
	}
	if r.Method == "PUT" {
		id := idPath(r, "/api/productos/")
		var stock, oldCost int64
		if a.DB.QueryRow("SELECT stock,costo FROM productos WHERE id=?", id).Scan(&stock, &oldCost) != nil {
			Fail(w, 404, "Producto no encontrado")
			return
		}
		// Stock y costo se cambian con movimientos para conservar su trazabilidad.
		if stock != in.Stock || oldCost != cost {
			Fail(w, 400, "Modifique stock y costo mediante movimientos de inventario")
			return
		}
		res, e := a.DB.Exec("UPDATE productos SET codigo=?,nombre=?,marca=?,descripcion=?,categoria_id=?,imagen=?,precio=?,stock_minimo=?,activo=?,proveedor_id=?,familia=?,presentacion=?,contenido=? WHERE id=?", in.Codigo, in.Nombre, in.Marca, in.Descripcion, in.Categoria, in.Imagen, price, in.Min, in.Activo, in.Proveedor, family, presentation, content, id)
		mutation(w, res, e)
		return
	}
	tx, e := a.DB.Begin()
	if e != nil {
		Fail(w, 500, "No se pudo iniciar la operación")
		return
	}
	defer tx.Rollback()
	res, e := tx.Exec("INSERT INTO productos(codigo,nombre,marca,descripcion,categoria_id,imagen,costo,precio,stock,stock_minimo,activo,fecha,proveedor_id,familia,presentacion,contenido) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", in.Codigo, in.Nombre, in.Marca, in.Descripcion, in.Categoria, in.Imagen, cost, price, in.Stock, in.Min, in.Activo, services.Now(), in.Proveedor, family, presentation, content)
	if e != nil {
		Fail(w, 409, "Código duplicado o categoría inválida")
		return
	}
	id, _ := res.LastInsertId()
	// La creación y su movimiento inicial pertenecen a la misma transacción.
	if in.Stock > 0 {
		_, e = tx.Exec("INSERT INTO movimientos(producto_id,usuario_id,fecha,tipo,cantidad,motivo,costo) VALUES(?,?,?,'inicial',?,'Stock inicial',?)", id, u.ID, services.Now(), in.Stock, cost)
	}
	if e != nil || tx.Commit() != nil {
		Fail(w, 500, "No se pudo guardar el producto")
		return
	}
	JSON(w, 201, map[string]int64{
		"id": id})
}

// categories permite consultar categorías y crear o actualizar su visibilidad.
func (a *App) categories(w http.ResponseWriter, r *http.Request, u User) {
	if r.Method == "GET" {
		list(w, a.DB, "SELECT * FROM categorias ORDER BY nombre")
		return
	}
	if !admin(w, u) {
		return
	}
	var in struct {
		ID     int64  `json:"id"`
		Nombre string `json:"nombre"`
		Activo bool   `json:"activo"`
	}
	if !Decode(w, r, &in) {
		return
	}
	if strings.TrimSpace(in.Nombre) == "" || len(in.Nombre) > 100 {
		Fail(w, 400, "Nombre obligatorio, máximo 100 caracteres")
		return
	}
	if r.Method == "POST" {
		res, e := a.DB.Exec("INSERT INTO categorias(nombre,activo) VALUES(?,?)", in.Nombre, in.Activo)
		mutation(w, res, e)
	} else if r.Method == "PUT" {
		res, e := a.DB.Exec("UPDATE categorias SET nombre=?,activo=? WHERE id=?", in.Nombre, in.Activo, in.ID)
		mutation(w, res, e)
	} else {
		unsupported(w)
	}
}

// movements registra ajustes e ingresos dentro de una transacción con el nuevo costo promedio.
func (a *App) movements(w http.ResponseWriter, r *http.Request, u User) {
	if !admin(w, u) {
		return
	}
	if r.Method == "GET" {
		lim, off := page(r)
		list(w, a.DB, "SELECT m.*,p.nombre producto,u.nombre usuario,COALESCE(s.nombre,'') proveedor FROM movimientos m JOIN productos p ON p.id=m.producto_id JOIN usuarios u ON u.id=m.usuario_id LEFT JOIN proveedores s ON s.id=m.proveedor_id WHERE (?='' OR m.producto_id=?) ORDER BY m.id DESC LIMIT ? OFFSET ?", r.URL.Query().Get("producto_id"), r.URL.Query().Get("producto_id"), lim, off)
		return
	}
	if r.Method != "POST" {
		unsupported(w)
		return
	}
	var in struct {
		Producto    int64  `json:"producto_id"`
		Tipo        string `json:"tipo"`
		Cantidad    int64  `json:"cantidad"`
		Costo       string `json:"costo"`
		Motivo      string `json:"motivo"`
		Proveedor   *int64 `json:"proveedor_id"`
		Comprobante string `json:"comprobante"`
	}
	if !Decode(w, r, &in) {
		return
	}
	cost, e := models.Money(in.Costo)
	if len(in.Comprobante) > 80 || (in.Tipo != "entrada" && (in.Proveedor != nil || in.Comprobante != "")) {
		Fail(w, 400, "Proveedor y comprobante corresponden solo a entradas")
		return
	}
	if e != nil || in.Cantidad == 0 || in.Cantidad > models.MaxQty || in.Cantidad < -models.MaxQty || strings.TrimSpace(in.Motivo) == "" || len(in.Motivo) > 500 || (in.Tipo != "entrada" && in.Tipo != "ajuste") || (in.Tipo == "entrada" && in.Cantidad < 1) {
		Fail(w, 400, "Movimiento inválido; indique cantidad, costo y motivo")
		return
	}
	tx, e := a.DB.Begin()
	if e != nil {
		Fail(w, 500, "No se pudo iniciar el movimiento")
		return
	}
	defer tx.Rollback()
	if in.Proveedor != nil {
		var active bool
		if tx.QueryRow("SELECT activo FROM proveedores WHERE id=?", *in.Proveedor).Scan(&active) != nil || !active {
			Fail(w, 400, "Seleccione un proveedor activo")
			return
		}
	}
	var stock, oldCost int64
	if tx.QueryRow("SELECT stock,costo FROM productos WHERE id=?", in.Producto).Scan(&stock, &oldCost) != nil {
		Fail(w, 404, "Producto inexistente")
		return
	}
	next := stock + in.Cantidad
	if next < 0 || next > models.MaxQty {
		Fail(w, 409, "El movimiento dejaría stock fuera de límites")
		return
	}
	if in.Tipo == "ajuste" {
		cost = oldCost
	}
	newCost := oldCost
	if in.Tipo == "entrada" {
		// Promedio ponderado en enteros: sumar next/2 redondea al céntimo más cercano.
		newCost = (stock*oldCost + in.Cantidad*cost + next/2) / next
	}
	if _, e = tx.Exec("UPDATE productos SET stock=?,costo=? WHERE id=?", next, newCost, in.Producto); e == nil {
		_, e = tx.Exec("INSERT INTO movimientos(producto_id,usuario_id,fecha,tipo,cantidad,motivo,costo,proveedor_id,comprobante) VALUES(?,?,?,?,?,?,?,?,?)", in.Producto, u.ID, services.Now(), in.Tipo, in.Cantidad, in.Motivo, cost, in.Proveedor, strings.TrimSpace(in.Comprobante))
	}
	if e != nil || tx.Commit() != nil {
		Fail(w, 500, "No se pudo guardar el movimiento")
		return
	}
	JSON(w, 201, map[string]bool{
		"ok": true})
}

// clients mantiene fichas de clientes y consulta su historial paginado de ventas y cotizaciones.
func (a *App) clients(w http.ResponseWriter, r *http.Request, u User) {
	if r.Method == "GET" {
		if r.URL.Path != "/api/clientes" {
			id := idPath(r, "/api/clientes/")
			c, e := query(a.DB, "SELECT * FROM clientes WHERE id=?", id)
			if e != nil || len(c) == 0 {
				Fail(w, 404, "Cliente no encontrado")
				return
			}
			lim, off := page(r)
			v, ve := query(a.DB, "SELECT id,fecha,total,estado FROM ventas WHERE cliente_id=? ORDER BY id DESC LIMIT ? OFFSET ?", id, lim, off)
			q, qe := query(a.DB, "SELECT c.id,c.estado,p.estado pedido FROM cotizaciones c LEFT JOIN pedidos p ON p.cotizacion_id=c.id WHERE c.cliente_id=? ORDER BY c.id DESC LIMIT ? OFFSET ?", id, lim, off)
			if ve != nil || qe != nil {
				Fail(w, 500, "No se pudo consultar el historial")
				return
			}
			JSON(w, 200, map[string]any{
				"cliente": c[0], "ventas": v, "cotizaciones": q})
			return
		}
		lim, off := page(r)
		q := "%" + r.URL.Query().Get("q") + "%"
		tipo := r.URL.Query().Get("tipo")
		list(w, a.DB, "SELECT * FROM clientes WHERE (nombre LIKE ? OR documento LIKE ? OR telefono LIKE ?) AND (?='' OR tipo=?) ORDER BY nombre,id LIMIT ? OFFSET ?", q, q, q, tipo, tipo, lim, off)
		return
	}
	var in struct {
		Nombre    string `json:"nombre"`
		Telefono  string `json:"telefono"`
		Documento string `json:"documento"`
		Direccion string `json:"direccion"`
		Tipo      string `json:"tipo"`
	}
	if !Decode(w, r, &in) {
		return
	}
	in.Nombre = strings.TrimSpace(in.Nombre)
	in.Documento = strings.TrimSpace(in.Documento)
	in.Telefono = strings.TrimSpace(in.Telefono)
	in.Direccion = strings.TrimSpace(in.Direccion)
	if in.Tipo == "" {
		// Existing clients/forms keep their type when updating without this field.
		in.Tipo = "persona"
		if r.Method == "PUT" {
			_ = a.DB.QueryRow("SELECT tipo FROM clientes WHERE id=?", idPath(r, "/api/clientes/")).Scan(&in.Tipo)
		}
	}
	if in.Nombre == "" || len(in.Nombre) > 150 || len(in.Telefono) > 30 || len(in.Documento) > 30 || len(in.Direccion) > 300 || (in.Tipo != "persona" && in.Tipo != "empresa") {
		Fail(w, 400, "Datos de cliente inválidos")
		return
	}
	if in.Tipo == "empresa" {
		validRUC := len(in.Documento) == 11 && strings.IndexFunc(in.Documento, func(r rune) bool { return r < '0' || r > '9' }) == -1
		if !validRUC || in.Direccion == "" {
			Fail(w, 400, "Para una empresa indica un RUC de 11 dígitos y su dirección.")
			return
		}
	}
	if in.Documento != "" {
		var duplicate int
		_ = a.DB.QueryRow("SELECT COUNT(*) FROM clientes WHERE documento=? AND id<>?", in.Documento, idPath(r, "/api/clientes/")).Scan(&duplicate)
		if duplicate > 0 {
			Fail(w, 409, "Este documento ya está registrado. Busca y selecciona al cliente existente.")
			return
		}
	}
	if r.Method == "POST" {
		res, e := a.DB.Exec("INSERT INTO clientes(nombre,telefono,documento,direccion,tipo) VALUES(?,?,?,?,?)", in.Nombre, in.Telefono, in.Documento, in.Direccion, in.Tipo)
		mutation(w, res, e)
	} else if r.Method == "PUT" {
		res, e := a.DB.Exec("UPDATE clientes SET nombre=?,telefono=?,documento=?,direccion=?,tipo=? WHERE id=?", in.Nombre, in.Telefono, in.Documento, in.Direccion, in.Tipo, idPath(r, "/api/clientes/"))
		mutation(w, res, e)
	} else {
		unsupported(w)
	}
}

// users administra cuentas del personal; las escrituras requieren el rol administrador.
func (a *App) users(w http.ResponseWriter, r *http.Request, u User) {
	if !admin(w, u) {
		return
	}
	if r.Method == "GET" {
		lim, off := page(r)
		list(w, a.DB, "SELECT id,nombre,usuario,rol,activo FROM usuarios ORDER BY id LIMIT ? OFFSET ?", lim, off)
		return
	}
	var in struct {
		ID       int64  `json:"id"`
		Nombre   string `json:"nombre"`
		Usuario  string `json:"usuario"`
		Password string `json:"password"`
		Rol      string `json:"rol"`
		Activo   bool   `json:"activo"`
	}
	if !Decode(w, r, &in) {
		return
	}
	if in.Rol != "administrador" && in.Rol != "vendedor" || strings.TrimSpace(in.Usuario) == "" || strings.TrimSpace(in.Nombre) == "" || len(in.Nombre) > 150 || len(in.Usuario) > 80 || len(in.Password) > 72 {
		Fail(w, 400, "Datos de usuario inválidos")
		return
	}
	if in.ID == u.ID && (!in.Activo || in.Rol != "administrador") {
		Fail(w, 400, "No puede desactivar ni degradar su propia cuenta")
		return
	}
	if r.Method == "POST" {
		if len(in.Password) < 10 {
			Fail(w, 400, "Contraseña: mínimo 10 caracteres")
			return
		}
		hash, e := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
		if e != nil {
			Fail(w, 400, "Contraseña inválida")
			return
		}
		res, e := a.DB.Exec("INSERT INTO usuarios(nombre,usuario,password_hash,rol,activo,fecha) VALUES(?,?,?,?,?,?)", in.Nombre, in.Usuario, string(hash), in.Rol, in.Activo, services.Now())
		mutation(w, res, e)
	} else if r.Method == "PUT" {
		if in.Password != "" && len(in.Password) < 10 {
			Fail(w, 400, "Contraseña: mínimo 10 caracteres")
			return
		}
		tx, e := a.DB.Begin()
		if e != nil {
			Fail(w, 500, "No se pudo actualizar")
			return
		}
		defer tx.Rollback()
		_, e = tx.Exec("UPDATE usuarios SET nombre=?,usuario=?,rol=?,activo=? WHERE id=?", in.Nombre, in.Usuario, in.Rol, in.Activo, in.ID)
		if e == nil && in.Password != "" {
			hash, he := bcrypt.GenerateFromPassword([]byte(in.Password), bcrypt.DefaultCost)
			if he != nil {
				Fail(w, 400, "Contraseña inválida")
				return
			}
			_, e = tx.Exec("UPDATE usuarios SET password_hash=? WHERE id=?", string(hash), in.ID)
		}
		if e == nil {
			_, e = tx.Exec("DELETE FROM sesiones WHERE usuario_id=?", in.ID)
		}
		if e != nil || tx.Commit() != nil {
			Fail(w, 409, "No se pudo actualizar el usuario")
			return
		}
		JSON(w, 200, map[string]bool{
			"ok": true})
	} else {
		unsupported(w)
	}
}
