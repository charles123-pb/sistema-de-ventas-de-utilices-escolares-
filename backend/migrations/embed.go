package migrations

import "embed"

// Files incorpora los SQL al ejecutable para aplicar migraciones sin depender de archivos externos.
//go:embed *.sql
var Files embed.FS
