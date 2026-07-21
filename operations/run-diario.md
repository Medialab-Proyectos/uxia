# MD maestro — corrida diaria (la ejecuta Claude Code)

Rutina para correr **todos los días**. La app NO busca ni scrapea: Claude Code hace
las consultas/análisis y **guarda todo en Supabase**; la app solo muestra, busca y
da seguimiento. Nada depende de servidores extra.

> **Normas de referencia (leer y respetar SIEMPRE en cada corrida):**
> - [`operations/daily-run.md`](daily-run.md) — normas del **Centro de Operaciones**: tareas,
>   6 estados, ciclo de revisión / request review, novedades, instrumentación DesignOps y las
>   normas de UI refinadas. Es la fuente de verdad del producto operativo.
> - [`operations/radar-run.md`](radar-run.md) — normas del **Radar**: caducidad 5 días + archivo
>   anti-duplicados, tags de frescura, listados fuera de la lista, "Postulado", ubicación honesta
>   y orden por score.
>
> Con leer y ejecutar estos tres MD (maestro + los dos de normas) el recorrido queda completo:
> no hay reglas fuera de estos documentos.

## Requisitos (una sola vez)
- `.env` con `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Tablas creadas: correr **`supabase/setup.sql`** (incluye `insumos_pendientes`,
  `oportunidades`, `vacantes`, `people.contact_method` y todas las RLS).
- Bucket `operations-documents` público (ya hecho).

---

## Cuando el CEO diga "corre el MD del día", Claude Code hace 3 bloques:

### 1) Centro de Operaciones — insumos → tareas
```bash
npm run daily:fetch          # baja insumos pendientes de Supabase (imágenes Y textos)
```
- Los insumos de **texto** (`.md`/`.txt` subidos por subproyecto) llegan con
  `kind:"texto"` y su contenido en `raw_text`; las **imágenes** con `kind:"imagen"` y los
  **PDF** con `kind:"pdf"`. **Nada se convierte en tarea al subirlo** — todo queda pendiente
  hasta esta corrida.
- **PDF (hasta 8 MB):** `daily:fetch` los descarga a `operations/_run/` igual que las imágenes y
  deja su ruta en `localPath`. Claude los lee con la herramienta **Read** usando el parámetro
  `pages` (máx. 20 páginas por llamada; obligatorio para PDF de más de 10 páginas). Si el PDF es
  largo, se lee por bloques y se resume por sección antes de crear tareas.
- Claude lee `operations/_run/insumos.json` (texto en `raw_text` + las imágenes
  descargadas), arma tareas claras y escribe `operations/_run/tasks.json`
  (`{tasks, processedInsumoIds, keepFileInsumoIds}`).
- **TÍTULO CORTO ≠ DESCRIPCIÓN (regla dura, pedido de Christian 2026-07-14):** el
  `title` es una **etiqueta accionable breve, máx ~6 palabras**, verbo + objeto
  (ej. "Montar pop-up historia 1666", "Vectorizar logo Dumpster"). Todo el contexto,
  matices, responsables y aclaraciones van en `description`. **NUNCA** poner la frase
  completa del insumo como título ni repetir el mismo texto en título y descripción.
  La **descripción debe ser DETALLADA cuando el tema lo amerite** (pasos, criterios,
  responsables, dependencias); breve solo si la tarea es trivial.
- **DEDUPLICAR contra tareas EXISTENTES (obligatorio, pedido de Christian 2026-07-14):**
  antes de crear una tarea, **traer las tareas ya existentes de ese proyecto**
  (`GET tasks?company_id=eq.<id>&client=eq.<sub>`) y comparar por similitud de intención,
  no solo texto exacto. Si ya existe una tarea igual o muy parecida:
  - **NO crear una nueva.** En su lugar, **enriquecer la existente** (PATCH): sumar a la
    `description` el nuevo detalle/contexto que aporte el insumo (sin duplicar), y ajustar
    fecha/prioridad si el insumo trae algo más urgente.
  - Solo crear tarea nueva si es un pendiente genuinamente distinto.
  - Reportar al final cuántas se **crearon** vs cuántas se **fusionaron/actualizaron**.
- **Clasificar CADA tarea automáticamente por el CONTEXTO (obligatorio).** Claude infiere
  la `category` leyendo el contenido de la tarea (qué se pide, con qué herramientas, verbos):
  - `Desarrollo de software`: despliegue, endpoints/API, tokens/auth, integración, front/back,
    Angular/Bubble/Cloud, QA, base de datos, Datadog, logs, Excel/automatizaciones, demo estable.
  - `Diseño UX/UI`: interfaz, pantallas, pop-up/modal, ficha/tablero, sistema de diseño, Figma,
    User Pilot (tooltips), formato de recordatorios, flujos.
  - `Diseño gráfico`: logo, vectorizar, colores, manual de marca, portafolio, branding.
  - `UX Research`: investigación, teoría del cambio, grabaciones para definir, usabilidad.
  - `Producto`: KPIs/indicadores, estrategia, priorización, reportes ejecutivos, alcance, criterios.
  - `Gestión de proyecto`: reuniones, coordinación, seguimiento/push, accesos, entregas, correos.
  - `Apoyo`: cuando MediaLab solo **apoya/soporta** una tarea liderada por otro equipo
    (ej. apoyar QA/diseño ajeno, dar soporte puntual), sin ser el responsable principal.
  - La columna `tasks.category` **ya existe**; incluir `category` en cada tarea de `tasks.json`.
- **Respetar el ALCANCE del contrato de la empresa** (`companies.scope`): si el insumo pide algo
  **fuera del scope** contratado, anotarlo pero no inventar trabajo que no está contratado.
```bash
npm run daily:push           # sube las tareas y retira los insumos procesados
```
- **Si un archivo NO se puede leer o no genera tareas, AVISAR al usuario** (no
  descartarlo en silencio). Decirle explícitamente cuál es el caso:
  - **Corrupto / ilegible:** no se pudo abrir, imagen borrosa, o texto sin sentido
    (p. ej. transcripción automática cruda con fragmentos sueltos). Pedir que lo
    vuelva a subir con mejor calidad o en otro formato.
  - **Vacío / sin nada accionable:** se leyó bien pero no hay acuerdos, pendientes,
    responsables ni fechas. Confirmar que no había tareas.
  - En ambos casos, **NO inventar tareas** y **preguntar** si descartar el insumo
    (con o sin conservar el archivo) o dejarlo pendiente. Solo retirarlo tras su OK.
- **Ruteo de insumos por `companyId`:**
  - `companyId` normal (una empresa) → tareas de ese proyecto en el Centro Operativo.
  - **`companyId: "global"`** (botón "Subir insumo global"): el CEO escribió/subió todo
    de corrido sin elegir proyecto. Claude **lee el texto/imagen, lo divide por proyecto**
    (por nombre de empresa/subproyecto mencionado) y procede así — **decisión de Christian
    2026-07-14**:
    1. **Proyecto que SÍ existe** (empresa+subproyecto en la base) → **anexar** sus tareas
       a ese subproyecto (companyId+client reales). Ojo con nombres mal transcritos por voz
       (ej. "Streams Hey collisions" = **Xtreme Collision** / metrics-lab).
    2. **Proyecto que NO existe** → **NO crear la empresa/subproyecto real**. Las tareas van
       a una **bandeja de espera**: empresa `por-asignar` (nombre "Por asignar (bandeja)"),
       con **un subproyecto por cada proyecto mencionado** (BID, Arcus, Tu Barco, etc.) y
       las tareas dentro. Quedan visibles como "lista de espera para asignar a una
       empresa/proyecto"; cuando exista el proyecto real, se mueven/recrean.
    3. Como **todo** el contenido quedó capturado (en proyectos reales o en la bandeja),
       **se retira el insumo global** (borrar fila `insumos_pendientes` + archivo de Storage).
  - **Mecánica (service role, vía REST):** upsert `companies?on_conflict=id` de `por-asignar`;
    upsert `projects?on_conflict=company_id,name` de los subproyectos de espera; insert en
    `tasks` (columnas que existen hoy; **`category` aún no existe** hasta correr el SQL, así
    que omitirla). Fechas: marcar `due_date`=hoy y `priority:"alta"` solo a lo explícitamente
    time-bound ("hoy", "para mediodía"); el resto sin fecha.
  - **`companyId: "radar"`** (Radar → "Subir propuesta") → Claude los lee y los agrega
    a **Propuestas/Empleos** (bloques 2 y 3), y luego los retira con `opsData.deleteInsumo`.

### 2) Radar — PROPUESTAS de negocio para MediaLab (oportunidades)
Señales reales de demanda de UX/producto/consultoría: empresas que **escalan producto,
levantan capital, buscan agencia/aliado/partner de diseño**, o edtech/comunidad (cursos).
- **Prioriza Colombia y LATAM.**
- Hacer **varias búsquedas por sector**: fintech, ecommerce/retail, healthtech, edtech,
  SaaS, movilidad, logística, agro, gobierno.
- Fuentes típicas (noticias de funding/producto): Crunchbase, Cuantico VP, Techloy,
  BNamericas, This Week in Fintech, LatamRepublic, Failory, KPMG/reportes.
- Curar **solo reales con URL verificable** en `operations/_run/oportunidades.json`.
- **DEDUP + ARCHIVADO (pedido de Christian 2026-07-14):** al correr, traer nuevas y
  **validar contra las que YA existen** en la tabla `oportunidades` (todas: nuevas,
  me_interesa, descartadas y **archivadas**). Antes de insertar:
  - Si la propuesta **ya existe** (mismo id/URL/empresa) → **no** volver a crearla.
  - Si ya fue **borrada** por el usuario → no re-agregarla.
  - Si ya está en **me gusta** (`estado:"me_interesa"`) → no tratarla como nueva.
  - Deduplicar por **id determinista** = hash(url|empresa) para que la misma señal no entre dos veces.
- **Archivar tras 1 semana, NO borrar:** una propuesta con **más de 7 días** desde su
  `created_at` pasa a **`estado:"archivada"`** (no se elimina). Las archivadas **no se
  muestran** en la app, pero **sí se conservan** para el dedup (que no reentren iguales).
  Marcar el archivado en la corrida: `PATCH oportunidades?created_at=lt.<hoy-7d>&estado=in.(nueva)  {estado:"archivada"}`
  (no tocar me_interesa ni descartada).

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

### 4) Insumos subidos en el Radar ("Subir propuesta")
- `daily:fetch` ya baja los insumos con `companyId:"radar"` (imagen **o texto**).
  Claude lee cada imagen o el `rawText`, lo convierte en propuesta o vacante (respeta
  la prioridad Colombia-remoto), lo añade al JSON correspondiente y **borra el insumo**
  con `opsData.deleteInsumo`.
- **Frescura de empleos:** preferir ofertas recientes y listados siempre vigentes; las
  tarjetas muestran "Capturada hace Nd" y avisan "puede estar vencida" a los >15 días.

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
