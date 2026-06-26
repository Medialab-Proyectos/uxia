# Radar UX·IA

App React para detectar vacantes UX/UI/Product Designer (prioridad: español + remoto) y
oportunidades de consultoría, con escaneo en vivo por IA, importador de posts y tablero persistente.

Esta es la versión exportada desde Claude.ai, adaptada para correr en tu entorno React local.

## Requisitos

- Node.js 18 o superior
- Una API key de Anthropic (https://console.anthropic.com/) para las funciones de IA

## Instalación

```bash
# 1. Entra a la carpeta
cd radar-ux-ia

# 2. Instala dependencias
npm install

# 3. Configura tu API key
cp .env.example .env
# Abre .env y pega tu key en VITE_ANTHROPIC_API_KEY=

# 4. Arranca en modo desarrollo
npm run dev
```

Se abre en http://localhost:5173

## Qué cambió respecto a la versión de Claude.ai

Dentro de Claude.ai, la app usaba dos cosas que no existen fuera de ese entorno.
Ya las dejé adaptadas:

1. **Almacenamiento**: antes usaba `window.storage` (propio del artefacto).
   Ahora usa `localStorage` del navegador. Tus vacantes guardadas persisten igual,
   en este caso en el navegador de tu máquina.

2. **Llamadas a la IA**: antes llamaba a la API de Anthropic sin key (Claude.ai la
   inyectaba). Ahora usa tu key desde `.env`, mediante el helper `callClaude()`
   al inicio de `src/RadarUXIA.jsx`.

## Importante sobre CORS y la API key

El navegador **no puede llamar a `api.anthropic.com` directamente** por las reglas de
CORS. Para que las funciones de IA (Radar en vivo, Oportunidades, Importar) funcionen
tienes dos caminos:

### Opción A — Backend/proxy propio (recomendado para producción)
Monta un pequeño servidor (Express, Next.js API route, Cloudflare Worker, etc.) que
reciba la petición del front, le agregue tu key en el servidor, y la reenvíe a Anthropic.
Luego cambia `API_ENDPOINT` en `src/RadarUXIA.jsx` por la URL de tu proxy.
Así tu key nunca queda expuesta en el navegador.

### Opción B — Acceso directo desde el navegador (solo pruebas locales)
El helper `callClaude()` ya envía el header
`anthropic-dangerous-direct-browser-access: true`, que Anthropic permite para pruebas.
Con tu key en `.env` debería funcionar en local. **No subas esto a producción**: la key
queda visible en el navegador.

## Funciones que NO requieren IA

Aunque no configures la key, sí funcionan sin IA:
- La pestaña **Fuentes**: genera enlaces de búsqueda a LinkedIn, Magneto, Computrabajo,
  elempleo, Get on Board, Torre, Indeed, y búsquedas X-ray de Google.
- La pestaña **Oportunidades**: las búsquedas manuales de prospección.
- El **Tablero**: ver, filtrar y gestionar lo que ya tengas guardado.

Las que sí requieren key: **Radar en vivo**, **Importar con IA** y el botón
**Detectar oportunidades**.

## Estructura

```
radar-ux-ia/
├── index.html          # HTML base (carga Tailwind por CDN)
├── package.json
├── vite.config.js
├── .env.example        # plantilla para tu API key
└── src/
    ├── main.jsx        # punto de entrada
    └── RadarUXIA.jsx   # el componente completo
```

## Build para producción

```bash
npm run build      # genera /dist
npm run preview    # previsualiza el build
```

## Nota legal

Esta app prioriza enlaces de búsqueda e importación manual de texto que tú copias.
El "Radar en vivo" usa búsqueda web vía la API de Anthropic sobre contenido público
indexado. No hace scraping de perfiles de LinkedIn ni accede a tu sesión. Si decides
integrar un scraper externo (ej. JobSpy), revisa los términos de uso de cada portal.
