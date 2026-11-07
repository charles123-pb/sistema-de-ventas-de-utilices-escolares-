package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"
	"utilventa/internal/middleware"
	"utilventa/internal/models"
)

// DemoProduct describe un ejemplo de catálogo que puede cargarse sin afectar datos reales.
type DemoProduct struct {
	Codigo, Nombre, Categoria, Marca, Descripcion string
	Costo, Precio, Stock                          int64
	Activo                                        bool
}

var demoProducts = []DemoProduct{
	{"DEMO-01", "[DEMO] Cuaderno cuadriculado", "Cuadernos", "Línea escolar DEMO", "96 hojas, tamaño A4. Para matemáticas y tareas escolares.", 350, 600, 36, true},
	{"DEMO-02", "[DEMO] Lápiz escolar", "Escritura", "Línea escolar DEMO", "Grafito HB, cuerpo hexagonal y borrador incorporado.", 50, 100, 80, true},
	{"DEMO-03", "[DEMO] Colores 12 unidades", "Arte", "Línea escolar DEMO", "Estuche de doce colores para dibujos y trabajos escolares.", 700, 1100, 24, true},
	{"DEMO-04", "[DEMO] Cuaderno rayado A4", "Cuadernos", "Línea escolar DEMO", "96 hojas rayadas. Ideal para comunicación y apuntes.", 360, 650, 40, true},
	{"DEMO-05", "[DEMO] Cuaderno triple renglón", "Cuadernos", "Línea escolar DEMO", "Formato escolar para practicar escritura en primaria.", 300, 550, 24, true},
	{"DEMO-06", "[DEMO] Cuaderno de dibujo A4", "Cuadernos", "Línea escolar DEMO", "Hojas blancas para arte, bocetos y creatividad.", 400, 700, 25, true},
	{"DEMO-07", "[DEMO] Cuaderno cuadriculado A5", "Cuadernos", "Línea escolar DEMO", "Formato compacto de 80 hojas para notas y ejercicios.", 220, 400, 32, true},
	{"DEMO-08", "[DEMO] Lapicero azul", "Escritura", "Línea escolar DEMO", "Tinta azul, punta media y escritura suave.", 65, 150, 80, true},
	{"DEMO-09", "[DEMO] Lapicero negro", "Escritura", "Línea escolar DEMO", "Tinta negra para oficina, clases y uso diario.", 65, 150, 70, true},
	{"DEMO-10", "[DEMO] Lapicero rojo", "Escritura", "Línea escolar DEMO", "Tinta roja para correcciones y anotaciones.", 65, 150, 45, true},
	{"DEMO-11", "[DEMO] Portaminas 0.5 mm", "Escritura", "Línea escolar DEMO", "Portaminas ligero con agarre cómodo. Unidad de venta: pieza.", 180, 350, 20, true},
	{"DEMO-12", "[DEMO] Resaltador amarillo", "Escritura", "Línea escolar DEMO", "Punta biselada para destacar textos y organizar apuntes.", 130, 250, 30, true},
	{"DEMO-13", "[DEMO] Plumones 12 unidades", "Arte", "Línea escolar DEMO", "Colores variados, punta fina. Estuche escolar de 12 piezas.", 650, 1050, 24, true},
	{"DEMO-14", "[DEMO] Borrador blanco", "Escritura", "Línea escolar DEMO", "Borrador suave para lápiz de grafito. Una pieza.", 45, 100, 55, true},
	{"DEMO-15", "[DEMO] Tajador con depósito", "Escritura", "Línea escolar DEMO", "Tajador escolar de una entrada con depósito.", 80, 180, 35, true},
	{"DEMO-16", "[DEMO] Regla transparente 30 cm", "Papelería", "Línea escolar DEMO", "Escala de treinta centímetros para trazos escolares.", 70, 150, 35, true},
	{"DEMO-17", "[DEMO] Tijera escolar punta roma", "Papelería", "Línea escolar DEMO", "Punta redondeada y mango cómodo para trabajos manuales.", 200, 380, 24, true},
	{"DEMO-18", "[DEMO] Goma blanca 90 g", "Papelería", "Línea escolar DEMO", "Adhesivo escolar para papel y cartulina.", 180, 350, 25, true},
	{"DEMO-19", "[DEMO] Pegamento en barra 21 g", "Papelería", "Línea escolar DEMO", "Aplicación limpia para cuadernos, papel y manualidades.", 170, 300, 30, true},
	{"DEMO-20", "[DEMO] Papel bond A4 500 hojas", "Papelería", "Línea escolar DEMO", "Resma de 500 hojas, 75 g. Una resma por unidad.", 1200, 1800, 18, true},
	{"DEMO-21", "[DEMO] Cartulina de color", "Papelería", "Línea escolar DEMO", "Pliego de cartulina para maquetas y trabajos escolares.", 65, 120, 50, true},
	{"DEMO-22", "[DEMO] Papel crepé de color", "Papelería", "Línea escolar DEMO", "Pliego para decoraciones y actividades creativas.", 80, 150, 30, true},
	{"DEMO-23", "[DEMO] Papel lustre surtido", "Papelería", "Línea escolar DEMO", "Pliego de color brillante para recortar y decorar.", 55, 100, 40, true},
	{"DEMO-24", "[DEMO] Folder manila A4", "Oficina", "Línea práctica DEMO", "Carpeta para organizar tareas y documentos. Stock de ejemplo bajo.", 50, 100, 4, true},
	{"DEMO-25", "[DEMO] Mica transparente A4", "Oficina", "Línea práctica DEMO", "Protector transparente de documentos. Una pieza.", 30, 70, 60, true},
	{"DEMO-26", "[DEMO] Témperas 6 colores", "Arte", "Línea escolar DEMO", "Set de seis frascos para pintar y mezclar colores.", 550, 900, 18, true},
	{"DEMO-27", "[DEMO] Acuarelas 12 colores", "Arte", "Línea escolar DEMO", "Paleta escolar de doce colores con pincel.", 500, 850, 16, true},
	{"DEMO-28", "[DEMO] Pinceles escolares 3 piezas", "Arte", "Línea escolar DEMO", "Set de tres tamaños para témpera y acuarela.", 250, 450, 20, true},
	{"DEMO-29", "[DEMO] Plastilina 12 colores", "Arte", "Línea escolar DEMO", "Masa de modelado para actividades de inicial y primaria.", 300, 500, 24, true},
	{"DEMO-30", "[DEMO] Sketchbook A4", "Arte", "Línea escolar DEMO", "Cuaderno de bocetos de papel grueso. Ejemplo sin existencias.", 850, 1400, 0, true},
	{"DEMO-31", "[DEMO] Grapadora de escritorio", "Oficina", "Línea práctica DEMO", "Grapadora compacta para oficina y estudio.", 650, 1100, 14, true},
	{"DEMO-32", "[DEMO] Grapas 26/6 caja", "Oficina", "Línea práctica DEMO", "Caja de grapas estándar. Una caja por unidad.", 200, 350, 30, true},
	{"DEMO-33", "[DEMO] Archivador lomo ancho", "Oficina", "Línea práctica DEMO", "Archivador A4 para documentos y expedientes.", 550, 900, 18, true},
	{"DEMO-34", "[DEMO] Calculadora básica", "Oficina", "Línea práctica DEMO", "Doce dígitos y funciones básicas. Modelo de referencia.", 1000, 1650, 12, true},
	{"DEMO-35", "[DEMO] Cinta adhesiva transparente", "Oficina", "Línea práctica DEMO", "Rollo de cinta para uso diario. Stock de ejemplo bajo.", 140, 250, 3, true},
	{"DEMO-36", "[DEMO] Clips caja de 100", "Oficina", "Línea práctica DEMO", "Caja de cien clips para clasificar documentos.", 150, 280, 25, true},
	{"DEMO-37", "[DEMO] Cartuchera escolar", "Otras", "Línea práctica DEMO", "Estuche con cierre para lápices y accesorios.", 650, 1100, 16, true},
	{"DEMO-38", "[DEMO] Mochila escolar", "Otras", "Línea práctica DEMO", "Mochila ligera con compartimentos. Diseño referencial.", 2200, 3500, 5, true},
	{"DEMO-39", "[DEMO] Pizarra acrílica A4", "Otras", "Línea práctica DEMO", "Pizarra individual para practicar en clase. Ejemplo agotado.", 450, 750, 0, true},
	{"DEMO-40", "[DEMO] Repuesto de agenda antiguo", "Otras", "Línea práctica DEMO", "Producto desactivado de ejemplo; conserva su historial.", 250, 450, 6, false}}

type DemoLink struct {
	ID     int64  `json:"id"`
	Titulo string `json:"titulo"`
	Enlace string `json:"enlace"`
}
type demoQuote struct {
	Key, Title, State, Order string
	Client                   int
	Codes                    []string
	Quantities               []int64
	List                     string
	Revision                 int
	Convert                  bool
}

var demoQuotes = []demoQuote{
	{Key: "ESC-01", Title: "Inicial de 4 años", State: "solicitada", Client: 0, List: "2 cuadernos de dibujo A4\n1 caja de colores de 12\n1 plastilina de 12 colores\n1 goma blanca\n1 tijera punta roma\n3 pliegos de papel crepé"},
	{Key: "ESC-02", Title: "1.º de primaria", State: "solicitada", Client: 1, List: "3 cuadernos triple renglón\n2 cuadernos cuadriculados\n4 lápices HB\n2 borradores\n1 tajador\n1 regla de 30 cm\n1 caja de colores"},
	{Key: "ESC-03", Title: "3.º de primaria", State: "en preparación", Client: 2, Codes: []string{"DEMO-01", "DEMO-04", "DEMO-02", "DEMO-03"}, Quantities: []int64{3, 2, 4, 1}, List: "3 cuadernos cuadriculados\n2 cuadernos rayados\n4 lápices\n1 caja de colores\n1 juego de escuadras (por confirmar)"},
	{Key: "ESC-04", Title: "1.º de secundaria", State: "en preparación", Client: 3, Codes: []string{"DEMO-01", "DEMO-04", "DEMO-08", "DEMO-12"}, Quantities: []int64{4, 3, 3, 2}, List: "4 cuadernos cuadriculados\n3 cuadernos rayados\n3 lapiceros azules\n2 resaltadores\n1 compás metálico no disponible"},
	{Key: "ESC-05", Title: "5.º de primaria", State: "enviada", Client: 4, Codes: []string{"DEMO-01", "DEMO-04", "DEMO-03", "DEMO-16", "DEMO-18"}, Quantities: []int64{3, 2, 1, 1, 1}, List: "3 cuadernos cuadriculados\n2 cuadernos rayados\n1 caja de colores\n1 regla de 30 cm\n1 goma blanca"},
	{Key: "ESC-06", Title: "Taller de arte", State: "enviada", Client: 5, Codes: []string{"DEMO-06", "DEMO-26", "DEMO-28", "DEMO-29"}, Quantities: []int64{1, 1, 1, 2}, List: "1 cuaderno de dibujo\n1 set de témperas\n1 juego de pinceles\n2 cajas de plastilina\nSketchbook: se ofrece cuaderno de dibujo como alternativa"},
	{Key: "ESC-07", Title: "Útiles para oficina", State: "aceptada", Order: "listo", Client: 6, Codes: []string{"DEMO-20", "DEMO-08", "DEMO-33", "DEMO-36"}, Quantities: []int64{1, 6, 2, 1}, List: "1 resma de papel A4\n6 lapiceros azules\n2 archivadores\n1 caja de clips"},
	{Key: "ESC-08", Title: "2.º de secundaria", State: "aceptada", Order: "preparando", Client: 7, Codes: []string{"DEMO-01", "DEMO-04", "DEMO-11", "DEMO-34"}, Quantities: []int64{3, 3, 1, 1}, List: "3 cuadernos cuadriculados\n3 cuadernos rayados\n1 portaminas\n1 calculadora básica"},
	{Key: "ESC-09", Title: "Regreso a clases", State: "aceptada", Order: "pendiente", Client: 0, Codes: []string{"DEMO-07", "DEMO-02", "DEMO-14", "DEMO-37"}, Quantities: []int64{2, 3, 2, 1}, List: "2 cuadernos A5\n3 lápices\n2 borradores\n1 cartuchera"},
	{Key: "ESC-10", Title: "Propuesta vencida", State: "enviada", Client: 1, Codes: []string{"DEMO-05", "DEMO-19"}, Quantities: []int64{3, 1}, List: "3 cuadernos triple renglón\n1 pegamento en barra. Ejemplo de vigencia vencida."},
	{Key: "ESC-11", Title: "Propuesta rechazada", State: "rechazada", Client: 2, Codes: []string{"DEMO-38", "DEMO-37"}, Quantities: []int64{1, 1}, List: "1 mochila\n1 cartuchera. Ejemplo de propuesta rechazada por presupuesto."},
	{Key: "ESC-12", Title: "Lista completada", State: "aceptada", Order: "pendiente", Client: 3, Codes: []string{"DEMO-04", "DEMO-08", "DEMO-14"}, Quantities: []int64{2, 2, 1}, List: "2 cuadernos rayados\n2 lapiceros azules\n1 borrador", Convert: true},
	{Key: "ESC-13", Title: "Revisión de lista escolar", State: "enviada", Order: "cancelado", Client: 4, Codes: []string{"DEMO-01", "DEMO-03", "DEMO-18"}, Quantities: []int64{2, 1, 1}, List: "2 cuadernos cuadriculados\n1 caja de colores\n1 goma. Revisión 2: se anuló la aceptación de la primera propuesta.", Revision: 2},
}

// DemoReport resume cuántos registros demo fueron creados por la operación.
type DemoReport struct {
	Productos, Clientes, Cotizaciones, Ventas int
	Links                                     []DemoLink
}

// SeedDemo agrega datos ficticios de forma repetible y conserva las ediciones del usuario.
func SeedDemo(db *sql.DB, uid int64) (DemoReport, error) {
	report := DemoReport{Links: []DemoLink{}}
	var exists int
	if err := db.QueryRow("SELECT COUNT(*) FROM usuarios WHERE id=? AND rol='administrador' AND activo=1", uid).Scan(&exists); err != nil || exists != 1 {
		return report, fmt.Errorf("se necesita un administrador activo")
	}
	tx, err := db.Begin()
	if err != nil {
		return report, err
	}
	defer tx.Rollback()
	for _, p := range demoProducts {
		var categoryID int64
		if err = tx.QueryRow("SELECT id FROM categorias WHERE nombre=?", p.Categoria).Scan(&categoryID); err != nil {
			return report, err
		}
		result, e := tx.Exec("INSERT OR IGNORE INTO productos(codigo,nombre,marca,descripcion,categoria_id,costo,precio,stock,stock_minimo,activo,fecha) VALUES(?,?,?,?,?,?,?,?,5,?,?)", p.Codigo, p.Nombre, p.Marca, p.Descripcion, categoryID, p.Costo, p.Precio, p.Stock, p.Activo, Now())
		if e != nil {
			return report, e
		}
		n, _ := result.RowsAffected()
		if n == 1 {
			report.Productos++
			id, _ := result.LastInsertId()
			if p.Stock > 0 {
				if _, err = tx.Exec("INSERT INTO movimientos(producto_id,usuario_id,fecha,tipo,cantidad,motivo,costo) VALUES(?,?,?,'inicial',?,'[DEMO] Stock inicial ficticio',?)", id, uid, Now(), p.Stock, p.Costo); err != nil {
					return report, err
				}
			}
		} else {
			// Solo completa metadatos vacíos del antiguo conjunto de tres ejemplos.
			// Precio, costo, stock, nombre y estado que haya editado el usuario se conservan.
			if _, err = tx.Exec("UPDATE productos SET marca=?,descripcion=?,categoria_id=? WHERE codigo=? AND marca='' AND descripcion=''", p.Marca, p.Descripcion, categoryID, p.Codigo); err != nil {
				return report, err
			}
		}
	}
	clients := []int64{}
	for i, name := range []string{"Familia Quispe", "Familia Huamán", "Familia Flores", "Familia Medina", "Familia Rojas", "Familia López", "Oficina de práctica", "Familia García"} {
		document := fmt.Sprintf("DEMO-CLI-%02d", i+1)
		var id int64
		e := tx.QueryRow("SELECT id FROM clientes WHERE documento=? ORDER BY id LIMIT 1", document).Scan(&id)
		if e == sql.ErrNoRows {
			r, e := tx.Exec("INSERT INTO clientes(nombre,telefono,documento,direccion) VALUES(?,?,?,?)", "[DEMO] "+name, fmt.Sprintf("9000001%02d", i+1), document, "Dirección ficticia · Huamanga, Ayacucho")
			if e != nil {
				return report, e
			}
			id, _ = r.LastInsertId()
			report.Clientes++
		} else if e != nil {
			return report, e
		}
		clients = append(clients, id)
	}
	type conversion struct {
		ID  int64
		Key string
	}
	conversions := []conversion{}
	for _, q := range demoQuotes {
		marker := "[DEMO:" + q.Key + "]"
		var id int64
		e := tx.QueryRow("SELECT id FROM cotizaciones WHERE observaciones LIKE ? ORDER BY id LIMIT 1", marker+"%").Scan(&id)
		if e == nil {
			if q.Convert {
				conversions = append(conversions, conversion{id, q.Key})
			}
			continue
		}
		if e != sql.ErrNoRows {
			return report, e
		}
		rev := q.Revision
		if rev == 0 {
			rev = 1
		}
		expiry := time.Now().UTC().AddDate(0, 0, 10).Format(time.RFC3339)
		if q.Key == "ESC-10" {
			expiry = time.Now().UTC().AddDate(0, 0, -2).Format(time.RFC3339)
		}
		token := middleware.Token()
		var name, phone string
		if err = tx.QueryRow("SELECT nombre,telefono FROM clientes WHERE id=?", clients[q.Client]).Scan(&name, &phone); err != nil {
			return report, err
		}
		result, e := tx.Exec("INSERT INTO cotizaciones(token_hash,cliente_id,nombre,telefono,lista,observaciones,presupuesto,estado,revision,vigencia,fecha) VALUES(?,?,?,?,?,?,?,?,?,?,?)", middleware.Hash(token), clients[q.Client], name, phone, q.List, marker+" "+q.Title+". Datos ficticios para demostración; disponibilidad por confirmar.", 12000, q.State, rev, expiry, Now())
		if e != nil {
			return report, e
		}
		id, _ = result.LastInsertId()
		report.Cotizaciones++
		report.Links = append(report.Links, DemoLink{id, "[DEMO] " + q.Title, "/seguimiento/" + token})
		if len(q.Codes) > 0 {
			items := []models.Item{}
			for i, code := range q.Codes {
				var item models.Item
				var brand string
				if err = tx.QueryRow("SELECT id,nombre,codigo,precio,marca FROM productos WHERE codigo=?", code).Scan(&item.ProductoID, &item.Nombre, &item.Codigo, &item.Precio, &brand); err != nil {
					return report, err
				}
				item.Cantidad = q.Quantities[i]
				item.Subtotal = item.Precio * item.Cantidad
				item.Disponible = true
				item.Solicitado = item.Nombre
				item.Opciones = []models.Opcion{{ProductoID: item.ProductoID, Nombre: item.Nombre, Codigo: item.Codigo, Marca: brand, Precio: item.Precio}}
				if code == "DEMO-01" || code == "DEMO-06" {
					alternativeCode := "DEMO-07"
					if code == "DEMO-06" {
						alternativeCode = "DEMO-30"
					}
					var option models.Opcion
					if err = tx.QueryRow("SELECT id,nombre,codigo,marca,precio FROM productos WHERE codigo=?", alternativeCode).Scan(&option.ProductoID, &option.Nombre, &option.Codigo, &option.Marca, &option.Precio); err != nil {
						return report, err
					}
					item.Opciones = append(item.Opciones, option)
					item.Alternativa = "Revisar tamaño y marca antes de elegir; la opción elegida integra el total."
				}
				items = append(items, item)
			}
			if q.Key == "ESC-04" {
				items = append(items, models.Item{Cantidad: 1, Nombre: "Compás metálico", Solicitado: "Compás metálico", Alternativa: "No disponible; consultar próxima llegada.", Disponible: false})
			}
			content, e := json.Marshal(items)
			if e != nil {
				return report, e
			}
			for revision := 1; revision <= rev; revision++ {
				if _, err = tx.Exec("INSERT INTO propuestas(cotizacion_id,revision,contenido,fecha) VALUES(?,?,?,?)", id, revision, string(content), Now()); err != nil {
					return report, err
				}
			}
		}
		if q.Order != "" {
			if _, err = tx.Exec("INSERT INTO pedidos(cotizacion_id,estado,fecha) VALUES(?,?,?)", id, q.Order, Now()); err != nil {
				return report, err
			}
		}
		if q.Convert {
			conversions = append(conversions, conversion{id, q.Key})
		}
	}
	if err = tx.Commit(); err != nil {
		return report, err
	}
	// La venta usa la misma transacción y validaciones que la caja real.
	for _, q := range conversions {
		key := "demo-v2-conversion-" + q.Key
		if alreadyDemoSale(db, key) {
			continue
		}
		input := models.SaleInput{CotizacionID: &q.ID, Clave: key, Pago: "efectivo", Recibido: "500.00"}
		if _, err = Sell(db, uid, input); err != nil {
			return report, err
		}
		if _, err = db.Exec("UPDATE pedidos SET estado='entregado' WHERE cotizacion_id=? AND venta_id IS NOT NULL", q.ID); err != nil {
			return report, err
		}
		report.Ventas++
	}
	history := []struct {
		Days  int
		Codes []string
		Qty   []int64
	}{
		{6, []string{"DEMO-04", "DEMO-08"}, []int64{2, 3}},
		{5, []string{"DEMO-20", "DEMO-24"}, []int64{1, 2}},
		{5, []string{"DEMO-03", "DEMO-14"}, []int64{1, 2}},
		{4, []string{"DEMO-06", "DEMO-13"}, []int64{2, 1}},
		{4, []string{"DEMO-31", "DEMO-32"}, []int64{1, 1}},
		{3, []string{"DEMO-26", "DEMO-28"}, []int64{2, 1}},
		{3, []string{"DEMO-08", "DEMO-09", "DEMO-16"}, []int64{5, 4, 1}},
		{2, []string{"DEMO-01", "DEMO-02", "DEMO-03"}, []int64{3, 6, 1}},
		{2, []string{"DEMO-33", "DEMO-20"}, []int64{2, 1}},
		{1, []string{"DEMO-05", "DEMO-18", "DEMO-29"}, []int64{2, 1, 1}},
		{1, []string{"DEMO-34", "DEMO-35"}, []int64{1, 1}},
		{0, []string{"DEMO-07", "DEMO-19", "DEMO-15"}, []int64{3, 2, 2}},
		{0, []string{"DEMO-04", "DEMO-08", "DEMO-10"}, []int64{2, 4, 2}},
	}
	loc, e := time.LoadLocation("America/Lima")
	if e != nil {
		return report, e
	}
	now := time.Now().In(loc)
	for i, sale := range history {
		key := fmt.Sprintf("demo-v2-historial-%02d", i+1)
		if alreadyDemoSale(db, key) {
			continue
		}
		input := models.SaleInput{Clave: key, Pago: []string{"efectivo", "yape", "plin", "transferencia"}[i%4], Recibido: "500.00", ClienteID: &clients[i%len(clients)]}
		for j, code := range sale.Codes {
			var id int64
			if err = db.QueryRow("SELECT id FROM productos WHERE codigo=?", code).Scan(&id); err != nil {
				return report, err
			}
			input.Items = append(input.Items, models.Item{ProductoID: id, Cantidad: sale.Qty[j]})
		}
		id, e := Sell(db, uid, input)
		if e != nil {
			return report, e
		}
		day := time.Date(now.Year(), now.Month(), now.Day(), 10+i%6, 15, 0, 0, loc).AddDate(0, 0, -sale.Days)
		if day.After(now) {
			day = now.Add(-time.Duration(i+1) * time.Minute)
		}
		date := day.UTC().Format(time.RFC3339)
		// Solo se fecha el ejemplo recién creado; los reintentos no mueven su historia.
		tx, e := db.Begin()
		if e != nil {
			return report, e
		}
		if _, e = tx.Exec("UPDATE ventas SET fecha=? WHERE id=? AND clave=?", date, id, key); e == nil {
			_, e = tx.Exec("UPDATE movimientos SET fecha=? WHERE venta_id=?", date, id)
		}
		if e != nil {
			tx.Rollback()
			return report, e
		}
		if e = tx.Commit(); e != nil {
			return report, e
		}
		report.Ventas++
	}
	return report, nil
}
// alreadyDemoSale identifica ventas de ejemplo ya cargadas para no repetir cobros ni salidas de stock.
func alreadyDemoSale(db *sql.DB, key string) bool {
	var n int
	return db.QueryRow("SELECT COUNT(*) FROM ventas WHERE clave=?", key).Scan(&n) == nil && n > 0
}
