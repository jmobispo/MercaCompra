import { Outlet, NavLink, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { useAuth } from '../../hooks/useAuth';

const navItems = [
  { to: '/dashboard', label: 'Inicio', icon: '🏠' },
  { to: '/lists', label: 'Mis listas', icon: '📋' },
  { to: '/recipes', label: 'Recetas', icon: '🍳' },
  { to: '/automation', label: 'Automatización', icon: '🤖' },
];

export default function Layout() {
  const { logout, user } = useAuth();
  const location = useLocation();

  const getPageTitle = () => {
    if (location.pathname === '/dashboard') return 'Inicio';
    if (location.pathname === '/lists') return 'Mis listas';
    if (location.pathname.startsWith('/lists/')) return 'Detalle de lista';
    if (location.pathname === '/automation') return 'Automatización';
    if (location.pathname === '/recipes') return 'Recetas';
    if (location.pathname.startsWith('/recipes/')) return 'Detalle de receta';
    return 'MercaCompra';
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Merca<span>Compra</span></h1>
          <p>Lista de la compra</p>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button onClick={logout}>
            <span>🚪</span>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="main-area">
        <Navbar title={getPageTitle()} user={user} />
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
