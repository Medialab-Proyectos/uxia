// Radar — carga de vacantes SIN Apify. La búsqueda la hace Claude Code
// (web search) y cura las vacantes en operations/_run/vacantes.json;
// este script solo INSERTA en Supabase las NUEVAS (no pisa el seguimiento).
//
// Uso:  node --env-file=.env scripts/radar-fetch.mjs [ruta/vacantes.json]

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.");
  process.exit(1);
}

const file = process.argv[2] || resolve(process.cwd(), "operations", "_run", "vacantes.json");
const parsed = JSON.parse(readFileSync(file, "utf8"));
const opps = Array.isArray(parsed) ? parsed : parsed.vacantes || [];

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = (h * 31 + str.charCodeAt(i)) | 0; }
  return Math.abs(h).toString(36);
}

const rows = opps.map((o) => ({
  id: o.id || `opp-${hash(`${o.url || ""}|${o.empresa || ""}`)}`,
  score: typeof o.score === "number" ? o.score : 50,
  estado: "nueva",
  data: o,
}));

async function sb(path, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const existing = await sb("vacantes?select=id");
const have = new Set((existing || []).map((r) => r.id));
const nuevos = rows.filter((r) => !have.has(r.id));
if (nuevos.length) {
  await sb("vacantes", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(nuevos) });
}
console.log(`Vacantes en el archivo: ${rows.length} · nuevas guardadas en Supabase: ${nuevos.length} · ya existían: ${rows.length - nuevos.length}`);
