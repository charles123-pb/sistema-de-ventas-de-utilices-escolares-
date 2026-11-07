package repository

import (
	"database/sql"
	"database/sql/driver"
	"fmt"
	"os"
	"path/filepath"

	"modernc.org/sqlite"
	"utilventa/internal/middleware"
	"utilventa/internal/models"
	"utilventa/migrations"
)

func init() {
	sqlite.MustRegisterDeterministicScalarFunction("school_family", 1, func(_ *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
		return models.SchoolFamily(fmt.Sprint(args[0])), nil
	})
	sqlite.MustRegisterDeterministicScalarFunction("school_pack", 1, func(_ *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
		kind, _ := models.SchoolPackaging(fmt.Sprint(args[0]))
		return kind, nil
	})
	sqlite.MustRegisterDeterministicScalarFunction("school_content", 1, func(_ *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
		_, size := models.SchoolPackaging(fmt.Sprint(args[0]))
		return size, nil
	})
	sqlite.MustRegisterDeterministicScalarFunction("school_search", 5, func(_ *sqlite.FunctionContext, args []driver.Value) (driver.Value, error) {
		if models.SchoolSearch(fmt.Sprint(args[0]), fmt.Sprint(args[1]), fmt.Sprint(args[2]), fmt.Sprint(args[3]), fmt.Sprint(args[4])) {
			return int64(1), nil
		}
		return int64(0), nil
	})
}

// Open aplica las migraciones antes de aceptar operaciones de la tienda.
func Open(path string) (*sql.DB, error) {
	if path != ":memory:" {
		if err := os.MkdirAll(filepath.Dir(path), 0700); err != nil {
			return nil, err
		}
	}
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	// Una conexión mantiene los PRAGMA y serializa las transacciones locales.
	db.SetMaxOpenConns(1)
	if err = initialize(db); err != nil {
		db.Close()
		return nil, err
	}
	if _, err = db.Exec("UPDATE configuracion_tienda SET checkout_secret=? WHERE id=1 AND checkout_secret=''", middleware.Token()); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

// initialize activa las reglas de SQLite y ejecuta solo los archivos SQL aún no registrados.
func initialize(db *sql.DB) error {
	// foreign_keys valida referencias; busy_timeout espera bloqueos; WAL permite lectores durante escrituras.
	for _, statement := range []string{
		"PRAGMA foreign_keys=ON",
		"PRAGMA busy_timeout=5000",
		"PRAGMA journal_mode=WAL",
		"CREATE TABLE IF NOT EXISTS migraciones(version TEXT PRIMARY KEY)",
	} {
		if _, err := db.Exec(statement); err != nil {
			return err
		}
	}
	files, err := migrations.Files.ReadDir(".")
	if err != nil {
		return err
	}
	for _, file := range files {
		if filepath.Ext(file.Name()) != ".sql" {
			continue
		}
		var count int
		if err := db.QueryRow("SELECT COUNT(*) FROM migraciones WHERE version=?", file.Name()).Scan(&count); err != nil {
			return err
		}
		if count != 0 {
			continue
		}
		body, err := migrations.Files.ReadFile(file.Name())
		if err != nil {
			return err
		}
		// La estructura y su registro de versión se confirman juntos; un fallo revierte ambos.
		tx, err := db.Begin()
		if err != nil {
			return err
		}
		if _, err = tx.Exec(string(body)); err == nil {
			_, err = tx.Exec("INSERT INTO migraciones VALUES(?)", file.Name())
		}
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("migración %s: %w", file.Name(), err)
		}
		if err = tx.Commit(); err != nil {
			return err
		}
	}
	return nil
}
