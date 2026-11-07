import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./styles/app.css";
import "./styles/workspace.css";
import "./styles/refinements.css";
import "./styles/school-list.css";
import "./styles/checkout-customer.css";
import "./styles/quote-review.css";
import "./styles/operations.css";
import "./styles/theme.css";
import { AuthProvider, useAuth } from "./context/Auth";
import { Layout, PublicLayout } from "./components/Layout";
import Login from "./pages/Login";
import Settings from "./pages/Settings";
import { OrderTracking } from "./pages/WebOrders";
import { StoreProvider } from "./context/Store";
import "./styles/direct-orders.css";
import "./styles/sidebar.css";
import "./styles/stock.css";
import "./styles/list-flow.css";
import "./styles/orders.css";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Suppliers from "./pages/Suppliers";
import Checkout, { SaleDetail } from "./pages/Checkout";
import Catalog from "./pages/Catalog";
import Quotes, { QuoteDetail } from "./pages/Quotes";
import Stock, { StockLegacy } from "./pages/Stock";
import Orders from "./pages/Orders";
import { Records } from "./pages/Management";
import Reports from "./pages/Reports";
import { Backups, SalesHistory } from "./pages/Operations";
// Espera a comprobar la cookie de sesión antes de mostrar el panel o redirigir al ingreso.
function Protected() {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <p className="p-5" role="status">
        Comprobando sesión…
      </p>
    );
  return user ? <Layout /> : <Navigate to="/login" replace />;
}
// Restringe la navegación de administración; el servidor también verifica estos permisos.
function Admin({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  return user?.rol === "administrador" ? (
    children
  ) : (
    <Navigate to="/app" replace />
  );
}
// Define el mapa de pantallas: catálogo y seguimiento públicos, y módulos del personal bajo /app.
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/catalogo" replace />} />
          <Route element={<PublicLayout />}>
            <Route path="/catalogo" element={<Catalog />} />
            <Route path="/lista" element={<Navigate to="/catalogo#solicitud" replace />} />
            <Route path="/pedido/:token" element={<OrderTracking />} />
            <Route
              path="/seguimiento/:token"
              element={<QuoteDetail publicView />}
            />
          </Route>
          <Route path="/login" element={<Login />} />
          <Route path="/app" element={<Protected />}>
            <Route index element={<Dashboard />} />
            <Route path="configuracion" element={<Admin><Settings /></Admin>} />
            <Route path="productos" element={<Products />} />
            <Route path="caja" element={<Checkout />} />
            <Route path="ventas/:id" element={<SaleDetail />} />
            <Route path="ventas" element={<Admin><SalesHistory /></Admin>} />
            <Route path="cierres-caja" element={<Admin><Navigate to="/app/caja?cierre=1" replace /></Admin>} />
            <Route path="stock" element={<Admin><Stock /></Admin>} />
            <Route path="reposicion" element={<Admin><StockLegacy tab="reposicion" /></Admin>} />
            <Route path="respaldos" element={<Admin><Backups /></Admin>} />
            <Route path="cotizaciones" element={<Quotes />} />
            <Route path="cotizaciones/:id" element={<QuoteDetail />} />
            <Route path="pedidos" element={<Orders />} />
            <Route
              path="clientes"
              element={<Records key="clientes" kind="clientes" />}
            />
            <Route path="reportes" element={<Reports />} />
            <Route path="proveedores" element={<Admin><Suppliers /></Admin>} />
            <Route
              path="inventario"
              element={
                <Admin>
                  <StockLegacy />
                </Admin>
              }
            />
            <Route
              path="categorias"
              element={
                <Admin>
                  <Navigate to="/app/productos?categorias=1" replace />
                </Admin>
              }
            />
            <Route
              path="usuarios"
              element={
                <Admin>
                  <Records key="usuarios" kind="usuarios" />
                </Admin>
              }
            />
          </Route>
          <Route
            path="*"
            element={
              <div className="p-5">
                <h1>Página no encontrada</h1>
                <a href="/">Volver al inicio</a>
              </div>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <StoreProvider><App /></StoreProvider>
  </React.StrictMode>,
);
