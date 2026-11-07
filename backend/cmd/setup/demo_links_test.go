package main

import (
	"encoding/json"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"utilventa/internal/services"
)

func TestDemoLinksRemainPrivateAndKeepEarlierLinks(t *testing.T) {
	t.Setenv("APP_ORIGIN", "http://localhost:5173")
	folder := t.TempDir()
	db := filepath.Join(folder, "demo.db")
	first := services.DemoLink{ID: 1, Titulo: "[DEMO] Inicial", Enlace: "/seguimiento/" + strings.Repeat("a", 64)}
	second := services.DemoLink{ID: 2, Titulo: "[DEMO] Primaria", Enlace: "/seguimiento/" + strings.Repeat("b", 64)}
	if err := saveDemoLinks(db, []services.DemoLink{first}); err != nil {
		t.Fatal(err)
	}
	if err := saveDemoLinks(db, []services.DemoLink{first, second}); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(folder, "presentacion", "ENLACES_LISTAS_DEMO.json")
	content, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var links []services.DemoLink
	if err = json.Unmarshal(content, &links); err != nil {
		t.Fatal(err)
	}
	if len(links) != 2 || links[0].Enlace != first.Enlace {
		t.Fatal("se duplicó o perdió un enlace anterior")
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if runtime.GOOS != "windows" && info.Mode().Perm() != 0600 {
		t.Fatal("archivo privado con permisos demasiado amplios")
	}
}

func TestSchoolLinksDoNotCollideWithPreviousDatabase(t *testing.T) {
	folder := t.TempDir()
	previous := services.DemoLink{ID: 1, Titulo: "Anterior", Enlace: "/seguimiento/" + strings.Repeat("a", 64)}
	current := services.DemoLink{ID: 1, Titulo: "Lista escolar", Enlace: "/seguimiento/" + strings.Repeat("b", 64)}
	if err := saveDemoLinks(filepath.Join(folder, "presentacion.db"), []services.DemoLink{previous}); err != nil {
		t.Fatal(err)
	}
	if err := saveSchoolLinks(filepath.Join(folder, "utilventa.db"), []services.DemoLink{current}); err != nil {
		t.Fatal(err)
	}
	for path, expected := range map[string]string{
		filepath.Join(folder, "presentacion", "ENLACES_LISTAS_DEMO.json"): previous.Enlace,
		filepath.Join(folder, "exposicion", "ENLACES_LISTAS.json"):        current.Enlace,
	} {
		content, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		var links []services.DemoLink
		if err = json.Unmarshal(content, &links); err != nil || len(links) != 1 || links[0].Enlace != expected {
			t.Fatal("enlace privado mezclado entre bases")
		}
	}
}
