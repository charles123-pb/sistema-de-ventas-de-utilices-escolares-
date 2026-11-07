import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, money, date, today } from "../services/api";
import { useAuth } from "../context/Auth";
import {
  Heading,
  Field,
  Message,
  Empty,
  Pager,
  useLoad,
} from "../components/UI";
// Usa los mismos filtros para la tabla paginada y la descarga CSV generada por Go.
export default function Reports() {
  const [params] = useSearchParams(),
    [type, setType] = useState(params.get("tipo") || "ventas"),
    [from, setFrom] = useState(today()),
    [to, setTo] = useState(today()),
    [page, setPage] = useState(1);
  const { user } = useAuth();
  const query = `tipo=${type}&desde=${from}&hasta=${to}&pagina=${page}`,
    list = useLoad(() => api<any[]>("/reportes?" + query), [query]);
  // Las columnas dependen del reporte y de los datos que el servidor autoriza según el rol.
  const cols = list.data?.length ? Object.keys(list.data[0]) : [];
  return (
    <>
      <Heading
        title="Reportes"
        sub="Fechas de Lima · CSV hasta 10 000 registros."
        action={
          <div className="d-flex gap-2 flex-wrap">{user?.rol==="administrador"&&<Link className="btn btn-outline-primary" to="/app/ventas">Historial de ventas</Link>}<a
            href={"/api/reportes?" + query + "&csv=1"}
            className="btn btn-primary"
          >
            Descargar CSV
          </a>
          </div>
        }
      />
      <section className="panel mb-4">
        <div className="form-grid">
          <Field label="Reporte">
            <select
              className="form-select"
              value={type}
              onChange={(e) => {
                setType(e.target.value);
                setPage(1);
              }}
            >
              <option value="ventas">Ventas y margen</option>
              <option value="productos">Productos más vendidos</option>
              <option value="stock">Stock bajo</option>
              {user?.rol === "administrador" && (
                <option value="movimientos">Movimientos de inventario</option>
              )}
            </select>
          </Field>
          <Field label="Desde">
            <input
              className="form-control"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value);
                setPage(1);
              }}
            />
          </Field>
          <Field label="Hasta">
            <input
              className="form-control"
              type="date"
              min={from}
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setPage(1);
              }}
            />
          </Field>
        </div>
        {user?.rol === "administrador" && (
          <p className="small text-secondary mb-0">
            El margen bruto usa costos históricos y no descuenta gastos
            operativos.
          </p>
        )}
      </section>
      <Message error={list.error} />
      {type==="ventas"&&<p className="small text-secondary">Los totales incluyen ventas activas. Las anuladas se conservan en el historial.</p>}
      <section className="panel">
        {list.loading ? (
          <p>Cargando reporte…</p>
        ) : !list.data?.length ? (
          <Empty />
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  {cols.map((c) => (
                    <th key={c}>{c.replaceAll("_", " ")}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {list.data.map((row, n) => (
                  <tr key={n}>
                    {cols.map((c) => (
                      <td key={c}>
                        {["total", "costo", "margen"].includes(c) ? (
                          money(row[c])
                        ) : c === "fecha" ? (
                          date(row[c])
                        ) : c === "id" && type === "ventas" ? (
                          <Link to={"/app/ventas/" + row[c]}>#{row[c]}</Link>
                        ) : (
                          String(row[c] ?? "")
                        )}
                      </td>
                    ))}
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
