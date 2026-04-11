import { useState, useEffect } from 'react';
import type { ShoppingListSummary, CreateListPayload } from '../../types';

interface ListFormProps {
  onSubmit: (data: CreateListPayload) => Promise<void>;
  onCancel: () => void;
  initial?: ShoppingListSummary | null;
  title?: string;
}

export default function ListForm({ onSubmit, onCancel, initial, title }: ListFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [budget, setBudget] = useState<string>(
    initial?.budget != null ? String(initial.budget) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setName(initial?.name ?? '');
    setBudget(initial?.budget != null ? String(initial.budget) : '');
  }, [initial]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre es obligatorio');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload: CreateListPayload = {
        name: name.trim(),
        budget: budget !== '' ? parseFloat(budget) : null,
      };
      await onSubmit(payload);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal">
        <h2>{title ?? (initial ? 'Editar lista' : 'Nueva lista')}</h2>

        {error && <div className="alert alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="list-name">Nombre de la lista *</label>
            <input
              id="list-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Compra semanal"
              autoFocus
              className={!name && error ? 'error' : ''}
            />
          </div>

          <div className="form-group">
            <label htmlFor="list-budget">Presupuesto (€) — opcional</label>
            <input
              id="list-budget"
              type="number"
              min="0"
              step="0.01"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Ej: 80.00"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              Cancelar
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? (
                <>
                  <span className="loading-spinner white" style={{ width: 14, height: 14 }} />
                  Guardando…
                </>
              ) : (
                initial ? 'Guardar cambios' : 'Crear lista'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
