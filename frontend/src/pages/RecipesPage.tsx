import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getRecipes,
  createRecipe,
  deleteRecipe,
  duplicateRecipe,
  addRecipeToList,
} from '../api/recipes';
import RecipeCard from '../components/recipes/RecipeCard';
import RecipeForm from '../components/recipes/RecipeForm';
import AddToListModal from '../components/recipes/AddToListModal';
import type { RecipeSummary, CreateRecipePayload, AddToListPayload } from '../types';

export default function RecipesPage() {
  const navigate = useNavigate();
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<RecipeSummary | null>(null);
  const [addToListTarget, setAddToListTarget] = useState<RecipeSummary | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const fetchRecipes = async () => {
    try {
      const data = await getRecipes();
      setRecipes(data);
    } catch {
      setError('Error al cargar las recetas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecipes();
  }, []);

  // Collect all tags
  const allTags = useMemo(() => {
    const set = new Set<string>();
    recipes.forEach((r) => (r.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [recipes]);

  const filtered = useMemo(() => {
    let list = recipes;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    if (filterTag) {
      list = list.filter((r) => (r.tags ?? []).includes(filterTag));
    }
    return list;
  }, [recipes, search, filterTag]);

  const suggested = filtered.filter((r) => r.is_public);
  const mine = filtered.filter((r) => !r.is_public);

  const handleCreate = async (payload: CreateRecipePayload) => {
    await createRecipe(payload);
    await fetchRecipes();
    setShowForm(false);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setActionLoading(true);
    try {
      await deleteRecipe(deleteConfirm.id);
      setRecipes((prev) => prev.filter((r) => r.id !== deleteConfirm.id));
      setDeleteConfirm(null);
    } catch {
      setError('Error al eliminar la receta');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDuplicate = async (id: number) => {
    try {
      await duplicateRecipe(id);
      await fetchRecipes();
    } catch {
      setError('Error al duplicar la receta');
    }
  };

  const handleAddToList = async (payload: AddToListPayload) => {
    if (!addToListTarget) return;
    const result = await addRecipeToList(addToListTarget.id, payload);
    setAddToListTarget(null);
    setSuccessMsg(
      `${result.added} ingrediente(s) añadido(s) a "${result.list_name}"` +
        (result.skipped > 0 ? ` (${result.skipped} ya existían)` : '')
    );
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando recetas…</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Recetas</h1>
          <p>{recipes.filter((r) => !r.is_public).length} receta(s) propias · {recipes.filter((r) => r.is_public).length} sugeridas</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          + Nueva receta
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>×</button>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          {successMsg}
        </div>
      )}

      {/* Search + tag filter */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          className="form-input"
          style={{ flex: '1 1 220px', minWidth: 180 }}
          placeholder="Buscar recetas…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {allTags.length > 0 && (
          <select
            className="form-input"
            style={{ flex: '0 0 auto', minWidth: 160 }}
            value={filterTag}
            onChange={(e) => setFilterTag(e.target.value)}
          >
            <option value="">Todas las etiquetas</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}
      </div>

      {/* My recipes */}
      {mine.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
            Mis recetas
          </h2>
          <div className="recipes-grid">
            {mine.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onView={(id) => navigate(`/recipes/${id}`)}
                onEdit={(id) => navigate(`/recipes/${id}`)}
                onDuplicate={handleDuplicate}
                onDelete={(id) => setDeleteConfirm(recipes.find((x) => x.id === id) ?? null)}
                onAddToList={(id) => setAddToListTarget(recipes.find((x) => x.id === id) ?? null)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Suggested recipes */}
      {suggested.length > 0 && (
        <section style={{ marginBottom: 32 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: 'var(--color-text-muted)' }}>
            Recetas sugeridas
          </h2>
          <div className="recipes-grid">
            {suggested.map((r) => (
              <RecipeCard
                key={r.id}
                recipe={r}
                onView={(id) => navigate(`/recipes/${id}`)}
                onDuplicate={handleDuplicate}
                onAddToList={(id) => setAddToListTarget(recipes.find((x) => x.id === id) ?? null)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="empty-state" style={{ marginTop: 40 }}>
          <div className="empty-icon">🍳</div>
          <p style={{ marginBottom: 16 }}>
            {search || filterTag ? 'No hay recetas que coincidan con tu búsqueda' : 'Aún no tienes recetas'}
          </p>
          {!search && !filterTag && (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              Crear primera receta
            </button>
          )}
        </div>
      )}

      {/* Create recipe modal */}
      {showForm && (
        <RecipeForm
          onSubmit={handleCreate}
          onCancel={() => setShowForm(false)}
          title="Nueva receta"
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDeleteConfirm(null)}>
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Eliminar receta</h2>
              <button className="btn-icon" onClick={() => setDeleteConfirm(null)}>×</button>
            </div>
            <p style={{ padding: '8px 4px 20px', color: 'var(--color-text-muted)' }}>
              ¿Seguro que quieres eliminar <strong>{deleteConfirm.title}</strong>? Esta acción no se puede deshacer.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)} disabled={actionLoading}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={actionLoading}>
                {actionLoading ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add to list modal */}
      {addToListTarget && (
        <AddToListModal
          recipeTitle={addToListTarget.title}
          defaultServings={addToListTarget.servings}
          onConfirm={handleAddToList}
          onCancel={() => setAddToListTarget(null)}
        />
      )}
    </div>
  );
}
