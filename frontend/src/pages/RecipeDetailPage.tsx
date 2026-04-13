import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getRecipe,
  updateRecipe,
  deleteRecipe,
  duplicateRecipe,
  addRecipeToList,
} from '../api/recipes';
import RecipeForm from '../components/recipes/RecipeForm';
import AddToListModal from '../components/recipes/AddToListModal';
import type { Recipe, UpdateRecipePayload, AddToListPayload } from '../types';

export default function RecipeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recipeId = parseInt(id ?? '0', 10);

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddToList, setShowAddToList] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRecipe = useCallback(async () => {
    if (!recipeId) return;
    try {
      const data = await getRecipe(recipeId);
      setRecipe(data);
    } catch {
      setError('Error al cargar la receta');
    } finally {
      setLoading(false);
    }
  }, [recipeId]);

  useEffect(() => {
    fetchRecipe();
  }, [fetchRecipe]);

  const handleUpdate = async (payload: UpdateRecipePayload) => {
    if (!recipe) return;
    const updated = await updateRecipe(recipe.id, payload);
    setRecipe(updated);
    setShowEditForm(false);
  };

  const handleDelete = async () => {
    if (!recipe) return;
    if (!window.confirm(`¿Eliminar la receta "${recipe.title}"?`)) return;
    setActionLoading(true);
    try {
      await deleteRecipe(recipe.id);
      navigate('/recipes');
    } catch {
      setError('Error al eliminar la receta');
      setActionLoading(false);
    }
  };

  const handleDuplicate = async () => {
    if (!recipe) return;
    setActionLoading(true);
    try {
      const copy = await duplicateRecipe(recipe.id);
      navigate(`/recipes/${copy.id}`);
    } catch {
      setError('Error al duplicar la receta');
      setActionLoading(false);
    }
  };

  const handleAddToList = async (payload: AddToListPayload) => {
    if (!recipe) return;
    const result = await addRecipeToList(recipe.id, payload);
    setShowAddToList(false);
    setSuccessMsg(
      `${result.added} ingrediente(s) añadido(s) a "${result.list_name}"` +
        (result.skipped > 0 ? ` (${result.skipped} ya existían)` : '')
    );
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const formatCost = (c: number | null) =>
    c != null ? c.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : null;

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando receta…</span>
      </div>
    );
  }

  if (!recipe) {
    return (
      <div className="empty-state">
        <div className="empty-icon">❌</div>
        <p>Receta no encontrada</p>
        <button className="btn btn-secondary" onClick={() => navigate('/recipes')}>
          Volver a recetas
        </button>
      </div>
    );
  }

  const isOwn = recipe.user_id !== null && !recipe.is_public;

  return (
    <div>
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

      {/* Header */}
      <div className="page-header" style={{ alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ marginBottom: 4 }}>{recipe.title}</h1>
            {recipe.is_public && (
              <span className="badge" style={{ background: 'var(--color-success)', color: '#fff', fontSize: 11 }}>
                Sugerida
              </span>
            )}
          </div>
          {recipe.description && (
            <p style={{ color: 'var(--color-text-muted)', marginBottom: 8, marginTop: 4 }}>
              {recipe.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14, color: 'var(--color-text-muted)' }}>
            <span>👥 {recipe.servings} raciones</span>
            {recipe.estimated_minutes && <span>⏱ {recipe.estimated_minutes} min</span>}
            {formatCost(recipe.estimated_cost) && <span>💶 {formatCost(recipe.estimated_cost)}</span>}
            <span>🥕 {recipe.ingredients.length} ingredientes</span>
          </div>
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="recipe-tags" style={{ marginTop: 8 }}>
              {recipe.tags.map((tag) => (
                <span key={tag} className="recipe-tag">{tag}</span>
              ))}
            </div>
          )}
        </div>

        <div className="actions-row" style={{ flexShrink: 0 }}>
          <button
            className="btn btn-primary"
            onClick={() => setShowAddToList(true)}
            disabled={actionLoading}
          >
            + Añadir a lista
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleDuplicate}
            disabled={actionLoading}
            title="Duplicar receta"
          >
            Copiar
          </button>
          {isOwn && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowEditForm(true)}
                disabled={actionLoading}
                title="Editar receta"
              >
                ✏️
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={handleDelete}
                disabled={actionLoading}
                style={{ color: 'var(--color-danger)' }}
                title="Eliminar receta"
              >
                🗑
              </button>
            </>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/recipes')}
          >
            ← Volver
          </button>
        </div>
      </div>

      {/* Ingredients */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <h2>Ingredientes</h2>
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
            para {recipe.servings} raciones
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {recipe.ingredients.length === 0 ? (
            <p style={{ padding: 16, color: 'var(--color-text-muted)' }}>Sin ingredientes</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {recipe.ingredients
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((ing) => (
                  <li
                    key={ing.id}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      padding: '10px 20px',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <span style={{ flex: 1, fontWeight: 500 }}>{ing.name}</span>
                    {(ing.quantity != null || ing.unit) && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 14, whiteSpace: 'nowrap' }}>
                        {ing.quantity != null ? ing.quantity : ''}
                        {ing.unit ? ` ${ing.unit}` : ''}
                      </span>
                    )}
                    {ing.notes && (
                      <span style={{ color: 'var(--color-text-muted)', fontSize: 13, fontStyle: 'italic' }}>
                        ({ing.notes})
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit form modal */}
      {showEditForm && (
        <RecipeForm
          initial={recipe}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditForm(false)}
          title="Editar receta"
        />
      )}

      {/* Add to list modal */}
      {showAddToList && (
        <AddToListModal
          recipeTitle={recipe.title}
          defaultServings={recipe.servings}
          ingredients={recipe.ingredients}
          onConfirm={handleAddToList}
          onCancel={() => setShowAddToList(false)}
        />
      )}
    </div>
  );
}
