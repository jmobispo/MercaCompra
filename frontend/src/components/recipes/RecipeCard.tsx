import type { RecipeSummary } from '../../types';

interface RecipeCardProps {
  recipe: RecipeSummary;
  onView: (id: number) => void;
  onEdit?: (id: number) => void;
  onDuplicate?: (id: number) => void;
  onDelete?: (id: number) => void;
  onAddToList?: (id: number) => void;
}

export default function RecipeCard({
  recipe,
  onView,
  onEdit,
  onDuplicate,
  onDelete,
  onAddToList,
}: RecipeCardProps) {
  const formatCost = (c: number | null) =>
    c != null ? c.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' }) : null;

  const isOwn = recipe.user_id !== null && !recipe.is_public;

  return (
    <div
      className="recipe-card card"
      style={{ cursor: 'pointer' }}
      onClick={() => onView(recipe.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onView(recipe.id)}
    >
      <div className="recipe-card-body">
        <div className="recipe-card-header">
          <h3 className="recipe-card-title">{recipe.title}</h3>
          {recipe.is_public && (
            <span
              className="badge"
              style={{ background: 'var(--color-success)', color: '#fff', fontSize: 10 }}
            >
              Sugerida
            </span>
          )}
        </div>

        {recipe.description && (
          <p className="recipe-card-desc">{recipe.description}</p>
        )}

        <div className="recipe-card-meta">
          {recipe.estimated_minutes && (
            <span title="Tiempo de preparación">⏱ {recipe.estimated_minutes} min</span>
          )}
          <span title="Raciones">👥 {recipe.servings} raciones</span>
          <span title="Ingredientes">🥕 {recipe.ingredient_count} ingredientes</span>
          {formatCost(recipe.estimated_cost) && (
            <span title="Coste estimado">💶 {formatCost(recipe.estimated_cost)}</span>
          )}
        </div>

        {recipe.tags && recipe.tags.length > 0 && (
          <div className="recipe-tags">
            {recipe.tags.map((tag) => (
              <span key={tag} className="recipe-tag">{tag}</span>
            ))}
          </div>
        )}
      </div>

      <div
        className="recipe-card-actions"
        onClick={(e) => e.stopPropagation()}
      >
        {onAddToList && (
          <button
            className="btn btn-primary btn-sm"
            onClick={() => onAddToList(recipe.id)}
            title="Añadir ingredientes a una lista"
          >
            + Lista
          </button>
        )}
        {onDuplicate && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => onDuplicate(recipe.id)}
            title="Duplicar receta"
          >
            Copiar
          </button>
        )}
        {onEdit && isOwn && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onEdit(recipe.id)}
            title="Editar receta"
          >
            ✏️
          </button>
        )}
        {onDelete && isOwn && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => onDelete(recipe.id)}
            title="Eliminar receta"
            style={{ color: 'var(--color-danger)' }}
          >
            🗑
          </button>
        )}
      </div>
    </div>
  );
}
