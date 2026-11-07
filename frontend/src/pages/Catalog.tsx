import { useState } from "react";
import { api, money } from "../services/api";
import { ProductImage, Field, Message, Empty, Pager, useLoad } from "../components/UI";
import { SchoolRequest, type SchoolCart, type SchoolMissing } from "../components/SchoolRequest";
import type { Product, Brand } from "../types";
import { useStoredState } from "../lib/drafts";
import { quantityForProduct, requestedDescription } from "../lib/school-list";
import { presentationLabel } from "../lib/product-language";
// Catálogo público con filtros, paginación y una selección local para solicitar cotización.
export default function Catalog() {
  const [q, setQ] = useState(""),
    [category, setCategory] = useState(""),
    [brand, setBrand] = useState(""),
    [page, setPage] = useState(1),
    [matching, setMatching] = useState<SchoolMissing | null>(null);
  function openCatalog(){requestAnimationFrame(()=>document.getElementById("catalogo")?.scrollIntoView({behavior:"smooth",block:"start"}));}
  const [amounts,setAmounts]=useState<Record<number,string>>({});
  const [selectionError,setSelectionError]=useState("");
  const [cart,setCart,,cartStorageError]=useStoredState<SchoolCart>("catalog-cart",[]);
  const [missing,setMissing,,missingStorageError]=useStoredState<SchoolMissing[]>("catalog-missing",[]);
  const list = useLoad(
      () =>
        api<Product[]>(
          `/publico/productos?q=${encodeURIComponent(q)}&categoria=${category}&marca=${encodeURIComponent(brand)}&pagina=${page}`,
        ),
      [q, category, brand, page],
    ),
    cats = useLoad(() => api<any[]>("/publico/categorias"), []),
    brands = useLoad(() => api<Brand[]>("/publico/marcas"), []);
  const request = <div className="request-workspace"><SchoolRequest cart={cart} setCart={setCart} missing={missing} setMissing={setMissing} onFindMissing={line => {
        setMatching(line);
        setAmounts({});setSelectionError("");
        if (line) {setQ(line.nombre);setCategory("");setBrand("");setPage(1);openCatalog();}
      }} />
      <details className="catalog-list-help"><summary>Ayuda y plantillas</summary><p>Sube una foto nítida o un PDF, o pega un útil por línea: <b>2 Lápices Artesco</b>. Revisa las cantidades y envía tus datos.</p><p>Hasta 5 MB; PDF de hasta 10 páginas. <a href="/plantilla-lista-escolar.pdf" download>Plantilla PDF</a> · <a href="/plantilla-lista-escolar.txt" download>TXT</a>.</p><p>Si recargas, vuelve a adjuntar el archivo.</p></details></div>;
  return (
    <>
      <section className="catalog-intro">
        <div className="catalog-intro-copy">
          <h1>Grandes ideas.<br /><em>Todo para crearlas.</em></h1>
          <p>Útiles escolares y de oficina.</p>
          <div className="hero-actions"><a href="#catalogo" className="btn btn-primary">Explorar catálogo <i className="bi bi-arrow-right" aria-hidden="true" /></a><a href="#solicitud" className="hero-secondary"><i className="bi bi-cloud-arrow-up" aria-hidden="true" /> Cotizar mi lista</a></div>
        </div>
        <div className="catalog-showcase" aria-hidden="true">
          <span className="showcase-orbit" /><span className="showcase-spark">✳</span>
          <div className="showcase-card showcase-notebook"><img src="/productos/std-548001.jpg" alt="" /></div>
          <div className="showcase-card showcase-colors"><img src="/productos/fab-l601824.jpg" alt="" /></div>
        </div>
      </section>
      <div className="catalog-workbench">
      <section className="catalog-results" aria-label="Catálogo de útiles">
      <div className="catalog-heading" id="catalogo">
        <div>
          <h2>Nuestro catálogo</h2>
        </div>
        <a className="btn btn-outline-primary" href="#carrito">
          <i aria-hidden="true" className="bi bi-bag" /> Tu lista ({cart.length}
          )
        </a>
      </div>
      <div className="catalog-filterbar" role="search" aria-label="Filtros del catálogo">
      <div className="catalog-filter-fields">
        <div className="catalog-filter-search">
          <i className="bi bi-search catalog-search-icon" aria-hidden="true" />
          <Field label="Buscar">
            <input
              className="form-control"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Nombre, código o marca…"
            />
          </Field>
        </div>
        <div className="catalog-filter-select">
          <Field label="Categoría">
            <select
              className="form-select"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Todas</option>
              {cats.data?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="catalog-filter-select">
          <Field label="Marca"><select className="form-select" value={brand} onChange={e => {setBrand(e.target.value);setPage(1);}}><option value="">Todas</option>{brands.data?.map(b => <option key={b.nombre} value={b.nombre}>{b.nombre}</option>)}</select></Field>
        </div>
      </div>
      </div>
      {(q || category || brand) && <div className="active-filters"><span><i className="bi bi-funnel" aria-hidden="true" /> {brand || "Todas las marcas"}{q ? ` · «${q}»` : ""}{category ? ` · ${cats.data?.find(c => String(c.id) === category)?.nombre || "Categoría"}` : ""}</span><button className="btn btn-sm btn-link" onClick={() => {setQ("");setCategory("");setBrand("");setPage(1);}}>Limpiar filtros</button></div>}
      {matching && <div className="matching-banner"><div><small>COMPLETAR ESTE ÚTIL</small><b>{matching.cantidad} × {matching.nombre}</b><span>Elige el producto que corresponde. Puedes ajustar la búsqueda.</span></div><button className="btn btn-sm btn-link" onClick={() => setMatching(null)}>Cancelar</button></div>}
      <Message error={selectionError || list.error || cats.error || brands.error || cartStorageError || missingStorageError} />
      {list.loading ? (
        <p role="status">Cargando catálogo…</p>
      ) : !list.data?.length ? (
        <Empty text="No encontramos productos. Puedes enviarnos tu lista para consultar." />
      ) : (
        <div className="catalog-grid">
          {list.data.map((p) => (
            <article className="product-card" key={p.id}>
              <div className="product-visual">
                <ProductImage
                  src={p.imagen}
                  name={p.nombre}
                  category={p.categoria}
                />

              </div>
              <div className="p-3">
                <small className="text-secondary">
                  {p.categoria}
                </small>
                <div className="product-brand">{p.marca || ""}</div>
                <h3 title={p.nombre}>{p.nombre}</h3>
                <small className="product-presentation">{presentationLabel(p)}</small>
                {matching && quantityForProduct(matching,p)===null && <Field label={`Cantidad de ${p.presentacion||"unidad"} para ${p.nombre}`}><input className="form-control" type="number" min={1} max={1000000} step={1} value={amounts[p.id]||""} placeholder="Confirma la cantidad de venta" onChange={e=>setAmounts(v=>({...v,[p.id]:e.target.value}))} /></Field>}
                
                <div className="d-flex justify-content-between align-items-center">
                  <b className="price">{money(p.precio)}</b>
                  <span
                    className={
                      p.stock > 0
                        ? "availability available"
                        : "availability unavailable"
                    }
                  >
                    {p.stock > 0 ? "Disponible" : "Consultar disponibilidad"}
                  </span>
                </div>
                <button
                  className="btn btn-outline-primary w-100 mt-3"
                  disabled={!!matching&&quantityForProduct(matching,p)===null&&(!Number.isInteger(Number(amounts[p.id]))||Number(amounts[p.id])<1||Number(amounts[p.id])>1000000)}
                  onClick={() => {
                    if (!matching && cart.length + missing.length >= 100 && !cart.some(i => i.p.id === p.id)) return;
                    const amount = matching ? quantityForProduct(matching,p)??Number(amounts[p.id]) : 1;
                    if(!Number.isInteger(amount)||amount<1||amount+(cart.find(i=>i.p.id===p.id)?.cantidad||0)>1000000){setSelectionError("Revisa la cantidad; el total por producto no debe superar 1 000 000.");return;}
                    setSelectionError("");
                    setCart(c => {
                      const old = c.find(i => i.p.id === p.id);
                      return old ? c.map(i => i.p.id === p.id ? {...i, cantidad: i.cantidad + amount} : i) : [...c, {p, cantidad: amount, solicitado: matching?requestedDescription(matching):undefined}];
                    });
                    if (matching) {setMissing(v => v.filter(i => i.id !== matching.id));setMatching(null);document.getElementById("carrito")?.scrollIntoView({behavior:"smooth",block:"start"});}
                  }}
                >
                  {matching ? "Usar para este útil" : p.stock > 0 ? "+ Agregar a mi lista" : "+ Anotar faltante"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      <Pager page={page} setPage={setPage} count={list.data?.length || 0} />
      </section>
      {request}
      </div>
    </>
  );
}
