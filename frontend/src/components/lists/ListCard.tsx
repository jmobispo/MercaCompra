import { useNavigate } from 'react-router-dom';
import type { ShoppingListSummary } from '../../types';

interface ListCardProps {
  list: ShoppingListSummary;
  onEdit: (list: ShoppingListSummary) => void;
  onDelete: (list: ShoppingListSummary) => void;
  onDuplicate: (list: ShoppingListSummary) => void;
}

export default function ListCard({ list, onEdit, onDelete, onDuplicate }: ListCardProps) {
  const navigate = useNavigate();

  const budgetPercent =
    list.budget && list.budget > 0
      ? Math.min((list.total / list.budget) * 100, 100)
      : null;

  const isOverBudget = list.budget !== null && list.total > list.budget;

  const formatCurrency = (val: number) =>
    val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' });

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className={`list-card ${list.is_archived ? 'archived' : ''}`}>
      <div className="list-card-header">
        <div
          className="list-card-title"
          onClick={() => navigate(`/lists/${list.id}`)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && navigate(`/lists/${list.id}`)}
        >
          {list.name}
          {list.is_archived && <span className="badge archived" style={{ marginLeft: 8 }}>Archivada</span>}
        </div>
        <div className="list-card-actions">
          <button
            className="btn-icon"
            title="Ver lista"
            onClick={() => navigate(`/lists/${list.id}`)}
          >
            👁
          </button>
          <button
            className="btn-icon"
            title="Editar"
            onClick={() => onEdit(list)}
          >
            ✏️
          </button>
          <button
            className="btn-icon"
            title="Duplicar"
            onClick={() => onDuplicate(list)}
          >
            📋
          </button>
          <button
            className="btn-icon danger"
            title="Eliminar"
            onClick={() => onDelete(list)}
          >
            🗑
          </button>
        </div>
      </div>

      <div className="list-card-meta">
        Actualizada: {formatDate(list.updated_at)}
      </div>

      <div className="list-card-stats">
        <div className="list-card-stat">
          <span className="label">Artículos</span>
          <span className="value">{list.item_count}</span>
        </div>
        <div className="list-card-stat">
          <span className="label">Total</span>
          <span className="value" style={isOverBudget ? { color: 'var(--color-danger)' } : {}}>
            {formatCurrency(list.total)}
          </span>
        </div>
        {list.budget !== null && (
          <div className="list-card-stat">
            <span className="label">Presupuesto</span>
            <span className="value">{formatCurrency(list.budget)}</span>
          </div>
        )}
      </div>

      {budgetPercent !== null && (
        <div>
          <div className="progress-bar-container">
            <div
              className={`progress-bar ${isOverBudget ? 'over-budget' : ''}`}
              style={{ width: `${budgetPercent}%` }}
            />
          </div>
          {isOverBudget && (
            <div style={{ fontSize: 11, color: 'var(--color-danger)', marginTop: 4 }}>
              Excede el presupuesto en {formatCurrency(list.total - list.budget!)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
