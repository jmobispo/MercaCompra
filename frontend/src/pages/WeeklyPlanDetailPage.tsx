import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { getLists } from '../api/lists';
import { getRecipes } from '../api/recipes';
import { generateWeeklyPlanShoppingList, getWeeklyPlan, updateWeeklyPlan } from '../api/weeklyPlans';
import type {
  AddToListResult,
  RecipeSummary,
  ShoppingListSummary,
  WeeklyPlan,
  WeeklyPlanDay,
  WeeklyPlanDayPayload,
} from '../types';

const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'];
const SLOT_LABELS: Array<{ key: 'desayuno' | 'comida' | 'cena'; label: string }> = [
  { key: 'desayuno', label: 'Desayuno' },
  { key: 'comida', label: 'Comida' },
  { key: 'cena', label: 'Cena' },
];

type CalendarCell = {
  isoDate: string;
  dayNumber: number;
  dayIndex: number | null;
  isCurrentMonth: boolean;
  isActivePlanDay: boolean;
};

const toIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (base: Date, days: number) => {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
};

function buildCalendar(startDateIso: string, daysCount: number): CalendarCell[] {
  const startDate = new Date(`${startDateIso}T00:00:00`);
  const calendarMonth = startDate.getMonth();
  const calendarYear = startDate.getFullYear();
  const firstDayOfMonth = new Date(calendarYear, calendarMonth, 1);
  const firstWeekday = (firstDayOfMonth.getDay() + 6) % 7;
  const calendarStart = addDays(firstDayOfMonth, -firstWeekday);

  const activeDates = new Map<string, number>();
  for (let index = 0; index < daysCount; index += 1) {
    activeDates.set(toIsoDate(addDays(startDate, index)), index);
  }

  return Array.from({ length: 42 }, (_, offset) => {
    const current = addDays(calendarStart, offset);
    const isoDate = toIsoDate(current);
    const activeIndex = activeDates.get(isoDate);
    return {
      isoDate,
      dayNumber: current.getDate(),
      dayIndex: activeIndex ?? null,
      isCurrentMonth: current.getMonth() === calendarMonth,
      isActivePlanDay: activeIndex !== undefined,
    };
  });
}

function getSlotDay(plan: WeeklyPlan, dayIndex: number, mealSlot: 'desayuno' | 'comida' | 'cena'): WeeklyPlanDay | null {
  return plan.days.find((day) => day.day_index === dayIndex && day.meal_slot === mealSlot) ?? null;
}

export default function WeeklyPlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const planId = Number(id);

  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [lists, setLists] = useState<ShoppingListSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateMode, setGenerateMode] = useState<'new' | 'existing'>('new');
  const [selectedListId, setSelectedListId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState('Lista semanal');
  const [result, setResult] = useState<AddToListResult | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [planData, recipesData, listsData] = await Promise.all([
        getWeeklyPlan(planId),
        getRecipes(),
        getLists(),
      ]);
      setPlan(planData);
      setRecipes(recipesData);
      setLists(listsData.filter((item) => !item.is_archived));
      setSelectedListId(listsData.find((item) => !item.is_archived)?.id ?? null);
      setNewListName(`Lista: ${planData.title}`);
    } catch {
      setError('No se pudo cargar el plan');
    } finally {
      setLoading(false);
    }
  }, [planId]);

  useEffect(() => {
    if (!planId) return;
    fetchData();
  }, [fetchData, planId]);

  const calendarCells = useMemo(() => {
    if (!plan) return [];
    return buildCalendar(plan.start_date, plan.days_count);
  }, [plan]);

  const handleSlotChange = (
    dayIndex: number,
    mealSlot: 'desayuno' | 'comida' | 'cena',
    recipeId: number | null
  ) => {
    if (!plan) return;
    let updated = false;
    const nextDays = plan.days.map((day) => {
      if (day.day_index === dayIndex && day.meal_slot === mealSlot) {
        updated = true;
        return {
          ...day,
          recipe_id: recipeId,
          recipe_title: recipes.find((recipe) => recipe.id === recipeId)?.title ?? null,
        };
      }
      return day;
    });

    if (!updated) {
      nextDays.push({
        id: dayIndex * -10,
        day_index: dayIndex,
        meal_slot: mealSlot,
        recipe_id: recipeId,
        recipe_title: recipes.find((recipe) => recipe.id === recipeId)?.title ?? null,
        meal_type: null,
      });
    }

    setPlan({ ...plan, days: nextDays });
  };

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);
    try {
      const updated = await updateWeeklyPlan(plan.id, {
        title: plan.title,
        people_count: plan.people_count,
        days_count: plan.days_count,
        start_date: plan.start_date,
        budget_target: plan.budget_target,
        days: plan.days.map<WeeklyPlanDayPayload>((day) => ({
          day_index: day.day_index,
          meal_slot: day.meal_slot,
          recipe_id: day.recipe_id,
          meal_type: day.meal_type,
        })),
      });
      setPlan(updated);
      setResult(null);
      setError('');
    } catch {
      setError('No se pudo guardar el plan');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!plan) return;
    try {
      const generated = await generateWeeklyPlanShoppingList(plan.id, {
        list_id: generateMode === 'existing' ? selectedListId : null,
        new_list_name: generateMode === 'new' ? newListName : null,
      });
      setResult(generated);
      setShowGenerate(false);
    } catch {
      setError('No se pudo generar la lista de compra');
    }
  };

  if (loading) {
    return <div className="loading-overlay"><span className="loading-spinner" /><span>Cargando plan...</span></div>;
  }

  if (!plan) {
    return (
      <div className="empty-state">
        <div className="empty-icon">📅</div>
        <p>Plan no encontrado</p>
        <button className="btn btn-secondary" onClick={() => navigate('/weekly-plans')}>Volver</button>
      </div>
    );
  }

  const monthLabel = new Date(`${plan.start_date}T00:00:00`).toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div>
      <div className="page-header">
        <div>
          <input
            className="inline-edit-input"
            value={plan.title}
            onChange={(e) => setPlan({ ...plan, title: e.target.value })}
            style={{ fontSize: 28, fontWeight: 700, width: '100%' }}
          />
          <p>{plan.people_count} personas · {plan.days_count} días · desde {plan.start_date}</p>
        </div>
        <div className="actions-row">
          <button className="btn btn-secondary" onClick={() => navigate('/weekly-plans')}>← Volver</button>
          <button className="btn btn-secondary" onClick={() => setShowGenerate(true)}>Generar lista</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar plan'}</button>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}
      {result && (
        <div className="alert alert-success" style={{ marginBottom: 16 }}>
          Lista generada: {result.list_name}. Añadidos {result.added}, reales {result.resolved_real ?? 0}, fallback {result.resolved_fallback ?? 0}, pendientes {result.unresolved ?? 0}, cubiertos por despensa {result.pantry_covered ?? 0}, ajustados por despensa {result.pantry_reduced ?? 0}.
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label className="form-label">Personas</label>
            <input className="form-input" type="number" min={1} max={20} value={plan.people_count} onChange={(e) => setPlan({ ...plan, people_count: Number(e.target.value) })} />
          </div>
          <div>
            <label className="form-label">Días</label>
            <input className="form-input" type="number" min={1} max={31} value={plan.days_count} onChange={(e) => setPlan({ ...plan, days_count: Number(e.target.value) })} />
          </div>
          <div>
            <label className="form-label">Fecha de inicio</label>
            <input className="form-input" type="date" value={plan.start_date} onChange={(e) => setPlan({ ...plan, start_date: e.target.value })} />
          </div>
          <div>
            <label className="form-label">Presupuesto objetivo</label>
            <input className="form-input" type="number" min={0} value={plan.budget_target ?? ''} onChange={(e) => setPlan({ ...plan, budget_target: e.target.value ? Number(e.target.value) : null })} />
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Calendario de {monthLabel}</h2>
        </div>
        <div className="card-body">
          <div className="meal-calendar-weekdays">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="meal-calendar-weekday">{label}</div>
            ))}
          </div>
          <div className="meal-calendar-grid">
            {calendarCells.map((cell) => (
              <div
                key={cell.isoDate}
                className={[
                  'meal-calendar-cell',
                  cell.isCurrentMonth ? '' : 'is-outside',
                  cell.isActivePlanDay ? 'is-active' : 'is-inactive',
                ].join(' ').trim()}
              >
                <div className="meal-calendar-date">
                  <span>{cell.dayNumber}</span>
                  {cell.isActivePlanDay && <small>Día {cell.dayIndex! + 1}</small>}
                </div>

                {cell.isActivePlanDay ? (
                  <div className="meal-calendar-slots">
                    {SLOT_LABELS.map((slot) => {
                      const day = getSlotDay(plan, cell.dayIndex!, slot.key);
                      return (
                        <label key={`${cell.isoDate}-${slot.key}`} className="meal-slot">
                          <span>{slot.label}</span>
                          <select
                            className="form-input"
                            value={day?.recipe_id ?? ''}
                            onChange={(e) => handleSlotChange(cell.dayIndex!, slot.key, e.target.value ? Number(e.target.value) : null)}
                          >
                            <option value="">Sin receta</option>
                            {recipes.map((recipe) => (
                              <option key={recipe.id} value={recipe.id}>{recipe.title}</option>
                            ))}
                          </select>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="meal-calendar-disabled">Fuera del rango del plan</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showGenerate && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setShowGenerate(false)}>
          <div className="modal-content" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <h2>Generar lista de compra</h2>
              <button className="btn-icon" onClick={() => setShowGenerate(false)}>×</button>
            </div>
            <div style={{ padding: '8px 4px 16px', display: 'grid', gap: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`btn btn-sm ${generateMode === 'new' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGenerateMode('new')}>Nueva lista</button>
                {lists.length > 0 && <button className={`btn btn-sm ${generateMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setGenerateMode('existing')}>Lista existente</button>}
              </div>
              {generateMode === 'new' ? (
                <input className="form-input" value={newListName} onChange={(e) => setNewListName(e.target.value)} />
              ) : (
                <select className="form-input" value={selectedListId ?? ''} onChange={(e) => setSelectedListId(Number(e.target.value))}>
                  {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                </select>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowGenerate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={handleGenerate}>Generar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
