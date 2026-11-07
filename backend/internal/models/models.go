package models

import (
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
)

// Los importes se guardan en céntimos: 100000000 equivale a S/ 1 000 000.00.
const MaxMoney int64 = 100000000
const MaxQty int64 = 1000000

var decimalPattern = regexp.MustCompile(`^\d{1,7}(\.\d{1,2})?$`)

// Money convierte texto decimal a céntimos sin usar punto flotante.
func Money(s string) (int64, error) {
	if !decimalPattern.MatchString(s) {
		return 0, fmt.Errorf("importe inválido; use hasta dos decimales")
	}
	parts := strings.Split(s, ".")
	whole, _ := strconv.ParseInt(parts[0], 10, 64)
	amount := whole * 100
	if len(parts) == 2 {
		decimal := parts[1]
		if len(decimal) == 1 {
			decimal += "0"
		}
		fraction, _ := strconv.ParseInt(decimal, 10, 64)
		amount += fraction
	}
	if amount > MaxMoney {
		return 0, fmt.Errorf("importe fuera del límite")
	}
	return amount, nil
}

// Opcion conserva la fotografía de cada alternativa ofrecida.
type Opcion struct {
	Presentacion string `json:"presentacion,omitempty"`
	Contenido    int64  `json:"contenido"`
	ProductoID   int64  `json:"producto_id"`
	Nombre       string `json:"nombre"`
	Codigo       string `json:"codigo"`
	Marca        string `json:"marca"`
	Precio       int64  `json:"precio"`
}

// Item representa una línea de propuesta o venta; precio, costo y subtotal están en céntimos.
type Item struct {
	Presentacion string   `json:"presentacion,omitempty"`
	Contenido    int64    `json:"contenido,omitempty"`
	PorRevisar   bool     `json:"por_revisar,omitempty"`
	ProductoID   int64    `json:"producto_id"`
	Cantidad     int64    `json:"cantidad"`
	Nombre       string   `json:"nombre"`
	Codigo       string   `json:"codigo"`
	Precio       int64    `json:"precio"`
	Costo        int64    `json:"costo,omitempty"`
	Subtotal     int64    `json:"subtotal"`
	Solicitado   string   `json:"solicitado"`
	Alternativa  string   `json:"alternativa"`
	Disponible   bool     `json:"disponible"`
	Opciones     []Opcion `json:"opciones,omitempty"`
}

// SaleInput recibe el carrito o la cotización y una clave para reconocer reintentos del mismo cobro.
type SaleInput struct {
	PedidoWebID  *int64 `json:"pedido_web_id,omitempty"`
	Items        []Item `json:"items"`
	Clave        string `json:"clave"`
	Pago         string `json:"pago"`
	Recibido     string `json:"recibido"`
	ClienteID    *int64 `json:"cliente_id"`
	CotizacionID *int64 `json:"cotizacion_id"`
}

type Sale struct {
	Estado           string `json:"estado"`
	Vendedor         string `json:"vendedor"`
	AnulacionMotivo  string `json:"anulacion_motivo"`
	AnulacionFecha   string `json:"anulacion_fecha"`
	AnulacionUsuario string `json:"anulacion_usuario"`
	ID               int64  `json:"id"`
	Fecha            string `json:"fecha"`
	Total            int64  `json:"total"`
	Costo            *int64 `json:"costo,omitempty"`
	Pago             string `json:"pago"`
	Recibido         int64  `json:"recibido"`
	Items            []Item `json:"items"`
	ClienteNombre    string `json:"cliente_nombre"`
	ClienteDocumento string `json:"cliente_documento"`
	ClienteDireccion string `json:"cliente_direccion"`
	ClienteTipo      string `json:"cliente_tipo"`
}

// Fingerprint serializa la entrada para detectar si una clave de venta se reutiliza con otros datos.
func Fingerprint(value any) string {
	body, _ := json.Marshal(value)
	return string(body)
}
