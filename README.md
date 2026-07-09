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

## Arquitectura y despliegue en Vercel

El proyecto ya está listo para Vercel sin exponer tokens en el navegador:

- **Frontend** (Vite/React) → se compila a `/dist` y Vercel lo sirve como estático.
- **Backend** → funciones serverless en la carpeta `/api`:
  - `api/scrape.js` → radar de empleos.
  - `api/opportunities.js` → radar comercial (señales de demanda).
  - Ambas reutilizan el mismo core en `server/scraper.js`.
- El frontend llama a rutas **relativas** (`/api/scrape`, `/api/opportunities`), así que
  el mismo código corre en local y en Vercel sin cambios.

### Correr en local
Se necesitan dos procesos (el proxy de Vite reenvía `/api` al servidor Express):

```bash
npm run scraper   # backend en http://127.0.0.1:8787  (atiende /api/*)
npm run dev       # frontend en http://127.0.0.1:4173  (proxy /api → 8787)
```

### Desplegar en Vercel
1. Sube el repo a GitHub e impórtalo en Vercel (framework detectado: **Vite**).
2. En **Settings → Environment Variables** agrega:
   - `APIFY_TOKEN` = tu token de Apify (privado, **sin** prefijo `VITE_`).
   - `VITE_ANTHROPIC_API_KEY` (opcional) solo si quieres el respaldo con IA.
3. Deploy. Las funciones de `/api` quedan disponibles automáticamente.

> **Nota:** El radar comercial (Oportunidades) ahora funciona con **scraping** (Apify +
> X-ray de Google/Bing) y **no requiere** la API de Claude. La key de Anthropic solo se usa
> como respaldo opcional para *Analizar post* y para generar mensajes de outreach.

## Nota legal

Esta app prioriza enlaces de búsqueda e importación manual de texto que tú copias.
El "Radar en vivo" usa búsqueda web vía la API de Anthropic sobre contenido público
indexado. No hace scraping de perfiles de LinkedIn ni accede a tu sesión. Si decides
integrar un scraper externo (ej. JobSpy), revisa los términos de uso de cada portal.
# Pipeline Operativo UXIA

App React para centralizar tareas de proyectos por empresa y subproyecto. El flujo
recibe insumos pequenos en Markdown, texto o imagen, los interpreta y deja como
resultado tareas editables con titulo, descripcion, responsable, vencimiento, estado
y adjuntos propios de cada tarea.

## Flujo diario recomendado

```bash
npm run dev:local
```

1. Abre el panel en `http://127.0.0.1:4173`.
2. Entra con correo y contrasena.
3. Selecciona la empresa y el subproyecto.
4. Usa `Subir insumo` con un `.md`, `.txt` o imagen de menos de 1 MB.
5. La API local interpreta el archivo y crea tareas editables si encuentra informacion util.
6. Si el archivo no trae informacion accionable, se descarta para no cargar basura a la base.
7. Revisa cada tarea, asigna persona, estado y vencimiento.
8. Agrega adjuntos solo dentro de la tarea correspondiente.
9. Envia o notifica desde los iconos de la tarea: plataforma, Google Chat o WhatsApp.

El formato recomendado esta documentado en `operations/daily-run.md`.

## Persistencia compartida

El estado operativo ya no depende solo del navegador. La app guarda empresas,
subproyectos, personas, tareas, responsables, estados, logos, contexto y links en:

```txt
operations/state.json
```

Si varios equipos abren la app desde el mismo servidor, todos ven y actualizan ese
mismo archivo central. `localStorage` queda solo como respaldo temporal si la API no
esta disponible.

Para abrir desde otro equipo en la misma red, usa la IP de la maquina que corre la app:

```txt
http://IP-DE-LA-MAQUINA:4173/
```

En Vercel, la informacion operativa debe vivir en Supabase/Postgres + Supabase
Storage. El usuario no crea ni abre carpetas: sube insumos al subproyecto y la app
los interpreta para crear o complementar tareas.

Modelo recomendado en Supabase:

El archivo listo para copiar en el SQL Editor esta en:

```txt
supabase/schema.sql
```

En Supabase entra a `SQL Editor`, crea un query nuevo, pega ese archivo completo y
haz clic en `Run`.

Si ya habias corrido el SQL antes de esta correccion, corre tambien este archivo una
sola vez:

```txt
supabase/patch-people-id-text.sql
```

Para asociar personas por empresa, corre tambien:

```txt
supabase/patch-people-company-ids.sql
```

```sql
create table companies (
  id text primary key,
  name text not null,
  status text not null default 'activa',
  owner text not null default 'MediaLab',
  logo jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id) on delete cascade,
  name text not null,
  status text not null default 'activo',
  board_tool text,
  board_url text,
  description text,
  created_at timestamptz not null default now()
);

create table people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  type text not null default 'Empleado MediaLab',
  chat_url text,
  created_at timestamptz not null default now()
);

create table tasks (
  id text primary key,
  company_id text not null references companies(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  title text not null,
  status text not null,
  priority text not null,
  role text,
  assignee_id uuid references people(id) on delete set null,
  due_date date,
  delivery_date date,
  source text,
  evidence text,
  description text,
  user_story text,
  acceptance_criteria jsonb not null default '[]'::jsonb,
  attachments jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  company_id text not null references companies(id) on delete cascade,
  project_id uuid references projects(id) on delete set null,
  file_name text not null,
  storage_path text not null,
  status text not null default 'uploaded',
  task_count integer not null default 0,
  summary text,
  raw_text text,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);
```

Bucket recomendado en Storage: `operations-documents`, con rutas internas
`{company_id}/{project_id}/source`, `{company_id}/{project_id}/context`,
`{company_id}/{project_id}/task-docs` y `{company_id}/logos`.

Variables esperadas cuando se implemente Supabase:

```txt
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
RESEND_API_KEY=
MEDIALAB_NOTIFICATION_EMAIL=
```

Para `VITE_SUPABASE_ANON_KEY`, usa la `Publishable key` de Supabase. En proyectos
nuevos suele empezar por `sb_publishable_`. Si usas otra llave, el login puede mostrar
`invalid apikey`.

## Autenticacion y roles

La app usa Supabase Auth para entrar con correo y contrasena. Para crear el primer
usuario:

1. En Supabase abre `Authentication`.
2. Entra a `Users`.
3. Haz clic en `Add user`.
4. Escribe el correo del usuario.
5. Asigna una contrasena temporal.
6. Marca el correo como confirmado si Supabase muestra esa opcion.
7. Guarda el usuario.

Cuando el usuario entre a la app, puede abrir el menu de usuario en la parte superior,
cambiar su contrasena y cerrar sesion.

La division esperada de permisos es:

- Administrador: puede entrar al Radar de oportunidades y al Centro operativo, crear
  empresas, subproyectos, personas, procesar documentacion y revisar todas las tareas.
- Empleado MediaLab: puede entrar al Centro operativo, ver empresas/proyectos
  permitidos, subir documentacion y ver sus tareas asignadas.
- Externo: no debe recibir acceso al centro operativo por defecto.

Hoy el login ya bloquea la app completa. El siguiente ajuste de permisos finos es
filtrar acciones y tareas por rol/email del usuario autenticado.

Cada subproyecto puede guardar una herramienta seleccionada por desplegable y su
link. Los insumos se suben desde la tarjeta del subproyecto y se analizan para crear
o complementar tareas.

Los subproyectos se pueden archivar y reactivar sin borrar historial.

Cada empresa puede tener logo y cada subproyecto puede tener contexto general:
alcance, responsables, reglas del cliente y criterios del trabajo. Debajo de ese
contexto aparecen las tareas del subproyecto como tarjetas desplegables.

El panel tambien tiene un registro de personas con nombre, correo, telefono de
WhatsApp, tipo y empresa asociada. Al asignar una tarea, el desplegable debe mostrar
solo personas permitidas para esa empresa. Si la persona es interna se puede abrir su
Google Chat cuando tiene link configurado; si es externa se puede abrir WhatsApp con
el mensaje de la tarea.

Regla del procesamiento: al subir un `.md`, `.txt` o imagen de menos de 1 MB, la app
lo analiza para ese subproyecto. Si encuentra informacion util, crea tareas claras y
editables. Si no encuentra informacion util, descarta el archivo y no guarda basura.
El resultado visible no es una lista de fuentes procesadas: son tareas.

Cada tarea debe mostrar solo titulo, descripcion, asignado, estado, vencimiento
y adjuntos. No debe mostrar solicitud original, historia de usuario,
criterios de aceptacion, evidencia larga ni texto completo del insumo. Los adjuntos
son archivos agregados a esa tarea despues de creada y se pueden eliminar uno por uno.

## Integraciones previstas

- Trello: importar cards por tablero/lista/label y normalizarlas al pipeline.
- Notion: leer bases de datos internas de tareas y briefs.
- Jira: importar issues por proyecto/sprint/estado.
- Google Chat: enviar el brief diario a un espacio usando webhook.

---
