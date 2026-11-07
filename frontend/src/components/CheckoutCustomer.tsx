import { useState, type FormEvent } from "react";
import { api } from "../services/api";
import type { Customer } from "../types";
import { Field, Message, Pager, useLoad } from "./UI";

type CustomerMode = "final" | "persona" | "empresa";
export function CheckoutCustomer({ value, onChange, onBlockedChange, disabled }: {
  value: Customer | null;
  onChange: (customer: Customer | null) => void;
  onBlockedChange: (blocked: boolean) => void;
  disabled: boolean;
}) {
  const [mode, setMode] = useState<CustomerMode>(value?.tipo||"final");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const clients = useLoad(() => mode === "final" ? Promise.resolve([] as Customer[]) :
    api<Customer[]>(`/clientes?q=${encodeURIComponent(query)}&tipo=${mode}&pagina=${page}`), [query, mode, page]);

  function changeMode(next: CustomerMode) {
    setMode(next); setQuery(""); setPage(1); setCreating(false); setError(""); setSuccess("");
    onChange(null); onBlockedChange(next !== "final");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const customer = {
      nombre: String(form.get("nombre") || "").trim(), documento: String(form.get("documento") || "").trim(),
      telefono: String(form.get("telefono") || "").trim(), direccion: String(form.get("direccion") || "").trim(),
      tipo: mode as Customer["tipo"],
    };
    setSaving(true); setError("");
    try {
      const result = await api<{id:number}>("/clientes", "POST", customer);
      onChange({...customer, id:result.id}); onBlockedChange(false);
      setCreating(false); setSuccess("Cliente registrado y seleccionado. Puedes continuar con el cobro.");
      clients.reload();
    } catch(e) { setError((e as Error).message); }
    finally { setSaving(false); }
  }
  return <section className="checkout-customer" aria-label="Cliente de la venta">
    <div className="checkout-customer-title"><h3>¿Quién compra?</h3><span>Venta rápida o cliente registrado</span></div>
    <fieldset disabled={disabled || saving}>
      <legend className="visually-hidden">Tipo de cliente</legend>
      <div className="checkout-customer-modes">
        {([
          ["final", "bi-lightning-charge", "Consumidor final"],
          ["persona", "bi-person", "Persona"],
          ["empresa", "bi-buildings", "Empresa con RUC"],
        ] as const).map(([key, icon, label]) => <label key={key} className={mode === key ? "selected" : ""}>
          <input type="radio" name="tipo-cliente-caja" value={key} checked={mode===key} onChange={()=>changeMode(key)} />
          <i className={`bi ${icon}`} aria-hidden="true" /><span>{label}</span>
        </label>)}
      </div>
      <Message error={error} success={success} />
      {mode === "final" ? <p className="checkout-customer-hint">Puedes cobrar sin pedir nombre ni documento.</p> : <>
        {value && !creating && <div className="checkout-customer-selected" role="status">
          <b><i className="bi bi-check-circle" aria-hidden="true" /> {value.nombre}</b>
          <small>{value.documento ? `${value.tipo === "empresa" ? "RUC" : "Documento"}: ${value.documento}` : "Sin documento"}{value.direccion ? ` · ${value.direccion}` : ""}</small>
          <button type="button" className="btn btn-sm btn-link" onClick={()=>{onChange(null);onBlockedChange(true);setSuccess("");}}>Cambiar cliente</button>
        </div>}
        {!value && !creating && <>
          <Field label="Buscar cliente por nombre o documento"><input className="form-control" value={query} placeholder={mode === "empresa" ? "RUC o razón social" : "Nombre o documento"} onChange={e=>{setQuery(e.target.value);setPage(1);}} /></Field>
          <Message error={clients.error} />
          <Field label="Cliente"><select className="form-select" value="" onChange={e=>{
            const selected=clients.data?.find(c=>c.id===Number(e.target.value));
            if(selected) {onChange(selected);onBlockedChange(false);setError("");}
          }} disabled={clients.loading}><option value="">{clients.loading ? "Buscando…" : "Selecciona un cliente registrado"}</option>{clients.data?.map(c=><option key={c.id} value={c.id}>{c.nombre}{c.documento ? ` · ${c.documento}` : ""}</option>)}</select></Field>
          {!clients.loading && !clients.data?.length && !clients.error && <p className="checkout-customer-hint">No encontramos clientes. Puedes registrar uno aquí.</p>}
          {(page>1 || (clients.data?.length || 0)>=30) && <Pager page={page} setPage={setPage} count={clients.data?.length || 0} />}
          <button type="button" className="btn btn-sm btn-outline-primary" onClick={()=>{setCreating(true);onBlockedChange(true);setError("");setSuccess("");}}><i className="bi bi-person-plus" aria-hidden="true" /> Nuevo cliente</button>
        </>}
        {creating && <form className="checkout-customer-form" onSubmit={save}>
          <h4>{mode==="empresa" ? "Registrar empresa" : "Registrar persona"}</h4>
          <Field label={mode==="empresa" ? "Razón social" : "Nombre del cliente"}><input className="form-control" name="nombre" autoComplete="organization" required maxLength={150} autoFocus /></Field>
          <div className="row g-2">
            <div className="col-sm-6"><Field label={mode==="empresa" ? "RUC" : "Documento (opcional)"}><input className="form-control" name="documento" inputMode={mode==="empresa" ? "numeric" : "text"} required={mode==="empresa"} pattern={mode==="empresa" ? "[0-9]{11}" : undefined} minLength={mode==="empresa" ? 11 : undefined} maxLength={mode==="empresa" ? 11 : 30} /></Field></div>
            <div className="col-sm-6"><Field label="Teléfono (opcional)"><input className="form-control" name="telefono" type="tel" maxLength={30} autoComplete="tel" /></Field></div>
          </div>
          <Field label={mode==="empresa" ? "Dirección de la empresa" : "Dirección (opcional)"}><input className="form-control" name="direccion" required={mode==="empresa"} maxLength={300} autoComplete="street-address" /></Field>
          <div className="d-flex gap-2"><button className="btn btn-sm btn-primary" disabled={saving}>{saving ? "Guardando…" : "Guardar y seleccionar"}</button><button type="button" className="btn btn-sm btn-outline-secondary" onClick={()=>{setCreating(false);setError("");onBlockedChange(!value);}}>Cancelar</button></div>
        </form>}
      </>}
    </fieldset>
  </section>;
}
