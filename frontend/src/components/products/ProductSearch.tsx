import { useState, useEffect, useRef, useCallback } from 'react';
import { searchProducts } from '../../api/products';
import type { Product, ProductSearchResult } from '../../types';

interface ProductSearchProps {
  onAddProduct: (product: Product) => void;
  postalCode?: string;
  disabled?: boolean;
}

export default function ProductSearch({ onAddProduct, postalCode, disabled }: ProductSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [searchMeta, setSearchMeta] = useState<Pick<ProductSearchResult, 'source' | 'error'> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showResults, setShowResults] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setResults([]);
        setShowResults(false);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const data = await searchProducts(q.trim(), postalCode);
        setResults(data.products);
        setSearchMeta({ source: data.source, error: data.error });
        setShowResults(true);
        if (data.error) {
          setError(`Búsqueda limitada: ${data.error}`);
        }
      } catch {
        setError('Error al buscar productos');
        setResults([]);
        setSearchMeta(null);
      } finally {
        setLoading(false);
      }
    },
    [postalCode]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      doSearch(query);
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (product: Product) => {
    onAddProduct(product);
    setQuery('');
    setResults([]);
    setShowResults(false);
    setSearchMeta(null);
  };

  const formatPrice = (price: number | null) =>
    price != null ? `${price.toFixed(2)} €` : '';

  return (
    <div className="product-search" ref={containerRef}>
      <div className="search-input-wrap">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar productos de Mercadona…"
          disabled={disabled}
          onFocus={() => results.length > 0 && setShowResults(true)}
        />
        <span className="search-icon">
          {loading ? <span className="loading-spinner" style={{ width: 14, height: 14 }} /> : '🔍'}
        </span>
      </div>

      {searchMeta?.source === 'fallback' && (
        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ background: 'var(--color-warning, #f59e0b)', color: '#fff', borderRadius: 4, padding: '1px 5px', fontSize: 10 }}>
            OFFLINE
          </span>
          Usando catálogo local (Mercadona no disponible)
        </div>
      )}

      {error && !searchMeta?.error && (
        <div className="alert alert-error" style={{ marginTop: 6, padding: '6px 10px' }}>{error}</div>
      )}
      {searchMeta?.error && results.length === 0 && (
        <div className="alert alert-error" style={{ marginTop: 6, padding: '6px 10px' }}>{error}</div>
      )}

      {showResults && results.length > 0 && (
        <div className="search-results">
          {results.map((product) => (
            <div
              key={product.id}
              className="search-result-item"
              onClick={() => handleSelect(product)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && handleSelect(product)}
            >
              {product.thumbnail ? (
                <img
                  src={product.thumbnail}
                  alt={product.name}
                  className="search-result-thumb"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <div className="item-thumb-placeholder">🛒</div>
              )}
              <div className="search-result-info">
                <div className="search-result-name">
                  {product.display_name || product.name}
                </div>
                <div className="search-result-meta">
                  {product.category && <span>{product.category}</span>}
                  {product.unit_size && <span> · {product.unit_size}</span>}
                </div>
              </div>
              {product.price != null && (
                <div className="search-result-price">{formatPrice(product.price)}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {showResults && !loading && query.trim().length >= 2 && results.length === 0 && (
        <div className="search-results">
          <div className="search-loading">No se encontraron productos para "{query}"</div>
        </div>
      )}
    </div>
  );
}
