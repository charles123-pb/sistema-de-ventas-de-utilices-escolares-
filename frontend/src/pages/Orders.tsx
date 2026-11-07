import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, date, money } from "../services/api";
import { presentationLabel } from "../lib/product-language";
import type { Item, Quote } from "../types";
import { Empty, Field, Heading, Message, Pager, Status, useLoad } from "../components/UI";

type Source = "cotizaciones" | "catalogo";
interface OrderRow {
  id:number; nombre:string; telefono:string; fecha:string; estado:string; total:number;
  venta_id:number|null; venta_estado:string; cotizacion_id?:number;
}
interface OrderDetail extends OrderRow {
  items:Item[]; observaciones:string; vence?:string; entrega_fecha?:string; entrega_usuario?:string; quote?:Quote;
}
const endpoint=(source:Source)=>source==="catalogo"?"/pedidos-web":"/pedidos";
const isFinal=(state:string)=>["entregado","cancelado","vencido"].includes(state);
const paymentText=(p:OrderRow)=>p.venta_estado==="anulada"?"Venta anulada":p.venta_id?"Pago registrado":"Pendiente de pago";

export default function Orders() {
  const [params,setParams]=useSearchParams();
  const source:Source=params.get("origen")==="catalogo"?"catalogo":"cotizaciones";
  const search=params.get("q")||"",state=params.get("estado")||"";
  const page=Math.max(1,Number(params.get("pagina"))||1),selected=Number(params.get("pedido"))||0;
  const [version,setVersion]=useState(0);
  const returnFocus=useRef<number|null>(null);
  const list=useLoad(()=>api<OrderRow[]>(`${endpoint(source)}?q=${encodeURIComponent(search)}&estado=${encodeURIComponent(state)}&pagina=${page}`),[source,search,state,page,version]);
  useEffect(()=>{
    if(selected||list.loading||returnFocus.current===null)return;
    const button=document.querySelector<HTMLButtonElement>(`[data-order-open="${returnFocus.current}"]`);
    const search=document.querySelector<HTMLInputElement>(".orders-inbox input");
    (button||search)?.focus();returnFocus.current=null;
  },[selected,list.loading,list.data]);
  function filter(key:string,value:string) {
    const next=new URLSearchParams(params);
    if(value)next.set(key,value);else next.delete(key);
    next.delete("pagina");next.delete("pedido");setParams(next,{replace:true});
  }
  function open(id:number) { const next=new URLSearchParams(params);if(id)next.set("pedido",String(id));else next.delete("pedido");setParams(next,{replace:true}); }
  function setPage(n:number) {const next=new URLSearchParams(params);next.set("pagina",String(n));setParams(next);}
  return <div className="orders-workspace">
    <Heading title="Pedidos para recoger" sub="Revisa el pago, prepara los útiles y confirma la entrega." action={<button type="button" className="btn btn-outline-secondary" disabled={list.loading} onClick={()=>setVersion(v=>v+1)}><i className="bi bi-arrow-clockwise" aria-hidden="true" /> Actualizar</button>} />
    <nav className="orders-sources" aria-label="Origen de los pedidos">{[["cotizaciones","De cotizaciones"],["catalogo","Del catálogo"]].map(([value,label])=><button type="button" key={value} aria-pressed={source===value} onClick={()=>filter("origen",value)}>{label}</button>)}</nav>
    <section className="panel orders-inbox">
      <Field label="Buscar pedidos"><input className="form-control" type="search" value={search} placeholder="Número, cliente o teléfono" onChange={e=>filter("q",e.target.value)} /></Field>
      <nav className="order-state-filters" aria-label="Estado de los pedidos">{[["","Todos"],["pendiente","Pendientes"],["preparando","Preparando"],["listo","Listos"],["finalizados","Finalizados"]].map(([value,label])=><button type="button" key={value} aria-pressed={state===value} onClick={()=>filter("estado",value)}>{label}</button>)}</nav>
      <Message error={list.error} />
      {list.loading?<p role="status">Cargando pedidos…</p>:!list.data?.length?<Empty text="No hay pedidos con esos filtros." />:<div className="table-responsive"><table className="table align-middle orders-table"><thead><tr><th>Pedido / fecha</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th>Acción</th></tr></thead><tbody>{list.data.map(p=><tr key={p.id}>
        <td><b>#{p.id}</b><small>{date(p.fecha)}</small></td><td><b>{p.nombre}</b><small>{p.telefono}{p.cotizacion_id?` · Cotización #${p.cotizacion_id}`:""}</small></td><td className="text-nowrap">{money(p.total)}</td><td><span className={p.venta_estado==="anulada"?"text-danger":p.venta_id?"text-success":"text-secondary"}>{paymentText(p)}</span></td><td><Status value={p.estado} /></td><td><button type="button" className="btn btn-sm btn-outline-primary" data-order-open={p.id} onClick={()=>open(p.id)}>Abrir</button></td>
      </tr>)}</tbody></table></div>}
      <Pager page={page} setPage={setPage} count={list.data?.length||0} />
    </section>
    {selected>0&&<OrderDialog key={`${source}:${selected}`} source={source} id={selected} onClose={()=>{returnFocus.current=selected;open(0);}} onChanged={()=>setVersion(v=>v+1)} />}
  </div>;
}

function OrderDialog({source,id,onClose,onChanged}:{source:Source;id:number;onClose:()=>void;onChanged:()=>void}) {
  const dialog=useRef<HTMLDialogElement>(null),trigger=useRef(document.activeElement as HTMLElement|null),pending=useRef(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
  const [paying,setPaying]=useState(false),[payment,setPayment]=useState("efectivo"),[received,setReceived]=useState(""),[verified,setVerified]=useState(false),[code,setCode]=useState(""),[canceling,setCanceling]=useState(false);
  const attempt=useRef({body:"",key:""});
  const load=useLoad(async()=>{
    const order=await api<OrderDetail>(`${endpoint(source)}/${id}`);
    if(source==="cotizaciones") {
      const quote=await api<Quote>(`/cotizaciones/${order.cotizacion_id}`);
      return {...order,items:quote.items,observaciones:quote.observaciones,quote};
    }
    return order;
  },[source,id]);
  const cash=useLoad(()=>api<{cerrada:boolean}>("/caja/estado"),[]);
  const order=load.data;
  const paid=!!order?.venta_id&&order.venta_estado==="activa";
  const valid=source==="catalogo"||!!order?.venta_id||(order?.quote?.estado==="aceptada"&&new Date(order.quote.vigencia).getTime()>Date.now());
  const actionable=!!order&&!isFinal(order.estado)&&order.venta_estado!=="anulada"&&valid;
  useEffect(()=>{dialog.current?.showModal();const previous=trigger.current;return()=>previous?.focus();},[]);
  async function run(action:()=>Promise<unknown>,message:string) {
    if(pending.current)return;pending.current=true;setBusy(true);setError("");setSuccess("");
    try {await action();setSuccess(message);setPaying(false);setCanceling(false);setCode("");load.reload();cash.reload();onChanged();}
    catch(e){setError((e as Error).message);cash.reload();}
    finally{pending.current=false;setBusy(false);}
  }
  function update(state:string) {return run(()=>api(`${endpoint(source)}/${id}`,"PUT",{estado:state,...(source==="catalogo"?{codigo:code}:{})}),state==="entregado"?"Entrega registrada.":"Pedido actualizado.");}
  async function pay(e:FormEvent) {
    e.preventDefault();if(!order||!verified||cash.loading||cash.error||cash.data?.cerrada)return;
    const body={...(source==="catalogo"?{pedido_web_id:id}:{cotizacion_id:order.cotizacion_id,items:[]}),pago:payment,recibido:payment==="efectivo"?received:"0.00"};
    const serialized=JSON.stringify(body);if(attempt.current.body!==serialized)attempt.current={body:serialized,key:crypto.randomUUID()};
    await run(()=>api("/ventas","POST",{...body,clave:attempt.current.key}),"Pago registrado. El stock se actualizó una sola vez.");
  }
  const available=(order?.items||[]).filter(i=>source==="catalogo"||i.disponible);
  const missing=(order?.items||[]).filter(i=>source==="cotizaciones"&&!i.disponible);
  return <dialog ref={dialog} className="order-dialog" aria-labelledby="order-dialog-title" aria-busy={busy} onCancel={e=>{e.preventDefault();if(!pending.current)onClose();}}>
    <header className="order-dialog-heading"><div><small>{source==="catalogo"?"Del catálogo":"De cotización"}</small><h2 id="order-dialog-title">Pedido #{id}</h2></div><button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={onClose} aria-label="Cerrar pedido"><i className="bi bi-x-lg" aria-hidden="true" /></button></header>
    <Message error={error||load.error} success={success} />
    {load.loading?<p role="status">Consultando pedido…</p>:load.error?<button type="button" className="btn btn-outline-primary" onClick={load.reload}>Reintentar pedido</button>:order&&<>
      <section className="order-customer"><div><b>{order.nombre}</b><small>{order.telefono} · {date(order.fecha)}</small></div><Status value={order.estado} /></section>
      <div className="order-payment-status"><strong>{paymentText(order)}</strong>{order.venta_id&&<Link to={`/app/ventas/${order.venta_id}`}>Ver venta #{order.venta_id}</Link>}{order.cotizacion_id&&<Link to={`/app/cotizaciones/${order.cotizacion_id}`}>Ver cotización #{order.cotizacion_id}</Link>}</div>
      <section className="order-items" aria-label="Productos del pedido"><h3>Productos <span>{available.length}</span></h3><div className="table-responsive"><table className="table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>{available.map((i,n)=><tr key={n}><td><b>{i.nombre||i.solicitado}</b><small>{presentationLabel(i)}</small></td><td>{i.cantidad}</td><td className="text-nowrap">{money(i.precio)}</td><td className="text-nowrap">{money(i.subtotal)}</td></tr>)}</tbody></table></div><div className="order-total"><span>Total del pedido</span><strong>{money(order.total)}</strong></div></section>
      {!!missing.length&&<section className="order-missing" aria-label="Faltantes del pedido"><h3>Faltantes · fuera del cobro</h3>{missing.map((i,n)=><p key={n}><b>{i.cantidad} × {i.solicitado||i.nombre}</b>{i.alternativa&&<small>{i.alternativa}</small>}</p>)}</section>}
      {order.observaciones&&<details className="order-notes"><summary>Observaciones</summary><p>{order.observaciones}</p></details>}
      {order.vence&&!order.venta_id&&!isFinal(order.estado)&&<p className="order-footnote">Pago pendiente hasta {date(order.vence)}. El pedido no reserva stock.</p>}
      {!valid&&!isFinal(order.estado)&&<p className="alert alert-warning">La cotización requiere revisión antes de continuar. Abre la cotización para actualizarla.</p>}
      {order.venta_estado==="anulada"&&<p className="alert alert-warning">La venta está anulada. La preparación y entrega están bloqueadas.</p>}
      {source==="cotizaciones"&&order.estado==="cancelado"&&!order.venta_id&&valid&&<section className="order-next-action"><h3>Retomar pedido</h3><p className="order-footnote">La cotización está aceptada y vigente. Puedes retomar la preparación con su revisión actual.</p><button type="button" className="btn btn-outline-primary" disabled={busy} onClick={()=>void update("pendiente")}>Reactivar pedido</button></section>}
      {actionable&&<section className="order-next-action">
        <h3>{paying?"Registrar pago":"Continuar pedido"}</h3>
        {paying?<form onSubmit={pay} className="order-payment-form"><fieldset disabled={busy}>
          <div className="form-grid"><Field label="Medio de pago del pedido"><select className="form-select" value={payment} onChange={e=>{setPayment(e.target.value);setVerified(false);}}>{["efectivo","yape","plin","transferencia"].map(m=><option key={m}>{m}</option>)}</select></Field>{payment==="efectivo"&&<Field label="Efectivo recibido del pedido (S/)"><input className="form-control" inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" required value={received} onChange={e=>setReceived(e.target.value)} /></Field>}</div>
          <label className="order-payment-confirm"><input type="checkbox" required checked={verified} onChange={e=>setVerified(e.target.checked)} />Confirmo que cobré el efectivo o verifiqué el abono en la cuenta de la tienda.</label>
          {(cash.error||cash.data?.cerrada)&&<p className="text-danger small">{cash.data?.cerrada?"La caja está cerrada. El administrador debe reabrirla para cobrar.":"No se pudo consultar la caja."} <button type="button" className="btn btn-sm btn-link" onClick={cash.reload}>Actualizar estado de caja</button></p>}
          <div className="order-action-buttons"><button className="btn btn-primary" disabled={busy||!verified||cash.loading||!!cash.error||cash.data?.cerrada}>Confirmar pago del pedido</button><button type="button" className="btn btn-outline-secondary" onClick={()=>setPaying(false)}>Volver al pedido</button></div>
        </fieldset></form>:<>
          <div className="order-action-buttons">
            {!order.venta_id&&<button type="button" className="btn btn-primary" disabled={busy} onClick={()=>{setPaying(true);setVerified(false);setError("");cash.reload();}}>Registrar pago</button>}
            {order.estado==="pendiente"&&<button type="button" className="btn btn-outline-primary" disabled={busy} onClick={()=>void update("preparando")}>Preparar pedido</button>}
            {order.estado==="preparando"&&<button type="button" className="btn btn-outline-primary" disabled={busy} onClick={()=>void update("listo")}>Marcar listo</button>}
            {order.estado==="listo"&&source==="cotizaciones"&&<button type="button" className="btn btn-primary" disabled={busy||!paid} onClick={()=>void update("entregado")}>Entregar pedido</button>}
            {!order.venta_id&&<button type="button" className="btn btn-link text-danger" disabled={busy} onClick={()=>setCanceling(true)}>Cancelar pedido</button>}
          </div>
          {order.estado==="listo"&&!paid&&<p className="order-footnote">Registra el pago antes de entregar.</p>}
          {order.estado==="listo"&&paid&&source==="catalogo"&&<form className="order-pickup" onSubmit={e=>{e.preventDefault();void update("entregado");}}><fieldset disabled={busy}><Field label="Código de recojo"><input className="form-control" value={code} onChange={e=>setCode(e.target.value)} required minLength={10} maxLength={10} autoComplete="off" /></Field><button className="btn btn-primary">Entregar pedido</button></fieldset></form>}
          {canceling&&<div className="order-cancel-confirm"><p>¿Cancelar este pedido sin pago?</p><button type="button" className="btn btn-outline-danger" disabled={busy} onClick={()=>void update("cancelado")}>Confirmar cancelación</button><button type="button" className="btn btn-link" disabled={busy} onClick={()=>setCanceling(false)}>Conservar pedido</button></div>}
        </>}
      </section>}
      {order.entrega_fecha&&<p className="order-footnote">Entregó {order.entrega_usuario} · {date(order.entrega_fecha)}</p>}
    </>}
    <div className="order-dialog-footer"><button type="button" className="btn btn-outline-secondary" disabled={busy} onClick={onClose}>Volver a pedidos</button></div>
  </dialog>;
}
