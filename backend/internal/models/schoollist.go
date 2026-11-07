package models

// SchoolSelection describe lo solicitado; el servidor determina nombre, precio y stock.
type SchoolSelection struct {
	PorRevisar bool   `json:"por_revisar"`
	ProductoID int64  `json:"producto_id"`
	Solicitado string `json:"solicitado"`
	Cantidad   int64  `json:"cantidad"`
}

// SchoolLine conserva la disponibilidad al recibir la solicitud, sin reservar stock.
type SchoolLine struct {
	Presentacion string `json:"presentacion,omitempty"`
	Contenido    int64  `json:"contenido,omitempty"`
	PorRevisar   bool   `json:"por_revisar"`
	ProductoID   int64  `json:"producto_id"`
	Solicitado   string `json:"solicitado"`
	Nombre       string `json:"nombre"`
	Marca        string `json:"marca"`
	Cantidad     int64  `json:"cantidad"`
	Disponibles  int64  `json:"disponibles"`
	Faltantes    int64  `json:"faltantes"`
	Precio       int64  `json:"precio"`
}
