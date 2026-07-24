# Runbook del Radar — la búsqueda la corre Claude Code (sin Apify, sin interfaz)

La interfaz del Radar **ya no busca ni scrapea** (se quitó Apify). La búsqueda la
hace **Claude Code**: busca en la web señales de demanda reales, las cura y las
**inserta en Supabase** (tabla `oportunidades`). La app solo **muestra, busca y da
seguimiento** (me interesa / descartar).

## Requisitos (en `.env`)
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Tabla `oportunidades` creada (`supabase/setup.sql`).

El radar corre **una vez al día, en la mañana**.

## Cuando el CEO diga "corre el md del radar", Claude Code hace:
0. **Caduca lo viejo primero** (higiene de la base): borra de Supabase las ofertas/
   propuestas con **más de 5 días** y guarda su id/URL en `operations/_run/archivo-radar.json`
   (memoria anti-duplicados). Así la base no crece con información sin valor y el fetch no
   re-inserta lo ya visto:
   ```bash
   npm run radar:clean
   ```
1. **Busca en la web** (WebSearch) señales reales: empresas/startups que escalan
   producto digital, levantan capital, o buscan agencia/consultoría UX/producto.
   Prioriza Colombia y LATAM.
2. **Cura solo oportunidades reales con URL verificable** (no inventa leads) en
   `operations/_run/oportunidades.json`. Formato por objeto:
   `{ empresa, persona, fuente, url, ubicacion, contacto, canal, categoria, dolor,
      tipo, encaje, señalesIA, prioridad, score, mensaje }`.
   - **NO cures "listados"** (enlaces de búsqueda de plataforma como "Ofertas en Magneto"):
     no son ofertas específicas. Esos ya están cubiertos por los botones de plataforma de la
     app (pestaña Radar). Solo se curan **ofertas/propuestas concretas** con URL directa.
     Si por alguna razón se incluye un listado, márcalo `"esListado": true` para que la app lo
     oculte de la lista de empleos.
3. **Inserta SOLO las nuevas** en Supabase (dedup; no pisa el seguimiento del CEO):
   ```bash
   npm run radar:fetch    # oportunidades
   npm run radar:jobs     # vacantes
   # (o npm run radar:all, que ya corre clean + fetch + jobs en orden)
   ```
   - **El dedup compara el id de cada candidato contra TODAS las filas que ya existen en la tabla
     (activas Y archivadas) + `archivo-radar.json`.** Por eso, lo que el CEO **archivó/eliminó** de
     la lista (estado `archivada`) NO se vuelve a traer: sigue en la base como memoria de "ya
     analizado". Nunca borres las archivadas para conservar esa memoria (solo la caducidad de +5d
     hace borrado duro, y antes guarda el id en el archivo).
   - **NO pongas un `id` aleatorio** en el JSON curado: si el objeto no trae `id`, el script lo
     deriva determinista con `hash(url|empresa)`, así el mismo empleo/propuesta recibe SIEMPRE el
     mismo id y el dedup por id funciona entre corridas (y respeta lo archivado). Deja `id` vacío.
4. El CEO abre **Radar → Oportunidades / Empleos**, recarga, prioriza por score y marca
   "me gusta"; dentro de "me gusta" marca **"Postulado"** cuando ya aplicó.

### Fuentes de VACANTES (buscar en VARIAS, no solo una)

La búsqueda de empleos debe barrer **múltiples portales** cada corrida — nunca depender de uno solo.
Verificar SIEMPRE que la URL siga **abierta** (muchas expiran/dan 403/410 en días; descartar las
cerradas). Fuentes a rotar:
- **LATAM/remoto:** Get on Board (getonbrd.com), We Remoto (weremoto.com), Remote Rocketship,
  startup.jobs, NoDesk, Built In, Arc.dev, uiuxjobsboard.com, Vacantes Digitales, LinkedIn.
- **Colombia:** elempleo.com, Magneto (magneto365.com), Torre (torre.co), computrabajo.
- **Freelance/producto:** Contra, Toptal, Domestika, YC "Work at a Startup".
Priorizar Colombia y LATAM remoto; puntuar más alto lo que tenga **señal de IA / design system /
producto** y sea senior/lead. No curar "listados" (páginas de búsqueda), solo ofertas concretas.

## Frescura / probabilidad de recordación (tag por oferta)

Cada oferta lleva un tag según hace cuánto se capturó (`created_at`), porque las empresas
suelen contratar en las primeras 48h y después baja rápido. La app lo pinta solo; el rango
ideal de una oferta es **máximo 3 días**:

- **≤ 48h (0–2 días): "A tiempo"** — dentro del límite de recordación.
- **3 días: "Poco probable"**.
- **4–5 días: "Baja probabilidad"**.
- **> 5 días: se archiva y se borra** (paso 0). El máximo de vida de una oferta es 5 días.

## Seguimiento en la app

- **Me gusta** (corazón) = interesa. Persistente en Supabase (`estado = me_interesa`).
- **Postulado** = tag INDEPENDIENTE dentro de "Me gusta" (columna `postulado`): la oferta
  sigue en "Me gusta" y además queda marcada como postulada. Hay filtro "Postuladas".
- **Listados vs empleos**: la lista de empleos muestra SOLO ofertas concretas. Los listados/
  búsquedas de plataforma se abren desde los botones de plataforma, antes de la lista.
- **Ubicación honesta (no todo es Colombia)**: se prioriza Colombia/LATAM, pero las ofertas pueden
  ser de cualquier país. Captura `ubicacion` tal cual la fuente (país/ciudad o "Remoto") y NO asumas
  Colombia por defecto; la app muestra la ubicación real de cada oferta.
- **Orden por score**: tanto Oportunidades como Empleos se presentan ordenados por `score`
  (mayor probabilidad de encaje primero).
- **"Eliminar" = ARCHIVAR (soft), no borrar**: cuando el CEO elimina una oferta/propuesta de la
  lista, NO se borra la fila: se marca `estado = 'archivada'`. Así sale de la vista pero queda como
  **memoria anti-duplicados** — el fetch dedup compara contra TODOS los ids existentes (incluidas
  las archivadas), de modo que ese empleo/propuesta **no se vuelve a traer** en la próxima corrida.
  Usa UPDATE (persiste con la RLS actual). El borrado DURO solo lo hace la caducidad (`radar:clean`,
  >5 días), que además guarda el id en `archivo-radar.json` antes de borrar.
- **Indicadores = lista visible**: los tiles (Empleos/Remotos/Colombia) y el contador de la pestaña
  "Vacantes · N" cuentan solo las vacantes ACTIVAS de la lista (sin favoritos, listados, archivadas
  ni aplicadas), no el total de filas.

## Nota honesta
La búsqueda web de Claude Code es US-first, así que para leads con **contacto
directo** en español/LATAM rinde menos que una fuente tipo LinkedIn. Lo que se
inserta son **señales de prospección reales** (empresa + URL + el porqué del encaje);
el contacto suele quedar "No especificado" hasta abrir la conversación.
