import { useState, useEffect } from 'react';
import { getSpendingMetrics, getSpendingHistory } from '../api/spending';
import type { SpendingMetrics, PurchaseHistory } from '../types';

const fmt = (val: number) =>
  val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

function VariationBadge({ value }: { value: number }) {
  if (value === 0) {
    return <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>sin datos previos</span>;
  }
  const positive = value > 0;
  return (
    <span
      style={{
        fontSize: 12,
        fontWeight: 600,
        color: positive ? 'var(--color-danger, #ef4444)' : 'var(--color-success, #22c55e)',
        background: positive ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
        borderRadius: 4,
        padding: '2px 6px',
      }}
    >
      {positive ? '+' : ''}{value}%
    </span>
  );
}

function MetricCard({
  label,
  current,
  previous,
  variation,
  sublabel,
}: {
  label: string;
  current: number;
  previous: number;
  variation: number;
  sublabel: string;
}) {
  return (
    <div className="card" style={{ flex: 1 }}>
      <div className="card-body" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>{fmt(current)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <VariationBadge value={variation} />
          {previous > 0 && (
            <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
              vs {fmt(previous)} {sublabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function SpendingPage() {
  const [metrics, setMetrics] = useState<SpendingMetrics | null>(null);
  const [history, setHistory] = useState<PurchaseHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [m, h] = await Promise.all([getSpendingMetrics(), getSpendingHistory()]);
        setMetrics(m);
        setHistory(h);
      } catch {
        setError('Error al cargar los datos de gasto');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando datos…</span>
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>×</button>
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h1 style={{ marginBottom: 4 }}>Control de gasto</h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 14, margin: 0 }}>
          Resumen de tu gasto registrado en compras.
        </p>
      </div>

      {/* Metrics cards */}
      {metrics && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <MetricCard
            label="Esta semana"
            current={metrics.weekly_current}
            previous={metrics.weekly_previous}
            variation={metrics.weekly_variation}
            sublabel="semana anterior"
          />
          <MetricCard
            label="Este mes"
            current={metrics.monthly_current}
            previous={metrics.monthly_previous}
            variation={metrics.monthly_variation}
            sublabel="mes anterior"
          />
          <div className="card" style={{ flex: 1, minWidth: 140 }}>
            <div className="card-body" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 6 }}>Compras registradas</div>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{metrics.total_purchases}</div>
            </div>
          </div>
        </div>
      )}

      {/* Bar chart – last 8 entries */}
      {history.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h2>Últimas compras</h2>
          </div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            {(() => {
              const recent = history.slice(0, 8).reverse();
              const max = Math.max(...recent.map((h) => h.estimated_total), 1);
              return (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, padding: '0 4px' }}>
                  {recent.map((entry) => {
                    const pct = (entry.estimated_total / max) * 100;
                    return (
                      <div
                        key={entry.id}
                        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
                        title={`${entry.list_name} — ${fmt(entry.estimated_total)}`}
                      >
                        <span style={{ fontSize: 10, color: 'var(--color-text-muted)' }}>
                          {fmt(entry.estimated_total)}
                        </span>
                        <div
                          style={{
                            width: '100%',
                            height: `${Math.max(pct, 6)}%`,
                            background: 'var(--color-primary)',
                            borderRadius: '4px 4px 0 0',
                            minHeight: 6,
                            transition: 'height 0.3s',
                          }}
                        />
                        <span
                          style={{
                            fontSize: 9,
                            color: 'var(--color-text-muted)',
                            textAlign: 'center',
                            lineHeight: 1.2,
                            maxWidth: 40,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {new Date(entry.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* History table */}
      <div className="card">
        <div className="card-header">
          <h2>Historial</h2>
        </div>
        {history.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 24px' }}>
            <div className="empty-icon">📊</div>
            <p>Sin compras registradas todavía.</p>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
              Registra una compra desde el detalle de una lista.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  {['Fecha', 'Lista', 'Artículos', 'Total estimado'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '10px 16px',
                        textAlign: 'left',
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr
                    key={entry.id}
                    style={{ borderBottom: '1px solid var(--color-border)' }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {fmtDate(entry.created_at)}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13 }}>{entry.list_name}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, textAlign: 'center' }}>
                      {entry.item_count}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600 }}>
                      {fmt(entry.estimated_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
