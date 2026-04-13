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

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span
        style={{
          fontWeight: 500,
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

    fetchData();
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
    <div>
      <div className="page-header">
        <div>
          <h1>Hola, {user?.username ?? 'Usuario'}</h1>
          <p>Aquí tienes un resumen de tu actividad</p>
        </div>
        <Link to="/lists" className="btn btn-primary">
          + Nueva lista
        </Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-icon">💸</div>
          <div className="stat-label">Gasto esta semana</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {formatCurrency(dashboard?.weekly_spending ?? totalSpend)}
          </div>
          {(dashboard?.weekly_variation ?? 0) !== 0 && (
            <div
              style={{
                fontSize: 12,
                color: variationColor(dashboard?.weekly_variation ?? 0),
                marginTop: 4,
              }}
            >
              {(dashboard?.weekly_variation ?? 0) > 0 ? '▲' : '▼'}{' '}
              {Math.abs(dashboard?.weekly_variation ?? 0).toFixed(1)}% vs semana anterior
            </div>
          )}
        </div>
        <div className="stat-card">
          <div className="stat-icon">📋</div>
          <div className="stat-label">Listas activas</div>
          <div className="stat-value">{dashboard?.active_list_count ?? activeLists.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛒</div>
          <div className="stat-label">Total artículos</div>
          <div className="stat-value">{totalItems}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🗓</div>
          <div className="stat-label">Planes semanales</div>
          <div className="stat-value">{weeklyPlans.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <h2>Listas recientes</h2>
            <Link to="/lists" className="btn btn-ghost btn-sm">Ver todas</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {activeLists.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📋</div>
                <p>No tienes listas aún</p>
              </div>
            ) : (
              activeLists.slice(0, 5).map((list) => (
                <Link
                  key={list.id}
                  to={`/lists/${list.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--color-border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{list.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {list.item_count} artículos · {formatDate(list.updated_at)}
                    </div>
                  </div>
                  <div style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
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
          <div className="card-body" style={{ padding: 0 }}>
            {recentRuns.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🤖</div>
                <p>No hay ejecuciones aún</p>
              </div>
            ) : (
              recentRuns.map((run) => (
                <Link
                  key={run.id}
                  to="/automation"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--color-border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>Ejecución #{run.id}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginTop: 20 }}>
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
                <div className="empty-icon">⭐</div>
                <p>Aún no hay hábitos suficientes</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {frequentProducts.map((product) => (
                  <div key={product.product_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{product.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {product.times_added} veces · media {product.average_quantity.toFixed(1)}
                      </div>
                    </div>
                    <div style={{ fontWeight: 600 }}>
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
          <div className="card-body" style={{ padding: 0 }}>
            {weeklyPlans.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🗓</div>
                <p>Todavía no has creado planes</p>
              </div>
            ) : (
              weeklyPlans.slice(0, 4).map((plan) => (
                <Link
                  key={plan.id}
                  to={`/weekly-plans/${plan.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 20px',
                    borderBottom: '1px solid var(--color-border)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{plan.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {plan.assigned_days}/{plan.days_count} días cubiertos
                    </div>
                  </div>
                  <div style={{ fontWeight: 600 }}>{plan.people_count} pers.</div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {dashboard?.system_status && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-header">
            <h2>Estado del sistema</h2>
          </div>
          <div className="card-body" style={{ fontSize: 14 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <StatusRow label="Búsqueda" value={dashboard.system_status.search_mode} />
              <StatusRow label="IA (recetas)" value={dashboard.system_status.ai_mode} />
              <StatusRow label="Código postal" value={dashboard.system_status.postal_code} />
              <StatusRow
                label="Bot Mercadona"
                value={dashboard.system_status.bot_available ? 'Disponible' : 'No disponible'}
                ok={dashboard.system_status.bot_available}
              />
              {dashboard.system_status.demo_mode && (
                <StatusRow label="Modo demo" value="Activo" ok={true} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
