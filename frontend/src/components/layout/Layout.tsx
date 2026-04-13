import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import { useAuth } from '../../hooks/useAuth';

const basicNavItems = [
  { to: '/dashboard', label: 'Inicio', icon: '\u{1F3E0}' },
  { to: '/products', label: 'Catálogo', icon: '\u{1F96C}' },
  { to: '/favorites', label: 'Favoritos', icon: '\u2B50' },
  { to: '/weekly-plans', label: 'Planes', icon: '\u{1F4C5}' },
  { to: '/lists', label: 'Mis listas', icon: '\u{1F4CB}' },
  { to: '/recipes', label: 'Recetas', icon: '\u{1F37D}' },
];

const advancedNavItems = [
  { to: '/dashboard', label: 'Inicio', icon: '\u{1F3E0}' },
  { to: '/products', label: 'Catálogo', icon: '\u{1F96C}' },
  { to: '/favorites', label: 'Favoritos', icon: '\u2B50' },
  { to: '/lists', label: 'Mis listas', icon: '\u{1F4CB}' },
  { to: '/recipes', label: 'Recetas', icon: '\u{1F37D}' },
  { to: '/pantry', label: 'Despensa', icon: '\u{1F9FA}' },
  { to: '/spending', label: 'Gasto', icon: '\u{1F4B0}' },
  { to: '/automation', label: 'Automatización', icon: '\u{1F916}' },
];

export default function Layout() {
  const { logout, user, update } = useAuth();
  const location = useLocation();
  const isAdvanced = user?.ui_mode !== 'basic';
  const navItems = isAdvanced ? advancedNavItems : basicNavItems;

  const toggleMode = async () => {
    if (!user) return;
    await update({ ui_mode: isAdvanced ? 'basic' : 'advanced' });
  };

  const getPageTitle = () => {
    if (location.pathname === '/dashboard') return 'Inicio';
    if (location.pathname === '/products') return 'Catálogo';
    if (location.pathname === '/favorites') return 'Favoritos';
    if (location.pathname === '/weekly-plans') return 'Planes semanales';
    if (location.pathname.startsWith('/weekly-plans/')) return 'Detalle del plan';
    if (location.pathname === '/lists') return 'Mis listas';
    if (location.pathname.startsWith('/lists/')) return 'Detalle de lista';
    if (location.pathname === '/automation') return 'Automatización';
    if (location.pathname === '/recipes') return 'Recetas';
    if (location.pathname.startsWith('/recipes/')) return 'Detalle de receta';
    if (location.pathname === '/pantry') return 'Despensa';
    if (location.pathname === '/spending') return 'Control de gasto';
    if (location.pathname.endsWith('/supermarket')) return 'Modo supermercado';
    return 'MercaCompra';
  };

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>
            Merca<span>Compra</span>
          </h1>
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
          <button
            onClick={toggleMode}
            title={isAdvanced ? 'Cambiar a modo básico' : 'Cambiar a modo avanzado'}
            style={{ fontSize: 12, opacity: 0.7 }}
          >
            <span>{isAdvanced ? '\u{1F527}' : '\u2728'}</span>
            {isAdvanced ? 'Modo avanzado' : 'Modo básico'}
          </button>
          <button onClick={logout}>
            <span>{'\u{1F6AA}'}</span>
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
