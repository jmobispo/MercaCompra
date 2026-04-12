import { useState } from 'react';
import { launchAutomation } from '../../api/automation';
import type { AutomationRun } from '../../types';

interface AutomationPanelProps {
  listId: number;
  onLaunched?: (run: AutomationRun) => void;
}

export default function AutomationPanel({ listId, onLaunched }: AutomationPanelProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [headless, setHeadless] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [launched, setLaunched] = useState<AutomationRun | null>(null);
  const [showForm, setShowForm] = useState(false);

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const run = await launchAutomation({
        shopping_list_id: listId,
        headless,
        mercadona_email: email || undefined,
        mercadona_password: password || undefined,
      });
      setLaunched(run);
      setShowForm(false);
      onLaunched?.(run);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Error al lanzar la automatización';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="automation-panel">
      <h3>Automatización</h3>

      {launched ? (
        <div>
          <div className="alert alert-success">
            Automatización iniciada (ID: {launched.id})
          </div>
          <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            Estado: <span className={`run-status ${launched.status}`}>{launched.status}</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            style={{ marginTop: 10, width: '100%' }}
            onClick={() => { setLaunched(null); setShowForm(false); }}
          >
            Nueva ejecución
          </button>
        </div>
      ) : showForm ? (
        <form onSubmit={handleLaunch}>
          {error && (
            <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>
          )}

          <div className="automation-form-row">
            <label>Email Mercadona (opcional)</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
            />
          </div>

          <div className="automation-form-row">
            <label>Contraseña Mercadona (opcional)</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <div className="automation-form-row" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              id="headless-cb"
              checked={headless}
              onChange={(e) => setHeadless(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <label htmlFor="headless-cb" style={{ marginBottom: 0 }}>Modo sin interfaz (headless)</label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowForm(false)}
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={loading}
              style={{ flex: 1 }}
            >
              {loading ? (
                <>
                  <span className="loading-spinner white" style={{ width: 12, height: 12 }} />
                  Lanzando…
                </>
              ) : (
                'Lanzar bot'
              )}
            </button>
          </div>
        </form>
      ) : (
        <div>
          <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 10 }}>
            Añade automáticamente los productos de esta lista al carrito de Mercadona.
          </p>
          <button
            className="btn btn-primary btn-full"
            onClick={() => setShowForm(true)}
          >
            🤖 Lanzar automatización
          </button>
        </div>
      )}
    </div>
  );
}
