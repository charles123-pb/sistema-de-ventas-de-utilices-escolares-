import { useState } from "react";
import { Link, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { api, date, money } from "../services/api";
import type { Product } from "../types";
import { Empty, Field, Heading, Message, Pager, ProductImage, useLoad } from "../components/UI";
import { presentationLabel } from "../lib/product-language";
import { Replenishment } from "./Operations";
export function StockLegacy({tab}:{tab?:string}){const {search}=useLocation();const params=new URLSearchParams(search);if(tab)params.set("tab",tab);return <Navigate replace to={"/app/stock"+(params.size?"?"+params:"")} />;}
export default function Stock(){
 const [params,setParams]=useSearchParams();const tab=["historial","reposicion"].includes(params.get("tab")||"")?params.get("tab")!:"historial";
 const product=params.get("producto")||"";const page=Math.max(1,Number(params.get("pagina"))||1);
 function choose(id:string){const next=new URLSearchParams(params);if(id)next.set("producto",id);else next.delete("producto");next.delete("pagina");next.delete("cantidad");next.delete("proveedor");setParams(next);}
 function setPage(n:number){const next=new URLSearchParams(params);next.set("pagina",String(n));setParams(next);}
 function switchTab(value:string){const next=new URLSearchParams(params);next.set("tab",value);next.delete("pagina");setParams(next);}
 const [q,setQ]=useState("");
 const products=useLoad(()=>api<Product[]>("/productos?q="+encodeURIComponent(q)),[q]);
 const selected=useLoad(()=>product?api<Product[]>("/productos?id="+encodeURIComponent(product)):Promise.resolve([]),[product]);
 const moves=useLoad(()=>api<any[]>(`/movimientos?producto_id=${encodeURIComponent(product)}&pagina=${page}`),[product,page]);
 const chosen=selected.data?.find(p=>String(p.id)===product);
 const choices=products.data||[];const selectedOutside=chosen&&!choices.some(p=>p.id===chosen.id);
 return <div className="stock-workspace"><Heading title="Control de inventario" />
 <nav className="stock-tabs" aria-label="Secciones de control de inventario">{[["historial","Historial","clock-history"],["reposicion","Reposición","truck"]].map(([value,label,icon])=><button type="button" key={value} className={tab===value?"selected":""} aria-pressed={tab===value} onClick={()=>switchTab(value)}><i className={"bi bi-"+icon} aria-hidden="true" />{label}</button>)}</nav>
 <div hidden={tab==="reposicion"}>
 <Message error={products.error||selected.error} />
 <section className="panel stock-product-picker mb-3"><div className="form-grid"><Field label="Buscar producto"><input className="form-control" placeholder="Nombre, código o marca…" value={q} onChange={e=>setQ(e.target.value)} /></Field><Field label="Producto"><select className="form-select" value={product} onChange={e=>choose(e.target.value)}><option value="">{tab==="historial"?"Todos los productos":"Selecciona un producto"}</option>{selectedOutside&&<option value={chosen.id}>{chosen.nombre} · {chosen.codigo}</option>}{choices.map(p=><option key={p.id} value={p.id}>{p.nombre} · {p.codigo}</option>)}</select></Field></div>
 {product&&selected.loading?<p role="status" className="small">Consultando producto…</p>:chosen?<div className="stock-selected-product"><ProductImage src={chosen.imagen} name={chosen.nombre} category={chosen.categoria} /><div><b>{chosen.codigo} · {presentationLabel(chosen)}</b><small>Stock: <strong>{chosen.stock}</strong> · Costo promedio: <strong>{money(chosen.costo)}</strong>{!chosen.activo?" · Inactivo":""}</small></div><Link to={"/app/productos?id="+chosen.id} className="btn btn-sm btn-outline-secondary">Ver ficha</Link></div>:product&&!selected.error?<p className="small text-danger">El producto seleccionado no existe.</p>:null}

 </section>
 <section className="panel" hidden={tab!=="historial"}><h2>Historial de movimientos</h2><Message error={moves.error} />{moves.loading?<p role="status">Cargando historial…</p>:!moves.data?.length?<Empty text="No hay movimientos con este filtro." />:<div className="table-responsive"><table className="table"><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th><th>Proveedor / comprobante</th><th>Usuario / referencia</th></tr></thead><tbody>{moves.data.map(m=><tr key={m.id}><td>{date(m.fecha)}</td><td>{m.producto}</td><td>{m.tipo}</td><td>{m.cantidad}</td><td>{m.motivo}</td><td>{m.proveedor||"—"}<small className="d-block text-secondary">{m.comprobante}</small></td><td>{m.usuario}{m.venta_id?" · Venta #"+m.venta_id:""}</td></tr>)}</tbody></table></div>}<Pager page={page} setPage={setPage} count={moves.data?.length||0} /></section>
 </div>
 {tab==="reposicion"&&<Replenishment embedded onChanged={()=>{selected.reload();products.reload();moves.reload();}} />}
 </div>;
}
