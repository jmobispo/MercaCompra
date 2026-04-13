import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../api/dashboard';
import { useAuthStore } from '../store/authStore';
import type { DashboardData } from '../types';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    getDashboard()
      .then(setData)
      .catch(() => setError('Error al cargar el panel'))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (val: number) =>
    val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

  const variationColor = (v: number) =>
    v > 0 ? 'var(--color-danger, #ef4444)' : v < 0 ? 'var(--color-success, #22c55e)' : 'inherit';

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Hola, {user?.username ?? 'Usuario'} 👋</h1>
          <p>Aquí tienes un resumen de tu actividad</p>
        </div>
        <Link to="/lists" className="btn btn-primary">
          + Nueva lista
        </Link>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      {data && (
        <>
          {/* KPI row */}
          <div className="stats-grid">
            <div className="stat-card accent">
              <div className="stat-icon">💸</div>
              <div className="stat-label">Gasto esta semana</div>
              <div className="stat-value" style={{ fontSize: 20 }}>{fmt(data.weekly_spending)}</div>
              {data.weekly_variation !== 0 && (
                <div style={{ fontSize: 12, color: variationColor(data.weekly_variation), marginTop: 4 }}>
                  {data.weekly_variation > 0 ? '▲' : '▼'} {Math.abs(data.weekly_variation).toFixed(1)}% vs semana anterior
                </div>
              )}
            </div>
            <div className="stat-card">
              <div className="stat-icon">📋</div>
              <div className="stat-label">Listas activas</div>
              <div className="stat-value">{data.active_list_count}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🧺</div>
              <div className="stat-label">Artículos en despensa</div>
              <div className="stat-value">{data.total_pantry_items}</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">🍳</div>
              <div className="stat-label">Recetas</div>
              <div className="stat-value">{data.recipe_count}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {/* Recent list */}
            <div className="card">
              <div className="card-header">
                <h2>Lista reciente</h2>
                <Link to="/lists" className="btn btn-ghost btn-sm">Ver todas</Link>
              </div>
              <div className="card-body">
                {data.recent_list ? (
                  <Link
                    to={`/lists/${data.recent_list.id}`}
                    style={{ textDecoration: 'none', color: 'inherit', display: 'block' }}
                  >
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{data.recent_list.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
                      {data.recent_list.item_count} artículos · {fmtDate(data.recent_list.updated_at)}
                    </div>
                    <div style={{ fontWeight: 700, color: 'var(--color-primary)', fontSize: 18 }}>
                      {fmt(data.recent_list.total)}
                    </div>
                  </Link>
                ) : (
                  <div className="empty-state" style={{ padding: '16px 0' }}>
                    <p style={{ marginBottom: 12 }}>No tienes listas aún</p>
                    <Link to="/lists" className="btn btn-primary btn-sm">Crear primera lista</Link>
                  </div>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="card">
              <div className="card-header">
                <h2>Accesos rápidos</h2>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link to="/products" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                  🥦 Buscar productos
                </Link>
                <Link to="/recipes" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                  🍳 Mis recetas
                </Link>
                <Link to="/pantry" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                  🧺 Gestionar despensa
                </Link>
                <Link to="/spending" className="btn btn-secondary" style={{ justifyContent: 'flex-start' }}>
                  📊 Control de gasto
                </Link>
              </div>
            </div>

            {/* System status */}
            <div className="card">
              <div className="card-header">
                <h2>Estado del sistema</h2>
              </div>
              <div className="card-body" style={{ fontSize: 14 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <StatusRow label="Búsqueda" value={data.system_status.search_mode} />
                  <StatusRow label="IA (recetas)" value={data.system_status.ai_mode} />
                  <StatusRow label="Código postal" value={data.system_status.postal_code} />
                  <StatusRow
                    label="Bot Mercadona"
                    value={data.system_status.bot_available ? 'Disponible' : 'No disponible'}
                    ok={data.system_status.bot_available}
                  />
                  {data.system_status.demo_mode && (
                    <StatusRow label="Modo demo" value="Activo" ok={true} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{
        fontWeight: 500,
        color: ok === true ? 'var(--color-success, #22c55e)' : ok === false ? 'var(--color-danger, #ef4444)' : 'inherit',
      }}>
        {value}
      </span>
    </div>
  );
}
