// Repriorización del run diario (ruta "sin insumos" de operations/daily-run.md).
//
// Aplica a TODAS las tareas activas las reglas del MD:
//   - designPoints: 0,5 trámite · 1 simple · 2 media · 4 compleja (esfuerzo, no prioridad)
//   - category "Administrativo" para obligaciones propias de MediaLab (riesgo no lineal)
//   - priority: bloqueada = cuello de botella (alta); Administrativo nunca baja
//   - dueDate automática en DÍAS HÁBILES (festivos Colombia), conservando prev_due_date
//
// Usa PATCH dirigido (solo las columnas que cambian) para NO pisar descripción,
// responsable, comentarios ni created_at.
//
// Uso:  node --env-file=.env scripts/repriorizar.mjs [--apply]

import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply");
const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }

const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const HOY = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

// ── Festivos de Colombia 2026 (ley Emiliani ya aplicada) ────────────────────
const FESTIVOS = new Set([
  "2026-01-01", "2026-01-12", "2026-03-23", "2026-04-02", "2026-04-03",
  "2026-05-01", "2026-05-18", "2026-06-08", "2026-06-15", "2026-06-29",
  "2026-07-20", "2026-08-07", "2026-08-17", "2026-10-12", "2026-11-02",
  "2026-11-16", "2026-12-08", "2026-12-25",
]);
const esHabil = (iso) => {
  const d = new Date(`${iso}T12:00:00Z`).getUTCDay();
  return d !== 0 && d !== 6 && !FESTIVOS.has(iso);
};
/** Suma N días hábiles a una fecha ISO (0 = el mismo día si es hábil, si no el siguiente). */
function sumarHabiles(desdeISO, n) {
  const d = new Date(`${desdeISO}T12:00:00Z`);
  let iso = d.toISOString().slice(0, 10);
  if (n === 0) { while (!esHabil(iso)) { d.setUTCDate(d.getUTCDate() + 1); iso = d.toISOString().slice(0, 10); } return iso; }
  let restantes = n;
  while (restantes > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    iso = d.toISOString().slice(0, 10);
    if (esHabil(iso)) restantes -= 1;
  }
  return iso;
}

// ── Clasificación ───────────────────────────────────────────────────────────
// Trámite (0,5): interacción corta sin entregable (reunión, pedir, confirmar, escribir).
const RE_TRAMITE = /^(reuni[oó]n|reunirse|agendar|programar|entrar a|pedir|solicitar|confirmar|escribir a|hablar con|push a|insistir|sincronizar|recibir|avisar|llamar|compartir|coordinar|planear tareas|presentar sprint)\b/i;
// Obligaciones propias de MediaLab: su incumplimiento cuesta multas/demandas.
const RE_ADMIN = /\b(dian|ex[oó]gena|iva|retenci[oó]n|renta|factura|cuenta de cobro|cesant[ií]as|prima|n[oó]mina|contador|seguridad social|planilla|contrataci[oó]n|vacante|medicina prepagada|certificado laboral|c[aá]mara de comercio|otros[ií])\b/i;

const q = async (path, init) => {
  const r = await fetch(`${URL}/rest/v1/${path}`, { ...init, headers: H, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.status === 204 ? null : r.json();
};

const tareas = await q("tasks?select=id,title,status,priority,due_date,prev_due_date,design_points,category,company_id,client&status=neq.done&limit=500");
console.log(`Tareas activas: ${tareas.length} · hoy ${HOY}\n`);

const cambios = [];
for (const t of tareas) {
  const titulo = String(t.title || "");
  const vencida = !!t.due_date && t.due_date < HOY;
  const bloqueada = t.status === "blocked";
  const esAdmin = RE_ADMIN.test(titulo);
  const ptsActual = t.design_points == null ? null : Number(t.design_points);
  const patch = {};

  // 1) ESFUERZO. Un trámite corto es 0,5 (no 1). Solo se baja desde 1 o 2.
  let pts = ptsActual;
  if (RE_TRAMITE.test(titulo) && (ptsActual === null || ptsActual <= 2)) pts = 0.5;
  else if (ptsActual === null) pts = 2; // sin estimar → media por defecto
  if (pts !== ptsActual) patch.design_points = pts;

  // 2) CATEGORÍA administrativa (obligaciones de la empresa).
  if (esAdmin && t.category !== "Administrativo") patch.category = "Administrativo";

  // 3) PRIORIDAD por impacto/riesgo (no por esfuerzo).
  let prio = t.priority || "media";
  if (bloqueada) prio = "alta";                       // Goldratt: destrabar primero
  else if (esAdmin && vencida) prio = "alta";          // riesgo legal ya materializado
  else if (esAdmin && prio === "baja") prio = "media"; // piso administrativo
  if (prio !== t.priority) patch.priority = prio;

  // 4) FECHA automática: solo si falta o ya venció (no se pisan compromisos futuros).
  if (!t.due_date || vencida) {
    const efectivos = pts ?? 2;
    const base = efectivos <= 0.5 ? 0 : efectivos === 1 ? 2 : efectivos === 2 ? 5 : 10;
    const conPrioridad = prio === "alta" ? Math.max(0, Math.floor(base / 2)) : base;
    const nueva = (esAdmin && vencida) ? sumarHabiles(HOY, 0) : sumarHabiles(HOY, conPrioridad);
    if (nueva !== t.due_date) {
      patch.due_date = nueva;
      if (t.due_date) patch.prev_due_date = t.due_date; // soporte del corrimiento
    }
  }

  if (Object.keys(patch).length) cambios.push({ t, patch, esAdmin, bloqueada, vencida });
}

// ── Reporte ────────────────────────────────────────────────────────────────
const f = (v) => (v === undefined ? "" : String(v));
console.log(`Tareas con cambios: ${cambios.length}\n`);
const tramites = cambios.filter((c) => c.patch.design_points === 0.5);
const admins = cambios.filter((c) => c.patch.category === "Administrativo");
const altas = cambios.filter((c) => c.patch.priority === "alta");
console.log(`  · Trámites reclasificados a 0,5 pts : ${tramites.length}`);
console.log(`  · Marcadas como Administrativo      : ${admins.length}`);
console.log(`  · Subidas a prioridad alta          : ${altas.length}`);
console.log(`  · Con fecha nueva                   : ${cambios.filter((c) => c.patch.due_date).length}\n`);

console.log("CUELLO DE BOTELLA (bloqueadas):");
for (const c of cambios.filter((x) => x.bloqueada)) console.log(`  · ${c.t.title} → ${f(c.patch.design_points ?? c.t.design_points)} pts · alta · vence ${f(c.patch.due_date ?? c.t.due_date)}`);

console.log("\nADMINISTRATIVO / CUMPLIMIENTO:");
for (const c of admins) console.log(`  · [${f(c.patch.priority ?? c.t.priority)}] ${c.t.title} → vence ${f(c.patch.due_date ?? c.t.due_date)}`);

console.log("\nBLOQUE DE TRÁMITES (0,5 pts):");
const totalTramite = tramites.length * 0.5;
for (const c of tramites.slice(0, 30)) console.log(`  · [${f(c.patch.priority ?? c.t.priority)}] ${c.t.title} → ${f(c.patch.due_date ?? c.t.due_date)}`);
console.log(`  (${tramites.length} trámites = ${totalTramite} pts en total)`);

if (!APPLY) { console.log("\n— SIMULACIÓN. Corre con --apply para escribir. —"); process.exit(0); }

let ok = 0;
for (const c of cambios) {
  await q(`tasks?id=eq.${c.t.id}`, { method: "PATCH", body: JSON.stringify(c.patch) });
  ok += 1;
}
console.log(`\n✓ Aplicado: ${ok} tarea(s) actualizada(s).`);
