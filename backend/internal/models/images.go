package models

import (
	"net/url"
	"regexp"
)

var localProductImage = regexp.MustCompile(`^/productos/[a-z0-9][a-z0-9_-]*\.(jpg|jpeg|png|webp|avif)$`)

// ValidProductImage admite fotos estáticas del catálogo o URLs externas HTTPS.
func ValidProductImage(value string) bool {
	if value == "" {
		return true
	}
	if len(value) > 1000 {
		return false
	}
	if localProductImage.MatchString(value) {
		return true
	}
	u, err := url.Parse(value)
	return err == nil && u.Scheme == "https" && u.Host != "" && u.User == nil
}
