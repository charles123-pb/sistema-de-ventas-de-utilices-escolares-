package handlers

import (
	"errors"
	"net/http"
	"strings"
)

// Filtering happens before pagination for both order sources.
func orderFilters(r *http.Request, direct bool) (string, []any, error) {
	customer := "c"
	if direct {
		customer = "p"
	}
	search := "%" + strings.TrimSpace(r.URL.Query().Get("q")) + "%"
	where := " WHERE (" + customer + ".nombre LIKE ? OR " + customer + ".telefono LIKE ? OR CAST(p.id AS TEXT) LIKE ?)"
	args := []any{search, search, search}
	switch state := r.URL.Query().Get("estado"); state {
	case "":
	case "pendiente", "preparando", "listo":
		where += " AND p.estado=?"
		args = append(args, state)
	case "finalizados":
		if direct {
			where += " AND p.estado IN ('entregado','cancelado','vencido')"
		} else {
			where += " AND p.estado IN ('entregado','cancelado')"
		}
	default:
		return "", nil, errors.New("Estado de pedido inválido")
	}
	return where, args, nil
}
