import { Link, useParams } from "react-router-dom";
import { api, date, money } from "../services/api";
import { useStore } from "../context/Store";
import { Heading, Message, Status, useLoad } from "../components/UI";
import type { Item } from "../types";
export interface WebOrder {id:number;nombre:string;telefono:string;observaciones:string;items:Item[];total:number;estado:string;fecha:string;vence:string;venta_id:number|null;venta_estado:string;codigo_recojo?:string;entrega_fecha:string;entrega_usuario?:string;}
function OrderItems({order}:{order:WebOrder}){return <ul className="web-order-items">{order.items.map(i=><li key={i.producto_id}><span>{i.cantidad} × {i.nombre}</span><b>{money(i.subtotal)}</b></li>)}</ul>;}
export function OrderTracking(){
 const {token}=useParams();const load=useLoad(()=>api<WebOrder>("/publico/pedidos/"+token),[token]);const {store}=useStore();const p=load.data;
 return <div className="web-order-tracking"><Heading title="Seguimiento de tu pedido" action={<button className="btn btn-outline-primary" onClick={load.reload} disabled={load.loading}>Actualizar estado</button>} /><Message error={load.error} />{load.loading?<p role="status">Consultando pedido…</p>:p&&<section className="panel"><div className="d-flex justify-content-between"><h2>Pedido #{p.id}</h2><Status value={p.estado} /></div><p>{p.nombre}</p><OrderItems order={p} /><div className="total-line"><span>Total</span><strong>{money(p.total)}</strong></div><p>{p.venta_estado==="anulada"?"Venta anulada":p.venta_id?"Pago registrado por el personal":"Pendiente de pago"}</p>
  {p.codigo_recojo&&<div className="pickup-code"><span>Código de recojo</span><strong>{p.codigo_recojo}</strong><small>Muéstralo al recoger. Es privado y de un solo uso.</small></div>}
  {!p.venta_id&&p.estado!=="vencido"&&p.estado!=="cancelado"&&<p className="small text-secondary">Paga antes del {date(p.vence)}. El pedido no reserva existencias.</p>}
  {p.estado==="vencido"&&<p>El pedido venció sin pago. Puedes crear otro desde el catálogo.</p>}
  {p.estado==="listo"&&<p className="alert alert-success">Tu pedido está listo para recoger. La entrega requiere el pago registrado.</p>}
  {p.entrega_fecha&&<p>Entregado el {date(p.entrega_fecha)}.</p>}
  {p.observaciones&&<p>Nota: {p.observaciones}</p>}
  {(store.direccion||store.horario||store.telefono)&&<address className="pickup-address"><b>{store.nombre}</b>{store.direccion&&<span>{store.direccion}</span>}{store.horario&&<span>{store.horario}</span>}{store.telefono&&<span>{store.telefono}</span>}</address>}
  <p className="request-footnote">Guarda este enlace privado para consultar tu pedido.</p><Link to="/catalogo" className="btn btn-outline-primary">Volver al catálogo</Link>
 </section>}</div>;
}
