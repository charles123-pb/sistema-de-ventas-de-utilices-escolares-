package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"
)

var backupName = regexp.MustCompile(`^respaldo-[0-9]{8}T[0-9]{6}-[0-9]+\.db$`)

func (a *App) backupFolder() (string, error) {
	if a.BackupDir != "" {
		return a.BackupDir, nil
	}
	rows, e := a.DB.Query("PRAGMA database_list")
	if e != nil {
		return "", e
	}
	defer rows.Close()
	for rows.Next() {
		var seq int
		var name, path string
		if e = rows.Scan(&seq, &name, &path); e != nil {
			return "", e
		}
		if name == "main" && path != "" {
			return filepath.Join(filepath.Dir(path), "respaldos"), nil
		}
	}
	return "", fmt.Errorf("respaldo no disponible para esta base")
}
func (a *App) backups(w http.ResponseWriter, r *http.Request, u User) {
	if !admin(w, u) {
		return
	}
	dir, e := a.backupFolder()
	if e != nil {
		Fail(w, 500, "No se pudo localizar la carpeta de respaldos")
		return
	}
	if r.Method == "GET" && r.URL.Path != "/api/respaldos" {
		name := strings.TrimPrefix(r.URL.Path, "/api/respaldos/")
		if !backupName.MatchString(name) {
			Fail(w, 404, "Respaldo no encontrado")
			return
		}
		path := filepath.Join(dir, name)
		info, e := os.Lstat(path)
		if e != nil || !info.Mode().IsRegular() {
			Fail(w, 404, "Respaldo no encontrado")
			return
		}
		w.Header().Set("Content-Type", "application/octet-stream")
		w.Header().Set("Content-Disposition", `attachment; filename="`+name+`"`)
		w.Header().Set("Cache-Control", "no-store")
		http.ServeFile(w, r, path)
		return
	}
	if r.URL.Path != "/api/respaldos" {
		Fail(w, 404, "Ruta no encontrada")
		return
	}
	if r.Method == "POST" {
		var in struct{}
		if !Decode(w, r, &in) {
			return
		}
		name, e := a.CreateBackup()
		if e != nil {
			Fail(w, 500, "No se pudo crear el respaldo; revisa espacio y permisos")
			return
		}
		JSON(w, 200, map[string]any{"nombre": name})
		return
	}
	if r.Method != "GET" {
		unsupported(w)
		return
	}
	files, e := os.ReadDir(dir)
	if e != nil && !os.IsNotExist(e) {
		Fail(w, 500, "No se pudieron consultar los respaldos")
		return
	}
	result := []map[string]any{}
	for _, file := range files {
		if !backupName.MatchString(file.Name()) || file.Type()&os.ModeSymlink != 0 {
			continue
		}
		info, e := file.Info()
		if e != nil || !info.Mode().IsRegular() {
			continue
		}
		result = append(result, map[string]any{"nombre": file.Name(), "tamano": info.Size(), "fecha": info.ModTime().UTC().Format(time.RFC3339), "url": "/api/respaldos/" + file.Name()})
	}
	sort.Slice(result, func(i, j int) bool { return fmt.Sprint(result[i]["nombre"]) > fmt.Sprint(result[j]["nombre"]) })
	w.Header().Set("Cache-Control", "no-store")
	JSON(w, 200, result)
}
