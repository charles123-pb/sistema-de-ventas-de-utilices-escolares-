package handlers

import (
	"database/sql"
	"encoding/json"
	"golang.org/x/crypto/bcrypt"
	"io"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
	"utilventa/internal/middleware"
	"utilventa/internal/services"
)

// App concentra las dependencias compartidas y el control de solicitudes.
type App struct {
	backupMu      sync.Mutex
	maintenanceMu sync.Mutex
	DB            *sql.DB
	Origin        string
	Production    bool
	BackupDir     string
	Limits        middleware.Limiter
}

// User contiene únicamente los datos seguros que se exponen al cliente.
type User struct {
	ID      int64  `json:"id"`
	Nombre  string `json:"nombre"`
	Usuario string `json:"usuario"`
	Rol     string `json:"rol"`
}

// JSON centraliza el formato de las respuestas exitosas.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// Fail genera un error estructurado para mostrar mensajes consistentes al cliente.
func Fail(w http.ResponseWriter, status int, message string) {
	JSON(w, status, map[string]any{
		"error": map[string]string{
			"mensaje": message}})
}

// Decode rechaza JSON desconocido, objetos adicionales y cuerpos excesivamente grandes.
func Decode(w http.ResponseWriter, r *http.Request, v any) bool {
	return decodeLimit(w, r, v, 65536)
}
func decodeLimit(w http.ResponseWriter, r *http.Request, v any, limit int64) bool {
	r.Body = http.MaxBytesReader(w, r.Body, limit)
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if e := d.Decode(v); e != nil {
		Fail(w, 400, "JSON inválido o petición demasiado grande")
		return false
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		Fail(w, 400, "Se esperaba un solo objeto JSON")
		return false
	}
	return true
}

// user recupera la identidad solo si la sesión sigue vigente y el usuario está activo.
func (a *App) user(r *http.Request) (User, error) {
	var u User
	c, e := r.Cookie("uv_session")
	if e != nil {
		return u, e
	}
	e = a.DB.QueryRow("SELECT u.id,u.nombre,u.usuario,u.rol FROM sesiones s JOIN usuarios u ON u.id=s.usuario_id WHERE s.hash=? AND s.expira>? AND u.activo=1", middleware.Hash(c.Value), services.Now()).Scan(&u.ID, &u.Nombre, &u.Usuario, &u.Rol)
	return u, e
}

// ServeHTTP aplica seguridad y dirige cada ruta pública o autenticada a su manejador.
func (a *App) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	middleware.Headers(w)
	defer func() {
		if recover() != nil {
			Fail(w, 500, "No se pudo completar la operación")
		}
	}()
	path := r.URL.Path
	// Antes de escribir, se comprueba el origen exacto y que el cuerpo sea JSON.
	if r.Method != "GET" && r.Method != "HEAD" {
		if r.Header.Get("Origin") != a.Origin {
			Fail(w, 403, "Origen de petición no permitido")
			return
		}
		if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
			Fail(w, 415, "Se requiere JSON")
			return
		}
	}
	if path == "/api/health" && r.Method == "GET" {
		if a.DB.Ping() != nil {
			Fail(w, 503, "Base de datos no disponible")
			return
		}
		JSON(w, 200, map[string]string{
			"estado": "ok"})
		return
	}
	if path == "/api/login" && r.Method == "POST" {
		a.login(w, r)
		return
	}
	if strings.HasPrefix(path, "/api/publico/") {
		a.public(w, r)
		return
	}
	// Las rutas públicas ya se atendieron; desde aquí todas requieren una sesión válida.
	u, e := a.user(r)
	if e != nil {
		Fail(w, 401, "Inicie sesión para continuar")
		return
	}
	switch {
	case path == "/api/configuracion":
		a.settings(w, r, u, false)
	case path == "/api/pedidos-web" || strings.HasPrefix(path, "/api/pedidos-web/"):
		a.webOrders(w, r, u)
	case path == "/api/caja/estado":
		a.cashStatus(w, r)
	case path == "/api/cierres-caja" || path == "/api/cierres-caja/reabrir":
		a.cash(w, r, u)
	case path == "/api/reposicion":
		a.replenishment(w, r, u)
	case path == "/api/respaldos" || strings.HasPrefix(path, "/api/respaldos/"):
		a.backups(w, r, u)
	case path == "/api/me" && r.Method == "GET":
		JSON(w, 200, u)
	case path == "/api/logout" && r.Method == "POST":
		c, _ := r.Cookie("uv_session")
		a.DB.Exec("DELETE FROM sesiones WHERE hash=?", middleware.Hash(c.Value))
		http.SetCookie(w, &http.Cookie{
			Name: "uv_session", Value: "", Path: "/", HttpOnly: true, Secure: a.Production, SameSite: http.SameSiteLaxMode, MaxAge: -1})
		JSON(w, 200, map[string]bool{
			"ok": true})
	case path == "/api/productos" || strings.HasPrefix(path, "/api/productos/"):
		a.products(w, r, u, false)
	case path == "/api/proveedores" || strings.HasPrefix(path, "/api/proveedores/"):
		a.suppliers(w, r, u)
	case path == "/api/marcas":
		a.brands(w, r, false)
	case path == "/api/categorias":
		a.categories(w, r, u)
	case path == "/api/movimientos":
		a.movements(w, r, u)
	case path == "/api/clientes" || strings.HasPrefix(path, "/api/clientes/"):
		a.clients(w, r, u)
	case path == "/api/usuarios":
		a.users(w, r, u)
	case path == "/api/ventas" || strings.HasPrefix(path, "/api/ventas/"):
		a.sales(w, r, u)
	case path == "/api/cotizaciones" || strings.HasPrefix(path, "/api/cotizaciones/"):
		a.quotes(w, r, u)
	case path == "/api/pedidos" || strings.HasPrefix(path, "/api/pedidos/"):
		a.orders(w, r, u)
	case path == "/api/resumen":
		a.summary(w, r, u)
	case path == "/api/reportes":
		a.reports(w, r, u)
	default:
		Fail(w, 404, "Ruta no encontrada")
	}
}

// login limita intentos, verifica la contraseña y crea una sesión con cookie opaca.
func (a *App) login(w http.ResponseWriter, r *http.Request) {
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	if !a.Limits.Allow("login:"+ip, 20) {
		Fail(w, 429, "Demasiados intentos. Espere 15 minutos")
		return
	}
	var in struct {
		Usuario  string `json:"usuario"`
		Password string `json:"password"`
	}
	if !Decode(w, r, &in) {
		return
	}
	var u User
	var hash string
	e := a.DB.QueryRow("SELECT id,nombre,usuario,rol,password_hash FROM usuarios WHERE usuario=? AND activo=1", in.Usuario).Scan(&u.ID, &u.Nombre, &u.Usuario, &u.Rol, &hash)
	if e != nil {
		hash = "$2a$10$7EqJtq98hPqEX7fNZaFWoO5.Z8N5Z8N5Z8N5Z8N5Z8N5Z8N5Z8N5Z"
	}
	valid := bcrypt.CompareHashAndPassword([]byte(hash), []byte(in.Password))
	if e != nil || valid != nil {
		Fail(w, 401, "Usuario o contraseña incorrectos")
		return
	}
	// El navegador recibe el token en una cookie HttpOnly; la base conserva únicamente su hash.
	token := middleware.Token()
	expires := time.Now().UTC().Add(8 * time.Hour)
	a.DB.Exec("DELETE FROM sesiones WHERE expira<=?", services.Now())
	_, e = a.DB.Exec("INSERT INTO sesiones(hash,usuario_id,expira) VALUES(?,?,?)", middleware.Hash(token), u.ID, expires.Format(time.RFC3339))
	if e != nil {
		Fail(w, 500, "No se pudo iniciar sesión")
		return
	}
	http.SetCookie(w, &http.Cookie{
		Name: "uv_session", Value: token, Path: "/", HttpOnly: true, Secure: a.Production, SameSite: http.SameSiteLaxMode, Expires: expires})
	JSON(w, 200, u)
}

// admin valida permisos sin exponer datos reservados a otros roles.
func admin(w http.ResponseWriter, u User) bool {
	if u.Rol != "administrador" {
		Fail(w, 403, "Se requiere permiso de administrador")
		return false
	}
	return true
}

// idPath extrae el identificador entero de una ruta.
func idPath(r *http.Request, prefix string) int64 {
	id, _ := strconv.ParseInt(strings.TrimPrefix(r.URL.Path, prefix), 10, 64)
	return id
}

// page devuelve una longitud fija y el desplazamiento seguro de la página solicitada.
func page(r *http.Request) (int, int) {
	p, _ := strconv.Atoi(r.URL.Query().Get("pagina"))
	if p < 1 {
		p = 1
	}
	if p > 100000 {
		p = 100000
	}
	return 30, (p - 1) * 30
}

// query convierte las columnas dinámicas de SQL en mapas serializables como JSON.
func query(db *sql.DB, q string, args ...any) ([]map[string]any, error) {
	rows, e := db.Query(q, args...)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	cols, _ := rows.Columns()
	out := []map[string]any{}
	for rows.Next() {
		v := make([]any, len(cols))
		ptr := make([]any, len(cols))
		for i := range v {
			ptr[i] = &v[i]
		}
		if e = rows.Scan(ptr...); e != nil {
			return nil, e
		}
		m := map[string]any{}
		for i, k := range cols {
			if b, ok := v[i].([]byte); ok {
				m[k] = string(b)
			} else {
				m[k] = v[i]
			}
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// list responde con una colección o convierte errores de consulta en HTTP 500.
func list(w http.ResponseWriter, db *sql.DB, q string, args ...any) {
	v, e := query(db, q, args...)
	if e != nil {
		Fail(w, 500, "No se pudieron consultar los datos")
		return
	}
	JSON(w, 200, v)
}

// mutation distingue entre conflictos de escritura y registros inexistentes.
func mutation(w http.ResponseWriter, res sql.Result, e error) {
	if e != nil {
		Fail(w, 409, "No se pudo guardar: verifique campos únicos y referencias")
		return
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		Fail(w, 404, "Registro no encontrado")
		return
	}
	id, _ := res.LastInsertId()
	JSON(w, 200, map[string]any{
		"ok": true, "id": id})
}

// unsupported informa métodos HTTP no admitidos por una ruta.
func unsupported(w http.ResponseWriter) {
	Fail(w, 405, "Método no permitido")
}
