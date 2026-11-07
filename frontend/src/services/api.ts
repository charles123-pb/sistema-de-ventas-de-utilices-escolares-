// Punto común de acceso a Go: añade /api, envía JSON y transforma errores HTTP en mensajes.
export async function api<T = any>(
  path: string,
  method = "GET",
  body?: unknown,
): Promise<T> {
  const response = await fetch("/api" + path, {
    method,
    // La cookie HttpOnly viaja con la petición sin que React tenga que leer su contenido.
    credentials: "same-origin",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  // AuthProvider escucha este evento para retirar la sesión de la interfaz cuando expira.
  if (response.status === 401 && path !== "/login") {
    window.dispatchEvent(new Event("uv:session-expired"));
  }
  if (!response.ok)
    throw new Error(
      data?.error?.mensaje || "No se pudo conectar con el servidor",
    );
  return data as T;
}
// La API devuelve céntimos; solo al presentar el importe se convierten a soles.
export const money = (n: number = 0) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    n / 100,
  );
// Las fechas del servidor están en UTC; la pantalla usa siempre la hora de Perú.
export const date = (s: string) =>
  s
    ? new Intl.DateTimeFormat("es-PE", {
        timeZone: "America/Lima",
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(s))
    : "—";
// Genera la fecha local usada por los filtros de día y los formularios de vigencia.
export const today = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
// Convierte texto decimal a un entero de céntimos sin multiplicar un decimal de punto flotante.
export function cents(s: string): number {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s))
    throw new Error("Use un importe con hasta dos decimales");
  const [whole, decimal = ""] = s.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}
