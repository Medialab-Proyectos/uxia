// Reporte semanal DesignOps por empresa. Se genera desde los datos reales del Centro
// de Operaciones (tareas, estados, fechas, satisfacción) y se abre en una ventana lista
// para "Guardar como PDF". Sin dependencias externas: usa el diálogo de impresión del
// navegador. La estructura sigue la propuesta DesignOps (4 categorías + puntos de diseño).

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function esc(s) { return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
function isoWeek(d) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
}

// Semáforo (chip) según valor y umbrales.
function chip(kind, label) { return `<span class="chip ${kind}">${esc(label)}</span>`; }
const PENDIENTE = chip("n", "por instrumentar");

const PERIOD_LABEL = { mes: "Mes", trimestre: "Trimestre", semestre: "Semestre", "año": "Año" };
const PERIOD_DAYS = { mes: 30, trimestre: 90, semestre: 180, "año": 365 };

export function buildDesignOpsReportHtml({ company, tasks = [], people = [], clients = [], logoUrl = "", period = "trimestre" }) {
  const today = todayIso();
  const now = new Date();
  const DAY = 86400000;
  const periodDays = PERIOD_DAYS[period] || 90;
  const periodLabel = PERIOD_LABEL[period] || "Trimestre";
  const cutoff = new Date(now.getTime() - periodDays * DAY);
  const weeks = Math.max(1, periodDays / 7);
  const ct = tasks.filter((t) => t.companyId === company.id);
  const active = ct.filter((t) => t.status !== "done");
  const doneAll = ct.filter((t) => t.status === "done");
  // Cerradas DENTRO DEL PERIODO seleccionado (mes/trimestre/semestre/año). Las métricas de
  // resultado/flujo se miden sobre esta ventana; lo activo (WIP, cola, vencidas) es al día.
  const done = doneAll.filter((t) => t.completedAt && new Date(t.completedAt) >= cutoff);
  const isOverdue = (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "review";
  const overdue = active.filter(isOverdue);
  const blocked = active.filter((t) => t.status === "blocked");
  const review = active.filter((t) => t.status === "review");
  const doing = active.filter((t) => t.status === "doing");
  const ready = active.filter((t) => t.status === "ready" || t.status === "backlog");
  const rated = done.filter((t) => t.rating != null);
  const avg = rated.length ? rated.reduce((a, t) => a + Number(t.rating), 0) / rated.length : null;
  const dueDone = done.filter((t) => t.dueDate);
  const late = dueDone.filter((t) => t.completedAt && t.completedAt.slice(0, 10) > t.dueDate);
  const onTime = dueDone.length - late.length;
  const predictPct = dueDone.length ? Math.round((onTime / dueDone.length) * 100) : null;

  // --- Métricas senior computables desde los datos reales (marco REACH · NN/g) ---
  const nameOf0 = (id) => people.find((p) => p.id === id)?.name || "";
  // Cycle time (lead time): días calendario de creada a cerrada (en el periodo).
  const cycArr = done.filter((t) => t.createdAt && t.completedAt).map((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / DAY).filter((d) => d >= 0);
  const cycleTime = cycArr.length ? cycArr.reduce((a, b) => a + b, 0) / cycArr.length : null;
  // Throughput: cerradas en el periodo ÷ semanas del periodo.
  const throughputWk = +(done.length / weeks).toFixed(1);
  const wip = doing.length;
  // Puntos de diseño → velocidad (pts/sem) y utilización por diseñador.
  const withPts = ct.filter((t) => t.designPoints != null);
  const ptsDoneP = done.reduce((a, t) => a + (Number(t.designPoints) || 0), 0);
  const velocity = withPts.length ? +(ptsDoneP / weeks).toFixed(1) : null;
  const cap = velocity && velocity > 0 ? velocity : 10;
  const byDesigner = {};
  for (const t of active) if (t.assigneeId && t.designPoints != null) byDesigner[t.assigneeId] = (byDesigner[t.assigneeId] || 0) + Number(t.designPoints);
  const utils = Object.entries(byDesigner).map(([id, p]) => ({ name: nameOf0(id) || "—", pct: Math.round((p / cap) * 100), pts: p }));
  const avgUtil = utils.length ? Math.round(utils.reduce((a, u) => a + u.pct, 0) / utils.length) : null;
  // Desviación de fechas: (días reales − días estimados) ÷ estimados.
  const devs = done.filter((t) => t.dueDate && t.createdAt && t.completedAt).map((t) => {
    const est = (new Date(t.dueDate) - new Date(t.createdAt)) / DAY;
    const real = (new Date(t.completedAt) - new Date(t.createdAt)) / DAY;
    return est > 0 ? (real - est) / est : null;
  }).filter((v) => v != null);
  const deviationPct = devs.length ? Math.round((devs.reduce((a, b) => a + b, 0) / devs.length) * 100) : null;
  // Defectos QA y Change Requests.
  const defTasks = ct.filter((t) => t.qaDefects != null);
  const defectsTotal = defTasks.reduce((a, t) => a + (Number(t.qaDefects) || 0), 0);
  const defectsPer10 = defTasks.length && done.length ? +(defectsTotal / done.length * 10).toFixed(1) : null;
  // --- RETRABAJO (Request Review) — indicador de gestión, no solo un conteo suelto ---
  // Un request review es un cambio pedido DESPUÉS de mostrar el trabajo: mide cuánto se rehace y
  // de dónde viene (cliente = alcance mal cerrado; interno/CEO = calidad antes de mostrar).
  const crList = (t) => (Array.isArray(t.changeRequests) ? t.changeRequests : []);
  const crCount = ct.reduce((a, t) => a + (crList(t).filter((c) => !c.resolved).length || (crList(t).length === 0 && t.changeRequest ? 1 : 0)), 0);
  const crAll = ct.flatMap(crList);
  const crTotal = crAll.length;
  const crResueltos = crAll.filter((c) => c.resolved).length;
  const crCliente = crAll.filter((c) => c.by === "cliente").length;
  const crInterno = crTotal - crCliente;
  const tareasConCR = ct.filter((t) => crList(t).length > 0 || t.changeRequest).length;
  // Tasa de retrabajo: % de tareas que necesitaron al menos un request review.
  const reworkPct = ct.length ? Math.round((tareasConCR / ct.length) * 100) : null;

  // --- CORRIMIENTOS DE FECHA (predictibilidad del compromiso) ---
  // prev_due_date guarda la fecha anterior al último cambio: cuántos compromisos se movieron.
  const movidas = ct.filter((t) => t.prevDueDate && t.prevDueDate !== t.dueDate);
  const conFecha = ct.filter((t) => t.dueDate).length;
  const movidasPct = conFecha ? Math.round((movidas.length / conFecha) * 100) : null;
  const movidasTop = movidas
    .filter((t) => t.status !== "done")
    .sort((a, b) => String(a.prevDueDate).localeCompare(String(b.prevDueDate)))
    .slice(0, 5);
  // Uso/consumo de IA y herramientas por tarea (adopción — REACH: Ability/Efficiency).
  const aiTasks = ct.filter((t) => t.aiUsage != null);
  const avgAi = aiTasks.length ? Math.round(aiTasks.reduce((a, t) => a + Number(t.aiUsage), 0) / aiTasks.length) : null;
  const toolFreq = {};
  for (const t of ct) if (Array.isArray(t.tools)) for (const tool of t.tools) toolFreq[tool] = (toolFreq[tool] || 0) + 1;
  const toolsSorted = Object.entries(toolFreq).sort((a, b) => b[1] - a[1]);

  const subs = (clients && clients.length ? clients : [...new Set(ct.map((t) => t.client || "—"))]).filter(Boolean);
  const perSub = subs.map((cl) => {
    const ts = ct.filter((t) => (t.client || "—") === cl);
    const a = ts.filter((t) => t.status !== "done");
    return {
      cl,
      total: ts.length,
      active: a.length,
      review: a.filter((t) => t.status === "review").length,
      blocked: a.filter((t) => t.status === "blocked").length,
      overdue: a.filter(isOverdue).length,
      done: ts.filter((t) => t.status === "done").length,
    };
  });

  const catCount = {};
  for (const t of active) catCount[t.category || "Sin categoría"] = (catCount[t.category || "Sin categoría"] || 0) + 1;
  const compo = Object.entries(catCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${esc(k)} ${v}`).join(" · ") || "—";

  const nameOf = (id) => people.find((p) => p.id === id)?.name || "";
  const overdueTop = [...overdue]
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "") || (a.priority === "alta" ? -1 : 1))
    .slice(0, 6);

  // Semáforos
  const predChip = predictPct == null ? PENDIENTE
    : predictPct >= 85 ? chip("g", `${predictPct}%`) : predictPct >= 60 ? chip("a", `${predictPct}%`) : chip("r", `${predictPct}%`);
  const reviewChip = review.length <= 4 ? chip("g", "En rango") : review.length <= 8 ? chip("a", "Atención") : chip("r", "Crítico");
  const satChip = avg == null ? PENDIENTE : avg >= 4.5 ? chip("g", "En meta") : avg >= 4 ? chip("a", "Cerca") : chip("r", "Bajo");
  const sign = (n) => `${n > 0 ? "+" : ""}${n}%`;
  const devChip = deviationPct == null ? PENDIENTE : Math.abs(deviationPct) <= 10 ? chip("g", sign(deviationPct)) : Math.abs(deviationPct) <= 25 ? chip("a", sign(deviationPct)) : chip("r", sign(deviationPct));
  const velChip = velocity == null ? PENDIENTE : velocity >= 8 && velocity <= 12 ? chip("g", "En rango") : chip("a", "Ajustar");
  const utilChip = avgUtil == null ? PENDIENTE : avgUtil >= 70 && avgUtil <= 90 ? chip("g", "Óptima") : avgUtil > 90 ? chip("r", "Sobrecarga") : chip("a", "Holgura");
  const defChip = defectsPer10 == null ? PENDIENTE : defectsPer10 <= 2 ? chip("g", "En meta") : defectsPer10 <= 4 ? chip("a", "Atención") : chip("r", "Alto");
  const crChip = crCount ? chip("a", `${crCount} abierto(s)`) : crTotal ? chip("g", "Todos resueltos") : chip("g", "Ninguno");
  // Retrabajo: cuánto se rehace tras mostrar el trabajo. Meta ≤20% de las tareas.
  const reworkChip = reworkPct == null ? PENDIENTE : reworkPct <= 20 ? chip("g", "En meta") : reworkPct <= 35 ? chip("a", "Atención") : chip("r", "Alto");
  // Origen: si el cliente pide más cambios que la revisión interna, el alcance se está cerrando mal.
  const origenChip = crTotal === 0 ? chip("g", "Sin retrabajo")
    : crCliente > crInterno ? chip("r", "Alcance flojo") : chip("g", "Filtro interno OK");
  // Compromisos movidos: mide estabilidad de la planeación (usa prev_due_date).
  const movChip = conFecha === 0 ? PENDIENTE
    : movidasPct <= 15 ? chip("g", "Estable") : movidasPct <= 30 ? chip("a", "Inestable") : chip("r", "Muy inestable");
  const overdueChip = overdue.length === 0 ? chip("g", "Al día") : overdue.length <= 3 ? chip("a", `${overdue.length} vencida(s)`) : chip("r", `${overdue.length} vencidas`);

  // Resumen ejecutivo dinámico
  const focos = [];
  if (review.length >= 4) focos.push(`vaciar la cola de revisión (${review.length})`);
  if (overdue.length) focos.push(`cerrar las ${overdue.length} vencidas`);
  if (blocked.length) focos.push(`destrabar ${blocked.length} bloqueada(s)`);
  const focoTxt = focos.length ? focos.join(" y ") : "sostener el ritmo y documentar entregas";
  const satTxt = avg != null ? `satisfacción <b>${avg.toFixed(1)}/5</b>` : "satisfacción aún sin evaluar";

  // Recomendaciones
  const recs = [];
  if (review.length >= 4) recs.push(`<b>Vaciar la cola de revisión</b> (${review.length} tareas): agendar un bloque de revisión/aprobación antes de tomar trabajo nuevo.`);
  if (overdue.length) recs.push(`<b>Priorizar las ${overdue.length} vencidas</b>${overdueTop[0] ? ` (la más antigua venció el ${fmtDate(overdueTop[0].dueDate)})` : ""}.`);
  if (blocked.length) recs.push(`<b>Destrabar ${blocked.length} bloqueada(s)</b>: resolver el acceso, decisión o dependencia que las frena.`);
  if (reworkPct != null && reworkPct > 20) recs.push(`<b>Bajar el retrabajo (${reworkPct}% de las tareas con request review)</b>: ${crCliente > crInterno ? "el cliente pide más cambios que la revisión interna — cerrar mejor el alcance y los criterios ANTES de diseñar." : "la mayoría son ajustes internos — reforzar la autorrevisión antes de mostrar."}`);
  if (crCount) recs.push(`<b>Cerrar los ${crCount} request review abiertos</b>: cada uno es trabajo comprometido que aún no se resolvió y bloquea la aprobación.`);
  if (movidasPct != null && movidasPct > 15) recs.push(`<b>Estabilizar la planeación</b>: al ${movidasPct}% de las tareas con fecha se le corrió el vencimiento. Revisar si la estimación inicial o las dependencias externas son la causa (cada corrimiento tiene su fecha anterior guardada como soporte).`);
  recs.push(`<b>Instrumentar puntos de diseño</b> en los proyectos activos para reportar velocidad y utilización reales el próximo corte.`);
  recs.push(`<b>Formalizar Change Requests</b> desde la aprobación del diseño, para que los ajustes del cliente no se absorban en el alcance.`);

  const rowsPerSub = perSub.map((s) => `
    <tr><td><b>${esc(s.cl)}</b></td><td class="num">${s.total}</td><td class="num">${s.active}</td><td class="num">${s.review}</td><td class="num">${s.blocked}</td><td class="num">${s.overdue}</td><td class="num">${s.done}</td></tr>`).join("");
  const overdueRows = overdueTop.length ? overdueTop.map((t) => `
    <tr><td>${esc(t.ref || "")}</td><td>${esc(t.title)}</td><td>${esc(t.client || "—")}</td><td class="center">${chip("r", fmtDate(t.dueDate))}</td></tr>`).join("")
    : `<tr><td colspan="4" class="muted">Sin tareas vencidas. 👌</td></tr>`;

  const logoAbs = logoUrl ? (() => { try { return new URL(logoUrl, window.location.href).href; } catch { return logoUrl; } })() : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<title>Reporte DesignOps — ${esc(company.name)}</title>
<style>
  @page { size: A4; margin: 14mm 15mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  :root { --teal:#17727A; --orange:#E8751A; --ink:#1D2939; --gray:#667085; --line:#E4DED6; --green:#0D7A4F; --amber:#B76E00; --red:#B42318; --violet:#6D28D9; }
  body { font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; color:#1D2939; font-size:10pt; line-height:1.45; }
  .wrap { max-width:720px; margin:0 auto; }
  h2 { font-size:12.5pt; font-weight:700; color:#17727A; margin:20px 0 8px; padding-bottom:4px; border-bottom:2px solid #17727A; break-after:avoid; }
  h3 { font-size:10.5pt; font-weight:700; margin:12px 0 5px; }
  p { margin:5px 0; } .muted { color:#667085; } .small { font-size:8.5pt; }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; border-bottom:3px solid #17727A; padding-bottom:12px; }
  .brand { display:flex; align-items:center; gap:10px; } .logo { width:34px; height:34px; object-fit:contain; }
  .brand .name { font-size:13pt; font-weight:700; letter-spacing:0.02em; }
  .brand .tag { font-size:8pt; color:#667085; text-transform:uppercase; letter-spacing:0.14em; }
  .head .meta { text-align:right; font-size:8.5pt; color:#667085; } .head .meta .big { font-size:11pt; color:#1D2939; font-weight:700; }
  .kicker { font-size:8.5pt; text-transform:uppercase; letter-spacing:0.16em; color:#E8751A; font-weight:700; margin-top:14px; }
  .tiles { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
  .tile { flex:1 1 0; min-width:120px; border:1px solid #E4DED6; border-radius:8px; padding:9px 10px; }
  .tile .k { font-size:7.5pt; text-transform:uppercase; letter-spacing:0.08em; color:#667085; }
  .tile .v { font-size:19pt; font-weight:700; line-height:1.1; margin-top:2px; font-variant-numeric:tabular-nums; }
  .tile .s { font-size:7.5pt; color:#667085; }
  table { width:100%; border-collapse:collapse; margin:8px 0; font-size:8.7pt; }
  th,td { text-align:left; padding:6px 8px; border-bottom:1px solid #E4DED6; vertical-align:top; }
  thead th { background:#1D2939; color:#fff; font-size:8pt; text-transform:uppercase; letter-spacing:0.05em; border:none; }
  tbody tr:nth-child(even) { background:#FBFAF7; }
  td.num,th.num { text-align:right; font-variant-numeric:tabular-nums; } td.center,th.center { text-align:center; }
  .chip { display:inline-block; padding:1px 8px; border-radius:999px; font-size:8pt; font-weight:700; white-space:nowrap; }
  .g { background:#E5F5EE; color:#0D7A4F; } .a { background:#FFF7E6; color:#B76E00; }
  .r { background:#FEF3F2; color:#B42318; } .n { background:#F2F4F7; color:#667085; }
  .callout { border-left:4px solid #E8751A; background:#FFF7E6; padding:9px 12px; border-radius:0 6px 6px 0; margin:8px 0; }
  .callout.teal { border-color:#17727A; background:#EAF4F2; } .callout.red { border-color:#B42318; background:#FEF3F2; }
  ul { margin:4px 0 4px 18px; } li { margin:3px 0; }
  .cols { display:flex; flex-wrap:wrap; gap:14px; }
  .cols > * { flex:1 1 0; min-width:220px; }
  .card { border:1px solid #E4DED6; border-radius:8px; padding:10px 12px; }
  .foot { margin-top:18px; border-top:1px solid #E4DED6; padding-top:8px; font-size:8pt; color:#667085; display:flex; justify-content:space-between; }
  .avoid { break-inside:avoid; }
</style></head><body><div class="wrap">

  <div class="head">
    <div class="brand">
      ${logoAbs ? `<img class="logo" src="${esc(logoAbs)}" alt="MediaLab" />` : ""}
      <div><div class="name">MediaLab Ingeniería</div><div class="tag">DesignOps · Visibilidad de producto</div></div>
    </div>
    <div class="meta">
      <div class="big">Reporte DesignOps · ${esc(periodLabel)}</div>
      <div>Cliente: <b>${esc(company.name)}</b>${subs.length ? ` · ${subs.map(esc).join(" · ")}` : ""}</div>
      <div>Periodo: ${esc(periodLabel)} · corte ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}</div>
      <div>Responsable: DesignOps · Semana ${isoWeek(now)}</div>
    </div>
  </div>

  <div class="kicker">Resumen ejecutivo</div>
  <p>El área de diseño de <b>${esc(company.name)}</b> tiene <b>${active.length}</b> tarea(s) activa(s) en ${subs.length || 1} subproyecto(s) (${done.length} cerrada(s)), con ${satTxt}.
  El foco de la semana es <b>${focoTxt}</b>. La predictibilidad de fecha ${predictPct == null ? "aún no tiene base suficiente" : `es del <b>${predictPct}%</b>`}${predictPct != null && predictPct < 85 ? ", por debajo de la meta (≥85%)" : ""}.</p>

  <div class="tiles">
    <div class="tile"><div class="k">Tareas activas</div><div class="v" style="color:#17727A">${active.length}</div><div class="s">de ${ct.length} · ${done.length} cerradas</div></div>
    <div class="tile"><div class="k">En revisión</div><div class="v" style="color:#6D28D9">${review.length}</div><div class="s">esperan aprobación</div></div>
    <div class="tile"><div class="k">Vencidas</div><div class="v" style="color:#B42318">${overdue.length}</div><div class="s">${blocked.length} bloqueada(s)</div></div>
    <div class="tile"><div class="k">Satisfacción</div><div class="v" style="color:#0D7A4F">${avg != null ? avg.toFixed(1) : "—"}</div><div class="s">/ 5 · ${rated.length} evaluada(s)</div></div>
  </div>

  <h2>1. Tablero de indicadores DesignOps</h2>
  <p class="muted small">Cuatro categorías que responden a lo que negocio pregunta sobre el área, alineadas al marco <b>REACH</b> (NN/g): Results, Efficiency, Ability, Clarity, Health. Los indicadores ${PENDIENTE} requieren capturar un dato que aún no se registra.</p>
  <table class="avoid"><thead><tr><th>Categoría</th><th>Indicador</th><th class="center">Valor</th><th class="center">Meta</th><th class="center">Estado</th></tr></thead><tbody>
    <tr><td rowspan="4"><b>Predictibilidad</b></td><td>Entregas en fecha ÷ comprometidas</td><td class="center">${predictPct == null ? "—" : predictPct + "%"}</td><td class="center">≥ 85%</td><td class="center">${predChip}</td></tr>
    <tr><td>Desviación promedio de fechas</td><td class="center">${deviationPct == null ? "—" : sign(deviationPct)}</td><td class="center">≤ 10%</td><td class="center">${devChip}</td></tr>
    <tr><td>Compromisos movidos (fecha corrida)</td><td class="center">${movidas.length}${movidasPct == null ? "" : ` · ${movidasPct}%`}</td><td class="center">≤ 15%</td><td class="center">${movChip}</td></tr>
    <tr><td>Tareas vencidas sin cerrar</td><td class="center">${overdue.length}</td><td class="center">0</td><td class="center">${overdueChip}</td></tr>
    <tr><td rowspan="4"><b>Eficiencia</b></td><td>Tasa de retrabajo (tareas con request review)</td><td class="center">${reworkPct == null ? "—" : reworkPct + "%"}</td><td class="center">≤ 20%</td><td class="center">${reworkChip}</td></tr>
    <tr><td>Request review abiertos ÷ totales</td><td class="center">${crCount} / ${crTotal}</td><td class="center">0 abiertos</td><td class="center">${crChip}</td></tr>
    <tr><td>Origen del retrabajo (cliente ÷ interno)</td><td class="center">${crCliente} / ${crInterno}</td><td class="center">cliente ≤ interno</td><td class="center">${origenChip}</td></tr>
    <tr><td>Tareas en revisión (cola)</td><td class="center">${review.length}</td><td class="center">≤ 4</td><td class="center">${reviewChip}</td></tr>
    <tr><td rowspan="2"><b>Capacidad</b></td><td>Velocidad real de diseño (pts/sem)</td><td class="center">${velocity == null ? "—" : velocity}</td><td class="center">8–12</td><td class="center">${velChip}</td></tr>
    <tr><td>Utilización por diseñador</td><td class="center">${avgUtil == null ? "—" : avgUtil + "%"}</td><td class="center">70–90%</td><td class="center">${utilChip}</td></tr>
    <tr><td rowspan="2"><b>Calidad</b></td><td>Satisfacción del Product Owner</td><td class="center">${avg != null ? avg.toFixed(1) + " / 5" : "—"}</td><td class="center">≥ 4,5</td><td class="center">${satChip}</td></tr>
    <tr><td>Defectos UX/UI en QA (por 10 entregas)</td><td class="center">${defectsPer10 == null ? "—" : defectsPer10}</td><td class="center">≤ 2</td><td class="center">${defChip}</td></tr>
  </tbody></table>

  <h3>Flujo del trabajo <span class="muted small" style="font-weight:400">· REACH: Efficiency</span></h3>
  <div class="tiles" style="grid-template-columns:repeat(3,1fr)">
    <div class="tile"><div class="k">Cycle time medio</div><div class="v" style="color:#17727A">${cycleTime == null ? "—" : Math.round(cycleTime)}</div><div class="s">días de creada a cerrada</div></div>
    <div class="tile"><div class="k">Throughput</div><div class="v" style="color:#0D7A4F">${throughputWk}</div><div class="s">tareas cerradas / semana</div></div>
    <div class="tile"><div class="k">WIP en progreso</div><div class="v" style="color:#B76E00">${wip}</div><div class="s">trabajo activo simultáneo</div></div>
  </div>
  ${utils.length ? `<p class="muted small">Utilización por diseñador: ${utils.sort((a, b) => b.pct - a.pct).slice(0, 6).map((u) => `${esc(u.name)} ${u.pct}%`).join(" · ")}. Objetivo 70–90%.</p>` : ""}

  <h2>2. Estado de los proyectos</h2>
  <table class="avoid"><thead><tr><th>Subproyecto</th><th class="num">Total</th><th class="num">Activas</th><th class="num">En revisión</th><th class="num">Bloqueadas</th><th class="num">Vencidas</th><th class="num">Cerradas</th></tr></thead><tbody>
    ${rowsPerSub}
    <tr style="font-weight:700"><td>Total ${esc(company.name)}</td><td class="num">${ct.length}</td><td class="num">${active.length}</td><td class="num">${review.length}</td><td class="num">${blocked.length}</td><td class="num">${overdue.length}</td><td class="num">${done.length}</td></tr>
  </tbody></table>
  <p class="muted small">Composición del trabajo activo: ${compo}.</p>

  <h2>3. Predictibilidad y cumplimiento</h2>
  <p>De las entregas con fecha comprometida, <b>${onTime} de ${dueDone.length}</b> salieron a tiempo${predictPct != null ? ` (<b>${predictPct}%</b>)` : ""}. Hay <b>${overdue.length}</b> tarea(s) vencida(s) sin cerrar; las más urgentes:</p>
  ${movidas.length ? `<p><b>Compromisos movidos:</b> a <b>${movidas.length}</b> tarea(s)${movidasPct != null ? ` (${movidasPct}% de las que tienen fecha)` : ""} se les corrió el vencimiento al menos una vez. Cada corrimiento queda con su fecha anterior como soporte, así el cambio se puede sustentar ante el cliente en vez de discutirse de memoria.${movidasTop.length ? ` Abiertas con fecha movida: ${movidasTop.map((t) => `<b>${esc(t.title)}</b> (antes ${fmtDate(t.prevDueDate)} → ahora ${t.dueDate ? fmtDate(t.dueDate) : "sin fecha"})`).join(" · ")}.` : ""}</p>` : `<p class="muted">Ningún compromiso de fecha se ha movido en el periodo: la planeación se está sosteniendo.</p>`}
  <table class="avoid"><thead><tr><th>Ref</th><th>Tarea</th><th>Subproyecto</th><th class="center">Venció</th></tr></thead><tbody>${overdueRows}</tbody></table>
  ${review.length >= 4 || overdue.length ? `<div class="callout red"><b>Cuello de botella (Teoría de Restricciones):</b> ${review.length >= 4 ? `${review.length} tareas terminadas esperan revisión/aprobación — la salida, no la entrada.` : `${overdue.length} vencidas acumuladas.`} Destrabar esa cola libera avance sin agregar carga nueva.</div>` : ""}

  <h2>4. Capacidad — modelo de puntos de diseño</h2>
  <p class="muted small">Instrumento a activar: estimar cada pantalla por complejidad funcional en vez de contar pantallas. Convierte fechas en un cálculo verificable por PM y negocio.</p>
  <div class="cols">
    <div class="card avoid"><h3 style="margin-top:0">Peso por complejidad</h3>
      <table style="margin:0"><thead><tr><th class="center">Pts</th><th>Nivel</th><th>Ejemplo</th></tr></thead><tbody>
        <tr><td class="center"><b>1</b></td><td>Simple</td><td>Login, error, splash</td></tr>
        <tr><td class="center"><b>2</b></td><td>Media</td><td>Formulario, listado, filtros</td></tr>
        <tr><td class="center"><b>4</b></td><td>Compleja</td><td>Dashboard, multi-step</td></tr>
      </tbody></table></div>
    <div class="card avoid"><h3 style="margin-top:0">Fórmulas operativas</h3>
      <p class="small" style="margin:3px 0"><b>Velocidad</b> = puntos cerrados ÷ semanas efectivas <span class="muted">(ref. 8–12 pts/sem senior)</span></p>
      <p class="small" style="margin:3px 0"><b>Duración</b> = puntos del proyecto ÷ velocidad</p>
      <p class="small" style="margin:3px 0"><b>Fecha</b> = inicio + duración + 20% buffer</p>
      <p class="small" style="margin:3px 0"><b>Regla de carga:</b> la fase de diseño debe ocupar 20–30% del proyecto; al superar 30% se suma un diseñador. Utilización objetivo 70–90%.</p>
    </div>
  </div>

  <h2>5. IA y herramientas <span class="muted small" style="font-weight:400">· adopción</span></h2>
  <div class="cols">
    <div class="card avoid">
      <h3 style="margin-top:0">Consumo de IA</h3>
      <p style="margin:4px 0"><span style="font-size:22pt;font-weight:700;color:#6941C6">${avgAi == null ? "—" : avgAi + "%"}</span> <span class="muted small">uso medio de IA por tarea</span></p>
      <p class="muted small">${aiTasks.length ? `Medido en ${aiTasks.length} de ${ct.length} tarea(s).` : "Aún sin registrar. Captúralo por tarea (% IA) para reportar el consumo real."}</p>
    </div>
    <div class="card avoid">
      <h3 style="margin-top:0">Herramientas usadas</h3>
      ${toolsSorted.length
        ? `<div style="display:flex;flex-wrap:wrap;gap:5px">${toolsSorted.map(([tool, n]) => `<span class="chip" style="background:#F4F1FD;color:#6941C6">${esc(tool)} · ${n}</span>`).join("")}</div>`
        : `<p class="muted small">Aún sin registrar. Marca las herramientas por tarea (Figma, Claude, etc.) para ver el stack real.</p>`}
    </div>
  </div>

  <h2>6. Recomendaciones de la semana</h2>
  <div class="callout teal"><ul style="margin-left:16px">${recs.map((r) => `<li>${r}</li>`).join("")}</ul></div>

  <div class="foot"><span>MediaLab Ingeniería · Reporte DesignOps — ${esc(company.name)}</span><span>Confidencial · generado ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}</span></div>

</div></body></html>`;
}

// Abre el reporte en una ventana nueva y lanza el diálogo de impresión (Guardar como PDF).
// Respaldo: abre el reporte en una ventana lista para "Guardar como PDF" (diálogo de impresión).
function openReportPrintWindow(html) {
  const w = window.open("", "_blank");
  if (!w) { alert("Habilita las ventanas emergentes para el reporte DesignOps."); return; }
  w.document.open();
  w.document.write(html);
  w.document.close();
  let printed = false;
  const doPrint = () => { if (printed) return; printed = true; try { w.focus(); w.print(); } catch { /* ignore */ } };
  w.onload = doPrint;
  setTimeout(doPrint, 900);
}

// Genera el reporte con el IMPRESOR NATIVO del navegador (Guardar como PDF). Es la única forma
// de conservar el formato exacto (texto vectorial, colores, tablas, saltos de página) — html2pdf
// rasteriza y degrada el resultado. Se abre la ventana del reporte y se lanza "Guardar como PDF".
export async function openDesignOpsReport(args) {
  const html = buildDesignOpsReportHtml(args);
  openReportPrintWindow(html);
}
