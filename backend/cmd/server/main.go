package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"
	_ "time/tzdata"

	"utilventa/internal/handlers"
	"utilventa/internal/repository"
)

// env permite configurar el servidor desde la terminal y usa un valor por defecto si falta la variable.
func env(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

// main abre SQLite, conecta los manejadores HTTP y empieza a escuchar solicitudes locales.
func main() {
	db, err := repository.Open(env("DB_PATH", "data/utilventa.db"))
	if err != nil {
		log.Fatal("No se pudo abrir SQLite: ", err)
	}
	defer db.Close()
	// Las rutas comparten la conexión, el origen permitido y la configuración de cookies.
	app := &handlers.App{
		DB:         db,
		Origin:     env("APP_ORIGIN", "http://localhost:5173"),
		Production: env("APP_ENV", "development") == "production",
	}
	go app.RunMaintenance(context.Background())
	// Los tiempos máximos evitan que conexiones lentas retengan recursos indefinidamente.
	server := &http.Server{
		Addr:              "127.0.0.1:" + env("PORT", "8080"),
		Handler:           app,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("ÚtilVenta: http://%s", server.Addr)
	log.Fatal(server.ListenAndServe())
}
