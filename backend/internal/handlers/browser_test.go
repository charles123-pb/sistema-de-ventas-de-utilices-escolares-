package handlers

import (
	"context"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"testing"
	"time"
)

// Este servidor solo existe dentro de go test y utiliza una base temporal.
func TestBrowserServer(t *testing.T) {
	if os.Getenv("UV_E2E") != "1" {
		t.Skip("servidor reservado para las pruebas de navegador")
	}
	app := fixture(t)
	app.Origin = os.Getenv("UV_E2E_ORIGIN")
	if app.Origin == "" {
		app.Origin = "http://127.0.0.1:5173"
	}
	port := os.Getenv("UV_E2E_PORT")
	if port == "" {
		port = "8080"
	}
	listener, err := net.Listen("tcp", "127.0.0.1:"+port)
	if err != nil {
		t.Fatal(err)
	}
	server := &http.Server{Handler: app, ReadHeaderTimeout: 5 * time.Second}
	go func() {
		if err := server.Serve(listener); err != nil && err != http.ErrServerClosed {
			t.Error(err)
		}
	}()
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()
	shutdown, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	server.Shutdown(shutdown)
}
