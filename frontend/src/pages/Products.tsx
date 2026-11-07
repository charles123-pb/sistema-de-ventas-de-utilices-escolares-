import { Link, useSearchParams } from "react-router-dom";
import { StockEntryDialog } from "../components/StockEntryDialog";
import { CategoryManager } from "../components/CategoryManager";
import { FormEvent, useEffect, useRef, useState } from "react";
import { api, money } from "../services/api";
import type { Product, Brand, SupplierOption } from "../types";
import { useAuth } from "../context/Auth";
import { packagingUnits, presentationLabel } from "../lib/product-language";
import {
  ProductImage,
  Heading,
  Field,
  Message,
  Empty,
  Pager,
  useLoad,
} from "../components/UI";
// Consulta paginada del catálogo; el administrador dispone además del formulario de edición.
export default function Products() {
  const {user}=useAuth();
  const [params,setParams]=useSearchParams();
  const search=params.get("q")||"",brand=params.get("marca")||"",category=params.get("categoria")||"",state=params.get("estado")||"",supplier=params.get("proveedor")||"",selectedID=params.get("id")||"";
  const page=Math.max(1,Number(params.get("pagina"))||1);
  function filter(key:string,value:string){const next=new URLSearchParams(params);if(value)next.set(key,value);else next.delete(key);if(key!=="categorias")next.delete("pagina");if(key!=="id"&&key!=="categorias")next.delete("id");setParams(next,{replace:true});}
  function setPage(value:number){const next=new URLSearchParams(params);next.set("pagina",String(value));setParams(next);}
  const [entryProduct,setEntryProduct]=useState<number|null>(null);
  const [stockAction,setStockAction]=useState<"entrada"|"ajuste">("entrada");
  const entryFocus=useRef<{id:number;mode:"entrada"|"ajuste"}|null>(null);
  const [edit,setEdit]=useState<Product|null|undefined>(undefined),[error,setError]=useState(""),[success,setSuccess]=useState(""),[busy,setBusy]=useState(false);
  const list = useLoad(
      () =>
        api<Product[]>(
          `/productos?q=${encodeURIComponent(search)}&marca=${encodeURIComponent(brand)}&categoria=${encodeURIComponent(category)}&estado=${encodeURIComponent(state)}&proveedor=${encodeURIComponent(supplier)}&id=${encodeURIComponent(selectedID)}&pagina=${page}`,
        ),
      [search, brand, category, state, supplier, selectedID, page],
    ),
    cats = useLoad(() => api<any[]>("/categorias"), []),
    brands = useLoad(() => api<Brand[]>("/marcas"), []),
    suppliers = useLoad(() => user?.rol === "administrador" ? api<SupplierOption[]>("/proveedores?opciones=1") : Promise.resolve([]), [user?.rol]);
  useEffect(()=>{
    if(entryFocus.current===null||list.loading)return;
    const button=document.querySelector<HTMLButtonElement>(`[data-stock-action="${entryFocus.current.mode}-${entryFocus.current.id}"]`);
    const search=document.querySelector<HTMLInputElement>(".filter-toolbar .search-label input");
    (button||search)?.focus();entryFocus.current=null;
  },[list.loading,list.data]);
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    // Los importes permanecen como texto decimal; identificadores y cantidades se envían como números.
    const body = {
      codigo: f.get("codigo"),
      nombre: f.get("nombre"),
      marca: f.get("marca"),
      proveedor_id: f.get("proveedor_id") ? Number(f.get("proveedor_id")) : null,
      descripcion: f.get("descripcion"),
      categoria_id: Number(f.get("categoria_id")),
      imagen: f.get("imagen"),
      precio: f.get("precio"),
      costo: f.get("costo"),
      stock: Number(f.get("stock")),
      stock_minimo: Number(f.get("stock_minimo")),
      activo: f.get("activo") === "on",
      familia: String(f.get("familia")||""),
      presentacion: f.get("presentacion")||undefined,
      contenido: f.get("contenido")===""?undefined:Number(f.get("contenido")),
    };
    try {
      await api(
        edit ? "/productos/" + edit.id : "/productos",
        edit ? "PUT" : "POST",
        body,
      );
      setEdit(undefined);
      setSuccess("Producto guardado correctamente.");
      list.reload();
      brands.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Productos"
        action={
          user?.rol === "administrador" && (
            <div className="d-flex gap-2 flex-wrap"><button type="button" className="btn btn-outline-primary" onClick={()=>filter("categorias","1")}><i className="bi bi-tags" aria-hidden="true" /> Categorías</button><button
              className="btn btn-primary"
              onClick={() => {
                setEdit(null);
                setError("");
              }}
            >
              + Nuevo producto
            </button></div>
          )
        }
      />
      <Message error={error || list.error || suppliers.error || brands.error} success={success} />
      {user?.rol==="administrador"&&params.get("categorias")==="1"&&<CategoryManager onClose={()=>filter("categorias","")} onChanged={()=>{cats.reload();list.reload();}} />}
      {user?.rol==="administrador"&&entryProduct!==null&&<StockEntryDialog productId={entryProduct} mode={stockAction} onClose={()=>setEntryProduct(null)} onSaved={()=>{entryFocus.current={id:entryProduct,mode:stockAction};setEntryProduct(null);setSuccess(stockAction==="entrada"?"Entrada registrada. Stock y costo actualizados.":"Ajuste registrado. Stock actualizado.");list.reload();}} />}
      {edit !== undefined && (
        <section className="panel mb-4">
          <h2>{edit ? "Editar producto" : "Registrar producto"}</h2>
          <form onSubmit={save} key={edit?.id || "new"}>
            <div className="form-grid">
              {[
                ["codigo", "Código", edit?.codigo],
                ["nombre", "Nombre", edit?.nombre],
                ["marca", "Marca (opcional)", edit?.marca],
              ].map(([name, label, value]) => (
                <Field label={String(label)} key={name}>
                  <input
                    className="form-control"
                    name={name}
                    list={name === "marca" ? "product-brands" : undefined}
                    defaultValue={value}
                    required={name !== "marca"}
                    maxLength={name === "codigo" ? 60 : 150}
                  />
                </Field>
              ))}
              <datalist id="product-brands">{brands.data?.map(b => <option key={b.nombre} value={b.nombre} />)}</datalist>
              <Field label="Tipo principal del producto"><input className="form-control" name="familia" list="product-families" defaultValue={edit?.familia||""} maxLength={60} placeholder="Automático desde el nombre" /></Field>
              <datalist id="product-families">{["cuaderno","colores","lapiz","borrador","tajador","pincel","lapicero","plumon","tempera","crayon","tijera","pegamento","papel","block","forro","mica","plastilina"].map(f=><option key={f} value={f} />)}</datalist>
              <Field label="Presentación de venta"><select className="form-select" name="presentacion" defaultValue={edit?.presentacion||""} onChange={e=>{if(e.target.value==="unidad"){const field=e.target.form?.elements.namedItem("contenido") as HTMLInputElement|null;if(field)field.value="1";}}}><option value="">Detectar desde el nombre</option>{packagingUnits.map(p=><option key={p} value={p}>{p}</option>)}</select></Field>
              <Field label="Unidades por presentación"><input className="form-control" name="contenido" type="number" min={0} max={1000000} step={1} defaultValue={edit?.contenido??""} placeholder="Automático; 0 si falta confirmar" /></Field>
              <Field label="Proveedor principal (opcional)">
                <select className="form-select" name="proveedor_id" defaultValue={edit?.proveedor_id ?? ""}>
                  <option value="">Sin proveedor asignado</option>
                  {suppliers.data?.filter(s => s.activo || s.id === edit?.proveedor_id).map(s => <option key={s.id} value={s.id}>{s.nombre}{!s.activo ? " (inactivo)" : ""}</option>)}
                </select>
              </Field>
              <Field label="Categoría">
                <select
                  name="categoria_id"
                  className="form-select"
                  defaultValue={edit?.categoria_id}
                  required
                >
                  {cats.data
                    ?.filter((c) => c.activo || c.id === edit?.categoria_id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Precio de venta (S/)">
                <input
                  className="form-control"
                  name="precio"
                  inputMode="decimal"
                  pattern="[0-9]+([.][0-9]{1,2})?"
                  defaultValue={edit ? (edit.precio / 100).toFixed(2) : ""}
                  required
                />
              </Field>
              <Field label="Costo unitario (S/)">
                <input
                  className="form-control"
                  name="costo"
                  defaultValue={
                    edit ? ((edit.costo || 0) / 100).toFixed(2) : "0.00"
                  }
                  readOnly={!!edit}
                  required
                />
              </Field>
              <Field label={edit ? "Stock (solo lectura)" : "Stock inicial"}>
                <input
                  className="form-control"
                  name="stock"
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  defaultValue={edit?.stock || 0}
                  readOnly={!!edit}
                  required
                />
              </Field>
              <Field label="Stock mínimo">
                <input
                  className="form-control"
                  name="stock_minimo"
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  defaultValue={edit?.stock_minimo ?? 5}
                  required
                />
              </Field>
              <Field label="Foto del producto (ruta local o HTTPS)">
                <input
                  className="form-control"
                  name="imagen"
                  type="text"
                  placeholder="/productos/foto.jpg o https://…"
                  defaultValue={edit?.imagen}
                  maxLength={1000}
                />
              </Field>
            </div>
            <p className="small text-secondary">El precio, costo y stock corresponden a la presentación de venta: por ejemplo, una caja de 12 colores cuenta como 1 caja. Cambiar estos datos no convierte ni recalcula el inventario.</p>
            <Field label="Descripción">
              <textarea
                className="form-control"
                name="descripcion"
                defaultValue={edit?.descripcion}
                maxLength={2000}
              />
            </Field>
            <label className="d-block my-3">
              <input
                type="checkbox"
                name="activo"
                defaultChecked={edit ? !!edit.activo : true}
              />{" "}
              Producto activo
            </label>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar producto"}
            </button>
            <button
              type="button"
              className="btn btn-link"
              onClick={() => setEdit(undefined)}
            >
              Cancelar
            </button>
          </form>
        </section>
      )}
      <section className="panel">
        <div className="filter-toolbar">
        <label className="search-label mb-0">
          Buscar producto
          <input
            className="form-control"
            placeholder="Nombre, código o marca…"
            value={search}
            onChange={(e) => {
              filter("q",e.target.value);
            }}
          />
        </label>
        <Field label="Filtrar por marca"><select className="form-select" value={brand} onChange={e => filter("marca",e.target.value)}><option value="">Todas las marcas</option>{brands.data?.map(b => <option key={b.nombre} value={b.nombre}>{b.nombre}</option>)}</select></Field>
        <Field label="Filtrar por categoría"><select className="form-select" value={category} onChange={e=>filter("categoria",e.target.value)}><option value="">Todas las categorías</option>{cats.data?.map(c=><option key={c.id} value={c.id}>{c.nombre}</option>)}</select></Field>
        </div>
        <div className="product-status-filters" aria-label="Estado de existencias">{[["","Todos"],["stock_bajo","Stock bajo"],["agotados","Agotados"],["inactivos","Inactivos"]].map(([value,label])=><button type="button" key={label} className={state===value?"selected":""} aria-pressed={state===value} onClick={()=>filter("estado",value)}>{label}</button>)}{(supplier||selectedID)&&<button type="button" onClick={()=>{const next=new URLSearchParams(params);next.delete("proveedor");next.delete("id");next.delete("pagina");setParams(next);}}>Quitar filtro de {supplier?"proveedor":"producto"}</button>}</div>
        {list.loading ? (
          <p>Cargando productos…</p>
        ) : !list.data?.length ? (
          <Empty />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Categoría</th>
                  <th>Precio</th>
                  {user?.rol === "administrador" && <><th>Costo</th><th>Proveedor</th></>}
                  <th>Stock</th>
                  <th>Estado</th>
                  {user?.rol === "administrador" && <th>Acción</th>}
                </tr>
              </thead>
              <tbody>
                {list.data.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div className="product-table-cell">
                        <ProductImage src={p.imagen} name={p.nombre} category={p.categoria} />
                        <div><b>{p.nombre}</b><small className="d-block text-secondary">{p.codigo} · {p.marca}</small><small className="product-presentation">{presentationLabel(p)}</small></div>
                      </div>
                    </td>
                    <td>{p.categoria}</td>
                    <td>{money(p.precio)}</td>
                    {user?.rol === "administrador" && <><td>{money(p.costo)}</td><td>{p.proveedor || "Sin asignar"}</td></>}
                    <td>
                      <span
                        className={
                          p.stock <= p.stock_minimo ? "text-danger fw-bold" : ""
                        }
                      >
                        {p.stock}
                      </span>
                    </td>
                    <td>{p.activo ? "Activo" : "Inactivo"}</td>
                    {user?.rol === "administrador" && (
                      <td>
                        <div className="product-row-actions"><button type="button" data-stock-action={`entrada-${p.id}`} className="btn btn-sm btn-outline-primary" onClick={()=>{setStockAction("entrada");setEntryProduct(p.id);setSuccess("");}}>Registrar entrada</button><button type="button" data-stock-action={`ajuste-${p.id}`} className="btn btn-sm btn-outline-secondary" onClick={()=>{setStockAction("ajuste");setEntryProduct(p.id);setSuccess("");}}>Ajustar stock</button><Link className="btn btn-sm btn-outline-secondary" to={`/app/stock?tab=historial&producto=${p.id}`}>Ver movimientos</Link><button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => {
                            setEdit(p);
                            window.scrollTo(0, 0);
                          }}
                        >
                          Editar
                        </button></div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} setPage={setPage} count={list.data?.length || 0} />
      </section>
    </>
  );
}
