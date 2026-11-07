package main

import (
	"bufio"
	"fmt"
	"golang.org/x/crypto/bcrypt"
	"golang.org/x/term"
	"log"
	"os"
	"strings"
	"utilventa/internal/repository"
	"utilventa/internal/services"
)

// main prepara la base: crea el primer administrador, aplica migraciones o carga ejemplos.
func main() {
	path := os.Getenv("DB_PATH")
	if path == "" {
		path = "data/utilventa.db"
	}
	// Open aplica las migraciones también cuando solo se solicita el comando migrate.
	db, e := repository.Open(path)
	if e != nil {
		log.Fatal(e)
	}
	defer db.Close()
	if len(os.Args) > 1 && os.Args[1] == "ejemplos" {
		var uid int64
		if db.QueryRow("SELECT id FROM usuarios WHERE rol='administrador' AND activo=1 ORDER BY id LIMIT 1").Scan(&uid) != nil {
			log.Fatal("Cree primero el administrador")
		}
		report, err := services.SeedSchoolShop(db, uid)
		if err != nil {
			log.Fatal("No se pudieron cargar los ejemplos: ", err)
		}
		if err = saveSchoolLinks(path, report.Links); err != nil {
			log.Fatal("No se pudieron guardar los enlaces: ", err)
		}
		fmt.Printf("Catálogo escolar: %d productos, %d proveedores, %d clientes, %d ventas y %d cotizaciones nuevas.\n", report.Productos, report.Proveedores, report.Clientes, report.Ventas, report.Cotizaciones)
		return
	}
	if len(os.Args) > 1 && os.Args[1] == "demo" {
		var uid int64
		if db.QueryRow("SELECT id FROM usuarios WHERE rol='administrador' AND activo=1 LIMIT 1").Scan(&uid) != nil {
			log.Fatal("Cree primero el administrador")
		}
		report, err := services.SeedDemo(db, uid)
		if err != nil {
			log.Fatal("No se pudieron completar los ejemplos: ", err)
		}
		if err = saveDemoLinks(path, report.Links); err != nil {
			log.Fatal("No se pudieron guardar los enlaces privados de ejemplo: ", err)
		}
		fmt.Printf("Datos DEMO: %d productos, %d clientes, %d listas y %d ventas nuevas.\n", report.Productos, report.Clientes, report.Cotizaciones, report.Ventas)
		fmt.Println("No se borraron datos ni se restableció stock. Enlaces de las listas: carpeta presentacion junto a SQLite (privada).")

		return
	}
	if len(os.Args) > 1 && os.Args[1] == "migrate" {
		fmt.Println("Migraciones aplicadas")
		return
	}
	var count int
	db.QueryRow("SELECT COUNT(*) FROM usuarios WHERE rol='administrador'").Scan(&count)
	if count > 0 {
		log.Fatal("Ya existe administrador; gestione empleados desde el sistema")
	}
	reader := bufio.NewReader(os.Stdin)
	fmt.Print("Nombre: ")
	name, _ := reader.ReadString('\n')
	fmt.Print("Usuario: ")
	user, _ := reader.ReadString('\n')
	fmt.Print("Contraseña (mínimo 10 caracteres): ")
	// La contraseña se lee sin mostrarla en pantalla; SQLite solo recibe su hash bcrypt.
	pw, e := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	if e != nil {
		log.Fatal("Se requiere una terminal interactiva")
	}
	fmt.Print("Repita contraseña: ")
	again, e := term.ReadPassword(int(os.Stdin.Fd()))
	fmt.Println()
	if e != nil || string(pw) != string(again) || len(pw) < 10 || len(pw) > 72 || strings.TrimSpace(name) == "" || strings.TrimSpace(user) == "" {
		log.Fatal("Datos inválidos o contraseñas distintas")
	}
	hash, e := bcrypt.GenerateFromPassword(pw, bcrypt.DefaultCost)
	if e != nil {
		log.Fatal(e)
	}
	_, e = db.Exec("INSERT INTO usuarios(nombre,usuario,password_hash,rol,fecha) VALUES(?,?,?,'administrador',?)", strings.TrimSpace(name), strings.TrimSpace(user), string(hash), services.Now())
	if e != nil {
		log.Fatal("No se pudo crear el administrador")
	}
	fmt.Println("Administrador creado")
}
