import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getLists } from '../api/lists';
import { getRuns } from '../api/automation';
import { useAuthStore } from '../store/authStore';
import type { ShoppingListSummary, AutomationRun } from '../types';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [listsData, runsData] = await Promise.all([getLists(), getRuns()]);
        setLists(listsData);
        setRuns(runsData);
      } catch {
        setError('Error al cargar los datos');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const activeLists = lists.filter((l) => !l.is_archived);
  const totalItems = lists.reduce((sum, l) => sum + l.item_count, 0);
  const totalSpend = lists.reduce((sum, l) => sum + l.total, 0);
  const recentRuns = runs.slice(0, 5);

  const formatCurrency = (val: number) =>
    val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

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

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-icon">📋</div>
          <div className="stat-label">Listas activas</div>
          <div className="stat-value">{activeLists.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🛒</div>
          <div className="stat-label">Total artículos</div>
          <div className="stat-value">{totalItems}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">💰</div>
          <div className="stat-label">Gasto total</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{formatCurrency(totalSpend)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">🤖</div>
          <div className="stat-label">Automatizaciones</div>
          <div className="stat-value">{runs.length}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Recent Lists */}
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
                <Link to="/lists" className="btn btn-primary btn-sm" style={{ marginTop: 12 }}>
                  Crear primera lista
                </Link>
              </div>
            ) : (
              <div>
                {activeLists.slice(0, 5).map((list) => (
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
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
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
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recent Runs */}
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
              <div>
                {recentRuns.map((run) => (
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
                      transition: 'background 0.2s',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        Ejecución #{run.id}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                        {run.added_ok}/{run.total_items} añadidos · {formatDate(run.created_at)}
                      </div>
                    </div>
                    <span className={`run-status ${run.status}`}>{run.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
