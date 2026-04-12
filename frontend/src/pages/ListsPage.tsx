import { useState, useEffect } from 'react';
import { getLists, createList, updateList, deleteList, duplicateList } from '../api/lists';
import ListCard from '../components/lists/ListCard';
import ListForm from '../components/lists/ListForm';
import type { ShoppingListSummary, CreateListPayload } from '../types';

export default function ListsPage() {
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<ShoppingListSummary | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<ShoppingListSummary | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchLists = async () => {
    try {
      const data = await getLists();
      setLists(data);
    } catch {
      setError('Error al cargar las listas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
  }, []);

  const handleCreate = async (payload: CreateListPayload) => {
    await createList(payload);
    // Refetch summaries
    await fetchLists();
    setShowForm(false);
  };

  const handleEdit = async (payload: CreateListPayload) => {
    if (!editTarget) return;
    await updateList(editTarget.id, payload);
    await fetchLists();
    setEditTarget(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(true);
    try {
      await deleteList(deleteConfirm.id);
      setLists((prev) => prev.filter((l) => l.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch {
      setError('Error al eliminar la lista');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (list: ShoppingListSummary) => {
    try {
      await duplicateList(list.id);
      await fetchLists();
    } catch {
      setError('Error al duplicar la lista');
    }
  };

  const visibleLists = showArchived ? lists : lists.filter((l) => !l.is_archived);

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando listas…</span>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Mis listas</h1>
          <p>{lists.filter((l) => !l.is_archived).length} lista(s) activa(s)</p>
        </div>
        <div className="actions-row">
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowArchived((v) => !v)}
          >
            {showArchived ? 'Ocultar archivadas' : 'Ver archivadas'}
          </button>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            + Nueva lista
          </button>
        </div>
      </div>

      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      {visibleLists.length === 0 ? (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-icon">📋</div>
          <p style={{ marginBottom: 16 }}>
            {showArchived ? 'No hay listas archivadas' : 'No tienes listas aún'}
          </p>
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            Crear primera lista
          </button>
        </div>
      ) : (
        <div className="lists-grid">
          {visibleLists.map((list) => (
            <ListCard
              key={list.id}
              list={list}
              onEdit={(l) => setEditTarget(l)}
              onDelete={(l) => setDeleteConfirm(l)}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <ListForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          title="Nueva lista"
        />
      )}

      {/* Edit modal */}
      {editTarget && (
        <ListForm
          onSubmit={handleEdit}
          onCancel={() => setEditTarget(null)}
          initial={editTarget}
          title="Editar lista"
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal">
            <h2>Eliminar lista</h2>
            <p style={{ marginBottom: 16, color: 'var(--color-text-muted)' }}>
              ¿Seguro que quieres eliminar <strong>{deleteConfirm.name}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteConfirm(null)}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <>
                    <span className="loading-spinner white" style={{ width: 14, height: 14 }} />
                    Eliminando…
                  </>
                ) : (
                  'Eliminar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

