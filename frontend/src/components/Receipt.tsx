import { useStore, type StoreSettings } from "../context/Store";
import { money, date } from "../services/api";
import type { Item } from "../types";
import { presentationLabel } from "../lib/product-language";
// Carga jsPDF solo al descargar y reparte las líneas largas entre páginas.
export async function downloadPDF(title: string, lines: string[], store?: StoreSettings) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF();
  let y = 18;
  doc.setFontSize(15);
  doc.text(store?.nombre || "ÚtilVenta Ayacucho", 14, y);
  y += 10;
  doc.setFontSize(10);
  for (const line of [
    title,
    ...[store?.direccion,store?.telefono,store?.horario].filter((s):s is string=>!!s),
    ...lines,
    "Disponibilidad confirmada al concretar la compra.",
    "DOCUMENTO INTERNO: NO ES COMPROBANTE TRIBUTARIO.",
  ]) {
    const parts = doc.splitTextToSize(line, 180) as string[];
    for (const p of parts) {
      if (y > 280) {
        doc.addPage();
        y = 18;
      }
      doc.text(p, 14, y);
      y += 6;
    }
  }
  doc.save(title.replace(/[^a-zA-Z0-9-]/g, "_") + ".pdf");
}
// Presenta artículos históricos y reutiliza sus datos para imprimir o generar el PDF interno.
export function Document({
  title,
  fecha,
  items,
  total,
  extra = [],
}: {
  title: string;
  fecha?: string;
  items: Item[];
  total: number;
  extra?: string[];
}) {
  const {store}=useStore();
  const lines = [
    fecha ? date(fecha) : "",
    ...items.flatMap((i) => [
      `${i.nombre || i.solicitado}: ${i.cantidad} x ${money(i.precio)} = ${money(i.subtotal)}${i.alternativa ? " · " + i.alternativa : ""}`,
      ...(i.presentacion?[`  ${presentationLabel(i)}`]:[]),
      ...(i.opciones || []).map(
        (o) =>
          `  ${o.producto_id === i.producto_id ? "Elegida" : "Opción"}: ${o.nombre} (${o.marca || o.codigo}) - ${money(o.precio)}`,
      ),
    ]),
    "TOTAL: " + money(total),
    ...extra,
  ];
  return (
    <section className="panel document">
      <h2>{store.nombre}</h2>
      {store.direccion&&<p>{store.direccion}</p>}
      {store.telefono&&<p>{store.telefono}</p>}
      <p>{title}</p>
      {fecha && <p>{date(fecha)}</p>}
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Artículo</th>
              <th>Cantidad</th>
              <th>Precio</th>
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i, n) => (
              <tr key={n}>
                <td>
                  {i.nombre || i.solicitado}
                  {i.presentacion&&<small className="d-block text-secondary">{presentationLabel(i)}</small>}
                  {i.disponible === false && (
                    <small className="d-block text-danger">No disponible</small>
                  )}
                  {i.opciones?.map((o) => (
                    <small
                      className="d-block text-secondary"
                      key={o.producto_id}
                    >
                      {o.producto_id === i.producto_id ? "Elegida" : "Opción"}:{" "}
                      {o.nombre} · {o.marca || o.codigo} · {money(o.precio)}
                    </small>
                  ))}
                  {i.alternativa && (
                    <small className="d-block">
                      Alternativa: {i.alternativa}
                    </small>
                  )}
                </td>
                <td>{i.cantidad}</td>
                <td>{money(i.precio)}</td>
                <td>{money(i.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="fs-4 text-end">
        Total: <b>{money(total)}</b>
      </p>
      {extra.map((t) => (
        <p key={t}>{t}</p>
      ))}
      <p className="small">
        DOCUMENTO INTERNO. NO ES UN COMPROBANTE TRIBUTARIO.
      </p>
      <div className="no-print d-flex gap-2">
        <button
          className="btn btn-outline-primary"
          onClick={() => window.print()}
        >
          <i aria-hidden="true" className="bi bi-printer" /> Imprimir
        </button>
        <button
          className="btn btn-primary"
          onClick={() => downloadPDF(title, lines, store)}
        >
          <i aria-hidden="true" className="bi bi-file-pdf" /> Descargar PDF
        </button>
      </div>
    </section>
  );
}
