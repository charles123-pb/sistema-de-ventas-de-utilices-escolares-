import {
  ReactNode,
  useState,
  useEffect,
  useId,
  isValidElement,
  cloneElement,
} from "react";
import { illustrationFor } from "../data/schoolLists";
export function Message({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}
      {success && (
        <div role="status" className="alert alert-success">
          {success}
        </div>
      )}
    </>
  );
}
export function Heading({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-heading">
      <div>
        <h1>{title}</h1>
        {sub && <p className="text-secondary mb-0">{sub}</p>}
      </div>
      {action}
    </header>
  );
}
export function Empty({
  text = "No hay registros para mostrar.",
}: {
  text?: string;
}) {
  return (
    <div className="empty">
      <i aria-hidden="true" className="bi bi-inbox" />
      <p>{text}</p>
    </div>
  );
}
// La API devuelve hasta 30 registros por página; una página incompleta desactiva Siguiente.
export function Pager({
  page,
  setPage,
  count,
}: {
  page: number;
  setPage: (n: number) => void;
  count: number;
}) {
  return (
    <div className="d-flex gap-3 align-items-center my-3">
      <button
        className="btn btn-outline-secondary btn-sm"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </button>
      <span>Página {page}</span>
      <button
        className="btn btn-outline-secondary btn-sm"
        disabled={count < 30}
        onClick={() => setPage(page + 1)}
      >
        Siguiente
      </button>
    </div>
  );
}
// Centraliza carga, error y recarga; las dependencias determinan cuándo repetir la consulta.
export function useLoad<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [version, setVersion] = useState(0);
  useEffect(() => {
    // Ignora respuestas antiguas al cambiar filtros o desmontar la pantalla; no cancela la petición HTTP.
    let live = true;
    setLoading(true);
    setError("");
    loader()
      .then((v) => {
        if (live) setData(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    }; /* El consumidor declara las dependencias de la consulta. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);
  return { data, error, loading, reload: () => setVersion((v) => v + 1) };
}
// Vincula cada etiqueta con su control para permitir foco con clic y lectura accesible.
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const generatedId = useId();
  let id = generatedId;
  let control = children;
  // La etiqueta conserva su nombre aunque cambie el texto del formulario.
  if (isValidElement<{ id?: string }>(children)) {
    id = children.props.id || generatedId;
    control = cloneElement(children, { id });
  }
  return (
    <div className="field">
      <label className="form-label" htmlFor={id}>
        {label}
      </label>
      {control}
    </div>
  );
}
export function Status({ value }: { value: string }) {
  return (
    <span
      className={`badge rounded-pill status-badge status-${value.replaceAll(" ", "-")}`}
    >
      {value}
    </span>
  );
}

// Si falta la foto o no carga, muestra una ilustración local según el producto.
export function ProductImage({
  src,
  name,
  category = "",
}: {
  src: string;
  name: string;
  category?: string;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  return (
    <div className="product-image">
      {src && !failed ? (
        <img
          src={src}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      ) : (
        <>
          <img
            className="product-illustration"
            src={`/illustrations/${illustrationFor(name, category)}.svg`}
            alt={`Ilustración referencial de ${name}`}
            loading="lazy"
          />
          <span className="illustration-note">Ilustración referencial</span>
        </>
      )}
    </div>
  );
}
