import { DirectCheckout } from "./DirectCheckout";
import { ChangeEvent, Dispatch, FormEvent, SetStateAction, useState } from "react";
import { Link } from "react-router-dom";
import { api, money } from "../services/api";
import type { Product, SchoolAttachment } from "../types";
import { Field, Message } from "./UI";
import { matchSchoolList, parseSchoolList, requestedDescription } from "../lib/school-list";
import { presentationLabel } from "../lib/product-language";
import { readSchoolFile } from "../lib/read-school-file";
import { useStoredState } from "../lib/drafts";

export type SchoolCart = { p: Product; cantidad: number; solicitado?: string }[];
export type SchoolMissing = { id: string; nombre: string; cantidad: number; motivo?: string; por_revisar?:boolean; unidad?:string };
const maxFileSize = 5 * 1024 * 1024;

export function SchoolRequest({ cart, setCart, missing, setMissing, onFindMissing }: {
  cart: SchoolCart;
  setCart: Dispatch<SetStateAction<SchoolCart>>;
  missing: SchoolMissing[];
  setMissing: Dispatch<SetStateAction<SchoolMissing[]>>;
  onFindMissing: (line: SchoolMissing | null) => void;
}) {
  const [attachment, setAttachment] = useState<SchoolAttachment | null>(null);
  const [preview, setPreview] = useState("");
  const [reading, setReading] = useState(false);
  const [progress, setProgress] = useState("");
  const [report, setReport] = useState("");
  const [listText, setListText,,textStorageError] = useStoredState("school-text","");
  const [contact,setContact,,contactStorageError]=useStoredState("school-contact",{nombre:"",telefono:"",presupuesto:"",observaciones:""});
  const [needsCompare, setNeedsCompare] = useStoredState("school-needs-compare",false);
  const [missingName, setMissingName] = useState("");
  const [missingQty, setMissingQty] = useState(1);
  const [error, setError] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [directBusy,setDirectBusy]=useState(false),[clearVersion,setClearVersion]=useState(0),[orderNotice,setOrderNotice]=useState("");
  function clearAll(){if(busy||reading||directBusy)return;setCart([]);setMissing([]);setListText("");setNeedsCompare(false);setAttachment(null);setPreview("");setMissingName("");setMissingQty(1);setReport("");setProgress("");setError("");setOrderNotice("");onFindMissing(null);setClearVersion(v=>v+1);}
  const directCart=cart.filter(i=>i.p.activo&&i.p.stock>0).map(i=>({...i,cantidad:Math.min(i.cantidad,i.p.stock)}));
  const available = cart.filter(i => i.p.stock > 0);
  const shortages = cart.filter(i => i.cantidad > i.p.stock);
  const pending=missing.filter(i=>i.por_revisar),unavailable=missing.filter(i=>!i.por_revisar);
  const total = cart.reduce((sum, i) => sum + i.p.precio * Math.min(i.cantidad, i.p.stock), 0);

  async function attach(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    const extensions: Record<string, string> = {txt:"text/plain",pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"};
    const kind = file.type || extensions[file.name.split(".").pop()?.toLowerCase() || ""] || "";
    if (!file.size || file.size > maxFileSize || !["image/jpeg", "image/png", "image/webp", "application/pdf", "text/plain"].includes(kind)) {
      setError("Elige una foto JPG, PNG, WebP, un PDF o un TXT de hasta 5 MB.");
      return;
    }
    if (file.name.length > 150) { setError("Acorta el nombre del archivo a un máximo de 150 caracteres."); return; }
    setReading(true);
    setReport(""); setProgress("Leyendo archivo…");
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
        reader.readAsDataURL(file);
      });
      setAttachment({ nombre: file.name, tipo: kind, datos: data.slice(data.indexOf(",") + 1) });
      setPreview(kind.startsWith("image/") ? data : "");
      const text = await readSchoolFile(new File([file], file.name, {type:kind}), setProgress);
      if (!text.trim()) throw new Error("No se pudo leer texto en el archivo. Usa una foto más nítida, un PDF con texto seleccionable o pega la lista abajo.");
      setListText(text.slice(0, 10000));
      setNeedsCompare(true);
      await compare(text);
    } catch (e) { setError("No se completó la comparación. " + (e as Error).message + " Puedes corregir el texto y volver a comparar."); }
    finally { setReading(false); }
  }

  function addMissing() {
    const name = missingName.trim();
    if (!name) return;
    if (missing.length + cart.length >= 100) { setError("Tu lista admite hasta 100 artículos."); return; }
    setMissing(v => [...v, { id: crypto.randomUUID(), nombre: name, cantidad: missingQty }]);
    setMissingName(""); setMissingQty(1);
  }

  async function compare(text: string) {
    const lines = parseSchoolList(text);
    setProgress("Comparando con el inventario…");
    const products: Product[] = [];
    // Query all pages, independently of the visible search/category/brand filters.
    for (let page = 1; ; page++) {
      const batch = await api<Product[]>(`/publico/productos?pagina=${page}`);
      products.push(...batch);
      if (batch.length < 30) break;
      if (page >= 334) throw new Error("El catálogo es demasiado grande para compararlo aquí. Solicita la revisión del personal.");
    }
    const result = matchSchoolList(lines, products);
    setCart(result.cart);
    setMissing(result.missing.map(line => ({ ...line, id: crypto.randomUUID() })));
    setNeedsCompare(false);
    onFindMissing(null);
    setReport(`${lines.length} renglones revisados. Comprueba las cantidades antes de enviar.`);
  }

  async function importLines() {
    setReading(true); setError(""); setReport("");
    try { await compare(listText); }
    catch (e) { setError((e as Error).message); }
    finally { setReading(false); }
  }

  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (needsCompare) { setError("Compara el texto modificado con el inventario antes de enviar."); return; }
    if (!attachment && !cart.length && !missing.length && !listText.trim()) { setError("Adjunta tu lista, escribe los útiles o agrega productos del catálogo."); return; }
    const f = new FormData(e.currentTarget);
    setBusy(true); setError("");
    try {
      const selected = cart.map(i => `${i.cantidad} x ${i.p.nombre} (${i.p.codigo} · ${i.p.marca})`).join("\n");
      const pending = missing.map(i => `${i.cantidad} x ${i.nombre}`).join("\n");
      const result = await api<{ enlace: string }>("/publico/solicitudes", "POST", {
        nombre: f.get("nombre"), telefono: f.get("telefono"),
        lista: listText.trim() || [selected, pending ? "FALTANTES:\n" + pending : ""].filter(Boolean).join("\n\n"),
        observaciones: f.get("observaciones") || "", presupuesto: f.get("presupuesto") || "",
        adjunto: attachment,
        seleccion: [
          ...cart.map(i => ({ producto_id: i.p.id, solicitado: i.solicitado || i.p.nombre, cantidad: i.cantidad })),
          ...missing.map(i => ({ producto_id: 0, solicitado: i.unidad?`${i.nombre} (${i.unidad})`:i.nombre, cantidad: i.cantidad,por_revisar:!!i.por_revisar })),
        ],
      });
      setLink(result.enlace);
      setNeedsCompare(false);
      setCart([]);setMissing([]);setListText("");setAttachment(null);setPreview("");setContact({nombre:"",telefono:"",presupuesto:"",observaciones:""});
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }

  return <aside className="school-request panel" id="solicitud">
    <div className="request-heading"><span className="request-heading-icon"><i className="bi bi-file-earmark-check" aria-hidden="true" /></span><div><h2>Tu lista</h2></div>{!link&&<button type="button" className="btn btn-sm btn-outline-secondary clear-all" onClick={clearAll} disabled={busy||reading||directBusy||!(cart.length||missing.length||listText||attachment||missingName)}>Limpiar todo</button>}</div>
    <p className="request-intro">Agrega productos o sube tu lista. Revisamos los faltantes y te enviamos una cotización.</p>
    <Message error={error||textStorageError||contactStorageError} />
    {link ? <div className="request-success" role="status">
      <i className="bi bi-check-circle" aria-hidden="true" /><h3>Solicitud recibida</h3>
      <p>Guarda el enlace privado para ver los disponibles, los faltantes y la propuesta del personal.</p>
      <Link to={link} className="text-break">{window.location.origin + link}</Link>
      <button className="btn btn-outline-success w-100 mt-3" onClick={() => navigator.clipboard.writeText(window.location.origin + link).catch(() => setError("Copia el enlace manualmente."))}>Copiar enlace</button>
      <button className="btn btn-link w-100 mt-2" onClick={() => { setLink(""); setAttachment(null); setPreview(""); setCart([]); setMissing([]); setListText(""); onFindMissing(null); }}>Cotizar otra lista</button>
    </div> : <>
      <label className={`school-upload ${attachment ? "has-file" : ""}`}>
        <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf,text/plain,.txt" aria-label="Subir lista escolar" onChange={attach} disabled={busy || reading || directBusy} />
        <i className={attachment ? "bi bi-file-earmark-check" : "bi bi-cloud-arrow-up"} aria-hidden="true" />
        <span><b>{reading ? progress : attachment ? attachment.nombre : "Subir foto, PDF o TXT"}</b><small>{attachment ? "Archivo adjunto a tu solicitud" : "JPG, PNG, WebP, PDF o TXT · hasta 5 MB"}</small></span>
      </label>
      {attachment && <div className="upload-tools">{preview && <img src={preview} alt="Vista previa de la lista escolar" />}<button type="button" className="btn btn-sm btn-link" disabled={reading || busy || directBusy} onClick={() => {setAttachment(null);setPreview("");}}>Quitar archivo</button></div>}
      {reading && <p className="list-reading" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /> {progress}</p>}
      {report && <p className="list-match-report" role="status"><i className="bi bi-check2-circle" aria-hidden="true" /> {report}</p>}
      {(cart.length>0||missing.length>0)&&<p className="upload-hint">Revisa las cantidades. Comparar reemplaza tu selección.</p>}

      <fieldset className="request-editable" disabled={reading || busy || directBusy}>
        <details className="request-notes" open={!!listText}><summary>Pegar o corregir mi lista</summary><Field label="Lista de útiles"><textarea className="form-control" rows={5} maxLength={10000} value={listText} onChange={e => {setListText(e.target.value);setReport("");setNeedsCompare(!!e.target.value.trim());}} placeholder={"2 Lápices Artesco\n1 Regla de 20 cm"} /></Field>{listText.trim() && <button type="button" className="btn btn-sm btn-outline-secondary mt-2" onClick={importLines}>Revisar mi lista</button>}{needsCompare && <p className="upload-hint">Pulsa «Revisar mi lista» para actualizar los útiles antes de enviar.</p>}</details>
      <div className="request-coverage" id="carrito">
        <section className="coverage-column available-column" aria-label="Útiles disponibles">
          <h3><i className="bi bi-check2-circle" aria-hidden="true" /> Disponibles <span>{available.length}</span></h3>
          {!available.length && <p className="coverage-empty">Aún no agregaste productos.</p>}
          <div className="coverage-scroll">{available.map(i => <div className="cart-line" key={i.p.id}>
            <div><b>{Math.min(i.cantidad, i.p.stock)} × {i.p.nombre}</b><small>{i.p.marca} · {money(i.p.precio)}</small><small>{presentationLabel(i.p)}</small>{i.solicitado && <small>En tu lista: {i.solicitado}</small>}{i.cantidad > i.p.stock && <small>Disponibles: {i.p.stock} de {i.cantidad}</small>}</div>
            <div className="coverage-line-controls"><input type="number" className="form-control qty" aria-label={"Cantidad " + i.p.nombre} min={1} max={1000000} value={i.cantidad} onChange={e => setCart(v => v.map(x => x.p.id === i.p.id ? { ...x, cantidad: Math.max(1, Math.min(1000000, Math.floor(Number(e.target.value)))) } : x))} /><button className="remove-line" title="Quitar" aria-label={"Quitar " + i.p.nombre} onClick={() => setCart(v => v.filter(x => x.p.id !== i.p.id))}><i className="bi bi-x" aria-hidden="true" /></button></div>
          </div>)}</div>
        </section>
        <section className="coverage-column missing-column" aria-label="Útiles faltantes">
          <h3><i className="bi bi-clock-history" aria-hidden="true" /> Faltantes <span>{unavailable.length + shortages.length}</span></h3>
          {!!unavailable.length && <p className="coverage-empty">Sin stock o sin coincidencia en el catálogo.</p>}
          {!unavailable.length && !shortages.length && <p className="coverage-empty">Anota los útiles que no encontraste.</p>}
          <div className="coverage-scroll">
            {shortages.map(i => <div className="missing-line" key={i.p.id}><b>{i.cantidad - i.p.stock} × {i.p.nombre}</b><small>{i.p.stock ? "Cantidad pendiente de reposición" : "Sin stock actualmente"}</small>{!i.p.stock && <button className="remove-line" aria-label={"Quitar " + i.p.nombre} onClick={() => setCart(v => v.filter(x => x.p.id !== i.p.id))}>Quitar</button>}</div>)}
            {unavailable.map(i => <div className="missing-line" key={i.id}><b>{i.unidad?requestedDescription(i):`${i.cantidad} × ${i.nombre}`}</b>{i.motivo && <small>{i.motivo}</small>}<button className="find-missing" onClick={() => onFindMissing(i)} aria-label={"Buscar " + i.nombre + " en catálogo"}><i className="bi bi-search" aria-hidden="true" /> Buscar en catálogo</button><button className="remove-line" aria-label={"Quitar faltante " + i.nombre} onClick={() => {setMissing(v => v.filter(x => x.id !== i.id));onFindMissing(null);}}><i className="bi bi-x" aria-hidden="true" /></button></div>)}
          </div>
        </section>
      </div>
      {!!pending.length && <section className="review-pending coverage-column" aria-label="Útiles por revisar"><h3><i className="bi bi-question-circle" aria-hidden="true" /> Por revisar <span>{pending.length}</span></h3><p className="coverage-empty">Hay varias marcas o presentaciones. Elige la que corresponde.</p><div className="coverage-scroll">{pending.map(i=><div className="missing-line" key={i.id}><b>{i.unidad?requestedDescription(i):`${i.cantidad} × ${i.nombre}`}</b><small>{i.motivo}</small><button type="button" className="find-missing" onClick={()=>onFindMissing(i)} aria-label={`Buscar ${i.nombre} en catálogo`}>Elegir producto</button><button type="button" className="remove-line" aria-label={`Quitar pendiente ${i.nombre}`} onClick={()=>{setMissing(v=>v.filter(x=>x.id!==i.id));onFindMissing(null);}}>×</button></div>)}</div></section>}
      <div className="missing-entry">
        <Field label="Útil que falta"><input className="form-control" placeholder="Ej.: compás metálico" value={missingName} maxLength={150} onChange={e => setMissingName(e.target.value)} onKeyDown={e => {if (e.key === "Enter") {e.preventDefault();addMissing();}}} /></Field>
        <Field label="Cantidad faltante"><input className="form-control" type="number" min={1} max={1000000} value={missingQty} onChange={e => setMissingQty(Math.max(1, Math.min(1000000, Math.floor(Number(e.target.value)))))} /></Field>
        <button type="button" className="btn btn-outline-secondary" aria-label="Agregar faltante" disabled={!missingName.trim()} onClick={addMissing}><i className="bi bi-plus-lg" aria-hidden="true" /></button>
      </div>
      <DirectCheckout key={clearVersion} cart={directCart} blocked={needsCompare} partial={!!missing.length||!!shortages.length} onBusyChange={setDirectBusy} onComplete={ordered=>{
        const quantities=new Map(ordered.map(i=>[i.p.id,i.cantidad]));
        const remaining=cart.map(i=>({...i,cantidad:i.cantidad-(quantities.get(i.p.id)||0)})).filter(i=>i.cantidad>0);
        setCart(remaining);
        setListText([...remaining.map(i=>`${i.cantidad} ${i.p.nombre}`),...missing.map(i=>i.unidad?requestedDescription(i):`${i.cantidad} ${i.nombre}`)].join("\n"));
        if(!remaining.length&&!missing.length){setAttachment(null);setPreview("");}
        setNeedsCompare(false);setReport("");onFindMissing(null);
        setOrderNotice(missing.length||remaining.length?"Pedido creado. Los faltantes siguen en tu lista para cotizar.":"Pedido creado con todos los productos de tu selección.");
      }} />
      {orderNotice&&<p className="request-footnote" role="status">{orderNotice}</p>}
      <form onSubmit={send} onChange={e=>{const f=new FormData(e.currentTarget);setContact({nombre:String(f.get("nombre")||""),telefono:String(f.get("telefono")||""),presupuesto:String(f.get("presupuesto")||""),observaciones:String(f.get("observaciones")||"")});}}>

        <div className="request-contact">
          <Field label="Tu nombre"><input className="form-control" name="nombre" defaultValue={contact.nombre} required maxLength={150} autoComplete="name" /></Field>
          <Field label="Teléfono"><input className="form-control" name="telefono" defaultValue={contact.telefono} type="tel" required minLength={6} maxLength={30} autoComplete="tel" /></Field>
        </div>
        <details className="request-notes"><summary>Presupuesto y observaciones (opcional)</summary>
          <Field label="Presupuesto aproximado en S/"><input className="form-control" name="presupuesto" defaultValue={contact.presupuesto} inputMode="decimal" pattern="[0-9]+([.][0-9]{1,2})?" /></Field>
          <Field label="Observaciones"><textarea className="form-control" name="observaciones" defaultValue={contact.observaciones} rows={2} maxLength={2000} /></Field>
        </details>
        <div className="request-total"><span>Total estimado</span><strong>{money(total)}</strong></div>
        <button className="btn btn-primary w-100" disabled={busy || reading || directBusy || needsCompare}>{busy ? "Enviando…" : "Solicitar cotización"} <i className="bi bi-arrow-right" aria-hidden="true" /></button>
        <p className="request-footnote">El personal confirmará tu lista. No se realiza cobro ni reserva de stock.</p>
      </form>
      </fieldset>
    </>}
  </aside>;
}
