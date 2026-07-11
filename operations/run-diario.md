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

### 2) Radar — oportunidades comerciales
- Claude busca en la web señales reales (empresas que escalan producto, levantan
  capital, buscan agencia/consultoría UX; prioriza Colombia y LATAM) y cura **solo
  reales con URL** en `operations/_run/oportunidades.json`.

### 3) Radar — vacantes de empleo
- Claude busca vacantes reales (UX/UI/Producto, español/remoto/LATAM: Computrabajo,
  Get on Board, elempleo, LinkedIn, startup.jobs…) y cura en
  `operations/_run/vacantes.json`.

### Guardar oportunidades + vacantes (un comando)
```bash
npm run radar:all            # inserta SOLO las nuevas; no pisa "me interesa"/"descartada"
```
(o por separado: `npm run radar:fetch` / `npm run radar:jobs`)

---

## Después
El CEO abre la app y **recarga**:
- **Centro operativo** → tareas nuevas del día.
- **Radar → Oportunidades** y **Tablero/Buscar (vacantes)** → cargadas desde Supabase.
- Usa el botón **Buscar** para filtrar por término sobre lo que ya está en la base.

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
