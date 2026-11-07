package handlers

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
	"utilventa/internal/services"
)

// CreateBackup is shared by the administrator and the scheduler. It never overwrites a copy.
func (a *App) CreateBackup() (name string, err error) {
	a.backupMu.Lock()
	defer a.backupMu.Unlock()
	defer func() {
		if err != nil {
			a.DB.Exec("UPDATE configuracion_tienda SET respaldo_error=? WHERE id=1", "No se pudo crear el respaldo; revisa el espacio y los permisos de la carpeta")
		}
	}()
	dir, err := a.backupFolder()
	if err != nil {
		return "", err
	}
	if err = os.MkdirAll(dir, 0700); err != nil {
		return "", err
	}
	file, err := os.CreateTemp(dir, ".creando-*.db")
	if err != nil {
		return "", err
	}
	temp := file.Name()
	if err = file.Close(); err != nil {
		os.Remove(temp)
		return "", err
	}
	defer os.Remove(temp)
	if _, err = a.DB.Exec("VACUUM INTO ?", temp); err != nil {
		return "", err
	}
	name = fmt.Sprintf("respaldo-%s-%d.db", time.Now().UTC().Format("20060102T150405"), time.Now().UnixNano())
	if err = os.Chmod(temp, 0600); err != nil {
		return "", err
	}
	if err = os.Rename(temp, filepath.Join(dir, name)); err != nil {
		return "", err
	}
	_, err = a.DB.Exec("UPDATE configuracion_tienda SET ultimo_respaldo=?,respaldo_error='' WHERE id=1", services.Now())
	return name, err
}

// Maintenance can be run repeatedly: expiry is recorded once and backups follow the configured interval.
func (a *App) Maintenance() error {
	a.maintenanceMu.Lock()
	defer a.maintenanceMu.Unlock()
	if e := services.ExpireWebOrders(a.DB); e != nil {
		return e
	}
	s, e := services.ReadSettings(a.DB)
	if e != nil {
		return e
	}
	if !s.RespaldoAutomatico {
		return nil
	}
	last, e := time.Parse(time.RFC3339, s.UltimoRespaldo)
	if e == nil && time.Since(last) < time.Duration(s.RespaldoHoras)*time.Hour {
		return nil
	}
	_, e = a.CreateBackup()
	return e
}
func (a *App) RunMaintenance(ctx context.Context) {
	tick := time.NewTicker(time.Minute)
	defer tick.Stop()
	for {
		if e := a.Maintenance(); e != nil {
			log.Printf("Mantenimiento de ÚtilVenta: %v", e)
		}
		select {
		case <-ctx.Done():
			return
		case <-tick.C:
		}
	}
}
