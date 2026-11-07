import { FormEvent, useState } from "react";
import { api, money, date } from "../services/api";
import {
  Heading,
  Message,
  Field,
  Empty,
  Pager,
  useLoad,
} from "../components/UI";
// Reutiliza el listado y formulario según kind: clientes, categorías o usuarios del personal.
export function Records({
  kind,
}: {
  kind: "clientes" | "categorias" | "usuarios";
}) {
  const [page, setPage] = useState(1),
    [search, setSearch] = useState(""),
    [edit, setEdit] = useState<any | undefined>(undefined),
    [history, setHistory] = useState<any>(null),
    [historyPage, setHistoryPage] = useState(1),
    [historyBusy, setHistoryBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [busy, setBusy] = useState(false);
  const list = useLoad(
    () => api<any[]>(`/${kind}?q=${encodeURIComponent(search)}&pagina=${page}`),
    [kind, page, search],
  );
  // El historial de un cliente tiene su propia página, independiente de la lista de fichas.
  async function loadHistory(id: number, pageNumber: number) {
    setHistoryBusy(true);
    setError("");
    try {
      const result = await api("/clientes/" + id + "?pagina=" + pageNumber);
      setHistory(result);
      setHistoryPage(pageNumber);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setHistoryBusy(false);
    }
  }
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const body: any = Object.fromEntries(f);
    if (kind !== "clientes") {
      body.activo = f.get("activo") === "on";
      if (edit?.id) body.id = edit.id;
    }
    setBusy(true);
    setError("");
    try {
      await api(
        "/" + kind + (edit?.id && kind === "clientes" ? "/" + edit.id : ""),
        edit?.id ? "PUT" : "POST",
        body,
      );
      setEdit(undefined);
      setSuccess("Registro guardado.");
      list.reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <Heading
        title={
          {
            clientes: "Clientes",
            categorias: "Categorías",
            usuarios: "Usuarios del personal",
          }[kind]
        }
        action={
          <button
            className="btn btn-primary"
            onClick={() => {
              setEdit({});
              setError("");
            }}
          >
            + Registrar
          </button>
        }
      />
      <Message error={error || list.error} success={success} />
      {edit && (
        <section className="panel mb-4">
          <form onSubmit={save} key={edit.id || "new"}>
            <div className="form-grid">
              {kind === "clientes" && <Field label="Tipo de cliente"><select name="tipo" className="form-select" value={edit.tipo || "persona"} onChange={e=>setEdit({...edit,tipo:e.target.value})}><option value="persona">Persona</option><option value="empresa">Empresa con RUC</option></select></Field>}
              <Field label={kind === "clientes" && edit.tipo === "empresa" ? "Razón social" : "Nombre"}>
                <input
                  className="form-control"
                  name="nombre"
                  required
                  maxLength={150}
                  defaultValue={edit.nombre}
                />
              </Field>
              {kind === "clientes" && (
                <>
                  {[
                    ["telefono", "Teléfono"],
                    ["documento", "Documento (opcional)"],
                    ["direccion", "Dirección (opcional)"],
                  ].map(([k, l]) => (
                    <Field key={k} label={edit.tipo === "empresa" && k === "documento" ? "RUC" : edit.tipo === "empresa" && k === "direccion" ? "Dirección de la empresa" : l}>
                      <input
                        className="form-control"
                        name={k}
                        defaultValue={edit[k]}
                        maxLength={k === "direccion" ? 300 : edit.tipo === "empresa" && k === "documento" ? 11 : 30}
                        required={edit.tipo === "empresa" && (k === "documento" || k === "direccion")}
                        pattern={edit.tipo === "empresa" && k === "documento" ? "[0-9]{11}" : undefined}
                        inputMode={edit.tipo === "empresa" && k === "documento" ? "numeric" : undefined}
                      />
                    </Field>
                  ))}
                </>
              )}
              {kind === "usuarios" && (
                <>
                  <Field label="Usuario">
                    <input
                      className="form-control"
                      name="usuario"
                      defaultValue={edit.usuario}
                      required
                      maxLength={80}
                    />
                  </Field>
                  <Field
                    label={
                      edit.id
                        ? "Nueva contraseña (vacío conserva actual)"
                        : "Contraseña"
                    }
                  >
                    <input
                      className="form-control"
                      type="password"
                      name="password"
                      autoComplete="new-password"
                      minLength={10}
                      maxLength={72}
                      required={!edit.id}
                    />
                  </Field>
                  <Field label="Rol">
                    <select
                      className="form-select"
                      name="rol"
                      defaultValue={edit.rol || "vendedor"}
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="administrador">Administrador</option>
                    </select>
                  </Field>
                </>
              )}
              {kind !== "clientes" && (
                <label>
                  <input
                    name="activo"
                    type="checkbox"
                    defaultChecked={edit.id ? !!edit.activo : true}
                  />{" "}
                  Activo
                </label>
              )}
            </div>
            <button className="btn btn-primary" disabled={busy}>
              {busy ? "Guardando…" : "Guardar"}
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
      {kind === "clientes" && (
        <Field label="Buscar cliente">
          <input
            className="form-control"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </Field>
      )}
      <section className="panel">
        {list.loading ? (
          <p>Cargando…</p>
        ) : !list.data?.length ? (
          <Empty />
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Datos</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.data.map((row) => (
                  <tr key={row.id}>
                    <td>{row.nombre}{kind === "clientes" && <small className="d-block text-secondary">{row.tipo === "empresa" ? "Empresa con RUC" : "Persona"}</small>}</td>
                    <td>
                      {kind === "clientes"
                        ? <>{row.documento && <span className="d-block">{row.tipo === "empresa" ? "RUC" : "Documento"}: {row.documento}</span>}{row.telefono && <small className="d-block">{row.telefono}</small>}{row.direccion && <small className="d-block text-secondary">{row.direccion}</small>}{!row.documento && !row.telefono && !row.direccion && "Sin datos adicionales"}</>
                        : kind === "usuarios"
                          ? `${row.usuario} · ${row.rol} · ${row.activo ? "Activo" : "Inactivo"}`
                          : row.activo
                            ? "Activa"
                            : "Inactiva"}
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-primary me-2"
                        onClick={() => setEdit(row)}
                      >
                        Editar
                      </button>
                      {kind === "clientes" && (
                        <button
                          className="btn btn-sm btn-outline-secondary"
                          disabled={historyBusy}
                          onClick={() => loadHistory(row.id, 1)}
                        >
                          Historial
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {kind !== "categorias" && (
          <Pager page={page} setPage={setPage} count={list.data?.length || 0} />
        )}
      </section>
      {history && (
        <section className="panel mt-4">
          <h2>Historial de {history.cliente.nombre}</h2>
          <h3 className="h6">Compras</h3>
          {history.ventas.length ? (
            history.ventas.map((v: any) => (
              <p key={v.id}>
                <a href={"/app/ventas/" + v.id}>Venta #{v.id}</a> ·{" "}
                {date(v.fecha)} · {money(v.total)} · {v.estado}
              </p>
            ))
          ) : (
            <p>No hay compras en esta página.</p>
          )}
          <h3 className="h6">Cotizaciones y pedidos</h3>
          {!history.cotizaciones.length && (
            <p>No hay cotizaciones en esta página.</p>
          )}
          {history.cotizaciones.map((q: any) => (
            <p key={q.id}>
              <a href={"/app/cotizaciones/" + q.id}>Cotización #{q.id}</a> ·{" "}
              {q.estado} · Pedido: {q.pedido || "sin pedido"}
            </p>
          ))}
          {historyBusy && <p role="status">Cargando historial…</p>}
          <div className="d-flex gap-3 align-items-center my-3">
            <button
              className="btn btn-outline-secondary btn-sm"
              disabled={historyBusy || historyPage === 1}
              onClick={() => loadHistory(history.cliente.id, historyPage - 1)}
            >
              Anterior
            </button>
            <span>Página {historyPage}</span>
            <button
              className="btn btn-outline-secondary btn-sm"
              disabled={
                historyBusy ||
                Math.max(history.ventas.length, history.cotizaciones.length) <
                  30
              }
              onClick={() => loadHistory(history.cliente.id, historyPage + 1)}
            >
              Siguiente
            </button>
          </div>
          <button className="btn btn-link" onClick={() => setHistory(null)}>
            Cerrar historial
          </button>
        </section>
      )}
    </>
  );
}
