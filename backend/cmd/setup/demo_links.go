package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"utilventa/internal/services"
)

// Los enlaces privados de ejemplo quedan fuera del sitio público.
func saveDemoLinks(databasePath string, added []services.DemoLink) error {
	return saveExampleLinks(databasePath, "presentacion", "ENLACES_LISTAS_DEMO", added)
}
func saveSchoolLinks(databasePath string, added []services.DemoLink) error {
	return saveExampleLinks(databasePath, "exposicion", "ENLACES_LISTAS", added)
}
func saveExampleLinks(databasePath, subfolder, basename string, added []services.DemoLink) error {
	if len(added) == 0 {
		return nil
	}
	folder := filepath.Join(filepath.Dir(databasePath), subfolder)
	if err := os.MkdirAll(folder, 0700); err != nil {
		return err
	}
	path := filepath.Join(folder, basename+".json")
	all := []services.DemoLink{}
	if content, err := os.ReadFile(path); err == nil {
		if err = json.Unmarshal(content, &all); err != nil {
			return err
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	for _, link := range added {
		found := false
		for _, old := range all {
			if old.ID == link.ID {
				found = true
				break
			}
		}
		if !found {
			all = append(all, link)
		}
	}
	content, err := json.MarshalIndent(all, "", "  ")
	if err != nil {
		return err
	}
	if err = privateFile(path, content); err != nil {
		return err
	}
	origin := os.Getenv("APP_ORIGIN")
	if origin == "" {
		origin = "http://localhost:5173"
	}
	var text strings.Builder
	text.WriteString("# Listas escolares — enlaces privados\n\nDatos ficticios. El enlace permite consultar y responder la propuesta. No compartir este archivo como catálogo público.\n\n")
	for _, link := range all {
		fmt.Fprintf(&text, "- %s · cotización #%d: %s%s\n", link.Titulo, link.ID, strings.TrimRight(origin, "/"), link.Enlace)
	}
	return privateFile(filepath.Join(folder, basename+".md"), []byte(text.String()))
}

// privateFile escribe en un temporal privado y lo renombra para evitar archivos parcialmente escritos.
func privateFile(path string, content []byte) error {
	file, err := os.CreateTemp(filepath.Dir(path), ".demo-enlaces-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err = file.Write(content); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), path)
}
