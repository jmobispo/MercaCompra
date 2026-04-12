import { useState, useEffect } from 'react';
import { getLists } from '../../api/lists';
import type { ShoppingListSummary, AddToListPayload } from '../../types';

interface AddToListModalProps {
  recipeTitle: string;
  defaultServings: number;
  onConfirm: (payload: AddToListPayload) => Promise<void>;
  onCancel: () => void;
}

export default function AddToListModal({
  recipeTitle,
  defaultServings,
  onConfirm,
  onCancel,
}: AddToListModalProps) {
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState(`Lista: ${recipeTitle}`);
  const [multiplier, setMultiplier] = useState(1.0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getLists()
      .then((data) => {
        const active = data.filter((l) => !l.is_archived);
        setLists(active);
        if (active.length === 0) setMode('new');
        else setSelectedListId(active[0].id);
      })
      .catch(() => setMode('new'));
  }, []);

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      const payload: AddToListPayload = {
        list_id: mode === 'existing' ? selectedListId : null,
        new_list_name: mode === 'new' ? newListName.trim() : null,
        servings_multiplier: multiplier,
      };
      await onConfirm(payload);
    } catch {
      setError('Error al añadir a la lista');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onCancel()}>
      <div className="modal-content" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2>Añadir a lista de compra</h2>
          <button className="btn-icon" onClick={onCancel}>×</button>
        </div>

        <div style={{ padding: '0 4px 16px' }}>
          {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

          {/* Servings multiplier */}
          <div className="form-group">
            <label className="form-label">
              Raciones (base: {defaultServings})
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={multiplier}
                onChange={(e) => setMultiplier(parseFloat(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ minWidth: 60, textAlign: 'right' }}>
                ×{multiplier} = {Math.round(defaultServings * multiplier)} raciones
              </span>
            </div>
          </div>

          {/* Destination list */}
          <div className="form-group">
            <label className="form-label">Destino</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              {lists.length > 0 && (
                <button
                  type="button"
                  className={`btn btn-sm ${mode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setMode('existing')}
                >
                  Lista existente
                </button>
              )}
              <button
                type="button"
                className={`btn btn-sm ${mode === 'new' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setMode('new')}
              >
                Nueva lista
              </button>
            </div>

            {mode === 'existing' && lists.length > 0 && (
              <select
                className="form-input"
                value={selectedListId ?? ''}
                onChange={(e) => setSelectedListId(parseInt(e.target.value))}
              >
                {lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.item_count} artículos)
                  </option>
                ))}
              </select>
            )}

            {mode === 'new' && (
              <input
                className="form-input"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="Nombre de la nueva lista"
              />
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </button>
          <button className="btn btn-primary" onClick={handleConfirm} disabled={loading}>
            {loading ? 'Añadiendo…' : 'Añadir ingredientes'}
          </button>
        </div>
      </div>
    </div>
  );
}
