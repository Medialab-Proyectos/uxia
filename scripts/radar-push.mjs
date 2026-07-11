// Radar — inserta en Supabase las oportunidades que Claude Code curó por búsqueda
// web (SIN Apify, sin scraper). La app solo las lee y les da seguimiento.
//
// Flujo: Claude Code busca en la web → escribe operations/_run/oportunidades.json
//        → este script inserta SOLO las nuevas (no pisa "me_interesa"/"descartada").
//
// Uso:  node --env-file=.env scripts/radar-push.mjs [ruta/oportunidades.json]
// Formato del JSON: un arreglo de oportunidades, cada una con al menos:
//   { empresa, persona, fuente, url, dolor, encaje, mensaje, canal, categoria,
//     prioridad, score }   (id opcional; se genera desde la url si falta)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";

const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.");
  process.exit(1);
}

const file = process.argv[2] || resolve(process.cwd(), "operations", "_run", "oportunidades.json");
const raw = JSON.parse(readFileSync(file, "utf8"));
const list = Array.isArray(raw) ? raw : Array.isArray(raw.oportunidades) ? raw.oportunidades : [];

const hash = (s) => createHash("sha1").update(String(s)).digest("hex").slice(0, 12);
const rows = list.map((o) => ({
  id: o.id || `opp-${hash(o.url || o.empresa + o.dolor)}`,
  score: typeof o.score === "number" ? o.score : 0,
  estado: "nueva",
  data: o,
}));

async function sb(path, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
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

console.log(`En el archivo: ${rows.length} · nuevas guardadas en Supabase: ${nuevos.length} · ya existían: ${rows.length - nuevos.length}`);
console.log("La app (Radar → Oportunidades) las muestra al recargar.");
