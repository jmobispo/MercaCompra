# Acceso desde iPad, iPhone o Android en la misma red local

La app está diseñada para funcionar desde cualquier dispositivo en tu red WiFi sin
cambiar ninguna configuración ni recompilar nada.

## Por qué funciona

El frontend usa URLs relativas (`/api/v1/...`) en vez de `http://localhost:8000`.
Esto significa que el navegador llama al mismo host que sirvió la página.
El servidor (Vite en dev, nginx en producción) reenvía esas llamadas al backend.

## Desarrollo local (Vite)

### 1. Obtén la IP local de tu PC

**macOS / Linux:**
```bash
# macOS
ipconfig getifaddr en0

# Linux
ip route get 1.1.1.1 | awk '/src/{print $7}'
```

**Windows:**
```cmd
ipconfig | findstr "IPv4"
```

Ejemplo de resultado: `192.168.1.35`

### 2. Arranca el servidor

```bash
# Opción A — script todo-en-uno
./scripts/start-dev.sh

# Opción B — manual
cd backend && uvicorn app.main:app --host 0.0.0.0 --port 8000
cd frontend && npm run dev   # ya escucha en 0.0.0.0:5173
```

### 3. Accede desde el dispositivo móvil

Con el dispositivo en la **misma red WiFi** que el PC:

```
http://192.168.1.35:5173
```

Sustituye `192.168.1.35` por la IP de tu PC.

> La app se comporta exactamente igual que en el PC.
> Las llamadas API van a `192.168.1.35:5173/api/v1/...`
> y Vite las reenvía a `localhost:8000`.

### Añadir a pantalla de inicio (PWA)

**iOS (Safari):**
1. Abre la URL en Safari
2. Pulsa el botón Compartir (cuadrado con flecha)
3. "Añadir a pantalla de inicio"
4. La app se instala como icono nativo

**Android (Chrome):**
1. Abre la URL en Chrome
2. Menú → "Añadir a pantalla de inicio" / "Instalar app"

## Docker Compose

```bash
docker compose up -d
docker compose exec backend alembic upgrade head
```

Accede desde cualquier dispositivo de la red:
```
http://<ip-del-pc>:5173
```

No hace falta VITE_API_URL ni ningún ajuste extra.
nginx reenvía `/api/` al contenedor backend por DNS interno de Docker.

## Firewall

Si el dispositivo móvil no puede conectar, comprueba que el firewall del PC
permite conexiones entrantes en los puertos 5173 y 8000.

**macOS:** Sistema → Privacidad y Seguridad → Firewall → Opciones de Firewall
**Linux (UFW):**
```bash
sudo ufw allow 5173
sudo ufw allow 8000
```
**Windows:** Panel de Control → Firewall de Windows Defender → Reglas de entrada
