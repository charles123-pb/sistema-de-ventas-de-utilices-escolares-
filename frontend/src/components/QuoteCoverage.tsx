import type { Quote } from "../types";
import { money } from "../services/api";

// La propuesta enviada prevalece; antes de prepararla se muestra la selección recibida.
export function QuoteCoverage({ quote }: { quote: Quote }) {
  const lines = quote.items.length ? quote.items.map(i => ({
    nombre: i.nombre || i.solicitado || "Útil solicitado",
    cantidad: i.cantidad,
    disponibles: i.disponible ? i.cantidad : 0,
    faltantes: i.disponible ? 0 : i.cantidad,
    precio: i.precio || 0,
    nota: i.alternativa,
    por_revisar:!!i.por_revisar&&!i.disponible,
  })) : (quote.solicitud_items || []).map(i => ({ ...i, nota: "" }));
  if (!lines.length) return null;
  const available = lines.filter(i => i.disponibles > 0);
  const missing = lines.filter(i => i.faltantes > 0&&!i.por_revisar);
  const pending=lines.filter(i=>i.por_revisar);
  return <section className="quote-coverage panel mb-3">
    <div className="d-flex justify-content-between gap-2 flex-wrap"><h2>Disponibles y faltantes</h2><small className="text-secondary">{quote.items.length ? "Según la propuesta actual" : "Al recibir tu solicitud · pendiente de revisión"}</small></div>
    <div className="request-coverage">
      <section className="coverage-column available-column" aria-label="Disponibles en la cotización"><h3><i className="bi bi-check2-circle" aria-hidden="true" /> Disponibles <span>{available.length}</span></h3>
        {!available.length && <p className="coverage-empty">Todavía no se han registrado disponibles.</p>}
        {available.map((i, n) => <div className="coverage-result" key={n}><b>{i.disponibles} × {i.nombre}</b><small>{money(i.precio)} por unidad</small></div>)}
      </section>
      <section className="coverage-column missing-column" aria-label="Faltantes en la cotización"><h3><i className="bi bi-clock-history" aria-hidden="true" /> Faltantes <span>{missing.length}</span></h3>
        {!missing.length && <p className="coverage-empty">Sin faltantes registrados.</p>}
        {missing.map((i, n) => <div className="coverage-result" key={n}><b>{i.faltantes} × {i.nombre}</b>{i.nota && <small>{i.nota}</small>}</div>)}
      </section>
    </div>
    {!!pending.length && <section className="review-pending coverage-column" aria-label="Por revisar en la cotización"><h3>Por revisar <span>{pending.length}</span></h3><p className="coverage-empty">Pendiente de elegir la marca o presentación.</p>{pending.map((i,n)=><div className="coverage-result" key={n}><b>{i.cantidad} × {i.nombre}</b>{i.nota&&<small>{i.nota}</small>}</div>)}</section>}
  </section>;
}
