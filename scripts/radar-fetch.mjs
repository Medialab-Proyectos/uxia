// Radar — búsqueda INTERNA (la corre Claude Code, NO la interfaz).
// Reutiliza el scraper existente (server/scraper.js) y guarda las oportunidades
// NUEVAS en Supabase (tabla oportunidades). La app solo las lee y les da seguimiento.
//
// Uso:  node --env-file=.env scripts/radar-fetch.mjs ["término de búsqueda"]
// Requiere: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (y APIFY_TOKEN para el scraper).

import { scrapeOpportunities } from "../server/scraper.js";

const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.");
  process.exit(1);
}

const query = process.argv.slice(2).join(" ") || "rediseño UX conversión retención";
console.log(`Buscando oportunidades para: "${query}" …`);

const opps = await scrapeOpportunities({ query, limit: 20 });
const rows = (opps || []).map((o) => ({
  id: o.id || `opp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  score: typeof o.score === "number" ? o.score : 0,
  estado: "nueva",
  data: o,
}));

// Solo insertar las que NO existen (para no pisar el estado "me_interesa"/"descartada").
async function sb(path, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

const existing = await sb("oportunidades?select=id");
const have = new Set((existing || []).map((r) => r.id));
const nuevos = rows.filter((r) => !have.has(r.id));

if (nuevos.length) {
  await sb("oportunidades", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(nuevos) });
}

console.log(`Encontradas: ${rows.length} · nuevas guardadas en Supabase: ${nuevos.length} · ya existían: ${rows.length - nuevos.length}`);
console.log("La app (Radar → Oportunidades) las mostrará al recargar.");
