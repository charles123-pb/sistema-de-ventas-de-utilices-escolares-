import { useState, type FormEvent } from "react";
import { api, date } from "../services/api";
import { Field, Heading, Message, useLoad } from "../components/UI";
import { useStore, type StoreSettings } from "../context/Store";
export default function Settings(){
 const load=useLoad(()=>api<StoreSettings>("/configuracion"),[]);
 const {refresh}=useStore();const [busy,setBusy]=useState(false),[error,setError]=useState(""),[success,setSuccess]=useState("");
 async function save(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);setBusy(true);setError("");setSuccess("");try{
  await api("/configuracion","PUT",{nombre:f.get("nombre"),direccion:f.get("direccion"),telefono:f.get("telefono"),horario:f.get("horario"),logo:f.get("logo"),pedido_horas:Number(f.get("pedido_horas")),respaldo_automatico:f.get("respaldo_automatico")==="on",respaldo_horas:Number(f.get("respaldo_horas"))});
  await refresh();load.reload();setSuccess("Configuración guardada.");
 }catch(e){setError((e as Error).message);}finally{setBusy(false);}}
 const s=load.data;
 return <><Heading title="Configuración del negocio" /><Message error={error||load.error} success={success} />{load.loading?<p>Cargando configuración…</p>:s&&<form className="panel" onSubmit={save} key={JSON.stringify(s)}><fieldset disabled={busy}>
  <h2>Datos de la tienda</h2><div className="form-grid">
   <Field label="Nombre comercial"><input className="form-control" name="nombre" required minLength={2} maxLength={150} defaultValue={s.nombre} /></Field>
   <Field label="Teléfono de la tienda"><input className="form-control" name="telefono" type="tel" maxLength={30} defaultValue={s.telefono} /></Field>
   <Field label="Dirección de recojo"><input className="form-control" name="direccion" maxLength={300} defaultValue={s.direccion} /></Field>
   <Field label="Horario de atención"><input className="form-control" name="horario" maxLength={300} defaultValue={s.horario} /></Field>
   <Field label="Logo (ruta local o URL HTTPS)"><input className="form-control" name="logo" maxLength={1000} defaultValue={s.logo} placeholder="/productos/logo.png" /></Field>
   <Field label="Vigencia del pedido sin pago (horas)"><input className="form-control" name="pedido_horas" type="number" min={1} max={72} required defaultValue={s.pedido_horas} /></Field>
  </div><h2 className="mt-4">Respaldos automáticos</h2>
  <label className="d-flex align-items-center gap-2 mb-3"><input type="checkbox" name="respaldo_automatico" defaultChecked={s.respaldo_automatico} /> Activar respaldos automáticos</label>
  <Field label="Intervalo de respaldo (horas)"><input className="form-control" style={{maxWidth:220}} name="respaldo_horas" type="number" min={1} max={168} required defaultValue={s.respaldo_horas} /></Field>
  <p className="small text-secondary">Se ejecutan mientras el servidor esté encendido. Guarda también una copia fuera del equipo.</p>
  <p className="small">Último respaldo: {date(s.ultimo_respaldo||"")}</p><Message error={s.respaldo_error} />
  <button className="btn btn-primary" disabled={busy}>{busy?"Guardando…":"Guardar configuración"}</button>
 </fieldset></form>}</>;
}
