package services

import (
	"database/sql"
	_ "embed"
	"encoding/json"
	"fmt"
	"time"
	"utilventa/internal/middleware"
	"utilventa/internal/models"
)

//go:embed school_catalog.json
var schoolCatalogJSON []byte

type SchoolProduct struct {
	Codigo      string `json:"codigo"`
	Nombre      string `json:"nombre"`
	Marca       string `json:"marca"`
	Categoria   string `json:"categoria"`
	Descripcion string `json:"descripcion"`
	Imagen      string `json:"imagen"`
	Proveedor   string `json:"proveedor"`
	Costo       int64  `json:"costo"`
	Precio      int64  `json:"precio"`
	Stock       int64  `json:"stock"`
	Min         int64  `json:"stock_minimo"`
}
type SchoolSupplier struct {
	Clave     string   `json:"clave"`
	Nombre    string   `json:"nombre"`
	RUC       string   `json:"ruc"`
	Contacto  string   `json:"contacto"`
	Telefono  string   `json:"telefono"`
	Email     string   `json:"email"`
	Direccion string   `json:"direccion"`
	Ciudad    string   `json:"ciudad"`
	Sitio     string   `json:"sitio_web"`
	Notas     string   `json:"notas"`
	Marcas    []string `json:"marcas"`
}
type SchoolCatalog struct {
	Productos   []SchoolProduct  `json:"productos"`
	Proveedores []SchoolSupplier `json:"proveedores"`
}
type SchoolReport struct {
	Productos, Proveedores, Clientes, Ventas, Cotizaciones int
	Links                                                  []DemoLink
}

// SeedSchoolShop carga referencias reales y operaciones académicas por una orden explícita.
// Los códigos y claves estables permiten repetir la carga sin cambiar trabajo existente.
func SeedSchoolShop(db *sql.DB, uid int64) (SchoolReport, error) {
	report := SchoolReport{Links: []DemoLink{}}
	var catalog SchoolCatalog
	if err := json.Unmarshal(schoolCatalogJSON, &catalog); err != nil {
		return report, err
	}
	var active int
	if err := db.QueryRow("SELECT COUNT(*) FROM usuarios WHERE id=? AND activo=1 AND rol='administrador'", uid).Scan(&active); err != nil || active != 1 {
		return report, fmt.Errorf("se requiere un administrador activo")
	}
	tx, err := db.Begin()
	if err != nil {
		return report, err
	}
	defer tx.Rollback()
	suppliers := map[string]int64{}
	for _, s := range catalog.Proveedores {
		var id int64
		e := tx.QueryRow("SELECT id FROM proveedores WHERE nombre=? ORDER BY id LIMIT 1", s.Nombre).Scan(&id)
		if e == sql.ErrNoRows {
			res, e := tx.Exec("INSERT INTO proveedores(nombre,ruc,contacto,telefono,email,direccion,ciudad,sitio_web,notas,activo) VALUES(?,?,?,?,?,?,?,?,?,1)", s.Nombre, s.RUC, s.Contacto, s.Telefono, s.Email, s.Direccion, s.Ciudad, s.Sitio, s.Notas)
			if e != nil {
				return report, e
			}
			id, _ = res.LastInsertId()
			report.Proveedores++
			for _, b := range s.Marcas {
				if _, e = tx.Exec("INSERT INTO proveedor_marcas(proveedor_id,marca) VALUES(?,?)", id, b); e != nil {
					return report, e
				}
			}
		} else if e != nil {
			return report, e
		}
		suppliers[s.Clave] = id
	}
	productIDs := map[string]int64{}
	incoming := map[string]bool{}
	for _, p := range catalog.Productos {
		var category int64
		if err = tx.QueryRow("SELECT id FROM categorias WHERE nombre=?", p.Categoria).Scan(&category); err != nil {
			return report, err
		}
		presentation, content := models.SchoolPackaging(p.Nombre)
		res, e := tx.Exec("INSERT OR IGNORE INTO productos(codigo,nombre,marca,descripcion,categoria_id,imagen,costo,precio,stock,stock_minimo,activo,fecha,proveedor_id,familia,presentacion,contenido) VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?,?,?)", p.Codigo, p.Nombre, p.Marca, p.Descripcion, category, p.Imagen, p.Costo, p.Precio, p.Stock, p.Min, Now(), suppliers[p.Proveedor], models.SchoolFamily(p.Nombre), presentation, content)
		if e != nil {
			return report, e
		}
		n, _ := res.RowsAffected()
		var id int64
		if err = tx.QueryRow("SELECT id FROM productos WHERE codigo=?", p.Codigo).Scan(&id); err != nil {
			return report, err
		}
		productIDs[p.Codigo] = id
		if n > 0 {
			report.Productos++
			if p.Stock > 0 {
				if _, err = tx.Exec("INSERT INTO movimientos(producto_id,usuario_id,fecha,tipo,cantidad,motivo,costo,proveedor_id,comprobante) VALUES(?,?,?,'inicial',?,'Inventario de apertura',?,?,'')", id, uid, Now(), p.Stock, p.Costo, suppliers[p.Proveedor]); err != nil {
					return report, err
				}
			}
			if p.Stock > 0 && !incoming[p.Proveedor] {
				incoming[p.Proveedor] = true
				if _, err = tx.Exec("UPDATE productos SET stock=stock+12 WHERE id=?", id); err != nil {
					return report, err
				}
				if _, err = tx.Exec("INSERT INTO movimientos(producto_id,usuario_id,fecha,tipo,cantidad,motivo,costo,proveedor_id,comprobante) VALUES(?,?,?,'entrada',12,'Reposición de mercadería',?,?,?)", id, uid, Now(), p.Costo, suppliers[p.Proveedor], fmt.Sprintf("ING-%03d", len(incoming))); err != nil {
					return report, err
				}
			}
		}
	}
	clients := []int64{}
	for i, name := range []string{"María Quispe", "José Huamán", "Rosa Flores", "Ana Gutiérrez", "Luis Rojas", "Carmen Medina", "Oficina Los Portales", "Taller Creativo Huamanga"} {
		phone := fmt.Sprintf("9000001%02d", i+1)
		var id int64
		e := tx.QueryRow("SELECT id FROM clientes WHERE nombre=? AND telefono=? ORDER BY id LIMIT 1", name, phone).Scan(&id)
		if e == sql.ErrNoRows {
			res, e := tx.Exec("INSERT INTO clientes(nombre,telefono,documento,direccion) VALUES(?,?,'','Huamanga, Ayacucho')", name, phone)
			if e != nil {
				return report, e
			}
			id, _ = res.LastInsertId()
			report.Clientes++
		} else if e != nil {
			return report, e
		}
		clients = append(clients, id)
	}
	// Propuestas de ejemplo conservan los nombres, marcas y precios de las referencias cargadas.
	quoteStates := []string{"solicitada", "en preparación", "enviada", "aceptada", "aceptada", "rechazada"}
	for i, state := range quoteStates {
		marker := fmt.Sprintf("Lista escolar %02d", i+1)
		var count int
		if err = tx.QueryRow("SELECT COUNT(*) FROM cotizaciones WHERE observaciones=? AND cliente_id=?", marker, clients[i]).Scan(&count); err != nil {
			return report, err
		}
		if count > 0 {
			continue
		}
		name := []string{"María Quispe", "José Huamán", "Rosa Flores", "Ana Gutiérrez", "Luis Rojas", "Carmen Medina"}[i]
		token := middleware.Token()
		expires := time.Now().UTC().AddDate(0, 0, 10).Format(time.RFC3339)
		res, e := tx.Exec("INSERT INTO cotizaciones(token_hash,cliente_id,nombre,telefono,lista,observaciones,presupuesto,estado,revision,vigencia,fecha) VALUES(?,?,?,?,?,?,15000,?,1,?,?)", middleware.Hash(token), clients[i], name, fmt.Sprintf("9000001%02d", i+1), "3 cuadernos A4\n2 lapiceros Pilot\n1 caja de colores\n1 goma en barra", marker, state, expires, Now())
		if e != nil {
			return report, e
		}
		id, _ := res.LastInsertId()
		report.Cotizaciones++
		report.Links = append(report.Links, DemoLink{ID: id, Titulo: marker, Enlace: "/seguimiento/" + token})
		if state != "solicitada" {
			items := []models.Item{}
			for j, code := range []string{"STD-PR14105", "PIL-L111611", "FAB-L601824"} {
				var item models.Item
				var brand string
				if err = tx.QueryRow("SELECT id,nombre,codigo,precio,marca FROM productos WHERE codigo=?", code).Scan(&item.ProductoID, &item.Nombre, &item.Codigo, &item.Precio, &brand); err != nil {
					return report, err
				}
				item.Cantidad = []int64{3, 2, 1}[j]
				item.Subtotal = item.Precio * item.Cantidad
				item.Disponible = true
				item.Solicitado = item.Nombre
				item.Opciones = []models.Opcion{{ProductoID: item.ProductoID, Nombre: item.Nombre, Codigo: item.Codigo, Marca: brand, Precio: item.Precio}}
				items = append(items, item)
			}
			content, e := json.Marshal(items)
			if e != nil {
				return report, e
			}
			if _, err = tx.Exec("INSERT INTO propuestas(cotizacion_id,revision,contenido,fecha) VALUES(?,1,?,?)", id, string(content), Now()); err != nil {
				return report, err
			}
		}
		if state == "aceptada" {
			orderState := "preparando"
			if i == 4 {
				orderState = "listo"
			}
			if _, err = tx.Exec("INSERT INTO pedidos(cotizacion_id,estado,fecha) VALUES(?,?,?)", id, orderState, Now()); err != nil {
				return report, err
			}
		}
	}
	if err = tx.Commit(); err != nil {
		return report, err
	}
	loc, err := time.LoadLocation("America/Lima")
	if err != nil {
		return report, err
	}
	now := time.Now().In(loc)
	history := [][]string{
		{"STD-PR14105", "PIL-L111611"}, {"ART-PR02269", "LAY-PR12076"}, {"VIN-PR04239", "ART-PR05121"},
		{"STD-548001", "ART-PR02093"}, {"PIL-L111604", "FAB-L300712"}, {"VIN-PR10869", "LAY-PR08295"},
		{"STD-PR14093", "VIN-528898"}, {"PIL-C707061", "ART-PR452593"}, {"FAB-U416098", "UHU-U372085"},
		{"LAY-579878", "PIL-L111613"}, {"VIN-PR04237", "ART-PR08003"}, {"CHA-PR14153", "FAB-PR02896"},
		{"STD-PR453756", "ART-PR13900"}, {"PIL-PR03413", "FAB-519089"},
	}
	for i, codes := range history {
		key := fmt.Sprintf("escolar-huamanga-historial-%02d", i+1)
		var count int
		if err = db.QueryRow("SELECT COUNT(*) FROM ventas WHERE clave=?", key).Scan(&count); err != nil {
			return report, err
		}
		if count > 0 {
			continue
		}
		in := models.SaleInput{Clave: key, Pago: []string{"efectivo", "yape", "plin", "transferencia"}[i%4], Recibido: "200.00", ClienteID: &clients[i%len(clients)]}
		for _, code := range codes {
			in.Items = append(in.Items, models.Item{ProductoID: productIDs[code], Cantidad: 1})
		}
		id, e := Sell(db, uid, in)
		if e != nil {
			return report, e
		}
		date := now.AddDate(0, 0, -(6 - i/2)).Add(-time.Duration(i+1) * time.Minute).UTC().Format(time.RFC3339)
		tx, e := db.Begin()
		if e != nil {
			return report, e
		}
		if _, e = tx.Exec("UPDATE ventas SET fecha=? WHERE id=?", date, id); e == nil {
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
