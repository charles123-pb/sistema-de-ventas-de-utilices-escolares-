package models

import (
	"regexp"
	"strconv"
	"strings"
)

var accents = strings.NewReplacer("á", "a", "é", "e", "í", "i", "ó", "o", "ú", "u", "ü", "u", "ñ", "n")
var schoolWords = regexp.MustCompile(`[a-z0-9]+(?:[.,][0-9]+)?`)
var schoolTimes = regexp.MustCompile(`\bx\s*([0-9]+)`)
var coloredPencils = regexp.MustCompile(`\b(?:lapices|lapiz)\s+de\s+color(?:es)?\b`)
var schoolAliases = map[string]string{
	"lapices": "lapiz", "colores": "color", "borradores": "borrador", "marcadores": "plumon", "marcador": "plumon", "plumones": "plumon",
	"boligrafo": "lapicero", "boligrafos": "lapicero", "escolares": "escolar", "compases": "compas", "sacapuntas": "tajador",
	"cuadriculado": "cuadricula", "cuadriculados": "cuadricula", "cuadrimax": "cuadricula", "hojas": "hoja", "hoj": "hoja",
	"lapiceros": "lapicero", "tijeras": "tijera", "cuadernos": "cuaderno", "temperas": "tempera", "crayones": "crayon",
	"cajas": "caja", "paquetes": "paquete", "estuches": "estuche", "juegos": "juego", "unidades": "unidad", "unds": "unidad", "und": "unidad", "uds": "unidad", "ud": "unidad",
	"frascos": "frasco", "rollos": "rollo", "resmas": "resma", "blocs": "block", "bloc": "block", "blocks": "block",
	"triangulares": "triangular", "micas": "mica", "pinceles": "pincel", "cartulinas": "cartulina", "reglas": "regla",
}

func SchoolNormalize(value string) string {
	return accents.Replace(strings.ToLower(strings.TrimSpace(value)))
}
func SchoolTokens(value string) []string {
	words := schoolWords.FindAllString(schoolTimes.ReplaceAllString(SchoolNormalize(value), "$1"), -1)
	out := []string{}
	for _, word := range words {
		if alias, ok := schoolAliases[word]; ok {
			word = alias
		} else if word != "compas" && word != "portaminas" && len(word) > 3 && strings.HasSuffix(word, "s") && !strings.HasSuffix(word, "is") {
			word = strings.TrimSuffix(word, "s")
		}
		word = strings.ReplaceAll(word, ",", ".")
		switch word {
		case "de", "del", "la", "el", "los", "las", "con", "para", "en", "y", "un", "una", "x":
			continue
		}
		out = append(out, word)
	}
	return out
}

func SchoolFamily(name string) string {
	s := coloredPencils.ReplaceAllString(SchoolNormalize(name), "colores")
	for _, word := range SchoolTokens(s) {
		switch word {
		case "color":
			return "colores"
		case "cuaderno", "lapiz", "lapicero", "borrador", "tajador", "pincel", "tempera", "crayon", "plumon", "tijera", "regla", "plastilina", "silicona", "resaltador", "portaminas", "limpiatipo", "cartulina", "papel", "forro", "mica", "archivador", "perforador", "block":
			return word
		case "pegamento", "cola":
			return "pegamento"
		case "goma":
			if strings.Contains(s, "borrar") {
				return "borrador"
			}
			return "pegamento"
		case "geometrico":
			return "geometria"
		}
	}
	return ""
}

var packSize = regexp.MustCompile(`(?:\bx\s*|\bcaja\s+(?:de\s+)?|\bpaquete\s+(?:de\s+)?)([0-9]+)\b`)
var colorSize = regexp.MustCompile(`\b([0-9]+)\s*(?:\+|unidades|colores|lapices|hojas)`)

func SchoolPackaging(name string) (string, int64) {
	s := SchoolNormalize(name)
	kind := "unidad"
	size := int64(1)
	for _, unit := range []string{"paquete", "estuche", "caja", "juego", "frasco", "rollo", "resma"} {
		if strings.Contains(s, unit) {
			kind = unit
			break
		}
	}
	family := SchoolFamily(name)
	if family == "colores" || family == "crayon" || family == "plastilina" {
		if kind == "unidad" {
			kind = "caja"
		}
	}
	if kind != "unidad" {
		size = 0
		match := packSize.FindStringSubmatch(s)
		if len(match) < 2 && (family == "colores" || family == "crayon" || family == "plastilina") {
			match = colorSize.FindStringSubmatch(s)
		}
		if len(match) > 1 {
			size, _ = strconv.ParseInt(match[1], 10, 64)
		}
	}
	return kind, size
}

func SchoolSearch(name, brand, code, family, query string) bool {
	query = strings.TrimSpace(query)
	if query == "" {
		return true
	}
	if family == "" {
		family = SchoolFamily(name)
	}
	requestedFamily := SchoolFamily(query)
	if requestedFamily != "" && family != "" && requestedFamily != family {
		return false
	}
	terms := SchoolTokens(query)
	words := SchoolTokens(name + " " + brand + " " + code)
	if requestedFamily == "colores" {
		words = append(words, "color")
		filtered := terms[:0]
		for _, t := range terms {
			if t != "lapiz" {
				filtered = append(filtered, t)
			}
		}
		terms = filtered
	}
	for _, term := range terms {
		switch term {
		case "unidad", "caja", "paquete", "estuche", "juego", "docena", "docenas":
			continue
		}
		found := false
		for _, w := range words {
			if w == term || (term[0] < '0' || term[0] > '9') && strings.HasPrefix(w, term) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	return len(terms) > 0
}
