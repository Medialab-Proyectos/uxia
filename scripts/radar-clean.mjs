// Radar — caducidad de ofertas/propuestas de más de 5 días.
// Las empresas suelen contratar en las primeras 48h; pasados ~5 días la oferta ya no
// tiene recordación. Este script:
//   1) busca en Supabase las filas (oportunidades + vacantes) con created_at < hoy-5d,
//   2) guarda su id/url/empresa en operations/_run/archivo-radar.json (memoria anti-dup),
//   3) las BORRA de Supabase para que la base no crezca con información sin valor.
// El archivo evita que el fetch vuelva a insertar lo ya visto (dedup contra activas + archivo).
//
// Uso:  node --env-file=.env scripts/radar-clean.mjs [dias]   (por defecto 5)

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const URL = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env."); process.exit(1); }

const DIAS = Number(process.argv[2] || 5);
const cutoff = new Date(Date.now() - DIAS * 86400000).toISOString();
const ARCHIVO = resolve(process.cwd(), "operations", "_run", "archivo-radar.json");

async function sb(path, init = {}) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

// Archivo anti-dup: { ids: [...], items: [{id,kind,empresa,url,fecha,archivedAt}] }
let archivo = { ids: [], items: [] };
if (existsSync(ARCHIVO)) {
  try { archivo = JSON.parse(readFileSync(ARCHIVO, "utf8")); } catch { /* archivo corrupto → se reinicia */ }
}
const idSet = new Set(archivo.ids || (archivo.items || []).map((x) => x.id));

let totalBorradas = 0;
for (const tabla of ["oportunidades", "vacantes"]) {
  // La caducidad NO toca lo que el CEO está rastreando: "me gusta" (me_interesa), aplicadas ni
  // postuladas se conservan aunque sean viejas. Solo caducan las desatendidas: nueva/descartada/
  // archivada (su id queda en archivo-radar.json, así el dedup sigue evitando que reaparezcan).
  const viejas = await sb(`${tabla}?select=id,data,created_at,estado,postulado&created_at=lt.${encodeURIComponent(cutoff)}&estado=in.(nueva,descartada,archivada)&postulado=is.false`);
  if (!viejas || !viejas.length) { console.log(`${tabla}: 0 caducadas (> ${DIAS}d).`); continue; }
  for (const r of viejas) {
    if (!idSet.has(r.id)) {
      idSet.add(r.id);
      archivo.items.push({ id: r.id, kind: tabla, empresa: r.data?.empresa || "", url: r.data?.url || "", fecha: r.data?.fecha || "", archivedAt: new Date().toISOString() });
    }
  }
  // Borra en lotes por id.
  const ids = viejas.map((r) => r.id);
  const inList = ids.map((id) => `"${String(id).replace(/"/g, "")}"`).join(",");
  await sb(`${tabla}?id=in.(${inList})`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
  totalBorradas += ids.length;
  console.log(`${tabla}: ${ids.length} caducada(s) archivada(s) y borrada(s).`);
}

archivo.ids = [...idSet];
writeFileSync(ARCHIVO, JSON.stringify(archivo, null, 2));
console.log(`\nCaducidad completada. ${totalBorradas} fila(s) retirada(s) (> ${DIAS}d). Archivo anti-dup: ${archivo.ids.length} id(s).`);
