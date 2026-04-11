# MercaCompra — Limitaciones del Bot de Automatización

## Aviso importante

El bot de automatización interactúa con la web pública de Mercadona mediante Playwright. Esto conlleva limitaciones inherentes que debes conocer.

## Limitaciones técnicas

### 1. Fragilidad de selectores CSS

Mercadona puede cambiar la estructura de su web en cualquier momento. Cuando eso ocurra, los selectores en `bot/src/selectors.py` dejarán de funcionar.

**Solución:** Todos los selectores están centralizados en un único archivo (`selectors.py`). Si la web cambia, actualiza solo ese archivo.

### 2. Sin garantía de disponibilidad

La API no oficial de Mercadona (`tienda.mercadona.es/api`) puede:
- Añadir autenticación
- Cambiar su estructura de respuesta
- Bloquear IPs con muchas peticiones
- Dejar de existir

### 3. Matching imperfecto de productos

El bot busca productos por nombre y escoge el mejor resultado. El matching es heurístico:

| Confianza | Estado | Significado |
|-----------|--------|-------------|
| ≥ 0.75 | `ok` | Buen match |
| 0.40 – 0.75 | `dubious` | Match dudoso — verifica antes de finalizar |
| 0.25 – 0.40 | `substituted` | Producto distinto añadido |
| < 0.25 | `not_found` | No añadido |

### 4. Requiere sesión de Mercadona para añadir al carrito

Para añadir productos al carrito de forma persistente:
- Necesitas credenciales válidas de Mercadona
- Configura `MERCADONA_EMAIL` y `MERCADONA_PASSWORD` en `bot/.env`
- Sin credenciales, el bot puede buscar pero puede no poder añadir permanentemente

### 5. CAPTCHAs y detección de bots

Mercadona puede implementar protecciones anti-bot. Si esto ocurre:
- El bot fallará con un error descriptivo
- Los resultados parciales se guardarán igualmente
- Puedes usar `HEADLESS=false` para ver el navegador y depurar

## Limitaciones de datos

### Precios estimados

Los precios mostrados en los resultados de automatización son los que el bot lee de la web en el momento de la ejecución. Pueden no coincidir exactamente con el precio final por:
- Ofertas aplicadas en checkout
- Cambios de precio entre sesiones
- Precio por peso (productos variables)

## Uso responsable

- No abuses de la frecuencia de ejecución
- Mercadona no tiene una API pública aprobada; usa el bot con moderación
- Respeta los términos de uso de Mercadona

## Cómo mejorar la fiabilidad

1. **Actualiza selectores** cuando la web cambie (`bot/src/selectors.py`)
2. **Aumenta `SLOW_MO`** si tienes problemas de timing (ej: `SLOW_MO=500`)
3. **Aumenta `BOT_TIMEOUT`** para conexiones lentas
4. **Usa `HEADLESS=false`** para depurar problemas visuales
5. **Revisa screenshots** en `SCREENSHOTS_DIR` cuando hay errores
