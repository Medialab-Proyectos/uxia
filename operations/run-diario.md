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
npm run daily:fetch          # baja insumos pendientes de Supabase (imágenes Y textos)
```
- Los insumos de **texto** (`.md`/`.txt` subidos por subproyecto) llegan con
  `kind:"texto"` y su contenido en `raw_text`; las **imágenes** con `kind:"imagen"`.
  **Nada se convierte en tarea al subirlo** — todo queda pendiente hasta esta corrida.
- Claude lee `operations/_run/insumos.json` (texto en `raw_text` + las imágenes
  descargadas), arma tareas claras y escribe `operations/_run/tasks.json`
  (`{tasks, processedInsumoIds, keepFileInsumoIds}`).
- **Categorizar cada tarea según el ALCANCE del contrato de la empresa.** Cada empresa
  tiene un `scope` (arreglo) con las categorías que aplican: `Diseño`, `UX Research`,
  `Producto`, `Gestión de proyecto`, `Desarrollo de software`. En unas empresas MediaLab
  solo **apoya diseño**; en otras hace **gestión total** o **desarrollo**. Al crear cada
  tarea, ponerle `category` = una de las categorías del `scope` de esa empresa (la que
  mejor describa la tarea). Si el insumo pide algo **fuera del scope** de la empresa,
  anotarlo pero no inventar trabajo que no está contratado.
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
  - **`companyId: "global"`** (botón "Subir insumo global"): el CEO escribió todo de
    corrido sin elegir proyecto. Claude **lee el texto/imagen, lo divide y reparte**
    entre los proyectos que menciona (por nombre de empresa/subproyecto), creando
    tareas en cada uno. **Si menciona un proyecto que NO existe todavía, ESA parte NO
    se convierte en tarea: se deja el insumo pendiente** (o se registra la porción
    pendiente) hasta que el proyecto exista; en la próxima corrida se reintenta.
    Solo se retira el insumo global cuando **todo** su contenido quedó repartido.
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
