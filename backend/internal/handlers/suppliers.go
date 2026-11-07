package handlers

import (
	"net/http"
	"net/mail"
	"net/url"
	"regexp"
	"strings"
)

var supplierRUC = regexp.MustCompile(`^[0-9]{11}$`)

// brands devuelve únicamente marcas del catálogo; nunca expone los contactos de proveedores.
func (a *App) brands(w http.ResponseWriter, r *http.Request, public bool) {
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	where := " WHERE TRIM(marca)<>''"
	if public {
		where += " AND activo=1"
	}
	list(w, a.DB, "SELECT MIN(TRIM(marca)) nombre,COUNT(*) productos FROM productos"+where+" GROUP BY TRIM(marca) COLLATE NOCASE ORDER BY nombre COLLATE NOCASE")
}

func (a *App) suppliers(w http.ResponseWriter, r *http.Request, u User) {
	if !admin(w, u) {
		return
	}
	if r.Method == "GET" {
		// Selector ligero completo: no trunca proveedores después de la primera página.
		if r.URL.Query().Get("opciones") == "1" {
			list(w, a.DB, "SELECT id,nombre,activo FROM proveedores ORDER BY nombre COLLATE NOCASE")
			return
		}
		lim, off := page(r)
		q := "%" + strings.TrimSpace(r.URL.Query().Get("q")) + "%"
		list(w, a.DB, `SELECT s.*,
   COALESCE((SELECT GROUP_CONCAT(marca, ', ') FROM proveedor_marcas WHERE proveedor_id=s.id), '') marcas_declaradas,
   COALESCE((SELECT GROUP_CONCAT(marca, ', ') FROM (SELECT marca FROM proveedor_marcas WHERE proveedor_id=s.id UNION SELECT TRIM(marca) FROM productos WHERE proveedor_id=s.id AND TRIM(marca)<>'' ORDER BY marca COLLATE NOCASE)), '') marcas,
   (SELECT COUNT(*) FROM productos WHERE proveedor_id=s.id) productos
   FROM proveedores s WHERE (s.nombre LIKE ? OR s.ruc LIKE ? OR s.ciudad LIKE ? OR EXISTS (SELECT 1 FROM proveedor_marcas m WHERE m.proveedor_id=s.id AND m.marca LIKE ?) OR EXISTS (SELECT 1 FROM productos p WHERE p.proveedor_id=s.id AND p.marca LIKE ?)) ORDER BY s.activo DESC,s.nombre COLLATE NOCASE LIMIT ? OFFSET ?`, q, q, q, q, q, lim, off)
		return
	}
	if r.Method != "POST" && r.Method != "PUT" {
		unsupported(w)
		return
	}
	var in struct {
		Nombre    string `json:"nombre"`
		SitioWeb  string `json:"sitio_web"`
		RUC       string `json:"ruc"`
		Contacto  string `json:"contacto"`
		Telefono  string `json:"telefono"`
		Email     string `json:"email"`
		Direccion string `json:"direccion"`
		Ciudad    string `json:"ciudad"`
		Notas     string `json:"notas"`
		Marcas    string `json:"marcas"`
		Activo    bool   `json:"activo"`
	}
	if !Decode(w, r, &in) {
		return
	}
	in.Nombre = strings.TrimSpace(in.Nombre)
	in.RUC = strings.TrimSpace(in.RUC)
	in.Email = strings.TrimSpace(in.Email)
	in.Ciudad = strings.TrimSpace(in.Ciudad)
	in.SitioWeb = strings.TrimSpace(in.SitioWeb)
	if in.SitioWeb != "" {
		site, err := url.Parse(in.SitioWeb)
		if err != nil || site.Scheme != "https" || site.Host == "" || site.User != nil || len(in.SitioWeb) > 1000 {
			Fail(w, 400, "Use un sitio web HTTPS válido")
			return
		}
	}
	if in.Nombre == "" || len(in.Nombre) > 150 || (in.RUC != "" && !supplierRUC.MatchString(in.RUC)) || len(in.Contacto) > 150 || len(in.Telefono) > 30 || len(in.Email) > 150 || len(in.Direccion) > 300 || in.Ciudad == "" || len(in.Ciudad) > 100 || len(in.Notas) > 2000 || len(in.Marcas) > 2000 {
		Fail(w, 400, "Revise empresa, ciudad, RUC de 11 dígitos y longitud de los campos")
		return
	}
	if in.Email != "" {
		if parsed, e := mail.ParseAddress(in.Email); e != nil || parsed.Address != in.Email {
			Fail(w, 400, "Correo electrónico inválido")
			return
		}
	}
	brands := []string{}
	seen := map[string]bool{}
	for _, b := range strings.Split(in.Marcas, ",") {
		b = strings.TrimSpace(b)
		if b == "" {
			continue
		}
		if len(b) > 150 {
			Fail(w, 400, "Cada marca admite hasta 150 caracteres")
			return
		}
		key := strings.ToLower(b)
		if !seen[key] {
			brands = append(brands, b)
			seen[key] = true
		}
	}
	if len(brands) > 30 {
		Fail(w, 400, "Registre hasta 30 marcas por proveedor")
		return
	}
	tx, e := a.DB.Begin()
	if e != nil {
		Fail(w, 500, "No se pudo iniciar la operación")
		return
	}
	defer tx.Rollback()
	id := idPath(r, "/api/proveedores/")
	if r.Method == "POST" {
		res, err := tx.Exec("INSERT INTO proveedores(nombre,ruc,contacto,telefono,email,direccion,ciudad,notas,activo,sitio_web) VALUES(?,?,?,?,?,?,?,?,?,?)", in.Nombre, in.RUC, in.Contacto, in.Telefono, in.Email, in.Direccion, in.Ciudad, in.Notas, in.Activo, in.SitioWeb)
		if err != nil {
			Fail(w, 409, "No se pudo guardar; compruebe que el RUC no esté registrado")
			return
		}
		id, _ = res.LastInsertId()
	} else {
		res, err := tx.Exec("UPDATE proveedores SET nombre=?,ruc=?,contacto=?,telefono=?,email=?,direccion=?,ciudad=?,notas=?,activo=?,sitio_web=? WHERE id=?", in.Nombre, in.RUC, in.Contacto, in.Telefono, in.Email, in.Direccion, in.Ciudad, in.Notas, in.Activo, in.SitioWeb, id)
		if err != nil {
			Fail(w, 409, "No se pudo guardar; compruebe que el RUC no esté registrado")
			return
		}
		n, _ := res.RowsAffected()
		if n == 0 {
			Fail(w, 404, "Proveedor no encontrado")
			return
		}
	}
	if _, e = tx.Exec("DELETE FROM proveedor_marcas WHERE proveedor_id=?", id); e != nil {
		Fail(w, 500, "No se pudieron guardar las marcas")
		return
	}
	for _, b := range brands {
		if _, e = tx.Exec("INSERT INTO proveedor_marcas(proveedor_id,marca) VALUES(?,?)", id, b); e != nil {
			Fail(w, 500, "No se pudieron guardar las marcas")
			return
		}
	}
	if tx.Commit() != nil {
		Fail(w, 500, "No se pudo guardar el proveedor")
		return
	}
	JSON(w, 200, map[string]any{"id": id, "ok": true})
}
