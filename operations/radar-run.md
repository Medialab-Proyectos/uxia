# Runbook del Radar — búsqueda que corre Claude Code (no la interfaz)

La interfaz del Radar **ya no busca ni scrapea**. La búsqueda la corre **Claude Code
por dentro** (reutiliza el scraper `server/scraper.js`) y guarda las oportunidades
**nuevas** en Supabase (tabla `oportunidades`). La app solo las **muestra, busca y
les da seguimiento** (me interesa / descartar).

## Requisitos (en `.env`)
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (para guardar en Supabase).
- `APIFY_TOKEN` (fuente real del scraper; sin él, Google/Bing X-ray suelen dar 0).
- Tabla `oportunidades` creada (está en `supabase/setup.sql`).

## Cuando el CEO diga "busca oportunidades" / "llena el radar", Claude Code hace:

```bash
npm run radar:fetch                      # término por defecto (UX/conversión/retención)
npm run radar:fetch "consultoría UX fintech"   # término específico
```

Qué hace el comando (`scripts/radar-fetch.mjs`):
1. Corre el scraper existente (`scrapeOpportunities`) con el término.
2. Trae las señales de demanda (empresas/personas que buscan UX, agencia, partner, rediseño, formación).
3. Guarda en Supabase **solo las oportunidades nuevas** (no pisa las que ya marcaste
   "me interesa" o "descartada").
4. Reporta cuántas encontró y cuántas eran nuevas.

## Después
El CEO abre **Radar → Oportunidades** y **recarga**: ve las nuevas, las prioriza por
score y marca "me interesa" / "descartar" para seguimiento.

## Sugerencia de barrido diario
Correr varias veces con términos distintos para cubrir segmentos:
```bash
npm run radar:fetch "rediseño de producto digital"
npm run radar:fetch "necesitamos consultoría UX"
npm run radar:fetch "buscamos agencia de diseño"
npm run radar:fetch "aprender UX producto"
```
