import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { api, money, cents, date } from "../services/api";
import {
  ProductImage,
  Heading,
  Message,
  Field,
  Empty,
  Pager,
  useLoad,
} from "../components/UI";
import { Document } from "../components/Receipt";
import { CheckoutCustomer } from "../components/CheckoutCustomer";
import { useAuth } from "../context/Auth";
import { CashClosingDialog } from "../components/CashClosingDialog";
import { SaleCancellation } from "./Operations";
import { readDraft, useStoredState } from "../lib/drafts";
import { presentationLabel } from "../lib/product-language";
import type { Customer, Product, Sale } from "../types";
// Caja de venta directa: selecciona productos, registra el pago y abre el documento confirmado.
export default function Checkout() {
  const {user}=useAuth();
  const [params,setParams]=useSearchParams();
  const [cashVersion,setCashVersion]=useState(0);
  const cash=useLoad(()=>api<{dia:string;cerrada:boolean}>("/caja/estado"),[cashVersion]);
  const cashClosed=!!cash.data?.cerrada;
  const cashBlocked=cashClosed||cash.loading||!!cash.error;
  const closingOpen=params.get("cierre")==="1"&&user?.rol==="administrador";
  function setClosing(open:boolean){const next=new URLSearchParams(params);if(open)next.set("cierre","1");else next.delete("cierre");setParams(next,{replace:true});}
  useEffect(()=>{
    const refresh=()=>setCashVersion(v=>v+1);
    const timer=window.setInterval(refresh,30000);
    window.addEventListener("focus",refresh);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",refresh);};
  },[]);
  const draftKey=`checkout:${user?.id}`;
  type Cart={p:Product;cantidad:number}[];
  const [initial]=useState(()=>readDraft<{cart:Cart;payment:string;received:string;client:Customer|null;key:string}>(draftKey));
  const [,setDraft,clearCheckoutDraft,storageError]=useStoredState(draftKey,initial);
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1),
    [cart, setCart] = useState<Cart>(initial?.cart||[]),
    [payment, setPayment] = useState(initial?.payment||"efectivo"),
    [received, setReceived] = useState(initial?.received||""),
    [client, setClient] = useState<Customer | null>(initial?.client||null),
    [customerBlocked, setCustomerBlocked] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  // La clave permanece entre reintentos del mismo cobro y se renueva solo tras una respuesta exitosa.
  const key = useRef(initial?.key||crypto.randomUUID()),
    nav = useNavigate(),
    products = useLoad(
      () =>
        api<Product[]>(`/productos?q=${encodeURIComponent(q)}&pagina=${page}`),
      [q, page],
    );
  useEffect(()=>{setDraft({cart,payment,received,client,key:key.current});},[cart,payment,received,client,setDraft]);
  const [recovered,setRecovered]=useState(!!initial?.cart.length),[customerVersion,setCustomerVersion]=useState(0);
  function clearAll(){if(busy)return;key.current=crypto.randomUUID();setCart([]);setReceived("");setPayment("efectivo");setClient(null);setCustomerBlocked(false);setCustomerVersion(v=>v+1);setError("");setRecovered(false);}
  const total = cart.reduce((s, i) => s + i.p.precio * i.cantidad, 0);
  let change = 0;
  try {
    change = cents(received) - total;
  } catch {
    /* Se valida antes de confirmar. */
  }
  // Se envían identificadores y cantidades; Go vuelve a comprobar precios, stock y efectivo.
  async function confirm() {
    if(busy||cashBlocked)return;
    if (customerBlocked) { setError("Selecciona o guarda al cliente antes de cobrar."); return; }
    setBusy(true);
    setError("");
    try {
      const v = await api<Sale>("/ventas", "POST", {
        items: cart.map((i) => ({ producto_id: i.p.id, cantidad: i.cantidad })),
        clave: key.current,
        pago: payment,
        recibido: received,
        cliente_id: client?.id || null,
      });
      setCart([]);
      clearCheckoutDraft();
      key.current = crypto.randomUUID();
      nav("/app/ventas/" + v.id);
    } catch (e) {
      setError((e as Error).message);
      setCashVersion(v=>v+1);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title="Caja de ventas"
        sub="Los precios y existencias se verifican al confirmar."
        action={user?.rol==="administrador"&&<button type="button" className="btn btn-outline-primary" disabled={busy} onClick={()=>setClosing(true)}><i className="bi bi-cash-stack" aria-hidden="true" /> Cierre de caja</button>}
      />
      {closingOpen&&<CashClosingDialog onClose={()=>setClosing(false)} onChanged={()=>setCashVersion(v=>v+1)} />}
      <Message error={error || products.error || storageError} />
      <div className={"cash-register-state"+(cashClosed?" is-closed":"")} aria-live="polite">
        {cash.error?<><span>No se pudo comprobar el estado de caja.</span><button type="button" className="btn btn-sm btn-outline-secondary" onClick={()=>setCashVersion(v=>v+1)}>Reintentar estado de caja</button></>:cash.loading&&!cash.data?<span>Consultando estado de caja…</span>:cash.data&&<><strong>{cashClosed?"Caja cerrada":"Caja abierta"}</strong><span>{cashClosed?"Los cobros están bloqueados. El administrador puede reabrir la caja con un motivo.":"Disponible para registrar ventas."}</span></>}
      </div>
      {recovered && <p className="draft-notice"><i className="bi bi-arrow-counterclockwise" aria-hidden="true" /> Carrito recuperado de este navegador. Los precios y el stock se verifican al cobrar.</p>}
      <div className="row g-4 checkout-workspace">
        <div className="col-xl-7">
          <section className="panel">
            <Field label="Buscar productos">
              <input
                className="form-control"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
                placeholder="Nombre, código o marca"
              />
            </Field>
            {products.loading ? (
              <p>Cargando…</p>
            ) : (
              <div className="sale-products">
                {products.data
                  ?.filter((p) => p.activo)
                  .map((p) => (
                    <button
                      disabled={busy || p.stock === 0}
                      className="sale-product"
                      key={p.id}
                      onClick={() => {
                        setCart((c) => {
                          const old = c.find((i) => i.p.id === p.id);
                          return old
                            ? c.map((i) =>
                                i === old
                                  ? { ...i, cantidad: i.cantidad + 1 }
                                  : i,
                              )
                            : [...c, { p, cantidad: 1 }];
                        });
                      }}
                    >
                      <ProductImage src={p.imagen} name={p.nombre} category={p.categoria} />
                      <b>{p.nombre}</b>
                      <small>
                        {p.marca} · Stock: {p.stock}
                      </small>
                      <small className="product-presentation">{presentationLabel(p)}</small>
                      <strong>
                        {money(p.precio)}{" "}
                        <i aria-hidden="true" className="bi bi-plus-circle" />
                      </strong>
                    </button>
                  ))}
              </div>
            )}
            <Pager
              page={page}
              setPage={setPage}
              count={products.data?.length || 0}
            />
          </section>
        </div>
        <div className="col-xl-5">
          <section className="panel">
            <div className="cart-heading"><h2><i aria-hidden="true" className="bi bi-cart3" /> Venta actual</h2><button type="button" className="btn btn-sm btn-outline-secondary" onClick={clearAll} disabled={busy||(!cart.length&&!received&&!client&&!customerBlocked&&payment==="efectivo")}>Limpiar todo</button></div>
            {!cart.length ? (
              <Empty text="Agrega productos para empezar." />
            ) : (
              cart.map((i) => (
                <div className="cart-line" key={i.p.id}>
                  <div>
                    <b>{i.p.nombre}</b>
                    <small>
                      {money(i.p.precio)} · Stock {i.p.stock}
                    </small>
                    <small className="product-presentation">{presentationLabel(i.p)}</small>
                  </div>
                  <input
                    aria-label={"Cantidad de " + i.p.nombre}
                    disabled={busy}
                    className="form-control qty"
                    type="number"
                    min="1"
                    max={i.p.stock}
                    step="1"
                    value={i.cantidad}
                    onChange={(e) =>
                      setCart((c) =>
                        c.map((v) =>
                          v === i
                            ? { ...v, cantidad: Number(e.target.value) }
                            : v,
                        ),
                      )
                    }
                  />
                  <b>{money(i.cantidad * i.p.precio)}</b>
                  <button
                    disabled={busy}
                    className="btn btn-sm btn-outline-danger"
                    aria-label={"Quitar " + i.p.nombre}
                    onClick={() => setCart((c) => c.filter((v) => v !== i))}
                  >
                    <i aria-hidden="true" className="bi bi-x" />
                  </button>
                </div>
              ))
            )}
            <div className="total-line">
              Total <strong>{money(total)}</strong>
            </div>
            <CheckoutCustomer key={customerVersion} value={client} onChange={setClient} onBlockedChange={setCustomerBlocked} disabled={busy} />
            <Field label="Medio de pago">
              <select
                className="form-select"
                value={payment}
                disabled={busy}
                onChange={(e) => setPayment(e.target.value)}
              >
                {["efectivo", "yape", "plin", "transferencia"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </Field>
            {payment === "efectivo" ? (
              <>
                <Field label="Efectivo recibido (S/)">
                  <input
                    className="form-control"
                    inputMode="decimal"
                    disabled={busy}
                    value={received}
                    onChange={(e) => setReceived(e.target.value)}
                  />
                </Field>
                <p>
                  Vuelto: <b>{money(Math.max(0, change))}</b>
                </p>
              </>
            ) : (
              <p className="small text-secondary">
                Registro manual. Confirma el abono antes de registrar; el
                sistema no verifica pagos.
              </p>
            )}
            <button
              className="btn btn-primary w-100"
              disabled={
                busy || cashBlocked ||
                customerBlocked ||
                !cart.length ||
                cart.some(
                  (i) =>
                    !Number.isInteger(i.cantidad) ||
                    i.cantidad < 1 ||
                    i.cantidad > i.p.stock,
                )
              }
              onClick={confirm}
            >
              {busy ? "Registrando…" : "Confirmar venta pagada"}
            </button>
          </section>
        </div>
      </div>
    </>
  );
}
// Carga el documento persistido de la venta para consultar, imprimir o descargar sus datos históricos.
export function SaleDetail() {
  const {user}=useAuth();
  const { id } = useParams();
  const { data, error, loading, reload } = useLoad(
    () => api<Sale>("/ventas/" + id),
    [id],
  );
  return (
    <>
      <Heading title={"Venta #" + id} />
      <Message error={error} />
      {loading ? (
        <p>Cargando…</p>
      ) : (
        data && (
          <><Document
            title={"Venta #" + data.id + (data.estado==="anulada" ? " · ANULADA" : "")}
            fecha={data.fecha}
            items={data.items}
            total={data.total}
            extra={[
              "Estado: " + data.estado,
              "Vendedor: " + data.vendedor,
              ...(data.estado==="anulada" ? ["Anulada por: "+data.anulacion_usuario,"Fecha de anulación: "+date(data.anulacion_fecha),"Motivo: "+data.anulacion_motivo] : []),
              "Cliente: " + (data.cliente_nombre || "Consumidor final"),
              ...(data.cliente_documento ? [(data.cliente_tipo === "empresa" ? "RUC: " : "Documento: ") + data.cliente_documento] : []),
              ...(data.cliente_direccion ? ["Dirección: " + data.cliente_direccion] : []),
              "Pago: " + data.pago,
              "Recibido: " +
                money(data.recibido) +
                " · Vuelto: " +
                money(data.recibido - data.total),
            ]}
          />{user?.rol==="administrador" && data.estado==="activa" && <SaleCancellation sale={data} reload={reload} />}</>
        )
      )}
      <Link to="/app/caja" className="btn btn-link no-print">
        Volver a caja
      </Link>
      {user?.rol==="administrador" && <Link to="/app/ventas" className="btn btn-link no-print">Historial de ventas</Link>}
    </>
  );
}
