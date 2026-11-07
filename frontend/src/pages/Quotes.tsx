import { FormEvent, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, date, money, today } from "../services/api";
import {
  Heading,
  Message,
  Field,
  Status,
  Empty,
  Pager,
  useLoad,
} from "../components/UI";
import { Document } from "../components/Receipt";
import { QuoteCoverage } from "../components/QuoteCoverage";
import type { Item, Product, Quote } from "../types";
import { useAuth } from "../context/Auth";
import { clearDraft, readDraft, writeDraft } from "../lib/drafts";
// Bandeja del personal para buscar listas recibidas y registrar solicitudes de clientes.
export default function Quotes() {
  const [params,setParams]=useSearchParams();const state=params.get("estado")||"";
  function setState(value:string){const next=new URLSearchParams(params);if(value)next.set("estado",value);else next.delete("estado");setParams(next);setPage(1);}
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [create, setCreate] = useState(false),
    [error, setError] = useState(""),
    [link, setLink] = useState(""),
    [busy, setBusy] = useState(false);
  const list = useLoad(
    () => api<any[]>(`/cotizaciones?q=${encodeURIComponent(q)}&pagina=${page}&estado=${encodeURIComponent(state)}`),
    [q, page, state],
  );
  const createDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{if(!create)return;const previous=document.activeElement as HTMLElement|null;createDialog.current?.showModal();return()=>previous?.focus();},[create]);
  const nav = useNavigate();
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if(busy)return;
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    try {
      const v = await api("/cotizaciones", "POST", {
        nombre: f.get("nombre"),
        telefono: f.get("telefono"),
        lista: f.get("lista"),
        observaciones: f.get("observaciones"),
        presupuesto: f.get("presupuesto"),
        cliente_id: f.get("cliente_id") ? Number(f.get("cliente_id")) : null,
      });
      setLink(window.location.origin + v.enlace);
      setCreate(false);
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const clients = useLoad(() => api<any[]>("/clientes"), []);
  return (
    <div className="quotes-workspace">
      <Heading
        title="Listas y cotizaciones"
        action={
          <button
            className="btn btn-primary"
            onClick={() => {setError("");setCreate(true);}}
          >
            + Nueva solicitud
          </button>
        }
      />
      <Message error={list.error} />
      {link && (
        <div className="alert alert-success">
          Solicitud creada. Guarda y comparte este enlace privado:{" "}
          <a className="text-break" href={link}>
            {link}
          </a>
        </div>
      )}
      {create && (
        <dialog ref={createDialog} className="quote-create-dialog" aria-labelledby="new-quote-title" onCancel={e=>{e.preventDefault();if(!busy)setCreate(false);}}>
          <header className="quote-create-heading"><h2 id="new-quote-title">Nueva solicitud</h2><button type="button" className="btn btn-sm btn-outline-secondary" aria-label="Cerrar solicitud" disabled={busy} onClick={()=>setCreate(false)}><i className="bi bi-x-lg" aria-hidden="true" /></button></header>
          <Message error={error||clients.error} />
          <form onSubmit={submit}><fieldset disabled={busy}>
            <div className="form-grid">
              <Field label="Nombre">
                <input
                  name="nombre"
                  className="form-control"
                  required
                  maxLength={150}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  name="telefono"
                  className="form-control"
                  required
                  minLength={6}
                  maxLength={30}
                />
              </Field>
              <Field label="Cliente registrado (opcional)">
                <select name="cliente_id" className="form-select">
                  <option value="">Sin vincular</option>
                  {clients.data?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Presupuesto S/ (opcional)">
                <input
                  name="presupuesto"
                  className="form-control"
                  pattern="[0-9]+([.][0-9]{1,2})?"
                />
              </Field>
            </div>
            <Field label="Lista solicitada">
              <textarea
                name="lista"
                className="form-control"
                rows={4}
                maxLength={10000}
                required
              />
            </Field>
            <Field label="Observaciones">
              <textarea
                name="observaciones"
                className="form-control"
                maxLength={2000}
              />
            </Field>
            <div className="quote-create-actions"><button type="button" className="btn btn-outline-secondary" onClick={()=>setCreate(false)}>Cancelar</button><button disabled={busy} className="btn btn-primary">{busy ? "Guardando…" : "Crear solicitud"}</button></div>
          </fieldset></form>
        </dialog>
      )}

      <section className="panel quote-inbox">
        <div className="quote-inbox-toolbar"><Field label="Buscar por nombre">
          <input
            className="form-control"
            value={q}
            placeholder="Nombre, teléfono o número"
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
          />
        </Field>
        <nav className="quote-inbox-filters" aria-label="Estado de las listas">{[["","Todas"],["pendientes","Por revisar"],["enviada","Enviadas"],["aceptada","Aceptadas"],["cerradas","Finalizadas"]].map(([value,label])=><button type="button" key={value} aria-pressed={state===value} onClick={()=>setState(value)}>{label}</button>)}</nav>
        </div>
        {list.loading ? (
          <p>Cargando…</p>
        ) : !list.data?.length ? (
          <Empty />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>N.º</th>
                  <th>Cliente</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((v) => (
                  <tr key={v.id}>
                    <td>#{v.id}</td>
                    <td>
                      {v.nombre}
                      <small className="d-block">{v.telefono}</small>
                    </td>
                    <td>{date(v.fecha)}</td>
                    <td>
                      <Status value={v.estado} />
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary"
                        onClick={() => nav("/app/cotizaciones/" + v.id)}
                      >
                        Revisar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} setPage={setPage} count={list.data?.length || 0} />
      </section>
    </div>
  );
}
// QuoteDetail permite revisar una propuesta según el contexto público o administrativo.
export function QuoteDetail({ publicView = false }: { publicView?: boolean }) {
  const {user}=useAuth();
  const { id, token } = useParams(),
    endpoint = publicView
      ? "/publico/seguimiento/" + token
      : "/cotizaciones/" + id;
  const load = useLoad(() => api<Quote>(endpoint), [endpoint]),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState(false),
    [items, setItems] = useState<Item[]>([]),
    [expires, setExpires] = useState(today()),
    [query, setQuery] = useState("");
  const products = useLoad(
    () =>
      publicView
        ? Promise.resolve([])
        : api<Product[]>("/productos?q=" + encodeURIComponent(query)),
    [publicView, query],
  );
  const quote = load.data,
    total = quote?.items.reduce((s, i) => s + (i.subtotal || 0), 0) || 0;
  const draftKey=`quote:${user?.id}:${id}`;
  const checkedDraft=useRef("");
  useEffect(()=>{
    if(publicView||!quote||checkedDraft.current===endpoint)return;
    checkedDraft.current=endpoint;
    const draft=readDraft<{revision:number;items:Item[];expires:string}>(draftKey);
    if(!draft)return;
    if(draft.revision===quote.revision && quote.estado!=="convertida"){
      setItems(draft.items);setExpires(draft.expires);setEditing(true);setSuccess("Borrador recuperado de este navegador. Revisa los datos antes de guardar o enviar.");
    }else{clearDraft(draftKey);setSuccess("La cotización cambió. El borrador anterior se descartó para evitar sobrescribir otra revisión.");}
  },[quote,publicView,endpoint,draftKey]);
  useEffect(()=>{
    if(editing&&!publicView&&quote&&!writeDraft(draftKey,{revision:quote.revision,items,expires}))setError("No se pudo guardar el borrador local. Guarda el borrador en el sistema antes de salir.");
  },[editing,publicView,quote,draftKey,items,expires]);
  // Comparte bloqueo, mensajes y recarga tras aceptar, preparar o convertir una propuesta.
  async function action(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await fn();
      setSuccess(message);
      load.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  // Prepara el borrador de edición y adapta artículos antiguos que aún no tenían alternativas.
  function startEdit() {
    if (!quote) return;
    setItems(
      (quote.items.length ? quote.items : (quote.solicitud_items || []).flatMap<Item>(line => [
        ...(line.disponibles > 0 ? [{ producto_id: line.producto_id, nombre: line.nombre, solicitado: line.solicitado, cantidad: line.disponibles, precio: line.precio, disponible: true, presentacion:line.presentacion,contenido:line.contenido,opciones: [{producto_id: line.producto_id, nombre: line.nombre, codigo: "", marca: line.marca, precio: line.precio,presentacion:line.presentacion,contenido:line.contenido}] }] : []),
        ...(line.faltantes > 0 ? [{producto_id: 0, nombre: line.nombre, solicitado: line.solicitado, cantidad: line.faltantes, precio: 0, disponible: false, por_revisar:line.por_revisar, alternativa: line.producto_id ? "Pendiente de reposición" : "Por conseguir"}] : []),
      ])).map((item) => ({
        ...item,
        opciones: item.opciones?.length
          ? item.opciones
          : item.producto_id > 0
            ? [
                {
                  producto_id: item.producto_id,
                  nombre: item.nombre || item.solicitado || "Producto",
                  codigo: item.codigo || "",
                  marca: "",
                  precio: item.precio || 0,
                },
              ]
            : [],
      })),
    );
    setExpires(
      quote.vigencia
        ? new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/Lima",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }).format(new Date(quote.vigencia))
        : today(),
    );
    setEditing(true);
  }
  // Envía referencias de productos y la revisión que se editó; el servidor calcula los precios.
  async function save(send: boolean) {
    await action(
      async () => {
        await api(endpoint, "PUT", {
          items: items.map((item) => ({
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            solicitado: item.solicitado || "",
            alternativa: item.alternativa || "",
            opciones: item.opciones?.map((option) => ({
              producto_id: option.producto_id,
            })),
          })),
          vigencia: expires,
          enviar: send,
          revision: quote?.revision,
        });
        clearDraft(draftKey);
        setEditing(false);
      },
      send
        ? "Propuesta enviada. El enlace privado ya muestra la revisión actual."
        : "Borrador guardado.",
    );
  }
  const delivered=quote?.pedidos.some(p=>p.estado==="entregado");
  const phase=!quote?0:delivered?4:quote.estado==="convertida"?3:quote.estado==="aceptada"?2:quote.estado==="enviada"?1:0;
  const nextStep=quote?({solicitada:publicView?"Recibimos tu lista. La librería está preparando tu propuesta.":"Revisa los útiles y prepara la propuesta.","en preparación":publicView?"La librería está revisando los productos de tu lista.":"Completa la propuesta y envíala al cliente.",enviada:publicView?"Revisa los artículos y acepta la propuesta si estás de acuerdo.":"Espera la respuesta del cliente desde su enlace privado.",aceptada:publicView?"Tu propuesta está aceptada. Coordina el pago con la librería.":"Continúa en el pedido para registrar el pago y preparar la entrega.",convertida:delivered?"Pedido entregado.":publicView?"Pago registrado. Revisa el estado de tu recojo.":"Venta registrada. Continúa con la preparación y el recojo.",rechazada:"Propuesta rechazada. Puedes solicitar una nueva revisión.",vencida:"La propuesta venció. Solicita una nueva revisión."}[quote.estado]||""):"";
  return (
    <div className={publicView ? "quote-tracking" : "quote-review"}>
      <Heading
        title={publicView ? "Seguimiento de tu lista" : "Cotización #" + id}
        action={!publicView && <Link className="btn btn-sm btn-outline-secondary no-print" to="/app/cotizaciones">← Volver a cotizaciones</Link>}
      />
      <Message error={error || load.error} success={success} />
      {load.loading ? (
        <p role="status">Cargando cotización…</p>
      ) : (
        quote && (
          <>
            <ol className="quote-flow" aria-label="Avance de la lista">{["Revisión","Aceptación","Pago","Recojo"].map((label,n)=><li key={label} className={n===phase?"current":n<phase?"complete":""} aria-current={n===phase?"step":undefined}>{label}</li>)}</ol>
            <div className="quote-next"><span>{nextStep}</span></div>
            <div className="quote-review-overview">
            <section className="panel mb-4 quote-info">
              <div className="d-flex justify-content-between gap-2 flex-wrap">
                <div>
                  <h2>{quote.nombre}</h2>
                  <p>{quote.telefono}</p>
                </div>
                <div>
                  <Status value={quote.estado} />
                  <small className="d-block mt-2">
                    Revisión {quote.revision} · Vigencia: {date(quote.vigencia)}
                  </small>
                </div>
              </div>
            {!publicView && quote.estado !== "convertida" && !editing && (
              <button className="btn btn-primary" onClick={startEdit}>
                {["enviada", "aceptada", "rechazada", "vencida"].includes(
                  quote.estado,
                )
                  ? "Crear revisión de la propuesta"
                  : "Preparar propuesta"}
              </button>
            )}
              {quote.adjunto && <div className="quote-attachment"><i className="bi bi-paperclip" aria-hidden="true" /><div><b>{quote.adjunto.nombre}</b><small>{(quote.adjunto.tamano / 1024).toFixed(0)} KB · Lista adjunta</small></div><a href={quote.adjunto.url} className="btn btn-sm btn-outline-primary" download={quote.adjunto.nombre}>Descargar lista</a></div>}
              <details className="quote-source"><summary><i className="bi bi-file-earmark-text" aria-hidden="true" /> Ver lista original</summary><p className="whitespace">{quote.lista}</p></details>
              {quote.observaciones && (
                <p>Observaciones: {quote.observaciones}</p>
              )}
              {quote.presupuesto > 0 && (
                <p>Presupuesto aproximado: {money(quote.presupuesto)}</p>
              )}
              {quote.pedidos.map((p) => (
                <p key={p.id}>
                  Pedido #{p.id}: <Status value={p.estado} />
                  {p.venta_estado==="anulada" ? " · Venta anulada" : p.venta_id ? " · Pago registrado" : " · Pendiente de pago"}
                </p>
              ))}
            </section>
            <QuoteCoverage quote={editing ? { ...quote, items } : quote} />
            </div>
            {editing && (
              <section className="panel mb-4 no-print quote-editor">
                <div className="quote-editor-heading"><h2>Preparar propuesta <span>{items.length} artículos</span></h2><small>Revisa el producto y la cantidad de cada renglón.</small></div>
                <small className="draft-notice d-block mb-2">Borrador guardado automáticamente en este navegador.</small>
                <p className="small text-secondary">Los precios se verifican al guardar. Una nueva revisión requiere la aceptación del cliente.</p>
                <Field label="Buscar producto para agregar">
                  <input
                    className="form-control"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </Field>
                <div className="suggestions quote-product-results">
                  {(query.trim() ? products.data : [])
                    ?.filter((p) => p.activo)
                    .map((p) => (
                      <button
                        key={p.id}
                        data-product-id={p.id}
                        className="btn btn-sm btn-outline-primary"
                        onClick={() =>
                          setItems((v) => [
                            ...v,
                            {
                              producto_id: p.id,
                              cantidad: 1,
                              nombre: p.nombre,
                              presentacion:p.presentacion,contenido:p.contenido,
                              codigo: p.codigo,
                              precio: p.precio,
                              subtotal: p.precio,
                              solicitado: p.nombre,
                              alternativa: "",
                              disponible: true,
                              opciones: [
                                {
                                  producto_id: p.id,
                                  nombre: p.nombre,
                                  codigo: p.codigo,
                                  marca: p.marca,
                                  presentacion:p.presentacion,contenido:p.contenido,
                                  precio: p.precio,
                                },
                              ],
                            },
                          ])
                        }
                      >
                        {p.nombre} · {money(p.precio)} · Stock {p.stock}
                      </button>
                    ))}
                </div>
                <button
                  className="btn btn-outline-secondary my-3"
                  onClick={() =>
                    setItems((v) => [
                      ...v,
                      {
                        producto_id: 0,
                        cantidad: 1,
                        solicitado: "",
                        alternativa: "",
                        disponible: false,
                      },
                    ])
                  }
                >
                  + Artículo no disponible
                </button>
                <fieldset className="quote-lines" disabled={busy}>
                {items.map((it, n) => (
                  <div className="proposal-line" key={n}>
                    <strong>
                      {it.producto_id ? it.nombre : "Sin producto disponible"}
                    </strong>
                    <div className="form-grid">
                      {it.producto_id===0 && <label className="proposal-review-toggle"><input type="checkbox" checked={!!it.por_revisar} onChange={e=>setItems(v=>v.map((x,i)=>i===n?{...x,por_revisar:e.target.checked}:x))} /> Pendiente de elegir marca o presentación</label>}
                      <Field label="Artículo solicitado">
                        <input
                          className="form-control"
                          value={it.solicitado || ""}
                          maxLength={300}
                          onChange={(e) =>
                            setItems((v) =>
                              v.map((x, i) =>
                                i === n
                                  ? { ...x, solicitado: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label={it.presentacion&&it.presentacion!=="unidad"?`Cantidad (${it.presentacion})`:"Cantidad"}>
                        <input
                          aria-label="Cantidad"
                          className="form-control"
                          type="number"
                          min="1"
                          max="1000000"
                          step="1"
                          value={it.cantidad}
                          onChange={(e) =>
                            setItems((v) =>
                              v.map((x, i) =>
                                i === n
                                  ? { ...x, cantidad: Number(e.target.value) }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label="Alternativa elegida para la propuesta">
                        <select
                          className="form-select"
                          value={it.producto_id}
                          onChange={(e) => {
                            const productID = Number(e.target.value),
                              option = it.opciones?.find(
                                (o) => o.producto_id === productID,
                              );
                            setItems((v) =>
                              v.map((x, i) =>
                                i === n
                                  ? {
                                      ...x,
                                      producto_id: productID,
                                      nombre: option?.nombre || x.nombre,
                                      presentacion:option?.presentacion||x.presentacion,contenido:option?.contenido??x.contenido,
                                      disponible: productID > 0,
                                    }
                                  : x,
                              ),
                            );
                          }}
                        >
                          <option value="0">No disponible</option>
                          {!it.opciones?.length && it.producto_id > 0 && (
                            <option value={it.producto_id}>{it.nombre}</option>
                          )}
                          {it.opciones?.map((o) => (
                            <option key={o.producto_id} value={o.producto_id}>
                              {o.nombre} · {o.marca || o.codigo} ·{" "}
                              {money(o.precio)}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <details className="proposal-options">
                      <summary>Alternativas y observaciones {it.opciones && it.opciones.length > 1 ? `(${it.opciones.length})` : ""}</summary>
                      <div className="form-grid">
                      <Field label="Alternativas / marca / motivo">
                        <input
                          className="form-control"
                          value={it.alternativa || ""}
                          maxLength={500}
                          onChange={(e) =>
                            setItems((v) =>
                              v.map((x, i) =>
                                i === n
                                  ? { ...x, alternativa: e.target.value }
                                  : x,
                              ),
                            )
                          }
                        />
                      </Field>
                      <Field label="Agregar alternativa (usa la búsqueda superior)">
                        <select
                          className="form-select"
                          value=""
                          onChange={(e) => {
                            const p = products.data?.find(
                              (p) => p.id === Number(e.target.value),
                            );
                            if (!p) return;
                            setItems((v) =>
                              v.map((x, i) => {
                                if (i !== n) return x;
                                const options = x.opciones || [];
                                if (
                                  options.some((o) => o.producto_id === p.id) ||
                                  options.length >= 10
                                )
                                  return x;
                                const selected = options.length === 0;
                                return {
                                  ...x,
                                  opciones: [
                                    ...options,
                                    {
                                      producto_id: p.id,
                                      nombre: p.nombre,
                                      codigo: p.codigo,
                                      marca: p.marca,
                                  presentacion:p.presentacion,contenido:p.contenido,
                                      precio: p.precio,
                                    },
                                  ],
                                  ...(selected
                                    ? {
                                        producto_id: p.id,
                                        nombre: p.nombre,
                                        presentacion:p.presentacion,contenido:p.contenido,
                                        disponible: true,
                                        opciones: [
                                          {
                                            producto_id: p.id,
                                            nombre: p.nombre,
                                            codigo: p.codigo,
                                            marca: p.marca,
                                  presentacion:p.presentacion,contenido:p.contenido,
                                            precio: p.precio,
                                          },
                                        ],
                                      }
                                    : {}),
                                };
                              }),
                            );
                          }}
                        >
                          <option value="">Seleccionar producto…</option>
                          {products.data
                            ?.filter((p) => p.activo)
                            .map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} · {money(p.precio)}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <div className="proposal-alternatives">
                        {it.opciones?.map((o) => (
                          <div
                            className="d-flex align-items-center gap-2 mb-2"
                            key={o.producto_id}
                          >
                            <span>
                              {o.nombre} · {money(o.precio)}
                            </span>
                            <button
                              className="btn btn-sm btn-outline-secondary"
                              onClick={() =>
                                setItems((v) =>
                                  v.map((x, i) =>
                                    i === n
                                      ? {
                                          ...x,
                                          opciones: x.opciones?.filter(
                                            (candidate) =>
                                              candidate.producto_id !==
                                              o.producto_id,
                                          ),
                                          ...(x.producto_id === o.producto_id
                                            ? {
                                                producto_id: 0,
                                                disponible: false,
                                              }
                                            : {}),
                                        }
                                      : x,
                                  ),
                                )
                              }
                            >
                              Quitar alternativa
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                    </details>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() =>
                        setItems((v) => v.filter((_, i) => i !== n))
                      }
                    >
                      Quitar artículo
                    </button>
                  </div>
                ))}
                </fieldset>
                <div className="proposal-footer">
                <strong className="proposal-total">Total estimado <span>{money(items.reduce((sum,it)=>sum+(it.opciones?.find(o=>o.producto_id===it.producto_id)?.precio ?? it.precio ?? 0)*(it.producto_id?it.cantidad:0),0))}</span></strong>
                <Field label="Vigente hasta (hora de Lima, fin del día)">
                  <input
                    className="form-control"
                    type="date"
                    min={today()}
                    value={expires}
                    onChange={(e) => setExpires(e.target.value)}
                  />
                </Field>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    className="btn btn-outline-primary"
                    onClick={() => save(false)}
                  >
                    Guardar borrador
                  </button>
                  <button
                    disabled={busy}
                    className="btn btn-primary"
                    onClick={() => save(true)}
                  >
                    Enviar propuesta
                  </button>
                  <button
                    className="btn btn-link"
                    onClick={() => {clearDraft(draftKey);setEditing(false);}}
                  >
                    Cancelar
                  </button>
                </div>
                </div>
              </section>
            )}
            {quote.items.length > 0 && !editing && (
              <Document
                title={
                  "Cotización #" + quote.id + " · Revisión " + quote.revision
                }
                items={quote.items}
                total={total}
                extra={[
                  "Vigencia: " + date(quote.vigencia),
                  "Esta propuesta no reserva stock.",
                ]}
              />
            )}
            <div className="panel my-4 no-print quote-actions">
              {publicView && quote.estado === "enviada" && (
                <>
                  <p>Revisa los artículos y alternativas antes de responder.</p>
                  <button
                    disabled={busy}
                    className="btn btn-success me-2"
                    onClick={() =>
                      action(
                        () =>
                          api(endpoint, "POST", {
                            accion: "aceptada",
                            revision: quote.revision,
                          }),
                        "Propuesta aceptada. Puedes coordinar la compra con la librería.",
                      )
                    }
                  >
                    Aceptar propuesta
                  </button>
                  <button
                    disabled={busy}
                    className="btn btn-outline-danger"
                    onClick={() =>
                      action(
                        () =>
                          api(endpoint, "POST", {
                            accion: "rechazada",
                            revision: quote.revision,
                          }),
                        "Propuesta rechazada.",
                      )
                    }
                  >
                    Rechazar
                  </button>
                </>
              )}
              {!publicView && quote.estado === "aceptada" && !quote.pedidos.length && (
                <><h2>Continuar con el pedido</h2><p>La propuesta está aceptada. Crea el pedido para cobrar, preparar y entregar.</p><button disabled={busy} className="btn btn-primary" onClick={()=>action(()=>api("/pedidos","POST",{cotizacion_id:quote.id}),"Pedido de preparación creado sin descontar stock.")}>Crear pedido para recoger</button></>
              )}
              {!publicView && quote.pedidos.length>0 && <div className="d-flex gap-2 flex-wrap">{quote.pedidos.map(p=><Link key={p.id} className="btn btn-primary" to={`/app/pedidos?origen=cotizaciones&pedido=${p.id}`}>Ver pedido #{p.id}</Link>)}</div>}
              {publicView &&
                ["solicitada", "en preparación"].includes(quote.estado) && (
                  <p>
                    Tu solicitud está en revisión. Vuelve a este enlace para
                    consultar la propuesta.
                  </p>
                )}
              {quote.estado === "vencida" && (
                <p>
                  La propuesta venció. Solicita al personal una nueva revisión
                  antes de comprar.
                </p>
              )}
            </div>
          </>
        )
      )}
    </div>
  );
}
