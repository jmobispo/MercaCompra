interface BudgetPanelProps {
  total: number;
  budget: number | null;
  onEditBudget?: () => void;
}

export default function BudgetPanel({ total, budget, onEditBudget }: BudgetPanelProps) {
  const formatCurrency = (val: number) =>
    val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const isOverBudget = budget !== null && total > budget;
  const remaining = budget !== null ? budget - total : null;
  const percent =
    budget && budget > 0 ? Math.min((total / budget) * 100, 100) : null;

  return (
    <div className="budget-panel">
      <h3>Presupuesto</h3>

      <div className="budget-row">
        <span className="label">Total actual</span>
        <span className={`value total ${isOverBudget ? 'over' : ''}`}>
          {formatCurrency(total)}
        </span>
      </div>

      {budget !== null ? (
        <>
          <div className="budget-row">
            <span className="label">Presupuesto</span>
            <span className="value">{formatCurrency(budget)}</span>
          </div>
          <div className="budget-row">
            <span className="label">Restante</span>
            <span className={`value ${isOverBudget ? 'over' : ''}`}>
              {remaining !== null ? formatCurrency(remaining) : '—'}
            </span>
          </div>

          {percent !== null && (
            <div className="progress-bar-container">
              <div
                className={`progress-bar ${isOverBudget ? 'over-budget' : ''}`}
                style={{ width: `${percent}%` }}
              />
            </div>
          )}

          {isOverBudget && (
            <div className="budget-warning">
              ⚠️ Has superado el presupuesto en {formatCurrency(total - budget)}
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginTop: 4 }}>
          Sin presupuesto definido
        </div>
      )}

      {onEditBudget && (
        <button
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 10, width: '100%' }}
          onClick={onEditBudget}
        >
          {budget !== null ? 'Cambiar presupuesto' : 'Añadir presupuesto'}
        </button>
      )}
    </div>
  );
}
