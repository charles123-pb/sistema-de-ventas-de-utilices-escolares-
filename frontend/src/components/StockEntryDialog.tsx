import { useEffect, useRef, useState, type FormEvent } from "react";
import { api, money } from "../services/api";
import type { Product, SupplierOption } from "../types";
import { presentationLabel } from "../lib/product-language";
import { Field, Message, ProductImage, useLoad } from "./UI";

// Purchase fields for the entry dialog used by Products and Replenishment.
function StockEntryFields({ cost, suppliers, supplier = "" }: {
  cost: number; suppliers: SupplierOption[]; supplier?: string;
}) {
  return <>
    <Field label="Costo unitario entrada (S/)"><input className="form-control" name="costo" defaultValue={(cost / 100).toFixed(2)} inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required /></Field>
    <Field label="Proveedor de la entrada (opcional)"><select className="form-select" name="proveedor_id" defaultValue={supplier}><option value="">Sin proveedor registrado</option>{suppliers.filter(s => s.activo).map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select></Field>
    <Field label="Comprobante de compra (opcional)"><input className="form-control" name="comprobante" maxLength={80} placeholder="Ej.: F001-000123" /></Field>
  </>;
}

export function StockEntryDialog({ productId, mode = "entrada", initialQuantity, onClose, onSaved }: {
  productId: number; mode?: "entrada" | "ajuste"; initialQuantity?: number; onClose: () => void; onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  const pending = useRef(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const load = useLoad(async () => {
    const [products, suppliers] = await Promise.all([
      api<Product[]>(`/productos?id=${productId}`),
      mode === "entrada" ? api<SupplierOption[]>("/proveedores?opciones=1") : Promise.resolve([] as SupplierOption[]),
    ]);
    const product = products.find(p => p.id === productId);
    if (!product) throw new Error("El producto ya no está disponible.");
    return { product, suppliers };
  }, [productId, mode]);
  useEffect(() => {
    dialog.current?.showModal();
    const previous = trigger.current;
    return () => previous?.focus();
  }, []);
  const product = load.data?.product;
  const suppliers = load.data?.suppliers || [];
  const supplier = suppliers.some(s => s.activo && s.id === product?.proveedor_id) ? String(product?.proveedor_id) : "";
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!product || load.loading || pending.current) return;
    const f = new FormData(e.currentTarget);
    if (mode === "ajuste" && Number(f.get("cantidad")) === 0) { setError("La cantidad del ajuste debe ser distinta de cero."); return; }
    pending.current = true;
    setBusy(true); setError("");
    try {
      await api("/movimientos", "POST", {
        producto_id: product.id, tipo: mode, cantidad: Number(f.get("cantidad")),
        costo: mode === "entrada" ? String(f.get("costo")) : "0.00", proveedor_id: mode === "entrada" && f.get("proveedor_id") ? Number(f.get("proveedor_id")) : null,
        comprobante: mode === "entrada" ? String(f.get("comprobante") || "").trim() : "", motivo: String(f.get("motivo") || "").trim(),
      });
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return <dialog ref={dialog} className="stock-entry-dialog" aria-labelledby="stock-entry-title" aria-busy={busy} onCancel={e => { e.preventDefault(); if (!pending.current) onClose(); }}>
    <header className="stock-entry-heading"><h2 id="stock-entry-title">{mode === "entrada" ? "Registrar entrada" : "Ajustar stock"}</h2><button type="button" className="btn btn-sm btn-outline-secondary" aria-label={mode === "entrada" ? "Cerrar entrada" : "Cerrar ajuste"} disabled={busy} onClick={onClose}><i className="bi bi-x-lg" aria-hidden="true" /></button></header>
    <Message error={error || load.error} />
    {load.loading ? <p role="status">Consultando producto…</p> : product && <>
      <div className="stock-entry-product"><ProductImage src={product.imagen} name={product.nombre} category={product.categoria} /><div><b>{product.nombre}</b><small>{product.codigo} · {presentationLabel(product)}</small><small>Stock actual: <strong>{product.stock}</strong> · Costo promedio: <strong>{money(product.costo)}</strong></small></div></div>
      <form onSubmit={save}>
        <fieldset disabled={busy}>
          <div className="form-grid">
            <Field label={mode === "entrada" ? "Cantidad de entrada" : "Cantidad a ajustar"}><input className="form-control" name="cantidad" type="number" min={mode === "entrada" ? 1 : -1000000} max={1000000} step={1} defaultValue={mode === "entrada" && initialQuantity && Number.isInteger(initialQuantity) && initialQuantity > 0 && initialQuantity <= 1000000 ? initialQuantity : ""} required /></Field>
            {mode === "entrada" && <StockEntryFields cost={product.costo || 0} suppliers={suppliers} supplier={supplier} />}
          </div>
          <Field label="Motivo obligatorio"><input className="form-control" name="motivo" maxLength={500} defaultValue={mode === "entrada" ? "Compra de mercadería" : ""} placeholder={mode === "ajuste" ? "Ej.: diferencia en el conteo físico" : undefined} required /></Field>
          <p className="small text-secondary">{mode === "entrada" ? "Confirma el costo de compra. El stock y el costo promedio se actualizan al guardar." : "Usa una cantidad positiva para sumar o negativa para restar. El ajuste conserva el costo promedio y registra el motivo."}</p>
          <footer className="stock-entry-actions"><button type="button" className="btn btn-outline-secondary" onClick={onClose}>Cancelar</button><button className="btn btn-primary">{busy ? "Guardando…" : mode === "entrada" ? "Guardar entrada" : "Guardar ajuste"}</button></footer>
        </fieldset>
      </form>
    </>}
    {!load.loading && load.error && <button type="button" className="btn btn-outline-primary" onClick={load.reload}>Reintentar</button>}
  </dialog>;
}
