import { FormEvent, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "../context/Auth";
import { useStore } from "../context/Store";
import { Field, Message } from "../components/UI";
// Recupera la sesión compartida y dirige al panel cuando el ingreso termina correctamente.
export default function Login() {
  const {store}=useStore();
  const { user, login, loading } = useAuth(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  if (loading)
    return (
      <p className="p-5" role="status">
        Comprobando sesión…
      </p>
    );
  if (user) return <Navigate to="/app" replace />;
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      await login(String(f.get("usuario")), String(f.get("password")));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-screen">
      <div className="login-story">
        <i
          aria-hidden="true"
          className="bi bi-journal-bookmark-fill display-3"
        />
        <span className="login-brand">{store.nombre}<span>ESPACIO DEL PERSONAL</span></span>
        <h1>
          Tu librería,
          <br />
          en orden.
        </h1>
        <p>Ventas, inventario y pedidos.</p>
        <span>HUAMANGA · AYACUCHO</span>
      </div>
      <div className="login-form">
        <h2>Bienvenido de nuevo</h2>
        <Message error={error} />
        <form onSubmit={submit}>
          <Field label="Usuario">
            <input
              name="usuario"
              autoComplete="username"
              className="form-control"
              required
              maxLength={80}
            />
          </Field>
          <Field label="Contraseña">
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              className="form-control"
              required
              maxLength={72}
            />
          </Field>
          <button disabled={busy} className="btn btn-primary w-100 mt-3">
            {busy ? "Ingresando…" : "Iniciar sesión"}
          </button>
        </form>
        <Link to="/catalogo" className="d-block mt-4">
          ← Volver al catálogo
        </Link>
      </div>
    </div>
  );
}
