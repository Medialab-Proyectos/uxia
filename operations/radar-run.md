# Runbook del Radar — la búsqueda la corre Claude Code (sin Apify, sin interfaz)

La interfaz del Radar **ya no busca ni scrapea** (se quitó Apify). La búsqueda la
hace **Claude Code**: busca en la web señales de demanda reales, las cura y las
**inserta en Supabase** (tabla `oportunidades`). La app solo **muestra, busca y da
seguimiento** (me interesa / descartar).

## Requisitos (en `.env`)
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`.
- Tabla `oportunidades` creada (`supabase/setup.sql`).

## Cuando el CEO diga "corre el md del radar", Claude Code hace:
1. **Busca en la web** (WebSearch) señales reales: empresas/startups que escalan
   producto digital, levantan capital, o buscan agencia/consultoría UX/producto.
   Prioriza Colombia y LATAM.
2. **Cura solo oportunidades reales con URL verificable** (no inventa leads) en
   `operations/_run/oportunidades.json`. Formato por objeto:
   `{ empresa, persona, fuente, url, ubicacion, contacto, canal, categoria, dolor,
      tipo, encaje, señalesIA, prioridad, score, mensaje }`.
3. **Inserta las nuevas** en Supabase (no pisa el seguimiento existente):
   ```bash
   npm run radar:fetch
   ```
4. El CEO abre **Radar → Oportunidades**, recarga, prioriza por score y marca
   "me interesa" / "descartar".

## Nota honesta
La búsqueda web de Claude Code es US-first, así que para leads con **contacto
directo** en español/LATAM rinde menos que una fuente tipo LinkedIn. Lo que se
inserta son **señales de prospección reales** (empresa + URL + el porqué del encaje);
el contacto suele quedar "No especificado" hasta abrir la conversación.
