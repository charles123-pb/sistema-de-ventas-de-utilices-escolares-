import { NavLink, Outlet, Link, useLocation } from "react-router-dom";
import { useRef, useState } from "react";
import { useAuth } from "../context/Auth";
import { Message } from "./UI";
import { useStore, StoreLogo } from "../context/Store";
type MenuLink = { to: string; icon: string; label: string };
type MenuGroup = { id: string; icon: string; label: string; links: MenuLink[] };

// Marco del panel: menú agrupado por tareas, permisos del usuario y contenido de la ruta mediante Outlet.
export function Layout() {
  const {store}=useStore();
  const [collapsed,setCollapsed]=useState(()=>{try{return localStorage.getItem("uv:sidebar-collapsed")==="1";}catch{return false;}});
  function changeCollapsed(value:boolean){setCollapsed(value);try{localStorage.setItem("uv:sidebar-collapsed",value?"1":"0");}catch{/* La navegación funciona sin almacenamiento. */}}
  const { user, logout } = useAuth(),
    [open, setOpen] = useState(false),
    [error, setError] = useState("");
  const { pathname } = useLocation();
  const menuButton = useRef<HTMLButtonElement>(null);
  const admin = user?.rol === "administrador";
  const groups: MenuGroup[] = [
    {
      id: "listas",
      icon: "journal-text",
      label: "Listas escolares",
      links: [
        {
          to: "/app/cotizaciones",
          icon: "file-earmark-text",
          label: "Cotizaciones",
        },
        { to: "/app/pedidos", icon: "bag-check", label: "Pedidos" },
      ],
    },
    {
      id: "productos",
      icon: "box-seam",
      label: "Inventario",
      links: [
        { to: "/app/productos", icon: "box-seam", label: "Productos" },
        ...(admin
          ? [
              { to: "/app/stock", icon: "arrow-down-up", label: "Control de inventario" },
              { to: "/app/proveedores", icon: "truck", label: "Proveedores" },
            ]
          : []),
      ],
    },
    {
      id: "gestion",
      icon: "sliders2",
      label: "Gestión",
      links: [
        { to: "/app/clientes", icon: "people", label: "Clientes" },
        { to: "/app/reportes", icon: "bar-chart", label: "Reportes" },
        ...(admin
          ? [{ to: "/app/ventas", icon: "receipt", label: "Historial de ventas" },
             { to: "/app/respaldos", icon: "database-check", label: "Respaldos" },
             { to: "/app/usuarios", icon: "person-gear", label: "Usuarios" },
             { to: "/app/configuracion", icon: "gear", label: "Configuración" }]
          : []),
      ],
    },
  ];
  const matchesRoute = (to: string) =>
    pathname === to || pathname.startsWith(to + "/");
  const activeGroup = groups.find((group) =>
    group.links.some((link) => matchesRoute(link.to)),
  );
  // Al cambiar de ruta se abre su grupo; solo se despliega uno a la vez.
  const [expanded, setExpanded] = useState<{
    path: string;
    id: string | null;
  } | null>(null);
  const expandedId = expanded?.path === pathname ? expanded.id : activeGroup?.id;
  const inSales = matchesRoute("/app/caja") || (!admin && matchesRoute("/app/ventas"));
  const currentSection =
    activeGroup?.label || (inSales ? "Caja de ventas" : "Inicio");
  return (
    <div className={"workspace staff-compact"+(collapsed?" sidebar-collapsed":"")}>
      <button
        ref={menuButton}
        className="mobile-menu btn btn-dark"
        aria-label={open ? "Cerrar menú" : "Abrir menú"}
        aria-expanded={open}
        aria-controls="personal-sidebar"
        onClick={() => setOpen(!open)}
      >
        <i aria-hidden="true" className={open ? "bi bi-x-lg" : "bi bi-list"} />
        <span>{store.nombre === "ÚtilVenta Ayacucho" ? "ÚtilVenta" : store.nombre}</span><span className="mobile-menu-context">{currentSection}</span>
      </button>
      {open && (
        <button
          className="sidebar-backdrop"
          aria-label="Cerrar menú lateral"
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        id="personal-sidebar"
        className={open ? "sidebar open" : "sidebar"}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setOpen(false);
            menuButton.current?.focus();
          }
        }}
      >
        <div className="sidebar-header">
        <Link className="brand" title={store.nombre} to="/app" onClick={() => setOpen(false)}>
          <StoreLogo />
          <span>
            {store.nombre === "ÚtilVenta Ayacucho" ? "ÚtilVenta" : store.nombre}<small>{store.telefono || "HUAMANGA · AYACUCHO"}</small>
          </span>
        </Link>
        <button type="button" className="sidebar-collapse" aria-label={collapsed?"Expandir menú":"Contraer menú"} title={collapsed?"Expandir menú":"Contraer menú"} aria-controls="personal-sidebar" aria-expanded={!collapsed} onClick={()=>changeCollapsed(!collapsed)}><i className={"bi bi-layout-sidebar"+(collapsed?"-reverse":"")} aria-hidden="true" /></button>
        </div>
        <nav aria-label="Módulos del personal">
          <NavLink to="/app" title="Inicio" end onClick={() => setOpen(false)}>
            <i aria-hidden="true" className="bi bi-grid-1x2" />
            <span className="nav-link-label">Inicio</span>
          </NavLink>
          <NavLink
            to="/app/caja"
            title="Caja de ventas"
            className={"nav-sale"+(inSales ? " active" : "")}
            onClick={() => setOpen(false)}
          >
            <i aria-hidden="true" className="bi bi-receipt-cutoff" />
            <span className="nav-link-label">Caja de ventas</span>
          </NavLink>
          {groups.map((group) => (
            <div className="nav-group" key={group.id}>
              <button
                className={
                  activeGroup?.id === group.id
                    ? "nav-group-toggle current"
                    : "nav-group-toggle"
                }
                title={group.label}
                aria-expanded={expandedId === group.id}
                aria-controls={"menu-" + group.id}
                onClick={() => {
                  if(collapsed) changeCollapsed(false);
                  setExpanded({
                    path: pathname,
                    id: collapsed ? group.id : expandedId === group.id ? null : group.id,
                  });
                }}
              >
                <i aria-hidden="true" className={"bi bi-" + group.icon} />
                <span className="nav-link-label">{group.label}</span>
                <i aria-hidden="true" className="bi bi-chevron-down nav-chevron" />
              </button>
              <div
                id={"menu-" + group.id}
                className="nav-submenu"
                hidden={expandedId !== group.id}
              >
                {group.links.map(({ to, icon, label }) => (
                  <NavLink key={to} to={to} title={label} onClick={() => setOpen(false)}>
                    <i aria-hidden="true" className={"bi bi-" + icon} />
                    {label}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <Link className="sidebar-store-link" to="/catalogo" title="Ver catálogo público" onClick={()=>setOpen(false)}>
            <i aria-hidden="true" className="bi bi-shop" /><span className="nav-link-label">Ver catálogo público</span><i className="bi bi-arrow-up-right store-link-arrow" aria-hidden="true" />
          </Link>
          <div className="sidebar-account">
            <div className="user-info" title={`${user?.nombre} · ${admin?"Administrador":"Vendedor"}`}>
              <span className="sidebar-avatar" aria-hidden="true">{user?.nombre.trim().split(/\s+/).slice(0,2).map(word=>word[0]).join("").toUpperCase()}</span>
              <div className="sidebar-account-name">{user?.nombre}<small>{admin?"Administrador":"Vendedor"}</small></div>
            </div>
            <button type="button" className="sidebar-logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={()=>logout().catch(e=>setError(e.message))}><i className="bi bi-box-arrow-right" aria-hidden="true" /></button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <div className="staff-topbar">
          <span>
            Panel del personal <span className="topbar-separator">/</span>{" "}
            {currentSection}
          </span>
          <div className="topbar-context"><span className="workspace-role"><i className={admin ? "bi bi-shield-check" : "bi bi-person-badge"} aria-hidden="true" /> {admin ? "Administrador" : "Vendedor"}</span><time>
            {new Intl.DateTimeFormat("es-PE", {
              timeZone: "America/Lima",
              day: "numeric",
              month: "long",
              year: "numeric",
            }).format(new Date())}
          </time>
          </div>
        </div>
        <Message error={error} />
        <Outlet />
      </main>
    </div>
  );
}
// Marco compartido por el catálogo y el seguimiento que no requieren cuenta del personal.
export function PublicLayout() {
  const {store}=useStore();
  return (
    <>
      <nav className="public-nav">
        <Link className="brand" to="/catalogo">
          <StoreLogo />
          <span>
            {store.nombre === "ÚtilVenta Ayacucho" ? "ÚtilVenta" : store.nombre}<small>{store.telefono || "HUAMANGA · AYACUCHO"}</small>
          </span>
        </Link>
        <Link className="btn btn-outline-primary" to="/login">
          Acceso del personal
        </Link>
      </nav>
      <main className="public-main">
        <Outlet />
      </main>
      <footer>
        <div className="footer-brand">{store.nombre}</div>
        <div>{store.direccion || "Huamanga · Ayacucho"}</div>
        {store.telefono && <div>{store.telefono}</div>}
        {store.horario && <div>{store.horario}</div>}
        <a href="/fuentes-imagenes.html" className="d-block mt-2">Créditos de fotografías</a>
      </footer>
    </>
  );
}
