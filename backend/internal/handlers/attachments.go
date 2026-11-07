package handlers

import (
	"bytes"
	"fmt"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"unicode/utf8"
)

const maxSchoolAttachment = 5 * 1024 * 1024

type schoolAttachment struct {
	Nombre string `json:"nombre"`
	Tipo   string `json:"tipo"`
	Datos  []byte `json:"datos"`
}

// validateAttachment comprueba contenido real y tamaño; no admite HTML ni SVG.
func validateAttachment(in *schoolAttachment) bool {
	if in == nil {
		return true
	}
	if len(in.Datos) == 0 || len(in.Datos) > maxSchoolAttachment || strings.TrimSpace(in.Nombre) == "" || len(in.Nombre) > 200 {
		return false
	}
	name := strings.ReplaceAll(in.Nombre, "\\", "/")
	in.Nombre = filepath.Base(name)
	for _, c := range in.Nombre {
		if c < 32 || c == 127 {
			return false
		}
	}
	actual := http.DetectContentType(in.Datos)
	actual = strings.Split(actual, ";")[0]
	switch actual {
	case "image/jpeg", "image/png", "image/webp", "application/pdf":
	case "text/plain":
		prefix := strings.ToLower(string(in.Datos[:min(len(in.Datos), 512)]))
		if !utf8.Valid(in.Datos) || bytes.Contains(in.Datos, []byte{0}) || strings.Contains(prefix, "<svg") || strings.Contains(prefix, "<script") || strings.Contains(prefix, "<html") {
			return false
		}
	default:
		return false
	}
	ext := strings.ToLower(filepath.Ext(in.Nombre))
	allowed := map[string][]string{"image/jpeg": {".jpg", ".jpeg"}, "image/png": {".png"}, "image/webp": {".webp"}, "application/pdf": {".pdf"}, "text/plain": {".txt"}}
	valid := false
	for _, value := range allowed[actual] {
		if ext == value {
			valid = true
		}
	}
	if !valid {
		return false
	}
	in.Tipo = actual
	return true
}

// quoteAttachment solo se invoca tras autenticar al personal o comprobar el enlace privado.
func (a *App) quoteAttachment(w http.ResponseWriter, r *http.Request, id int64) {
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	var name, kind string
	var data []byte
	if a.DB.QueryRow("SELECT nombre,tipo,contenido FROM cotizacion_adjuntos WHERE cotizacion_id=?", id).Scan(&name, &kind, &data) != nil {
		Fail(w, 404, "Archivo no encontrado")
		return
	}
	w.Header().Set("Content-Type", kind)
	w.Header().Set("Content-Length", fmt.Sprint(len(data)))
	w.Header().Set("Content-Disposition", mime.FormatMediaType("attachment", map[string]string{"filename": name}))
	w.Header().Set("Content-Security-Policy", "sandbox; default-src 'none'")
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}
