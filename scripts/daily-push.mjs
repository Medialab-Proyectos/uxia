// Run diario — PASO 3 (lo corre Claude Code local, después de analizar).
// Sube a Supabase las tareas que Claude armó y retira los insumos procesados.
//
// Uso:  node --env-file=.env.local scripts/daily-push.mjs [ruta/tasks.json]
// Formato de tasks.json:
// {
//   "tasks": [ { title, companyId, client, description?, status?, dueDate?,
//                deliveryDate?, owner?, assigneeId?, role?, source?, attachments?[] } ],
//   "processedInsumoIds": ["uuid", ...],       // insumos que ya se convirtieron
//   "keepFileInsumoIds":  ["uuid", ...],       // de esos, cuáles conservan el archivo
//   "productSignals": [ { companyId, client?, force, intensity, weight?, title,
//                         evidence?, source? } ]  // mediciones de salud del producto
// }                                            // (documentos SIN tareas: feedback/contexto → MDSSP)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { insertTasks, insertProductSignals, deleteInsumoPendiente } from "../server/operations.js";
import { nextBusinessDayCO } from "./businessDays.mjs";

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
  // La fecha propuesta NUNCA debe caer en sábado, domingo o festivo colombiano: se corre al
  // siguiente día hábil. Backstop del análisis del MD.
  if (task.dueDate) {
    const snapped = nextBusinessDayCO(task.dueDate);
    if (snapped !== task.dueDate) { console.log(`Fecha ${task.dueDate} → ${snapped} (día hábil) · ${task.title}`); task.dueDate = snapped; }
  }
}

const { inserted } = await insertTasks(tasks);
console.log(`Tareas subidas a Supabase: ${inserted}`);

// Mediciones de salud del producto (de documentos sin tareas: feedback/contexto) → MDSSP.
const productSignals = Array.isArray(payload.productSignals) ? payload.productSignals : [];
for (const signal of productSignals) {
  if (!signal.id) signal.id = randomUUID();
}
const { inserted: signalsInserted } = productSignals.length
  ? await insertProductSignals(productSignals)
  : { inserted: 0 };
if (signalsInserted) console.log(`Mediciones de producto subidas (MDSSP): ${signalsInserted}`);

let retired = 0;
for (const id of processedInsumoIds) {
  await deleteInsumoPendiente(id, { keepFile: keepFileIds.has(id) });
  retired += 1;
  console.log(`Insumo retirado: ${id}${keepFileIds.has(id) ? " (archivo conservado como adjunto)" : ""}`);
}

// Aviso instantáneo de la corrida del MD: un push-resumen por responsable con tareas nuevas/tocadas.
// No bloquea el run si falta VAPID o el push falla.
async function notifyRun(runTasks) {
  const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "";
  const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) { console.log("Aviso del MD: sin VAPID, se omite (llegará en el resumen diario)."); return; }
  const U = process.env.SUPABASE_URL.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const K = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
  const rest = (p) => fetch(`${U}/rest/v1/${p}`, { headers: H }).then((r) => (r.ok ? r.json() : []));

  const byAssignee = new Map();
  for (const t of runTasks) { if (!t.assigneeId) continue; byAssignee.set(t.assigneeId, (byAssignee.get(t.assigneeId) || 0) + 1); }
  if (byAssignee.size === 0) return;

  const { default: webpush } = await import("web-push");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@medialab.design", VAPID_PUBLIC, VAPID_PRIVATE);

  const people = await rest(`people?select=id,email`);
  const emailById = new Map((people || []).map((p) => [p.id, String(p.email || "").toLowerCase()]));
  let sent = 0;
  for (const [pid, count] of byAssignee) {
    const email = emailById.get(pid);
    if (!email) continue;
    const subs = await rest(`push_subscriptions?email=eq.${encodeURIComponent(email)}&select=endpoint,subscription`);
    const payload = JSON.stringify({ title: "El MD actualizó tus tareas", body: `${count} tarea${count > 1 ? "s" : ""} nueva${count > 1 ? "s" : ""} o complementada${count > 1 ? "s" : ""} por el análisis del día`, url: "/", tag: "uxia-md-run" });
    for (const s of (Array.isArray(subs) ? subs : [])) {
      try { await webpush.sendNotification(s.subscription, payload); sent++; }
      catch (err) { if (err && (err.statusCode === 404 || err.statusCode === 410)) await fetch(`${U}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE", headers: H }); }
    }
  }
  console.log(`Aviso del MD enviado a ${byAssignee.size} responsable(s) · ${sent} dispositivo(s).`);
}
try { await notifyRun(tasks); } catch (e) { console.log("Aviso del MD omitido:", e?.message || e); }

console.log(`\nRun diario completado. ${inserted} tarea(s), ${signalsInserted} medicion(es), ${retired} insumo(s) procesados.`);
