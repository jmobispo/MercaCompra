import { useState, useEffect, useRef, useCallback } from 'react';
import { getRuns, getRun } from '../api/automation';
import AutomationResults from '../components/automation/AutomationResults';
import type { AutomationRun } from '../types';

const ACTIVE_STATUSES = new Set(['pending', 'running']);

export default function AutomationPage() {
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const runsRef = useRef<AutomationRun[]>([]);

  // Keep ref in sync for polling closure
  useEffect(() => {
    runsRef.current = runs;
  }, [runs]);

  const fetchRuns = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getRuns();
      setRuns(data);
    } catch {
      setError('Error al cargar las ejecuciones');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const pollActiveRuns = useCallback(async () => {
    const activeRuns = runsRef.current.filter((r) => ACTIVE_STATUSES.has(r.status));
    if (activeRuns.length === 0) return;

    const updated = await Promise.all(
      activeRuns.map((r) => getRun(r.id).catch(() => r))
    );

    setRuns((prev) =>
      prev.map((r) => {
        const u = updated.find((up) => up.id === r.id);
        return u ?? r;
      })
    );
  }, []);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Set up polling when there are active runs
  useEffect(() => {
    const hasActive = runs.some((r) => ACTIVE_STATUSES.has(r.status));

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    if (hasActive) {
      pollRef.current = setInterval(pollActiveRuns, 3000);
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [runs, pollActiveRuns]);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (secs: number | null) => {
    if (secs == null) return '—';
    if (secs < 60) return `${secs.toFixed(1)}s`;
    return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  };

  const formatCurrency = (val: number | null) =>
    val != null
      ? val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      : '—';

  const STATUS_ICONS: Record<string, string> = {
    pending: '⏳',
    running: '⚙️',
    completed: '✅',
    failed: '❌',
    partial: '⚠️',
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando ejecuciones…</span>
      </div>
    );
  }

  const hasActive = runs.some((r) => ACTIVE_STATUSES.has(r.status));

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Automatización</h1>
          <p>Historial de ejecuciones del bot de compra</p>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => fetchRuns()}
        >
          🔄 Actualizar
        </button>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      {hasActive && (
        <div className="alert alert-info" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className="loading-spinner" style={{ width: 14, height: 14, flexShrink: 0 }} />
          Hay ejecuciones en curso. Actualizando automáticamente cada 3 segundos…
        </div>
      )}

      {runs.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-icon">🤖</div>
          <p>No hay ejecuciones aún. Ve a una lista y lanza el bot.</p>
        </div>
      ) : (
        <div className="runs-list">
          {runs.map((run) => (
            <div
              key={run.id}
              className={`run-card ${expandedId === run.id ? 'expanded' : ''}`}
              onClick={() => setExpandedId(expandedId === run.id ? null : run.id)}
            >
              <div className="run-card-header">
                <div className="run-card-info">
                  <span style={{ fontSize: 18 }}>{STATUS_ICONS[run.status] ?? '❓'}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>
                      Ejecución #{run.id}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                      {run.shopping_list_id ? `Lista #${run.shopping_list_id} · ` : ''}
                      {formatDate(run.created_at)}
                      {run.duration_seconds != null && ` · ${formatDuration(run.duration_seconds)}`}
                    </div>
                  </div>
                  <span className={`run-status ${run.status}`}>{run.status}</span>
                </div>

                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {run.estimated_cost != null && (
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>
                      {formatCurrency(run.estimated_cost)}
                    </span>
                  )}
                  <span style={{ color: 'var(--color-text-muted)', fontSize: 18 }}>
                    {expandedId === run.id ? '▲' : '▼'}
                  </span>
                </div>
              </div>

              {/* Quick stats row */}
              <div className="run-stats">
                <div className="run-stat">
                  <span className="stat-label">Total</span>
                  <span className="stat-value">{run.total_items}</span>
                </div>
                <div className="run-stat">
                  <span className="stat-label">Añadidos</span>
                  <span className="stat-value green">{run.added_ok}</span>
                </div>
                <div className="run-stat">
                  <span className="stat-label">No encontrados</span>
                  <span className="stat-value red">{run.not_found}</span>
                </div>
                {run.dubious_match > 0 && (
                  <div className="run-stat">
                    <span className="stat-label">Dudosos</span>
                    <span className="stat-value orange">{run.dubious_match}</span>
                  </div>
                )}
                {run.substituted > 0 && (
                  <div className="run-stat">
                    <span className="stat-label">Sustituidos</span>
                    <span className="stat-value orange">{run.substituted}</span>
                  </div>
                )}
                {run.errors > 0 && (
                  <div className="run-stat">
                    <span className="stat-label">Errores</span>
                    <span className="stat-value red">{run.errors}</span>
                  </div>
                )}
              </div>

              {/* Expanded detail */}
              {expandedId === run.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{ marginTop: 12, borderTop: '1px solid var(--color-border)', paddingTop: 12 }}
                >
                  <AutomationResults run={run} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
