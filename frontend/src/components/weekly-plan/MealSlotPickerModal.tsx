import { useMemo, useState } from 'react';

import { resolveBackendUrl } from '../../api/client';
import type { RecipeSummary, WeeklyMealSlot } from '../../types';

const SLOT_GROUPS: Array<{
  title: string;
  items: Array<{ key: WeeklyMealSlot; label: string; family: string }>;
}> = [
  {
    title: 'Desayuno',
    items: [
      { key: 'desayuno', label: 'Desayuno', family: 'desayuno' },
    ],
  },
  {
    title: 'Comida',
    items: [
      { key: 'comida_primero', label: 'Primer plato', family: 'comida' },
      { key: 'comida_segundo', label: 'Segundo plato', family: 'comida' },
      { key: 'comida_postre', label: 'Postre', family: 'postre' },
    ],
  },
  {
    title: 'Merienda',
    items: [
      { key: 'merienda', label: 'Merienda', family: 'merienda' },
    ],
  },
  {
    title: 'Cena',
    items: [
      { key: 'cena_primero', label: 'Primer plato', family: 'cena' },
      { key: 'cena_segundo', label: 'Segundo plato', family: 'cena' },
      { key: 'cena_postre', label: 'Postre', family: 'postre' },
    ],
  },
];

function slotFamily(slot: WeeklyMealSlot): string {
  return SLOT_GROUPS.flatMap((group) => group.items).find((item) => item.key === slot)?.family ?? slot;
}

interface MealSlotPickerModalProps {
  open: boolean;
  dayLabel: string;
  mealSlot: WeeklyMealSlot;
  selectedRecipeId: number | null;
  recipes: RecipeSummary[];
  saving: boolean;
  onClose: () => void;
  onSelectMealSlot: (slot: WeeklyMealSlot) => void;
  onAssignRecipe: (recipeId: number) => void;
  onClearRecipe: () => void;
}

export default function MealSlotPickerModal({
  open,
  dayLabel,
  mealSlot,
  selectedRecipeId,
  recipes,
  saving,
  onClose,
  onSelectMealSlot,
  onAssignRecipe,
  onClearRecipe,
}: MealSlotPickerModalProps) {
  const [query, setQuery] = useState('');

  const activeFamily = slotFamily(mealSlot);

  const filteredRecipes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const base = recipes.filter((recipe) => {
      const haystack = [
        recipe.title,
        recipe.description ?? '',
        ...(recipe.tags ?? []),
        ...(recipe.meal_types ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return q ? haystack.includes(q) : true;
    });

    return [...base].sort((left, right) => {
      const leftPriority = left.meal_types?.some((mealType) => mealType === activeFamily) ? 1 : 0;
      const rightPriority = right.meal_types?.some((mealType) => mealType === activeFamily) ? 1 : 0;
      if (leftPriority !== rightPriority) return rightPriority - leftPriority;
      return left.title.localeCompare(right.title, 'es');
    });
  }, [activeFamily, query, recipes]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal-content meal-picker-modal">
        <div className="modal-header">
          <div>
            <h2>Elegir receta</h2>
            <p className="meal-picker-subtitle">{dayLabel}</p>
          </div>
          <button className="btn-icon" onClick={onClose}>×</button>
        </div>

        <div className="modal-body modal-body-scroll meal-picker-body">
          <div className="meal-slot-selector">
            {SLOT_GROUPS.map((group) => (
              <div key={group.title} className="meal-slot-selector-group">
                <span className="meal-slot-selector-title">{group.title}</span>
                <div className="meal-slot-selector-chips">
                  {group.items.map((slot) => (
                    <button
                      key={slot.key}
                      type="button"
                      className={`meal-slot-tab${mealSlot === slot.key ? ' is-active' : ''}`}
                      onClick={() => onSelectMealSlot(slot.key)}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="meal-picker-toolbar">
            <input
              className="form-input"
              placeholder="Buscar receta..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onClearRecipe}
              disabled={saving || selectedRecipeId == null}
            >
              Quitar
            </button>
          </div>

          <div className="meal-picker-grid">
            {filteredRecipes.map((recipe) => {
              const imageUrl = resolveBackendUrl(recipe.image_url);
              const isSelected = recipe.id === selectedRecipeId;
              return (
                <button
                  key={recipe.id}
                  type="button"
                  className={`meal-recipe-card${isSelected ? ' is-selected' : ''}`}
                  onClick={() => onAssignRecipe(recipe.id)}
                  disabled={saving}
                >
                  <div className="meal-recipe-card-media">
                    {imageUrl ? (
                      <img src={imageUrl} alt={recipe.title} className="meal-recipe-card-image" />
                    ) : (
                      <div className="meal-recipe-card-placeholder">Sin imagen</div>
                    )}
                  </div>
                  <div className="meal-recipe-card-content">
                    <div className="meal-recipe-card-header">
                      <h3>{recipe.title}</h3>
                      {isSelected && <span className="meal-recipe-selected-badge">Actual</span>}
                    </div>
                    <p className="meal-recipe-card-description">
                      {recipe.description?.trim() || 'Sin descripcion'}
                    </p>
                    <div className="meal-recipe-card-meta">
                      <span>
                        {recipe.calories_per_serving != null
                          ? `${Math.round(recipe.calories_per_serving)} kcal`
                          : 'Kcal sin definir'}
                      </span>
                      <span>{recipe.estimated_minutes ? `${recipe.estimated_minutes} min` : 'Tiempo libre'}</span>
                      <span>
                        {recipe.estimated_cost != null
                          ? recipe.estimated_cost.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
                          : 'Coste sin definir'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filteredRecipes.length === 0 && (
            <div className="empty-state" style={{ padding: 24 }}>
              <div className="empty-icon">R</div>
              <p>No hay recetas que coincidan con la busqueda</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
