const FALLBACK_THUMB_THEME: Record<
  string,
  { icon: string; top: string; bottom: string; accent: string }
> = {
  verduras: { icon: '🥬', top: '#eefbf2', bottom: '#d7f5df', accent: '#2e8b57' },
  frutas: { icon: '🍎', top: '#fff4ea', bottom: '#ffe0c9', accent: '#d96b2b' },
  panaderia: { icon: '🥖', top: '#fff6e8', bottom: '#ffe7c2', accent: '#b7791f' },
  aceites: { icon: '🫒', top: '#f5f9e8', bottom: '#e4efbe', accent: '#6b8e23' },
  charcuteria: { icon: '🥓', top: '#fff0f0', bottom: '#ffdada', accent: '#b85c5c' },
  huevos: { icon: '🥚', top: '#fffdf4', bottom: '#f8f0c7', accent: '#9a7d2e' },
  quesos: { icon: '🧀', top: '#fffbe8', bottom: '#fff0a8', accent: '#b8860b' },
  carnes: { icon: '🥩', top: '#fff0f1', bottom: '#ffd8dc', accent: '#b94a62' },
  pescado: { icon: '🐟', top: '#eef7ff', bottom: '#d8ebff', accent: '#357ab8' },
  lacteos: { icon: '🥛', top: '#f4f8ff', bottom: '#dde7ff', accent: '#4c6fbf' },
  bebidas: { icon: '🥤', top: '#eefcff', bottom: '#d6f5fb', accent: '#2d8ca3' },
  congelados: { icon: '❄️', top: '#f1fbff', bottom: '#dbf3ff', accent: '#3e86b3' },
  conservas: { icon: '🥫', top: '#f9f2ff', bottom: '#eadbff', accent: '#7a58b3' },
  default: { icon: '🛒', top: '#f3f7fb', bottom: '#e2ebf5', accent: '#55708f' },
};

export function hasRealHttpImage(value: string | null | undefined) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

export function normalizeCategoryKey(value: string | null | undefined) {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

export function buildInlineFallbackThumbnail(name: string, category: string | null | undefined) {
  const normalizedCategory = normalizeCategoryKey(category);
  const theme =
    FALLBACK_THUMB_THEME[normalizedCategory] ||
    (normalizedCategory.includes('verdur') ? FALLBACK_THUMB_THEME.verduras : null) ||
    (normalizedCategory.includes('frut') ? FALLBACK_THUMB_THEME.frutas : null) ||
    (normalizedCategory.includes('pan') ? FALLBACK_THUMB_THEME.panaderia : null) ||
    (normalizedCategory.includes('aceite') ? FALLBACK_THUMB_THEME.aceites : null) ||
    (normalizedCategory.includes('charcut') ? FALLBACK_THUMB_THEME.charcuteria : null) ||
    (normalizedCategory.includes('huevo') ? FALLBACK_THUMB_THEME.huevos : null) ||
    (normalizedCategory.includes('ques') ? FALLBACK_THUMB_THEME.quesos : null) ||
    (normalizedCategory.includes('carne') ? FALLBACK_THUMB_THEME.carnes : null) ||
    (normalizedCategory.includes('pesc') ? FALLBACK_THUMB_THEME.pescado : null) ||
    (normalizedCategory.includes('lact') ? FALLBACK_THUMB_THEME.lacteos : null) ||
    (normalizedCategory.includes('bebid') ? FALLBACK_THUMB_THEME.bebidas : null) ||
    (normalizedCategory.includes('congel') ? FALLBACK_THUMB_THEME.congelados : null) ||
    (normalizedCategory.includes('conserv') ? FALLBACK_THUMB_THEME.conservas : null) ||
    FALLBACK_THUMB_THEME.default;

  const shortName = (name || 'Producto').trim().split(/\s+/).slice(0, 2).join(' ').slice(0, 22);
  const safeName = shortName
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${theme.top}"/>
      <stop offset="100%" stop-color="${theme.bottom}"/>
    </linearGradient>
  </defs>
  <rect x="3" y="3" width="90" height="90" rx="18" fill="url(#g)"/>
  <rect x="10" y="10" width="76" height="76" rx="14" fill="rgba(255,255,255,0.52)"/>
  <circle cx="48" cy="34" r="18" fill="${theme.accent}" opacity="0.14"/>
  <text x="48" y="42" text-anchor="middle" font-family="Segoe UI Emoji, Apple Color Emoji, Segoe UI, Arial, sans-serif" font-size="22">${theme.icon}</text>
  <text x="48" y="68" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="9" font-weight="700" fill="${theme.accent}">${safeName}</text>
</svg>`.trim();

  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svg)))}`;
}
