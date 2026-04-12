# MercaCompra — Modos de Inteligencia Artificial

## Principio fundamental

**La aplicación funciona perfectamente sin ninguna IA externa o de pago.**

El modo `heuristics` es el predeterminado y siempre está disponible. Los demás modos son mejoras opcionales.

## Configuración

Establece `AI_MODE` en `backend/.env`:

```bash
# Opciones: heuristics | local_free | claude_optional
AI_MODE=heuristics
```

## Modo 1: heuristics (por defecto)

- **Coste:** cero
- **Dependencias:** ninguna
- **Siempre disponible:** sí

Utiliza similitud de secuencias (`difflib.SequenceMatcher`) y solapamiento de tokens para ordenar productos.

Incluye complementos por categoría (si la lista tiene "pasta", sugiere "salsa de tomate", etc.).

**Cuándo usar:** siempre; es el fallback de todos los demás modos.

## Modo 2: local_free (opcional)

- **Coste:** cero
- **Dependencias:** ninguna adicional
- **Fallback automático:** heuristics si falla

Implementa TF-IDF simple para puntuar productos contra la query. Mejor que heurísticos puros para queries ambiguas con muchos candidatos.

```bash
AI_MODE=local_free
```

## Modo 3: claude_optional (opcional, no requerido)

- **Coste:** depende de tu plan con Anthropic (puede ser de pago)
- **Dependencias:** `anthropic` package + `ANTHROPIC_API_KEY`
- **Fallback automático:** heuristics si API key no está o falla
- **Nunca rompe la aplicación:** cualquier error → heuristics silenciosamente

```bash
AI_MODE=claude_optional
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-6
```

### Qué hace Claude en este modo

1. **Ranking de productos:** Dado una query y una lista de candidatos de Mercadona, Claude elige los más relevantes considerando el contexto de la lista completa.
2. **Sugerencias de lista:** Dado el nombre y contenido de una lista, Claude propone productos complementarios.

### Degradación elegante

Si `ANTHROPIC_API_KEY` no está configurada o la llamada falla:
- Se registra un warning en logs
- Se usa automáticamente `HeuristicsAI`
- El usuario no percibe ningún error
- La aplicación sigue funcionando normalmente

## Tabla resumen

| Modo | Coste | External API | Degradación | Calidad |
|------|-------|--------------|-------------|---------|
| heuristics | 0 | No | — | Buena |
| local_free | 0 | No | → heuristics | Mejor |
| claude_optional | Variable* | Sí (opcional) | → heuristics | Excelente |

*Solo si usas claude_optional Y tienes API key.
