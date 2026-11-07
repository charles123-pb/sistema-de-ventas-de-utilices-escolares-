import { Link } from "react-router-dom";
import { api, money, date } from "../services/api";
import { Heading, Message, Empty, useLoad } from "../components/UI";
// Consulta indicadores calculados por Go para el día de Lima y las ventas de los últimos siete días.
export default function Dashboard() {
  const { data: d, error, loading } = useLoad(() => api("/resumen"), []);
  return (
    <div className="dashboard-page">
      <div className="dashboard-welcome">
      <Heading
        title="Tu librería, de un vistazo"
        action={
          <Link to="/app/caja" className="btn btn-primary">
            <i aria-hidden="true" className="bi bi-plus-lg" /> Nueva venta
          </Link>
        }
      />
      </div>
      <Message error={error} />
      {loading ? (
        <p role="status">Cargando indicadores…</p>
      ) : (
        d && (
          <>
            <div className="workflow-links no-print">
              <Link to="/app/caja">
                <i aria-hidden="true" className="bi bi-cart-plus" />
                <span>
                  <b>Abrir caja</b>
                  <small>Registra una venta</small>
                </span>
                <i aria-hidden="true" className="bi bi-arrow-up-right" />
              </Link>
              <Link to="/app/cotizaciones">
                <i aria-hidden="true" className="bi bi-file-earmark-text" />
                <span>
                  <b>Revisar listas</b>
                  <small>{d.pendientes} solicitudes por preparar</small>
                </span>
                <i aria-hidden="true" className="bi bi-arrow-up-right" />
              </Link>
              <Link to="/app/pedidos">
                <i aria-hidden="true" className="bi bi-bag-check" />
                <span>
                  <b>Preparar pedidos</b>
                  <small>{d.pedidos_web_pendientes ? `${d.pedidos_web_pendientes} directos · ` : ""}{d.listos} listos para recoger</small>
                </span>
                <i aria-hidden="true" className="bi bi-arrow-up-right" />
              </Link>
            </div>
            <div className="metrics">
              {[
                ["Ventas de hoy", money(d.total), "cash-stack"],
                ["Ventas realizadas", d.cantidad, "receipt"],
                ["Cotizaciones pendientes", d.pendientes, "file-earmark-text"],
                ["Listos para recoger", d.listos, "bag-check"],
              ].map(([label, value, icon]) => (
                <section className="metric" key={label}>
                  <i aria-hidden="true" className={"bi bi-" + icon} />
                  <span>{label}</span>
                  <strong>{value}</strong>
                </section>
              ))}
            </div>
            <div className="row g-4 mt-1">
              <div className="col-lg-8">
                <section className="panel">
                  <h2>Ventas de los últimos 7 días</h2>
                  <div
                    className="chart"
                    role="img"
                    aria-label="Ventas diarias en soles"
                  >
                    {d.grafico.map((g: any) => (
                      <div className="chart-column" key={g.dia}>
                        <small>{money(g.total)}</small>
                        <div
                          className="chart-bar"
                          style={{
                            height: Math.max(
                              3,
                              (g.total /
                                Math.max(
                                  ...d.grafico.map((v: any) => v.total),
                                  1,
                                )) *
                                150,
                            ),
                          }}
                        />
                        <span>{g.dia}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
              <div className="col-lg-4">
                <section className="panel attention">
                  <i aria-hidden="true" className="bi bi-box-seam" />
                  <h2>Atención al inventario</h2>
                  <strong className="display-5">{d.stock_bajo}</strong>
                  <p>productos en su stock mínimo o por debajo.</p>
                  <Link to="/app/stock?tab=reposicion">
                    Consultar stock bajo →
                  </Link>
                </section>
              </div>
            </div>
            {d.margen !== undefined && (
              <div className="panel margin-summary mt-4">
                Costo vendido: <b>{money(d.costo)}</b> · Margen bruto:{" "}
                <b>{money(d.margen)}</b>
                <small className="d-block text-secondary">
                  El margen bruto no descuenta gastos operativos.
                </small>
              </div>
            )}
            <section className="panel mt-4">
              <h2>Últimas ventas</h2>
              {!d.ultimas.length ? (
                <Empty text="Aún no se han registrado ventas." />
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Venta</th>
                        <th>Fecha</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.ultimas.map((v: any) => (
                        <tr key={v.id}>
                          <td>
                            <Link to={"/app/ventas/" + v.id}>#{v.id}</Link>
                          </td>
                          <td>{date(v.fecha)}</td>
                          <td>{money(v.total)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
