package models

import "testing"

func TestProductImagePaths(t *testing.T) {
	for _, s := range []string{"", "/productos/art-pr02093.jpg", "/productos/foto_1.webp", "https://example.com/foto.png"} {
		if !ValidProductImage(s) {
			t.Fatal("foto válida rechazada", s)
		}
	}
	for _, s := range []string{"http://example.com/foto.png", "//example.com/foto.jpg", "/productos/../secreto.png", "/productos/%2e%2e/secreto.png", "/productos/foto.svg", "/productos/foto.jpg?token=x", "javascript:alert(1)", "https://user:secret@example.com/foto.jpg"} {
		if ValidProductImage(s) {
			t.Fatal("foto inválida aceptada", s)
		}
	}
}
