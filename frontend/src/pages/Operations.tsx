import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, cents, date, money, today } from "../services/api";
import { StockEntryDialog } from "../components/StockEntryDialog";
import { Empty, Field, Heading, Message, Pager, Status, useLoad } from "../components/UI";
import type { Sale, SupplierOption } from "../types";

export function SalesHistory() {
  const [from,setFrom]=useState(today()),[to,setTo]=useState(today()),[q,setQ]=useState(""),[state,setState]=useState(""),[page,setPage]=useState(1);
  const list=useLoad(()=>api<any[]>(`/ventas?desde=${from}&hasta=${to}&q=${encodeURIComponent(q)}&estado=${state}&pagina=${page}`),[from,to,q,state,page]);
  return <div className="operations"><Heading title="Historial de ventas" sub="Consulta el detalle. Las anulaciones conservan la venta y su motivo." />
    <section className="panel mb-3"><div className="form-grid">
      <Field label="Buscar venta, cliente o vendedor"><input className="form-control" value={q} onChange={e=>{setQ(e.target.value);setPage(1);}} placeholder="Número, nombre o documento" /></Field>
      <Field label="Desde"><input className="form-control" type="date" value={from} onChange={e=>{setFrom(e.target.value);setPage(1);}} /></Field>
      <Field label="Hasta"><input className="form-control" type="date" min={from} value={to} onChange={e=>{setTo(e.target.value);setPage(1);}} /></Field>
      <Field label="Estado"><select className="form-select" value={state} onChange={e=>{setState(e.target.value);setPage(1);}}><option value="">Todas las ventas</option><option value="activa">Activas</option><option value="anulada">Anuladas</option></select></Field>
    </div></section><Message error={list.error} />
    <section className="panel">{list.loading?<p>Cargando ventas…</p>:!list.data?.length?<Empty text="No hay ventas con esos filtros." />:<div className="table-responsive"><table className="table align-middle"><thead><tr><th>Venta / fecha</th><th>Cliente</th><th>Vendedor</th><th>Pago</th><th>Total</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>{list.data.map(v=><tr key={v.id}><td><b>#{v.id}</b><small className="d-block text-secondary">{date(v.fecha)}</small></td><td>{v.cliente}</td><td>{v.vendedor}</td><td>{v.pago}</td><td>{money(v.total)}</td><td><Status value={v.estado} /></td><td><Link className="btn btn-sm btn-outline-primary" to={`/app/ventas/${v.id}`}>Ver venta</Link></td></tr>)}</tbody></table></div>}<Pager page={page} setPage={setPage} count={list.data?.length||0} /></section>
  </div>;
}

export function SaleCancellation({sale,reload}:{sale:Sale;reload:()=>void}) {
  const [open,setOpen]=useState(false),[reason,setReason]=useState(""),[returned,setReturned]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  async function cancel(e:FormEvent){e.preventDefault();setBusy(true);setError("");try{await api(`/ventas/${sale.id}/anular`,"POST",{motivo:reason,productos_devueltos:returned});setOpen(false);reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="panel mt-3 no-print"><h2>Control del administrador</h2><p className="small text-secondary">Anular devuelve los productos al inventario y excluye esta venta de los totales vigentes. El registro original se conserva.</p><Message error={error} />
    {!open?<button className="btn btn-outline-danger" onClick={()=>setOpen(true)}>Anular venta</button>:<form onSubmit={cancel}><Field label="Motivo de anulación"><textarea className="form-control" value={reason} onChange={e=>setReason(e.target.value)} required minLength={5} maxLength={500} rows={2} disabled={busy} /></Field>
      <label className="d-flex gap-2 align-items-start small mb-3"><input type="checkbox" required checked={returned} onChange={e=>setReturned(e.target.checked)} disabled={busy} />Confirmo que los productos no se entregaron o ya fueron devueltos.</label>
      <div className="d-flex gap-2"><button className="btn btn-danger" disabled={busy||!returned||reason.trim().length<5}>{busy?"Anulando…":"Confirmar anulación"}</button><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={()=>setOpen(false)}>Cancelar</button></div>
    </form>}
  </section>;
}

export function CashClosing({onChanged,onBusyChange}:{onChanged:()=>void;onBusyChange:(busy:boolean)=>void}){
  const [day,setDay]=useState(today()),[form,setForm]=useState({fondo_inicial:"0.00",gastos:"0.00",retiros:"0.00",contado:"0.00",observaciones:""}),[reason,setReason]=useState(""),[reopening,setReopening]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const load=useLoad(()=>api<any>(`/cierres-caja?dia=${day}`),[day]);
  const totals=load.data?.totales,closed=load.data?.cierres.find((c:any)=>!c.reapertura_fecha);
  let expected=0,difference=0;try{expected=cents(form.fondo_inicial)+(totals?.efectivo||0)-cents(form.gastos)-cents(form.retiros);difference=cents(form.contado)-expected;}catch{/* Inputs are validated on submit. */}
  async function close(e:FormEvent){e.preventDefault();if(busy)return;setBusy(true);onBusyChange(true);setError("");setSuccess("");try{await api("/cierres-caja","POST",{dia:day,...form});setSuccess("Caja cerrada. El resumen y el responsable quedaron guardados.");load.reload();onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);onBusyChange(false);}}
  async function reopen(e:FormEvent){e.preventDefault();if(busy||!closed)return;setBusy(true);onBusyChange(true);setError("");try{await api("/cierres-caja/reabrir","POST",{id:closed.id,motivo:reason});setReopening(false);setReason("");setSuccess("Caja reabierta. El cierre anterior se conserva en el historial.");load.reload();onChanged();}catch(e){setError((e as Error).message);}finally{setBusy(false);onBusyChange(false);}}
  return <div className="operations"><p className="small text-secondary">Cuenta el efectivo disponible. Los pagos digitales se muestran por separado.</p>
    <section className="panel mb-3"><Field label="Día de caja"><input className="form-control" style={{maxWidth:240}} type="date" max={today()} value={day} disabled={busy} onChange={e=>{setDay(e.target.value);setSuccess("");setError("");setReopening(false);setForm({fondo_inicial:"0.00",gastos:"0.00",retiros:"0.00",contado:"0.00",observaciones:""});}} /></Field></section>
    <Message error={error||load.error} success={success} />
    {load.loading?<p>Cargando caja…</p>:totals&&<><div className="operation-metrics">{([['Efectivo',totals.efectivo],['Yape',totals.yape],['Plin',totals.plin],['Transferencia',totals.transferencia]] as [string,number][]).map(([name,value])=><section className="panel" key={name}><small>{name}</small><strong>{money(value)}</strong></section>)}</div>
      <section className="panel mb-3"><div className="d-flex justify-content-between gap-2 flex-wrap"><h2>{closed?"Caja cerrada":"Registrar cierre"}</h2><small>{totals.ventas} ventas activas</small></div>
        {closed?<><p>Cerrada por <b>{closed.usuario}</b> · {date(closed.fecha)}</p><p>Efectivo esperado: <b>{money(closed.esperado)}</b> · Contado: <b>{money(closed.contado)}</b> · Diferencia: <b>{money(closed.diferencia)}</b></p><p className="small">Fondo inicial: {money(closed.fondo_inicial)} · Gastos: {money(closed.gastos)} · Retiros: {money(closed.retiros)}</p>{closed.observaciones&&<p>{closed.observaciones}</p>}
          {!reopening?<button className="btn btn-outline-primary" onClick={()=>setReopening(true)}>Reabrir caja</button>:<form onSubmit={reopen}><Field label="Motivo de reapertura"><input className="form-control" required minLength={5} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} /></Field><button className="btn btn-primary" disabled={busy}>Confirmar reapertura</button><button type="button" className="btn btn-link" disabled={busy} onClick={()=>setReopening(false)}>Cancelar</button></form>}
        </>:<form onSubmit={close}><fieldset disabled={busy}><div className="form-grid">{([['fondo_inicial','Fondo inicial (S/)'],['gastos','Gastos en efectivo (S/)'],['retiros','Retiros en efectivo (S/)'],['contado','Efectivo contado (S/)']] as const).map(([key,label])=><Field key={key} label={label}><input className="form-control" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})} /></Field>)}</div>
          <Field label="Observaciones del cierre"><textarea className="form-control" rows={2} maxLength={1000} required={difference!==0} value={form.observaciones} onChange={e=>setForm({...form,observaciones:e.target.value})} /></Field>
          <div className="cash-balance"><span>Esperado: <b>{money(expected)}</b></span><span>Diferencia: <b>{money(difference)}</b></span></div><p className="small text-secondary">Esperado = fondo inicial + ventas en efectivo − gastos − retiros. Al cerrar se bloquean nuevas ventas y anulaciones de ese día hasta reabrirlo.</p><button className="btn btn-primary" disabled={busy||!day}>{busy?"Guardando…":"Confirmar cierre"}</button>
        </fieldset></form>}
      </section>
      <details className="cash-closing-history" open={!!success}><summary>Historial de cierres del día ({load.data.cierres.length})</summary><section className="panel">{!load.data.cierres.length?<Empty text="Todavía no hay cierres guardados para esta fecha." />:<div className="table-responsive"><table className="table"><thead><tr><th>Registro</th><th>Responsable</th><th>Esperado / contado</th><th>Diferencia</th><th>Estado</th></tr></thead><tbody>{load.data.cierres.map((c:any)=><tr key={c.id}><td>#{c.id}<small className="d-block">{date(c.fecha)}</small></td><td>{c.usuario}</td><td>{money(c.esperado)} / {money(c.contado)}</td><td>{money(c.diferencia)}</td><td>{c.reapertura_fecha?<><b>Reabierta</b><small className="d-block">{c.reapertura_usuario} · {date(c.reapertura_fecha)}</small><small className="d-block">{c.reapertura_motivo}</small></>:"Cerrada"}</td></tr>)}</tbody></table></div>}</section></details>
    </>}
  </div>;
}

export function Replenishment({embedded=false,onChanged}:{embedded?:boolean;onChanged?:()=>void}){
  const [entry,setEntry]=useState<{id:number;quantity:number}|null>(null),[success,setSuccess]=useState("");
  const entryFocus=useRef<number|null>(null);
  const [params,setParams]=useSearchParams();
  const [q,setQ]=useState("");const supplier=params.get("proveedor")||"";
  function setSupplier(value:string){const next=new URLSearchParams(params);if(value)next.set("proveedor",value);else next.delete("proveedor");setParams(next,{replace:true});}
  const query=`q=${encodeURIComponent(q)}&proveedor=${supplier}`;
  const load=useLoad(()=>api<any[]>(`/reposicion?${query}`),[query]),suppliers=useLoad(()=>api<SupplierOption[]>("/proveedores?opciones=1"),[]);
  useEffect(()=>{
    if(entryFocus.current===null||load.loading)return;
    const button=document.querySelector<HTMLButtonElement>(`[data-replenish-entry="${entryFocus.current}"]`);
    const search=document.querySelector<HTMLInputElement>(".replenishment-search input");
    (button||search)?.focus();entryFocus.current=null;
  },[load.loading,load.data]);
  const groups=new Map<string,any[]>();for(const p of load.data||[]){const key=p.proveedor;groups.set(key,[...(groups.get(key)||[]),p]);}
  return <div className="operations">{embedded?<div className="section-toolbar"><h2>Reposición por proveedor</h2><a className="btn btn-outline-primary" href={`/api/reposicion?${query}&csv=1`}>Descargar pedido CSV</a></div>:<Heading title="Reposición por proveedor" sub="Productos en su mínimo o por debajo. La cantidad sugerida permite superar el mínimo configurado." action={<a className="btn btn-primary" href={`/api/reposicion?${query}&csv=1`}>Descargar pedido CSV</a>} />}
    <section className="panel mb-3 replenishment-search"><div className="form-grid"><Field label="Buscar producto o marca"><input className="form-control" value={q} onChange={e=>setQ(e.target.value)} /></Field><Field label="Proveedor"><select className="form-select" value={supplier} onChange={e=>setSupplier(e.target.value)}><option value="">Todos los proveedores</option><option value="0">Sin proveedor asignado</option>{suppliers.data?.map(s=><option key={s.id} value={s.id}>{s.nombre}</option>)}</select></Field></div><small>Hasta 10 000 productos. Exportar no registra una compra ni cambia el stock.</small></section>
    {entry&&<StockEntryDialog productId={entry.id} initialQuantity={entry.quantity} onClose={()=>setEntry(null)} onSaved={()=>{entryFocus.current=entry.id;setEntry(null);setSuccess("Entrada registrada. Reposición actualizada.");load.reload();onChanged?.();}} />}
    <Message error={load.error||suppliers.error} success={success} />{load.loading?<p>Cargando reposición…</p>:!groups.size?<section className="panel"><Empty text="No hay productos pendientes con esos filtros." /></section>:[...groups].map(([name,products])=><section className="panel mb-3" key={name}><h2>{name}</h2><p className="small text-secondary">{products[0].telefono||"Sin teléfono registrado"}{products[0].proveedor_id>0&&!products[0].proveedor_activo?" · Proveedor inactivo: revisa la asignación":""}</p><div className="table-responsive"><table className="table"><thead><tr><th>Marca</th><th>Producto</th><th>Stock</th><th>Mínimo</th><th>Sugerido</th><th>Costo estimado</th><th>Acción</th></tr></thead><tbody>{products.map(p=><tr key={p.id}><td>{p.marca||"Sin marca"}</td><td>{p.nombre}<small className="d-block text-secondary">{p.codigo}</small></td><td>{p.stock}</td><td>{p.stock_minimo}</td><td><b>{p.cantidad_sugerida}</b></td><td>{money(p.cantidad_sugerida*p.costo)}</td><td><button type="button" className="btn btn-sm btn-outline-primary" data-replenish-entry={p.id} onClick={()=>{setEntry({id:p.id,quantity:p.cantidad_sugerida});setSuccess("");}}>Registrar entrada</button></td></tr>)}</tbody></table></div></section>)}
  </div>;
}

export function Backups(){
  const load=useLoad(()=>api<any[]>("/respaldos"),[]),[busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  async function create(){setBusy(true);setError("");setSuccess("");try{await api("/respaldos","POST",{});setSuccess("Respaldo completo creado. Ya puedes descargarlo.");load.reload();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <div className="operations"><Heading title="Respaldos" sub="Copias completas de la base de datos, disponibles solo para el administrador." action={<button className="btn btn-primary" disabled={busy} onClick={create}>{busy?"Creando respaldo…":"Crear respaldo"}</button>} />
    <Message error={error||load.error} success={success} /><section className="panel mb-3"><h2>Último respaldo</h2><p>{load.data?.length?date(load.data[0].fecha):"Todavía no se han creado respaldos desde este panel."}</p><small>Descarga una copia y guárdala en otro equipo o unidad. La copia contiene clientes y cuentas del personal. La restauración se realiza siguiendo el procedimiento del proyecto, sin sobrescribir la base en uso.</small></section>
    <section className="panel">{load.loading?<p>Cargando respaldos…</p>:!load.data?.length?<Empty text="Crea tu primer respaldo." />:<div className="table-responsive"><table className="table align-middle"><thead><tr><th>Archivo</th><th>Fecha</th><th>Tamaño</th><th>Descargar</th></tr></thead><tbody>{load.data.map(b=><tr key={b.nombre}><td className="text-break">{b.nombre}</td><td>{date(b.fecha)}</td><td>{(b.tamano/1024/1024).toFixed(2)} MB</td><td><a className="btn btn-sm btn-outline-primary" href={b.url} download>Descargar respaldo</a></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
