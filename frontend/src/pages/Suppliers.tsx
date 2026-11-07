import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { Supplier } from "../types";
import { Heading, Field, Message, Empty, Pager, useLoad } from "../components/UI";

export default function Suppliers() {
  const [search, setSearch] = useState(""), [page, setPage] = useState(1);
  const [edit, setEdit] = useState<Supplier | null | undefined>(undefined);
  const [error, setError] = useState(""), [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);
  const list = useLoad(() => api<Supplier[]>(`/proveedores?q=${encodeURIComponent(search)}&pagina=${page}`), [search, page]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError(""); setSuccess("");
    const f = new FormData(e.currentTarget);
    const body = Object.fromEntries(f.entries());
    try {
      await api(edit ? `/proveedores/${edit.id}` : "/proveedores", edit ? "PUT" : "POST", {...body, activo: f.get("activo") === "on"});
      setEdit(undefined); setSuccess("Proveedor guardado correctamente."); list.reload();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <>
    <Heading title="Proveedores"
      action={<button className="btn btn-primary" onClick={() => {setEdit(null); setError(""); setSuccess("");}}>+ Nuevo proveedor</button>} />
    <Message error={error || list.error} success={success} />
    <div className="supply-banner mb-3">
      <span className="supply-icon"><i className="bi bi-truck" aria-hidden="true" /></span>
      <div><b>Tu red de abastecimiento</b><p>Registra las marcas de cada empresa y vincula sus productos. Identifica quién te abastece en cada entrada.</p></div>
      <Link to="/app/productos" className="btn btn-outline-primary">Ver productos <i className="bi bi-arrow-right" aria-hidden="true" /></Link>
    </div>
    {edit !== undefined && <section className="panel mb-3">
      <h2>{edit ? "Editar proveedor" : "Registrar proveedor"}</h2>
      <form key={edit?.id || "new"} onSubmit={save}>
        <div className="form-grid">
          <Field label="Empresa / razón social"><input className="form-control" name="nombre" required maxLength={150} defaultValue={edit?.nombre} placeholder="Nombre del proveedor" /></Field>
          <Field label="RUC (opcional)"><input className="form-control" name="ruc" inputMode="numeric" pattern="[0-9]{11}" maxLength={11} defaultValue={edit?.ruc} placeholder="11 dígitos" /></Field>
          <Field label="Persona de contacto"><input className="form-control" name="contacto" maxLength={150} defaultValue={edit?.contacto} /></Field>
          <Field label="Teléfono del proveedor"><input className="form-control" name="telefono" type="tel" maxLength={30} defaultValue={edit?.telefono} /></Field>
          <Field label="Correo electrónico"><input className="form-control" name="email" type="email" maxLength={150} defaultValue={edit?.email} /></Field>
          <Field label="Sitio web del proveedor"><input className="form-control" name="sitio_web" type="url" pattern="https://.*" maxLength={1000} defaultValue={edit?.sitio_web} placeholder="https://" /></Field>
          <Field label="Ciudad"><input className="form-control" name="ciudad" required maxLength={100} defaultValue={edit?.ciudad ?? "Huamanga"} list="supplier-cities" /></Field>
          <Field label="Dirección"><input className="form-control" name="direccion" maxLength={300} defaultValue={edit?.direccion} /></Field>
          <Field label="Marcas que maneja (separadas por comas)"><input className="form-control" name="marcas" maxLength={2000} defaultValue={edit?.marcas_declaradas} placeholder="Escribe las marcas de esta empresa" /></Field>
        </div>
        <datalist id="supplier-cities"><option value="Huamanga" /><option value="Ayacucho" /><option value="Huanta" /><option value="Lima" /></datalist>
        <Field label="Notas / condiciones de compra"><textarea className="form-control" name="notas" maxLength={2000} rows={2} defaultValue={edit?.notas} placeholder="Plazos de entrega, pedido mínimo, condiciones…" /></Field>
        <label className="d-block mb-3"><input type="checkbox" name="activo" defaultChecked={edit ? !!edit.activo : true} /> Proveedor activo</label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar proveedor"}</button>
        <button type="button" className="btn btn-link" disabled={busy} onClick={() => setEdit(undefined)}>Cancelar</button>
      </form>
    </section>}
    <section className="panel">
      <div className="section-toolbar">
        <label className="search-label mb-0">Buscar proveedor<input className="form-control" placeholder="Empresa, RUC, ciudad o marca…" value={search} onChange={e => {setSearch(e.target.value);setPage(1);}} /></label>
        <span className="text-secondary small">Empresas y marcas registradas por tu equipo</span>
      </div>
      {list.loading ? <p role="status">Cargando proveedores…</p> : !list.data?.length ? <Empty text={search ? "No encontramos proveedores para esta búsqueda." : "Agrega tu primer proveedor y las marcas que maneja."} /> : <div className="table-responsive"><table className="table align-middle supplier-table">
        <thead><tr><th>Empresa</th><th>Contacto</th><th>Marcas que maneja</th><th>Productos</th><th>Estado</th><th>Acción</th></tr></thead>
        <tbody>{list.data.map(s => <tr key={s.id}>
          <td data-label="Empresa"><b>{s.nombre}</b><small className="d-block text-secondary">{s.ciudad}{s.ruc ? ` · RUC ${s.ruc}` : ""}</small><small className="d-block text-secondary">{s.direccion}</small></td>
          <td data-label="Contacto">{s.contacto || "Sin contacto"}<small className="d-block text-secondary">{s.telefono || "Sin teléfono"}</small><small className="d-block text-secondary">{s.email}</small>{s.sitio_web && <a className="supplier-website" href={s.sitio_web} target="_blank" rel="noreferrer">Ver sitio web <i className="bi bi-box-arrow-up-right" aria-hidden="true" /></a>}</td>
          <td data-label="Marcas que maneja"><div className="brand-tags">{s.marcas ? s.marcas.split(", ").map(b => <span key={b} className="brand-tag">{b}</span>) : <span className="text-secondary">Sin marcas registradas</span>}</div></td>
          <td data-label="Productos"><Link to={`/app/productos?proveedor=${s.id}`}>{s.productos} productos</Link></td><td data-label="Estado"><span className={`status-badge badge ${s.activo ? "status-aceptada" : "status-cancelado"}`}>{s.activo ? "Activo" : "Inactivo"}</span></td>
          <td data-label="Acción"><button className="btn btn-sm btn-outline-primary" onClick={() => {setEdit(s);setError("");setSuccess("");window.scrollTo({top:0,behavior:"smooth"});}}>Editar</button></td>
        </tr>)}</tbody>
      </table></div>}
      <Pager page={page} setPage={setPage} count={list.data?.length || 0} />
    </section>
  </>;
}
