import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { getRuns } from '../api/automation';
import { getDashboard } from '../api/dashboard';
import { getLists } from '../api/lists';
import { addFrequentProductsToList, getFrequentProducts } from '../api/products';
import { getWeeklyPlans } from '../api/weeklyPlans';
import { useAuthStore } from '../store/authStore';
import type {
  AutomationRun,
  DashboardData,
  FrequentProduct,
  ShoppingListSummary,
  WeeklyPlanSummary,
} from '../types';

function MetricIcon({ kind }: { kind: 'spend' | 'lists' | 'items' | 'plans' }) {
  const icons = {
    spend: (
      <>
        <rect x="4" y="6" width="16" height="12" rx="6" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 12h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="2.6" fill="currentColor" />
      </>
    ),
    lists: (
      <>
        <rect x="5" y="4" width="14" height="16" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 9h6M9 13h6M9 17h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    items: (
      <>
        <path d="M7 8h12l-1.2 7a2 2 0 0 1-2 1.7H10a2 2 0 0 1-2-1.7L7 8Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 8V7a3 3 0 0 1 6 0v1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
    plans: (
      <>
        <rect x="4" y="5" width="16" height="15" rx="4" stroke="currentColor" strokeWidth="1.8" />
        <path d="M8 3v4M16 3v4M4 9h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M8 13h3M8 16h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </>
    ),
  };

  return (
    <span className="stat-icon stat-icon-svg" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none">
        {icons[kind]}
      </svg>
    </span>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="dashboard-status-row">
      <span className="dashboard-status-label">{label}</span>
      <span
        className="dashboard-status-value"
        style={{
          color:
            ok === true
              ? 'var(--color-success, #22c55e)'
              : ok === false
                ? 'var(--color-danger, #ef4444)'
                : 'inherit',
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanSummary[]>([]);
  const [frequentProducts, setFrequentProducts] = useState<FrequentProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingBasics, setAddingBasics] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dashboardData, listsData, runsData, plansData, basicsData] = await Promise.all([
          getDashboard(),
          getLists(),
          getRuns(),
          getWeeklyPlans(),
          getFrequentProducts(6),
        ]);
        setDashboard(dashboardData);
        setLists(listsData);
        setRuns(runsData);
        setWeeklyPlans(plansData);
        setFrequentProducts(basicsData);
      } catch {
        setError('Error al cargar el panel');
      } finally {
        setLoading(false);
      }
    };

    void fetchData();
  }, []);

  const activeLists = lists.filter((item) => !item.is_archived);
  const totalItems = lists.reduce((sum, item) => sum + item.item_count, 0);
  const totalSpend = lists.reduce((sum, item) => sum + item.total, 0);
  const recentRuns = runs.slice(0, 5);

  const formatCurrency = (value: number) =>
    value.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const variationColor = (value: number) =>
    value > 0
      ? 'var(--color-danger, #ef4444)'
      : value < 0
        ? 'var(--color-success, #22c55e)'
        : 'inherit';

  const handleAddBasics = async () => {
    setAddingBasics(true);
    try {
      const response = await addFrequentProductsToList({
        new_list_name: 'Tus basicos',
        limit: 6,
      });
      window.alert(`Se ha creado "${response.list_name}" con ${response.added} productos frecuentes.`);
    } catch {
      setError('No se pudieron añadir tus básicos');
    } finally {
      setAddingBasics(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando...</span>
      </div>
    );
  }

  return (
    <div className="dashboard-page">
      <div className="page-header">
        <div>
          <h1>Hola, {user?.username ?? 'Usuario'}</h1>
          <p>Aquí tienes un resumen de tu actividad</p>
        </div>
        <Link to="/lists" className="btn btn-primary">
          + Nueva lista
        </Link>
      </div>

      {error && <div className="alert alert-error dashboard-alert">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card accent">
          <MetricIcon kind="spend" />
          <div className="stat-label">Gasto esta semana</div>
          <div className="stat-value dashboard-stat-value-lg">
            {formatCurrency(dashboard?.weekly_spending ?? totalSpend)}
          </div>
          {(dashboard?.weekly_variation ?? 0) !== 0 && (
            <div
              className="dashboard-variation-note"
              style={{ color: variationColor(dashboard?.weekly_variation ?? 0) }}
            >
              {(dashboard?.weekly_variation ?? 0) > 0 ? '▲' : '▼'}{' '}
              {Math.abs(dashboard?.weekly_variation ?? 0).toFixed(1)}% vs semana anterior
            </div>
          )}
        </div>
        <div className="stat-card">
          <MetricIcon kind="lists" />
          <div className="stat-label">Listas activas</div>
          <div className="stat-value">{dashboard?.active_list_count ?? activeLists.length}</div>
        </div>
        <div className="stat-card">
          <MetricIcon kind="items" />
          <div className="stat-label">Total artículos</div>
          <div className="stat-value">{totalItems}</div>
        </div>
        <div className="stat-card">
          <MetricIcon kind="plans" />
          <div className="stat-label">Planes semanales</div>
          <div className="stat-value">{weeklyPlans.length}</div>
        </div>
      </div>

      <div className="dashboard-columns">
        <div className="card">
          <div className="card-header">
            <h2>Listas recientes</h2>
            <Link to="/lists" className="btn btn-ghost btn-sm">Ver todas</Link>
          </div>
          <div className="card-body dashboard-card-list">
            {activeLists.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon empty-icon-soft">◦</div>
                <p>No tienes listas aún</p>
              </div>
            ) : (
              activeLists.slice(0, 5).map((list) => (
                <Link
                  key={list.id}
                  to={`/lists/${list.id}`}
                  className="dashboard-list-link"
                >
                  <div className="dashboard-list-link-copy">
                    <div className="dashboard-list-link-title">{list.name}</div>
                    <div className="dashboard-list-link-meta">
                      {list.item_count} artículos · {formatDate(list.updated_at)}
                    </div>
                  </div>
                  <div className="dashboard-list-link-value">
                    {formatCurrency(list.total)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Automatizaciones recientes</h2>
            <Link to="/automation" className="btn btn-ghost btn-sm">Ver todas</Link>
          </div>
          <div className="card-body dashboard-card-list">
            {recentRuns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon empty-icon-soft">◦</div>
                <p>No hay ejecuciones aún</p>
              </div>
            ) : (
              recentRuns.map((run) => (
                <Link
                  key={run.id}
                  to="/automation"
                  className="dashboard-list-link"
                >
                  <div className="dashboard-list-link-copy">
                    <div className="dashboard-list-link-title">Ejecución #{run.id}</div>
                    <div className="dashboard-list-link-meta">
                      {run.added_ok}/{run.total_items} añadidos · {formatDate(run.created_at)}
                    </div>
                  </div>
                  <span className={`run-status ${run.status}`}>{run.status}</span>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-columns dashboard-columns-secondary">
        <div className="card">
          <div className="card-header">
            <h2>Tus básicos</h2>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleAddBasics}
              disabled={addingBasics || frequentProducts.length === 0}
            >
              {addingBasics ? 'Añadiendo...' : 'Añadir básicos'}
            </button>
          </div>
          <div className="card-body">
            {frequentProducts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon empty-icon-soft">◦</div>
                <p>Aún no hay hábitos suficientes</p>
              </div>
            ) : (
              <div className="dashboard-basics-grid">
                {frequentProducts.map((product) => (
                  <div key={product.product_id} className="dashboard-basic-card">
                    <div>
                      <div className="dashboard-basic-card-title">{product.product_name}</div>
                      <div className="dashboard-basic-card-meta">
                        {product.times_added} veces · media {product.average_quantity.toFixed(1)}
                      </div>
                    </div>
                    <div className="dashboard-basic-card-value">
                      {product.product_price != null ? formatCurrency(product.product_price) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Planificación semanal</h2>
            <Link to="/weekly-plans" className="btn btn-ghost btn-sm">Ver planes</Link>
          </div>
          <div className="card-body dashboard-card-list">
            {weeklyPlans.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon empty-icon-soft">◦</div>
                <p>Todavía no has creado planes</p>
              </div>
            ) : (
              weeklyPlans.slice(0, 4).map((plan) => (
                <Link
                  key={plan.id}
                  to={`/weekly-plans/${plan.id}`}
                  className="dashboard-list-link"
                >
                  <div className="dashboard-list-link-copy">
                    <div className="dashboard-list-link-title">{plan.title}</div>
                    <div className="dashboard-list-link-meta">
                      {plan.assigned_days}/{plan.days_count} días cubiertos
                    </div>
                  </div>
                  <div className="dashboard-list-link-value">{plan.people_count} pers.</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {dashboard?.system_status && (
        <div className="card dashboard-system-card">
          <div className="card-header">
            <h2>Estado del sistema</h2>
          </div>
          <div className="card-body">
            <div className="dashboard-status-grid">
              <StatusRow label="Búsqueda" value={dashboard.system_status.search_mode} />
              <StatusRow label="IA (recetas)" value={dashboard.system_status.ai_mode} />
              <StatusRow label="Código postal" value={dashboard.system_status.postal_code} />
              <StatusRow
                label="Bot Mercadona"
                value={dashboard.system_status.bot_available ? 'Disponible' : 'No disponible'}
                ok={dashboard.system_status.bot_available}
              />
              {dashboard.system_status.demo_mode && (
                <StatusRow label="Modo demo" value="Activo" ok />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
