// Run diario — PASO 1 (lo corre Claude Code local, NO la app).
// Baja los insumos pendientes de Supabase y descarga las imágenes a
// operations/_run/ para que Claude las lea (visión) y arme las tareas.
//
// Uso:  node --env-file=.env.local scripts/daily-fetch.mjs
// Requiere en .env.local: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { listInsumosPendientes } from "../server/operations.js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const OUT = resolve(process.cwd(), "operations", "_run");
mkdirSync(OUT, { recursive: true });

const insumos = await listInsumosPendientes({});
const manifest = [];

for (const insumo of insumos) {
  const entry = {
    id: insumo.id,
    kind: insumo.kind,
    companyId: insumo.companyId,
    client: insumo.client,
    fileName: insumo.fileName,
    url: insumo.url,
    storagePath: insumo.storagePath,
    rawText: insumo.rawText || "",
  };
  if (insumo.kind === "imagen" && insumo.url) {
    try {
      const res = await fetch(insumo.url);
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        const local = resolve(OUT, `${insumo.id}-${insumo.fileName}`);
        writeFileSync(local, buf);
        entry.localPath = local.replace(process.cwd(), "").replace(/^[/\\]/, "");
      } else {
        entry.error = `descarga HTTP ${res.status}`;
      }
    } catch (error) {
      entry.error = error.message;
    }
  }
  manifest.push(entry);
}

writeFileSync(resolve(OUT, "insumos.json"), JSON.stringify(manifest, null, 2));

console.log(`Insumos pendientes: ${manifest.length}. Imágenes descargadas: ${manifest.filter((m) => m.localPath).length}.`);
for (const m of manifest) {
  const detail = m.localPath ? `→ ${m.localPath}` : m.rawText ? "(texto)" : m.error ? `ERROR ${m.error}` : "";
  console.log(`- [${m.kind}] ${m.companyId}/${m.client || "-"} · ${m.fileName} ${detail}`);
}
console.log("\nManifiesto: operations/_run/insumos.json");
