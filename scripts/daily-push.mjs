// Run diario — PASO 3 (lo corre Claude Code local, después de analizar).
// Sube a Supabase las tareas que Claude armó y retira los insumos procesados.
//
// Uso:  node --env-file=.env.local scripts/daily-push.mjs [ruta/tasks.json]
// Formato de tasks.json:
// {
//   "tasks": [ { title, companyId, client, description?, status?, dueDate?,
//                deliveryDate?, owner?, assigneeId?, role?, source?, attachments?[] } ],
//   "processedInsumoIds": ["uuid", ...],       // insumos que ya se convirtieron
//   "keepFileInsumoIds":  ["uuid", ...]        // de esos, cuáles conservan el archivo
// }                                            // (porque quedó como adjunto de la tarea)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { insertTasks, deleteInsumoPendiente } from "../server/operations.js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local.");
  process.exit(1);
}

const file = process.argv[2] || resolve(process.cwd(), "operations", "_run", "tasks.json");
const payload = JSON.parse(readFileSync(file, "utf8"));
const tasks = Array.isArray(payload.tasks) ? payload.tasks : Array.isArray(payload) ? payload : [];
const processedInsumoIds = payload.processedInsumoIds || [];
const keepFileIds = new Set(payload.keepFileInsumoIds || []);

const now = new Date().toISOString();
for (const task of tasks) {
  if (!task.id) task.id = randomUUID();
  if (!task.status) task.status = "ready";
  if (!task.priority) task.priority = "media";
  if (!task.createdAt) task.createdAt = now;
  if (!task.source) task.source = "Run diario";
}

const { inserted } = await insertTasks(tasks);
console.log(`Tareas subidas a Supabase: ${inserted}`);

let retired = 0;
for (const id of processedInsumoIds) {
  await deleteInsumoPendiente(id, { keepFile: keepFileIds.has(id) });
  retired += 1;
  console.log(`Insumo retirado: ${id}${keepFileIds.has(id) ? " (archivo conservado como adjunto)" : ""}`);
}

console.log(`\nRun diario completado. ${inserted} tarea(s), ${retired} insumo(s) procesados.`);
