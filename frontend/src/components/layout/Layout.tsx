import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navbar from './Navbar';
import BrandLogo from '../branding/BrandLogo';

const basicNavItems = [
  { to: '/dashboard', label: 'Inicio', icon: 'home' },
  { to: '/products', label: 'Catalogo', icon: 'catalog' },
  { to: '/favorites', label: 'Favoritos', icon: 'star' },
  { to: '/weekly-plans', label: 'Planes', icon: 'calendar' },
  { to: '/lists', label: 'Mis listas', icon: 'list' },
  { to: '/recipes', label: 'Recetas', icon: 'recipe' },
];

const advancedNavItems = [
  { to: '/dashboard', label: 'Inicio', icon: 'home' },
  { to: '/products', label: 'Catalogo', icon: 'catalog' },
  { to: '/favorites', label: 'Favoritos', icon: 'star' },
  { to: '/weekly-plans', label: 'Planes', icon: 'calendar' },
  { to: '/lists', label: 'Mis listas', icon: 'list' },
  { to: '/recipes', label: 'Recetas', icon: 'recipe' },
  { to: '/pantry', label: 'Despensa', icon: 'pantry' },
  { to: '/spending', label: 'Gasto', icon: 'spending' },
];

function SidebarIcon({ name }: { name: string }) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  const icons: Record<string, JSX.Element> = {
    home: (
      <path d="M3.5 9.5 12 3l8.5 6.5v9a1 1 0 0 1-1 1H14v-6H10v6H4.5a1 1 0 0 1-1-1v-9Z" {...common} />
    ),
    catalog: (
      <>
        <path d="M4 5h3l2.4 8.3a1 1 0 0 0 1 .7H17a1 1 0 0 0 1-.7L20 8H9.1" {...common} />
        <circle cx="10" cy="18.2" r="1.5" {...common} />
        <circle cx="17" cy="18.2" r="1.5" {...common} />
      </>
    ),
    star: <path d="m12 3 2.8 5.8 6.4.9-4.6 4.4 1.1 6.3L12 17.3 6.3 20.4l1.1-6.3L2.8 9.7l6.4-.9L12 3Z" {...common} />,
    calendar: (
      <>
        <rect x="3.5" y="5" width="17" height="15" rx="3" {...common} />
        <path d="M7.5 3v4M16.5 3v4M3.5 9.5h17" {...common} />
      </>
    ),
    list: (
      <>
        <path d="M8 7h9M8 12h9M8 17h9" {...common} />
        <circle cx="5" cy="7" r="1" fill="currentColor" />
        <circle cx="5" cy="12" r="1" fill="currentColor" />
        <circle cx="5" cy="17" r="1" fill="currentColor" />
      </>
    ),
    recipe: (
      <>
        <path d="M7 4v7a3 3 0 1 1-3-3V4M17 4v11a3 3 0 1 1-3-3h3" {...common} />
        <path d="M17 8h-3" {...common} />
      </>
    ),
    pantry: (
      <>
        <path d="M7 4h10v3H7zM5.5 7h13v13a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1z" {...common} />
        <path d="M9 11h6M9 15h4" {...common} />
      </>
    ),
    spending: (
      <>
        <path d="M12 3v18M16.5 7.5c0-1.9-1.8-3.5-4.5-3.5s-4.5 1.3-4.5 3.2c0 4.8 9 2 9 7 0 1.9-1.8 3.8-4.5 3.8s-4.8-1.6-4.8-3.7" {...common} />
      </>
    ),
    automation: (
      <>
        <rect x="5" y="7" width="14" height="10" rx="4" {...common} />
        <path d="M8 7V5a4 4 0 0 1 8 0v2M8 17v2M16 17v2M3.5 11H5M19 11h1.5" {...common} />
        <circle cx="10" cy="12" r="1" fill="currentColor" />
        <circle cx="14" cy="12" r="1" fill="currentColor" />
      </>
    ),
    mode: (
      <>
        <path d="M12 3v3M12 18v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M3 12h3M18 12h3M4.9 19.1 7 17M17 7l2.1-2.1" {...common} />
        <circle cx="12" cy="12" r="4" {...common} />
      </>
    ),
    logout: <path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l4-5-4-5M14 12H4" {...common} />,
  };

  return (
    <span className="nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        {icons[name]}
      </svg>
    </span>
  );
}

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
    if (location.pathname === '/products') return 'Catalogo';
    if (location.pathname === '/favorites') return 'Favoritos';
    if (location.pathname === '/weekly-plans') return 'Planes semanales';
    if (location.pathname.startsWith('/weekly-plans/')) return 'Detalle del plan';
    if (location.pathname === '/lists') return 'Mis listas';
    if (location.pathname.startsWith('/lists/')) return 'Detalle de lista';
    if (location.pathname === '/automation') return 'Automatizacion';
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
          <BrandLogo compact subtitle="Compra inteligente y planificada" />
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <SidebarIcon name={item.icon} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button
            onClick={toggleMode}
            title={isAdvanced ? 'Cambiar a modo basico' : 'Cambiar a modo avanzado'}
            style={{ fontSize: 12, opacity: 0.7 }}
          >
            <SidebarIcon name="mode" />
            {isAdvanced ? 'Modo avanzado' : 'Modo basico'}
          </button>
          <button onClick={logout}>
            <SidebarIcon name="logout" />
            Cerrar sesion
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
