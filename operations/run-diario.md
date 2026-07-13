# MD maestro — corrida diaria (la ejecuta Claude Code)

Rutina para correr **todos los días**. La app NO busca ni scrapea: Claude Code hace
las consultas/análisis y **guarda todo en Supabase**; la app solo muestra, busca y
da seguimiento. Nada depende de servidores extra.

## Requisitos (una sola vez)
- `.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Tablas creadas: correr **`supabase/setup.sql`** (incluye `insumos_pendientes`,
  `oportunidades`, `vacantes`, `people.contact_method` y todas las RLS).
- Bucket `operations-documents` público (ya hecho).

---

## Cuando el CEO diga "corre el MD del día", Claude Code hace 3 bloques:

### 1) Centro de Operaciones — insumos → tareas
```bash
npm run daily:fetch          # baja insumos pendientes de Supabase (descarga imágenes)
```
- Claude lee `operations/_run/insumos.json` + las imágenes, arma tareas claras y
  escribe `operations/_run/tasks.json` (`{tasks, processedInsumoIds, keepFileInsumoIds}`).
```bash
npm run daily:push           # sube las tareas y retira los insumos procesados
```
- **Ruteo de imágenes:** los insumos con `companyId` normal → tareas del Centro
  Operativo. Los insumos con **`companyId: "radar"`** (subidos en Radar → "Subir
  propuesta") → Claude los lee y los agrega a **Propuestas/Empleos** (bloques 2 y 3),
  y luego los retira con `opsData.deleteInsumo`.

### 2) Radar — PROPUESTAS de negocio para MediaLab (oportunidades)
Señales reales de demanda de UX/producto/consultoría: empresas que **escalan producto,
levantan capital, buscan agencia/aliado/partner de diseño**, o edtech/comunidad (cursos).
- **Prioriza Colombia y LATAM.**
- Hacer **varias búsquedas por sector**: fintech, ecommerce/retail, healthtech, edtech,
  SaaS, movilidad, logística, agro, gobierno.
- Fuentes típicas (noticias de funding/producto): Crunchbase, Cuantico VP, Techloy,
  BNamericas, This Week in Fintech, LatamRepublic, Failory, KPMG/reportes.
- Curar **solo reales con URL verificable** en `operations/_run/oportunidades.json`.

### 3) Radar — EMPLEOS (vacantes) — rol central: Colombia-remoto-español
**Orden de prioridad (así los ordena la app con `jobRank`):**
1. **Colombia + remoto + español (PRIMERO)**
2. LATAM remoto (español)
3. México / resto LATAM
4. EE.UU. / inglés (AL FINAL, pero se muestran)

- Hacer **varias rondas enfocadas Colombia-remoto** (Bogotá, Medellín, Cali…), luego
  LATAM, luego US.
- Fuentes de empleo: **Computrabajo, Magneto, elempleo, Get on Board, LinkedIn, Indeed,
  Glassdoor, startup.jobs, trabajo.org, WeRemoto, Remote Rocketship, UI/UX Jobs Board**.
- **Volumen:** además de vacantes puntuales (con empresa), incluir los **listados**
  (LinkedIn/Indeed/Get on Board con "735 ofertas de Product Design", "73–83 de UX")
  como entradas tipo "listado" para explorar directo. Bajan el score pero dan volumen.
- Curar en `operations/_run/vacantes.json` (o un archivo aparte y `radar:jobs -- ruta`).

### 4) Imágenes subidas en el Radar ("Subir propuesta")
- `daily:fetch` ya baja los insumos con `companyId:"radar"`. Claude lee cada imagen
  (captura de una oferta/post), la convierte en propuesta o vacante, la añade al JSON
  correspondiente y **borra el insumo** con `opsData.deleteInsumo`.

### Guardar propuestas + empleos (un comando)
```bash
npm run radar:all            # inserta SOLO las nuevas; no pisa "me gusta"/"descartada"
```
(o por separado: `npm run radar:fetch` / `npm run radar:jobs`
 · o desde otro archivo: `npm run radar:jobs -- operations/_run/vacantes-nuevas.json`)

---

## Después
El CEO abre la app y **recarga**:
- **Centro operativo** → tareas nuevas del día.
- **Radar** (4 pestañas: **Propuestas · MediaLab**, **Empleos**, **Me gusta**, **Subir
  propuesta**) → todo cargado desde Supabase. Cada lista tiene **buscador por texto** +
  **filtro por periodicidad** (hoy / semana / 15 días). Marca **Me gusta** o
  **Eliminar** (se guardan en Supabase, compartido entre equipos).

## Formatos (referencia rápida)
- Oportunidad: `{ empresa, persona, fuente, url, ubicacion, contacto, canal,
  categoria, dolor, tipo, encaje, señalesIA, prioridad, score, mensaje }`
- Vacante (campos en ESPAÑOL, los que lee la UI): `{ titulo, empresa, url, fuente,
  ubicacion, remoto ("remoto"|"híbrido"|"presencial"), idioma, esColombia, categoria,
  salario, resumen, score }`

## Nota honesta
La búsqueda web de Claude Code es US-first; para leads/vacantes con contacto directo
en LATAM rinde más una fuente tipo LinkedIn. Se insertan **solo ítems reales con URL
verificable** (nunca inventados); el contacto puede quedar "No especificado".
