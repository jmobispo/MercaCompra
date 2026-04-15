import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  getList,
  updateList,
  deleteItem,
  updateItem,
  addItem,
  deleteList,
  applyListOptimization,
  optimizeList,
} from '../api/lists';
import { useAuthStore } from '../store/authStore';
import ProductSearch from '../components/products/ProductSearch';
import BudgetPanel from '../components/budget/BudgetPanel';
import AutomationPanel from '../components/automation/AutomationPanel';
import ListForm from '../components/lists/ListForm';
import type { ShoppingList, ShoppingListItem, Product, CreateListPayload, ListOptimizationPreview } from '../types';

export default function ListDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);

  const [list, setList] = useState<ShoppingList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [optimizationPreview, setOptimizationPreview] = useState<ListOptimizationPreview | null>(null);
  const [selectedSuggestions, setSelectedSuggestions] = useState<string[]>([]);
  const [optimizing, setOptimizing] = useState(false);

  const listId = parseInt(id ?? '0', 10);

  const fetchList = useCallback(async () => {
    if (!listId) return;
    try {
      const data = await getList(listId);
      setList(data);
    } catch {
      setError('Error al cargar la lista');
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  // Compute real-time total
  const total =
    list?.items.reduce(
      (sum, item) =>
        sum + (item.product_price ?? 0) * item.quantity,
      0
    ) ?? 0;

  const handleAddProduct = async (product: Product) => {
    if (!list) return;
    setAddingItem(true);
    try {
      const updatedList = await addItem(list.id, {
        product_id: product.id,
        product_name: product.display_name ?? product.name,
        product_price: product.price,
        product_unit: product.unit_size,
        product_thumbnail: product.thumbnail,
        product_category: product.category,
        quantity: 1,
      });
      setList(updatedList);
    } catch {
      setError('Error al añadir el producto');
    } finally {
      setAddingItem(false);
    }
  };

  const handleToggleCheck = async (item: ShoppingListItem) => {
    if (!list) return;
    try {
      const updatedList = await updateItem(list.id, item.id, {
        is_checked: !item.is_checked,
      });
      setList(updatedList);
    } catch {
      setError('Error al actualizar el artículo');
    }
  };

  const handleQuantityChange = async (item: ShoppingListItem, delta: number) => {
    if (!list) return;
    const newQty = Math.max(1, item.quantity + delta);
    if (newQty === item.quantity) return;
    try {
      const updatedList = await updateItem(list.id, item.id, { quantity: newQty });
      setList(updatedList);
    } catch {
      setError('Error al actualizar la cantidad');
    }
  };

  const handleDeleteItem = async (item: ShoppingListItem) => {
    if (!list) return;
    try {
      await deleteItem(list.id, item.id);
      setList((prev) =>
        prev ? { ...prev, items: prev.items.filter((i) => i.id !== item.id) } : prev
      );
    } catch {
      setError('Error al eliminar el artículo');
    }
  };

  const handleUpdateList = async (payload: CreateListPayload) => {
    if (!list) return;
    const updated = await updateList(list.id, payload);
    setList(updated);
    setShowEditModal(false);
  };

  const handleInlineTitleSave = async () => {
    if (!list || !titleInput.trim()) {
      setEditingTitle(false);
      return;
    }
    try {
      const updated = await updateList(list.id, { name: titleInput.trim() });
      setList(updated);
    } catch {
      setError('Error al cambiar el nombre');
    }
    setEditingTitle(false);
  };

  const handleDeleteList = async () => {
    if (!list) return;
    if (!window.confirm(`¿Eliminar la lista "${list.name}"?`)) return;
    try {
      await deleteList(list.id);
      navigate('/lists');
    } catch {
      setError('Error al eliminar la lista');
    }
  };

  const handleOptimizePreview = async () => {
    if (!list) return;
    setOptimizing(true);
    try {
      const preview = await optimizeList(list.id);
      setOptimizationPreview(preview);
      setSelectedSuggestions(preview.suggestions.map((suggestion) => suggestion.id));
    } catch {
      setError('Error al analizar la lista');
    } finally {
      setOptimizing(false);
    }
  };

  const handleApplyOptimization = async () => {
    if (!list || !optimizationPreview) return;
    setOptimizing(true);
    try {
      const updated = await applyListOptimization(list.id, selectedSuggestions);
      setList(updated);
      setOptimizationPreview(null);
      setSelectedSuggestions([]);
    } catch {
      setError('Error al aplicar la optimizacion');
    } finally {
      setOptimizing(false);
    }
  };

  const formatCurrency = (val: number | null) =>
    val != null
      ? val.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })
      : '—';

  if (loading) {
    return (
      <div className="loading-overlay">
        <span className="loading-spinner" />
        <span>Cargando lista…</span>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="empty-state">
        <div className="empty-icon">❌</div>
        <p>Lista no encontrada</p>
        <button className="btn btn-secondary" onClick={() => navigate('/lists')}>
          Volver a listas
        </button>
      </div>
    );
  }

  const uncheckedItems = list.items.filter((i) => !i.is_checked);
  const checkedItems = list.items.filter((i) => i.is_checked);

  return (
    <div>
      {error && (
        <div className="alert alert-error" style={{ marginBottom: 16 }}>
          {error}
          <button className="btn btn-ghost btn-sm" style={{ marginLeft: 8 }} onClick={() => setError('')}>
            ×
          </button>
        </div>
      )}

      {/* Title row */}
      <div className="list-title-row" style={{ marginBottom: 20 }}>
        {editingTitle ? (
          <input
            className="inline-edit-input"
            value={titleInput}
            autoFocus
            onChange={(e) => setTitleInput(e.target.value)}
            onBlur={handleInlineTitleSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInlineTitleSave();
              if (e.key === 'Escape') setEditingTitle(false);
            }}
          />
        ) : (
          <h1
            style={{ cursor: 'pointer' }}
            title="Clic para editar"
            onClick={() => {
              setTitleInput(list.name);
              setEditingTitle(true);
            }}
          >
            {list.name}
          </h1>
        )}

        {list.is_archived && (
          <span className="badge archived">Archivada</span>
        )}

        <div className="actions-row" style={{ marginLeft: 'auto' }}>
          <Link
            to={`/lists/${listId}/supermarket`}
            className="btn btn-primary btn-sm"
            title="Vista optimizada para tienda"
          >
            🛒 Supermercado
          </Link>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleOptimizePreview}
            disabled={optimizing || list.items.length < 2}
          >
            Optimizar lista
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowEditModal(true)}
          >
            ✏️ Editar
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => navigate('/lists')}
          >
            ← Volver
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-danger)' }} onClick={handleDeleteList}>
            🗑
          </button>
        </div>
      </div>

      <div className="list-detail-layout">
        {/* Main area */}
        <div className="list-detail-main">
          {/* Product search */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <h2>Añadir productos</h2>
              {addingItem && <span className="loading-spinner" style={{ width: 16, height: 16 }} />}
            </div>
            <div className="card-body">
              <ProductSearch
                onAddProduct={handleAddProduct}
                postalCode={user?.postal_code}
                disabled={addingItem}
              />
            </div>
          </div>

          {/* Items list */}
          <div className="list-items-section">
            <div className="list-items-header">
              <span>Artículos ({list.items.length})</span>
              <span style={{ fontWeight: 400, fontSize: 12 }}>
                {uncheckedItems.length} pendientes · {checkedItems.length} marcados
              </span>
            </div>

            {list.items.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🛒</div>
                <p>La lista está vacía. Busca productos para añadir.</p>
              </div>
            ) : (
              <>
                {/* Unchecked items */}
                {uncheckedItems.map((item) => (
                  <ItemRow
                    key={item.id}
                    item={item}
                    onToggle={() => handleToggleCheck(item)}
                    onQtyChange={(delta) => handleQuantityChange(item, delta)}
                    onDelete={() => handleDeleteItem(item)}
                    formatCurrency={formatCurrency}
                  />
                ))}

                {/* Checked items */}
                {checkedItems.length > 0 && (
                  <>
                    <div
                      style={{
                        padding: '8px 16px',
                        fontSize: 12,
                        color: 'var(--color-text-muted)',
                        background: 'var(--color-bg)',
                        borderBottom: '1px solid var(--color-border)',
                      }}
                    >
                      En el carrito ({checkedItems.length})
                    </div>
                    {checkedItems.map((item) => (
                      <ItemRow
                        key={item.id}
                        item={item}
                        onToggle={() => handleToggleCheck(item)}
                        onQtyChange={(delta) => handleQuantityChange(item, delta)}
                        onDelete={() => handleDeleteItem(item)}
                        formatCurrency={formatCurrency}
                      />
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="list-detail-sidebar">
          <BudgetPanel
            total={total}
            budget={list.budget}
            onEditBudget={() => setShowEditModal(true)}
          />
          <AutomationPanel listId={list.id} />
        </div>
      </div>

      {/* Edit modal */}
      {showEditModal && (
        <ListForm
          onSubmit={handleUpdateList}
          onCancel={() => setShowEditModal(false)}
          initial={{
            id: list.id,
            name: list.name,
            budget: list.budget,
            is_archived: list.is_archived,
            item_count: list.items.length,
            total,
            updated_at: list.updated_at,
          }}
          title="Editar lista"
        />
      )}

      {optimizationPreview && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && setOptimizationPreview(null)}>
          <div className="modal-content" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h2>Optimizar lista</h2>
              <button className="btn-icon" onClick={() => setOptimizationPreview(null)}>×</button>
            </div>
            <div className="modal-body modal-body-scroll" style={{ display: 'grid', gap: 12 }}>
              {optimizationPreview.suggestions.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">✨</div>
                  <p>No he encontrado duplicados claros para unificar</p>
                </div>
              ) : (
                optimizationPreview.suggestions.map((suggestion) => (
                  <label key={suggestion.id} style={{ display: 'grid', gap: 6, padding: 12, border: '1px solid var(--color-border)', borderRadius: 12 }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                      <input
                        type="checkbox"
                        checked={selectedSuggestions.includes(suggestion.id)}
                        onChange={(event) => {
                          setSelectedSuggestions((prev) =>
                            event.target.checked
                              ? [...prev, suggestion.id]
                              : prev.filter((id) => id !== suggestion.id)
                          );
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600 }}>{suggestion.merged_product_name}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{suggestion.reason}</div>
                        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                          Unifica: {suggestion.item_names.join(' + ')}
                        </div>
                        <div style={{ fontSize: 13 }}>Cantidad final: {suggestion.combined_quantity}</div>
                      </div>
                    </div>
                  </label>
                ))
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setOptimizationPreview(null)}>Cerrar</button>
              <button
                className="btn btn-primary"
                disabled={optimizing || selectedSuggestions.length === 0}
                onClick={handleApplyOptimization}
              >
                {optimizing ? 'Aplicando...' : 'Aplicar sugerencias'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub-component for a single item row
function ItemRow({
  item,
  onToggle,
  onQtyChange,
  onDelete,
  formatCurrency,
}: {
  item: ShoppingListItem;
  onToggle: () => void;
  onQtyChange: (delta: number) => void;
  onDelete: () => void;
  formatCurrency: (v: number | null) => string;
}) {
  const lineTotal =
    item.product_price != null ? item.product_price * item.quantity : null;

  return (
    <div className={`item-row ${item.is_checked ? 'checked' : ''}`}>
      <input
        type="checkbox"
        className="item-checkbox"
        checked={item.is_checked}
        onChange={onToggle}
      />

      {item.product_thumbnail ? (
        <img
          src={item.product_thumbnail}
          alt={item.product_name}
          className="item-thumb"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        <div className="item-thumb-placeholder">🛒</div>
      )}

      <div className="item-info">
        <div className="item-name">{item.product_name}</div>
        <div className="item-meta">
          {item.product_category && <span>{item.product_category}</span>}
          {item.product_unit && <span> · {item.product_unit}</span>}
          {item.product_price != null && (
            <span> · {formatCurrency(item.product_price)}/ud</span>
          )}
        </div>
      </div>

      <div className="item-quantity-controls">
        <button className="qty-btn" onClick={() => onQtyChange(-1)} title="Restar">
          −
        </button>
        <span className="qty-value">{item.quantity}</span>
        <button className="qty-btn" onClick={() => onQtyChange(1)} title="Sumar">
          +
        </button>
      </div>

      <div className="item-price">
        {lineTotal != null ? formatCurrency(lineTotal) : '—'}
      </div>

      <button
        className="btn-icon danger"
        onClick={onDelete}
        title="Eliminar"
      >
        ×
      </button>
    </div>
  );
}
