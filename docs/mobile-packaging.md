# Empaquetado móvil — PWA y Capacitor

MercaCompra está preparada para funcionar como:
1. **PWA** — instalable desde el navegador en iOS y Android
2. **App nativa empaquetada con Capacitor** — publicable en App Store y Google Play

---

## Opción 1 — PWA (ya configurada)

La PWA está lista desde el commit actual:
- `vite-plugin-pwa` genera el service worker y el manifest automáticamente
- Los iconos están en `frontend/public/icons/`
- `index.html` incluye todas las meta tags necesarias (`apple-mobile-web-app-capable`, `theme-color`, etc.)

### Instalar en iOS
1. Abre la app en Safari (`http://<ip>:5173` o URL pública)
2. Compartir → "Añadir a pantalla de inicio"
3. La app se abre en modo `standalone` (sin barra de navegador)

### Instalar en Android
1. Abre en Chrome
2. Menú → "Instalar app" o "Añadir a pantalla de inicio"

### Iconos de producción
Los iconos actuales son placeholders (cuadrado verde sólido).
Para producción, reemplaza los ficheros en `frontend/public/icons/` con PNGs reales:

```
icon-72.png   icon-96.png   icon-128.png  icon-144.png
icon-152.png  icon-180.png  icon-192.png  icon-384.png
icon-512.png
```

Herramienta recomendada: https://realfavicongenerator.net
Sube una imagen 512×512 y descarga el kit completo.

---

## Opción 2 — Capacitor (empaquetado nativo)

Capacitor permite publicar la misma app React en App Store y Google Play
empaquetándola en un WebView nativo.

### Prerrequisitos
- Xcode (para iOS) o Android Studio (para Android)
- Cuenta de desarrollador Apple (99 €/año) o Google Play (25 € único)

### Pasos de integración

#### 1. Instalar Capacitor

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npm install @capacitor/ios @capacitor/android
npx cap init MercaCompra com.mercacompra.app --web-dir dist
```

#### 2. Configurar la URL del backend

En `frontend/capacitor.config.ts` (se crea con `cap init`):

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mercacompra.app',
  appName: 'MercaCompra',
  webDir: 'dist',
  server: {
    // En producción: URL pública de tu backend
    url: 'https://api.yourdomain.com',
    cleartext: true,
  },
};

export default config;
```

Si usas `server.url`, Capacitor carga el contenido desde esa URL en vez del bundle local.
Alternativamente, para bundle local + API remota, sólo define `VITE_API_URL` en el build.

#### 3. Build y sincronizar

```bash
cd frontend
npm run build           # genera dist/
npx cap add ios         # crea ios/ con proyecto Xcode
npx cap add android     # crea android/ con proyecto Android Studio
npx cap sync            # copia dist/ a los proyectos nativos
```

#### 4. Abrir en IDE nativo

```bash
npx cap open ios        # abre Xcode
npx cap open android    # abre Android Studio
```

Desde ahí puedes compilar, testear en simulador, y publicar en la tienda.

### Qué sigue funcionando dentro de WebView

- Toda la UI React (rutas, estado, formularios)
- Llamadas API (CORS configurado con `*` por defecto)
- localStorage (tokens JWT)
- Service worker / PWA cache
- Zustand store

### Qué hay que ajustar para producción móvil

| Aspecto | Acción |
|---------|--------|
| URL del backend | Definir `VITE_API_URL` o `server.url` en capacitor.config.ts |
| CORS | Restringir `CORS_ORIGINS` al dominio real |
| HTTPS | El backend debe tener certificado SSL válido |
| Iconos | Reemplazar los placeholders por imágenes reales |
| Splash screen | `@capacitor/splash-screen` + assets |
| Deep links | Configurar Universal Links (iOS) / App Links (Android) si es necesario |

---

## Próximos pasos recomendados

1. Reemplazar iconos placeholder con diseño real
2. Decidir si publicar como PWA, app nativa, o ambas
3. Configurar un dominio + HTTPS para el backend (ej. Railway, Render, Fly.io)
4. Testear la PWA en dispositivo real
5. Si Capacitor: abrir Xcode / Android Studio y hacer primer build
