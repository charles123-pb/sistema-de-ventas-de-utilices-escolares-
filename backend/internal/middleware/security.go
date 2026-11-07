package middleware

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"sync"
	"time"
)

// Token genera 32 bytes aleatorios y los representa con 64 caracteres hexadecimales.
func Token() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		panic("no hay fuente aleatoria")
	}
	return hex.EncodeToString(bytes)
}

// Hash permite buscar sesiones y enlaces sin guardar el token original en SQLite.
func Hash(value string) string {
	hash := sha256.Sum256([]byte(value))
	return hex.EncodeToString(hash[:])
}

type attempt struct {
	count int
	until time.Time
}

// Limiter protege el contador de intentos frente a solicitudes concurrentes con un mutex.
type Limiter struct {
	mu      sync.Mutex
	entries map[string]attempt
}

// Allow limita por IP en memoria. El reinicio del servidor reinicia el límite.
func (limiter *Limiter) Allow(key string, max int) bool {
	limiter.mu.Lock()
	defer limiter.mu.Unlock()
	if limiter.entries == nil {
		limiter.entries = map[string]attempt{}
	}
	now := time.Now()
	for key, value := range limiter.entries {
		if now.After(value.until) {
			delete(limiter.entries, key)
		}
	}
	value := limiter.entries[key]
	if value.until.IsZero() {
		value.until = now.Add(15 * time.Minute)
	}
	value.count++
	limiter.entries[key] = value
	return value.count <= max
}

// Headers evita caché de respuestas privadas, detección de tipos y envío de la URL como referencia.
func Headers(w http.ResponseWriter) {
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Robots-Tag", "noindex, nofollow")
}
