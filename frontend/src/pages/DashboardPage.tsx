import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getDashboard } from '../api/dashboard';
import { getLists } from '../api/lists';
import { addFrequentProductsToList, getFrequentProducts, searchProducts } from '../api/products';
import { getWeeklyPlans } from '../api/weeklyPlans';
import { useAuthStore } from '../store/authStore';
import { buildInlineFallbackThumbnail, hasRealHttpImage } from '../utils/productThumbnails';
import type {
  DashboardData,
  FrequentProduct,
  ShoppingListSummary,
  WeeklyPlanSummary,
} from '../types';

function MetricIcon({ kind }: { kind: 'spend' | 'lists' | 'plans' }) {
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

export default function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [weeklyPlans, setWeeklyPlans] = useState<WeeklyPlanSummary[]>([]);
  const [frequentProducts, setFrequentProducts] = useState<FrequentProduct[]>([]);
  const [basicThumbnailOverrides, setBasicThumbnailOverrides] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addingBasics, setAddingBasics] = useState(false);
  const postalCode = user?.postal_code ?? undefined;

  const visibleBasics = useMemo(
    () =>
      frequentProducts.map((product) => ({
        ...product,
        resolved_thumbnail:
          basicThumbnailOverrides[product.product_id] ?? product.product_thumbnail ?? null,
      })),
    [frequentProducts, basicThumbnailOverrides]
  );

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [dashboardData, listsData, plansData, basicsData] = await Promise.all([
          getDashboard(),
          getLists(),
          getWeeklyPlans(),
          getFrequentProducts(6),
        ]);
        setDashboard(dashboardData);
        setLists(listsData);
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

  useEffect(() => {
    if (frequentProducts.length === 0) return;

    const unresolvedProducts = frequentProducts.filter(
      (product) =>
        !hasRealHttpImage(basicThumbnailOverrides[product.product_id]) &&
        !hasRealHttpImage(product.product_thumbnail)
    );

    if (unresolvedProducts.length === 0) return;

    let cancelled = false;

    const hydrateBasicsThumbnails = async () => {
      for (const product of unresolvedProducts.slice(0, 6)) {
        if (cancelled) return;

        try {
          const result = await searchProducts(product.product_name, postalCode);
          const matched = result.products.find((candidate) => hasRealHttpImage(candidate.thumbnail));
          const thumbnail = matched?.thumbnail;
          if (!thumbnail) continue;

          setBasicThumbnailOverrides((current) => {
            if (current[product.product_id] === thumbnail) return current;
            return { ...current, [product.product_id]: thumbnail };
          });
        } catch {
          // Mantiene el fallback visual sin interrumpir el panel.
        }

        await new Promise((resolve) => window.setTimeout(resolve, 180));
      }
    };

    void hydrateBasicsThumbnails();

    return () => {
      cancelled = true;
    };
  }, [frequentProducts, postalCode, basicThumbnailOverrides]);

  const activeLists = lists.filter((item) => !item.is_archived);
  const totalSpend = lists.reduce((sum, item) => sum + item.total, 0);

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
        new_list_name: 'Tus básicos',
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
          <p>Resumen rápido de tus listas, planes y básicos.</p>
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
              {(dashboard?.weekly_variation ?? 0) > 0 ? '+' : '-'}{' '}
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
                <div className="empty-icon empty-icon-soft">?</div>
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
            <h2>Planes semanales</h2>
            <Link to="/weekly-plans" className="btn btn-ghost btn-sm">Ver planes</Link>
          </div>
          <div className="card-body dashboard-card-list">
            {weeklyPlans.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon empty-icon-soft">?</div>
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
                <div className="empty-icon empty-icon-soft">?</div>
                <p>Aún no hay hábitos suficientes</p>
              </div>
            ) : (
              <div className="dashboard-basics-grid">
                {visibleBasics.map((product) => (
                  <div key={product.product_id} className="dashboard-basic-card">
                    <img
                      src={
                        hasRealHttpImage(product.resolved_thumbnail)
                          ? product.resolved_thumbnail!
                          : buildInlineFallbackThumbnail(
                              product.product_name,
                              product.product_category
                            )
                      }
                      alt={product.product_name}
                      className="dashboard-basic-thumb"
                      onError={(event) => {
                        (event.target as HTMLImageElement).src = buildInlineFallbackThumbnail(
                          product.product_name,
                          product.product_category
                        );
                      }}
                    />
                    <div className="dashboard-basic-card-copy">
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
      </div>
    </div>
  );
}


