// Contratos de las respuestas JSON de Go. Todos los importes numéricos están expresados en céntimos.
export interface User {
  id: number;
  nombre: string;
  usuario: string;
  rol: "administrador" | "vendedor";
}
export interface Product {
  familia?: string;
  presentacion?: string;
  contenido?: number;
  id: number;
  codigo: string;
  nombre: string;
  marca: string;
  descripcion: string;
  categoria_id: number;
  categoria: string;
  imagen: string;
  precio: number;
  costo?: number;
  proveedor_id?: number | null;
  proveedor?: string;
  stock: number;
  stock_minimo: number;
  activo: number;
}
// Una alternativa conserva el nombre y precio capturados al preparar la propuesta.
export interface Opcion {
  presentacion?: string;
  contenido?: number;
  producto_id: number;
  nombre: string;
  codigo: string;
  marca: string;
  precio: number;
}
export interface Item {
  presentacion?: string;
  contenido?: number;
  por_revisar?: boolean;
  producto_id: number;
  cantidad: number;
  nombre?: string;
  codigo?: string;
  precio?: number;
  subtotal?: number;
  solicitado?: string;
  alternativa?: string;
  disponible?: boolean;
  opciones?: Opcion[];
}
export interface Sale {
	 estado: "activa" | "anulada";
	 vendedor: string;
	 anulacion_motivo: string;
	 anulacion_fecha: string;
	 anulacion_usuario: string;
  id: number;
  fecha: string;
  total: number;
  pago: string;
  recibido: number;
  items: Item[];
  cliente_nombre: string;
  cliente_documento: string;
  cliente_direccion: string;
  cliente_tipo: string;
}

export interface Customer {
  id: number;
  nombre: string;
  documento: string;
  direccion: string;
  telefono: string;
  tipo: "persona" | "empresa";
}
// La revisión permite detectar cambios mientras el cliente o el personal responde a una propuesta.
export interface Quote {
  id: number;
  nombre: string;
  telefono: string;
  lista: string;
  observaciones: string;
  presupuesto: number;
  estado: string;
  revision: number;
  vigencia: string;
  items: Item[];
  adjunto?: { nombre: string; tipo: string; tamano: number; url: string } | null;
  solicitud_items?: SchoolLine[];
  pedidos: { id: number; estado: string; venta_id: number | null; venta_estado?:string }[];
}

export interface Brand { nombre: string; productos: number; }
export interface Supplier {
  id: number; nombre: string; ruc: string; contacto: string;
  telefono: string; email: string; direccion: string; ciudad: string;
  sitio_web: string; notas: string; marcas: string; marcas_declaradas: string; activo: number; productos: number;
}
export interface SupplierOption { id: number; nombre: string; activo: number; }

export interface SchoolAttachment { nombre: string; tipo: string; datos: string; }
export interface SchoolLine {
  presentacion?: string;
  contenido?: number;
  por_revisar?: boolean;
  producto_id: number; solicitado: string; nombre: string; marca: string;
  cantidad: number; disponibles: number; faltantes: number; precio: number;
}
