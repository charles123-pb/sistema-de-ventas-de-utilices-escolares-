import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../services/api";
import { Field, Message } from "./UI";
import { writeDraft, useStoredState } from "../lib/drafts";
import { useStore } from "../context/Store";
import type { SchoolCart } from "./SchoolRequest";
export function DirectCheckout({cart,blocked,partial,onComplete,onBusyChange}:{cart:SchoolCart;blocked:boolean;partial:boolean;onComplete:(items:SchoolCart)=>void;onBusyChange:(busy:boolean)=>void}){
 const {store}=useStore();const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [contact,setContact,,storageError]=useStoredState("direct-contact",{nombre:"",telefono:""});
 const [attempt,setAttempt,,attemptError]=useStoredState<{clave:string;body:string}|null>("direct-attempt",null);
 const [saved,setSaved,,savedError]=useStoredState<{enlace:string;codigo_recojo:string}|null>("direct-last-order",null);
 const [acceptedSelection,setAcceptedSelection]=useState("");
 const selection=JSON.stringify(cart.map(i=>[i.p.id,i.cantidad]));
 const accepted=!partial||acceptedSelection===selection;
 const total=cart.reduce((n,i)=>n+i.cantidad*i.p.precio,0);
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();if(blocked||!cart.length||!accepted)return;setBusy(true);onBusyChange(true);setError("");const f=new FormData(e.currentTarget);
  const body={nombre:String(f.get("nombre")||"").trim(),telefono:String(f.get("telefono")||"").trim(),observaciones:String(f.get("observaciones")||"").trim(),items:cart.map(i=>({producto_id:i.p.id,cantidad:i.cantidad}))};
  const serialized=JSON.stringify(body);const key=attempt?.body===serialized?attempt.clave:crypto.randomUUID();setAttempt({clave:key,body:serialized});
  try{const result=await api<{enlace:string;codigo_recojo:string}>("/publico/pedidos","POST",{...body,clave:key});writeDraft("direct-last-order",result);setSaved(result);setAttempt(null);setContact({nombre:body.nombre,telefono:body.telefono});onComplete(cart);setAcceptedSelection("");setOpen(false);}catch(e){setError((e as Error).message);}finally{setBusy(false);onBusyChange(false);}
 }
 return <section className="direct-checkout">
  <h3>¿Ya elegiste tus productos?</h3>
  {saved&&<div className="direct-last-order"><Link to={saved.enlace}>Ver mi último pedido <i className="bi bi-arrow-right" aria-hidden="true" /></Link></div>}
  <Message error={error||storageError||attemptError||savedError} />
  {partial&&!!cart.length&&<label className="direct-partial"><input type="checkbox" checked={acceptedSelection===selection} onChange={e=>setAcceptedSelection(e.target.checked?selection:"")} disabled={busy} /><span>Pedir solo los disponibles<small>Los faltantes quedan en tu lista para cotizarlos.</small></span></label>}
  {!open?<><button type="button" className="btn btn-primary w-100" disabled={!cart.length||blocked||!accepted} onClick={()=>{setOpen(true);setError("");}}>Hacer pedido directo</button>{blocked&&<p className="request-footnote">Pulsa «Revisar mi lista» para actualizar los productos antes de pedir.</p>}</>:<form onSubmit={submit}><fieldset disabled={busy}>
   <div className="request-contact"><Field label="Nombre para el pedido"><input className="form-control" name="nombre" autoComplete="name" required minLength={2} maxLength={150} defaultValue={contact.nombre} /></Field><Field label="Teléfono para el pedido"><input className="form-control" name="telefono" type="tel" autoComplete="tel" required pattern="[0-9+() -]{9,30}" maxLength={30} defaultValue={contact.telefono} /></Field></div>
   <Field label="Nota del pedido (opcional)"><textarea className="form-control" name="observaciones" maxLength={500} rows={2} /></Field>
   <p className="request-footnote">{cart.reduce((sum,i)=>sum+i.cantidad,0)} unidades de {cart.length} productos disponibles.</p>
   <div className="request-total"><span>Total del pedido</span><strong>{money(total)}</strong></div>
   <p className="request-footnote">Pago al recoger o abono verificado por el personal. Sin reserva de stock. Vence en {store.pedido_horas} h si no se paga. El servidor confirma precios y disponibilidad al enviar.</p>
   <button className="btn btn-primary w-100" disabled={busy||!cart.length||blocked||!accepted}>{busy?"Confirmando…":"Confirmar pedido"}</button><button type="button" className="btn btn-link w-100" onClick={()=>setOpen(false)}>Volver a mi lista</button>
  </fieldset></form>}
 </section>;
}
