package handlers

import (
	"encoding/json"
	"net/http"
	"strings"
	"utilventa/internal/models"
	"utilventa/internal/services"
)

func (a *App) settings(w http.ResponseWriter, r *http.Request, u User, public bool) {
	if public || r.Method == "GET" {
		if r.Method != "GET" {
			unsupported(w)
			return
		}
		if !public && !admin(w, u) {
			return
		}
		s, e := services.ReadSettings(a.DB)
		if e != nil {
			Fail(w, 500, "No se pudo consultar la configuración")
			return
		}
		if public {
			JSON(w, 200, map[string]any{"nombre": s.Nombre, "direccion": s.Direccion, "telefono": s.Telefono, "horario": s.Horario, "logo": s.Logo, "pedido_horas": s.PedidoHoras})
		} else {
			JSON(w, 200, s)
		}
		return
	}
	if !admin(w, u) {
		return
	}
	if r.Method != "PUT" {
		unsupported(w)
		return
	}
	var in struct {
		Nombre             string `json:"nombre"`
		Direccion          string `json:"direccion"`
		Telefono           string `json:"telefono"`
		Horario            string `json:"horario"`
		Logo               string `json:"logo"`
		PedidoHoras        int    `json:"pedido_horas"`
		RespaldoAutomatico bool   `json:"respaldo_automatico"`
		RespaldoHoras      int    `json:"respaldo_horas"`
	}
	if !Decode(w, r, &in) {
		return
	}
	in.Nombre = strings.TrimSpace(in.Nombre)
	in.Direccion = strings.TrimSpace(in.Direccion)
	in.Telefono = strings.TrimSpace(in.Telefono)
	in.Horario = strings.TrimSpace(in.Horario)
	in.Logo = strings.TrimSpace(in.Logo)
	if len(in.Nombre) < 2 || len(in.Nombre) > 150 || len(in.Direccion) > 300 || len(in.Telefono) > 30 || len(in.Horario) > 300 || len(in.Logo) > 1000 || !models.ValidProductImage(in.Logo) || in.PedidoHoras < 1 || in.PedidoHoras > 72 || in.RespaldoHoras < 1 || in.RespaldoHoras > 168 {
		Fail(w, 400, "Revisa los datos, la imagen y los intervalos permitidos")
		return
	}
	tx, e := a.DB.Begin()
	if e != nil {
		Fail(w, 500, "No se pudo guardar la configuración")
		return
	}
	defer tx.Rollback()
	_, e = tx.Exec("UPDATE configuracion_tienda SET nombre=?,direccion=?,telefono=?,horario=?,logo=?,pedido_horas=?,respaldo_automatico=?,respaldo_horas=? WHERE id=1", in.Nombre, in.Direccion, in.Telefono, in.Horario, in.Logo, in.PedidoHoras, in.RespaldoAutomatico, in.RespaldoHoras)
	content, _ := json.Marshal(in)
	if e == nil {
		_, e = tx.Exec("INSERT INTO configuracion_historial(usuario_id,fecha,contenido) VALUES(?,?,?)", u.ID, services.Now(), string(content))
	}
	if e != nil || tx.Commit() != nil {
		Fail(w, 500, "No se pudo guardar la configuración")
		return
	}
	s, e := services.ReadSettings(a.DB)
	if e != nil {
		Fail(w, 500, "No se pudo leer la configuración guardada")
		return
	}
	JSON(w, 200, s)
}
