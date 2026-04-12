import type { AutomationRun } from '../../types';

interface AutomationResultsProps {
  run: AutomationRun;
}

const STATUS_LABELS: Record<string, string> = {
  ok: 'Añadido',
  not_found: 'No encontrado',
  dubious: 'Coincidencia dudosa',
  substituted: 'Sustituido',
  error: 'Error',
};

export default function AutomationResults({ run }: AutomationResultsProps) {
  const formatCurrency = (val: number | null) =>
    val != null
      ? val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      : '—';

  const formatDuration = (secs: number | null) => {
    if (secs == null) return '—';
    if (secs < 60) return `${secs.toFixed(1)}s`;
    return `${Math.floor(secs / 60)}m ${Math.round(secs % 60)}s`;
  };

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

  return (
    <div style={{ marginTop: 16 }}>
      {/* Summary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
          gap: 12,
          marginBottom: 16,
        }}
      >
        {[
          { label: 'Total', value: run.total_items, color: '' },
          { label: 'Añadidos', value: run.added_ok, color: 'green' },
          { label: 'No encontrados', value: run.not_found, color: 'red' },
          { label: 'Dudosos', value: run.dubious_match, color: 'orange' },
          { label: 'Sustituidos', value: run.substituted, color: 'orange' },
          { label: 'Errores', value: run.errors, color: 'red' },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: 'var(--color-bg)',
              borderRadius: 'var(--radius)',
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
              {s.label}
            </div>
            <div
              className={`run-stat`}
              style={{ fontWeight: 700, fontSize: 18, color: s.color === 'green' ? 'var(--color-success)' : s.color === 'red' ? 'var(--color-danger)' : s.color === 'orange' ? 'var(--color-warning)' : 'var(--color-text)' }}
            >
              {s.value}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 16, fontSize: 13, marginBottom: 16, flexWrap: 'wrap' }}>
        {run.estimated_cost != null && (
          <span>
            <span style={{ color: 'var(--color-text-muted)' }}>Coste estimado: </span>
            <strong>{formatCurrency(run.estimated_cost)}</strong>
          </span>
        )}
        {run.duration_seconds != null && (
          <span>
            <span style={{ color: 'var(--color-text-muted)' }}>Duración: </span>
            <strong>{formatDuration(run.duration_seconds)}</strong>
          </span>
        )}
        {run.started_at && (
          <span>
            <span style={{ color: 'var(--color-text-muted)' }}>Iniciada: </span>
            <strong>{formatDate(run.started_at)}</strong>
          </span>
        )}
        {run.finished_at && (
          <span>
            <span style={{ color: 'var(--color-text-muted)' }}>Finalizada: </span>
            <strong>{formatDate(run.finished_at)}</strong>
          </span>
        )}
      </div>

      {run.error_message && (
        <div className="alert alert-error" style={{ marginBottom: 12 }}>
          {run.error_message}
        </div>
      )}

      {run.item_results && run.item_results.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table className="results-table">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Estado</th>
                <th>Coincidencia</th>
                <th>Precio</th>
                <th>Cant.</th>
                <th>Nota</th>
              </tr>
            </thead>
            <tbody>
              {run.item_results.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 500 }}>{item.product_name}</td>
                  <td>
                    <span className={`item-status ${item.status}`}>
                      {STATUS_LABELS[item.status] ?? item.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--color-text-muted)' }}>
                    {item.matched_name ?? '—'}
                  </td>
                  <td>
                    {item.matched_price != null
                      ? `${item.matched_price.toFixed(2)} €`
                      : '—'}
                  </td>
                  <td>{item.quantity ?? '—'}</td>
                  <td style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {item.note ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <p>No hay detalles de artículos disponibles.</p>
        </div>
      )}
    </div>
  );
}
