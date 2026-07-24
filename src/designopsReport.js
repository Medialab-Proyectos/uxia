// Reporte DesignOps por empresa. Se genera desde los datos reales del Centro de Operaciones
// (tareas, estados, fechas, satisfacción) y se DESCARGA como PDF vectorial con jsPDF (texto
// seleccionable, nunca en blanco). Estructura: 4 categorías de indicadores + puntos de diseño.
import { newDoc, header, tiles, sectionTitle, table, paragraph, callout, footer, save, ensure, loadImage, safeName, PAGE, C } from "./pdfKit.js";
import { effortPoints } from "./effort.js";
import logoUrl from "./logos/logo-medialab.png";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function todayIso() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
function isoWeek(d) {
  const tt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = tt.getUTCDay() || 7;
  tt.setUTCDate(tt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tt.getUTCFullYear(), 0, 1));
  return Math.ceil(((tt - yearStart) / 86400000 + 1) / 7);
}
const TONE = { g: C.green, a: C.amber, r: C.red, n: C.gray, v: C.teal };
const PENDIENTE = { txt: "por instrumentar", tone: "n" };
const PERIOD_LABEL = { mes: "Mes", trimestre: "Trimestre", semestre: "Semestre", "año": "Año" };
const PERIOD_DAYS = { mes: 30, trimestre: 90, semestre: 180, "año": 365 };

export async function openDesignOpsReport({ company, tasks = [], people = [], clients = [], period = "trimestre" }) {
  const today = todayIso();
  const now = new Date();
  const DAY = 86400000;
  const periodDays = PERIOD_DAYS[period] || 90;
  const periodLabel = PERIOD_LABEL[period] || "Trimestre";
  const cutoff = new Date(now.getTime() - periodDays * DAY);
  const weeks = Math.max(1, periodDays / 7);
  const ct = tasks.filter((tk) => tk.companyId === company.id);
  const active = ct.filter((tk) => tk.status !== "done");
  const doneAll = ct.filter((tk) => tk.status === "done");
  const done = doneAll.filter((tk) => tk.completedAt && new Date(tk.completedAt) >= cutoff);
  const isOverdue = (tk) => tk.dueDate && tk.dueDate < today && tk.status !== "done" && tk.status !== "review" && tk.status !== "verificacion" && tk.status !== "notificado";
  const overdue = active.filter(isOverdue);
  const blocked = active.filter((tk) => tk.status === "blocked");
  const review = active.filter((tk) => tk.status === "review");
  const doing = active.filter((tk) => tk.status === "doing");
  const rated = done.filter((tk) => tk.rating != null);
  const avg = rated.length ? rated.reduce((a, tk) => a + Number(tk.rating), 0) / rated.length : null;
  const dueDone = done.filter((tk) => tk.dueDate);
  const late = dueDone.filter((tk) => tk.completedAt && tk.completedAt.slice(0, 10) > tk.dueDate);
  const onTime = dueDone.length - late.length;
  const predictPct = dueDone.length ? Math.round((onTime / dueDone.length) * 100) : null;

  const nameOf = (id) => people.find((p) => p.id === id)?.name || "";
  const cycArr = done.filter((tk) => tk.createdAt && tk.completedAt).map((tk) => (new Date(tk.completedAt) - new Date(tk.createdAt)) / DAY).filter((d) => d >= 0);
  const cycleTime = cycArr.length ? cycArr.reduce((a, b) => a + b, 0) / cycArr.length : null;
  const throughputWk = +(done.length / weeks).toFixed(1);
  const wip = doing.length;
  const withPts = ct.filter((tk) => tk.designPoints != null);
  const ptsDoneP = done.reduce((a, tk) => a + effortPoints(tk.designPoints, tk.category), 0);
  const velocity = withPts.length ? +(ptsDoneP / weeks).toFixed(1) : null;
  // Utilización = carga de diseño PENDIENTE ÷ capacidad de CORTO PLAZO (un sprint ~2 semanas al ritmo
  // senior de 10 pts/sem = 20 pts). Mide la carga cercana AHORA, no una fracción del periodo (medir
  // contra el trimestre diluía la carga). Independiente del periodo. NO usa la velocidad medida.
  // La carga es solo trabajo por hacer: excluye lo entregado/fuera de manos (review/verificacion/notificado).
  const REF_WEEKLY = 10;                 // pts/semana de referencia (senior; banda 8–12)
  const PLAN_WEEKS = 2;                  // horizonte de carga cercana (~1 sprint)
  const cap = REF_WEEKLY * PLAN_WEEKS;   // capacidad de corto plazo por diseñador (pts)
  const isPendingLoad = (tk) => tk.status !== "review" && tk.status !== "verificacion" && tk.status !== "notificado";
  const byDesigner = {};
  for (const tk of active) if (tk.assigneeId && tk.designPoints != null && isPendingLoad(tk)) byDesigner[tk.assigneeId] = (byDesigner[tk.assigneeId] || 0) + effortPoints(tk.designPoints, tk.category);
  const utils = Object.entries(byDesigner).map(([id, p]) => ({ name: nameOf(id) || "—", pct: Math.round((p / cap) * 100), pts: p }));
  const avgUtil = utils.length ? Math.round(utils.reduce((a, u) => a + u.pct, 0) / utils.length) : null;
  const devs = done.filter((tk) => tk.dueDate && tk.createdAt && tk.completedAt).map((tk) => {
    const est = (new Date(tk.dueDate) - new Date(tk.createdAt)) / DAY;
    const real = (new Date(tk.completedAt) - new Date(tk.createdAt)) / DAY;
    return est > 0 ? (real - est) / est : null;
  }).filter((v) => v != null);
  const deviationPct = devs.length ? Math.round((devs.reduce((a, b) => a + b, 0) / devs.length) * 100) : null;
  const defTasks = ct.filter((tk) => tk.qaDefects != null);
  const defectsTotal = defTasks.reduce((a, tk) => a + (Number(tk.qaDefects) || 0), 0);
  const defectsPer10 = defTasks.length && done.length ? +(defectsTotal / done.length * 10).toFixed(1) : null;
  const crList = (tk) => (Array.isArray(tk.changeRequests) ? tk.changeRequests : []);
  const crCount = ct.reduce((a, tk) => a + (crList(tk).filter((c) => !c.resolved).length || (crList(tk).length === 0 && tk.changeRequest ? 1 : 0)), 0);
  const crAll = ct.flatMap(crList);
  const crTotal = crAll.length;
  const crCliente = crAll.filter((c) => c.by === "cliente").length;
  const crInterno = crTotal - crCliente;
  const tareasConCR = ct.filter((tk) => crList(tk).length > 0 || tk.changeRequest).length;
  const reworkPct = ct.length ? Math.round((tareasConCR / ct.length) * 100) : null;
  const movidas = ct.filter((tk) => tk.prevDueDate && tk.prevDueDate !== tk.dueDate);
  const conFecha = ct.filter((tk) => tk.dueDate).length;
  const movidasPct = conFecha ? Math.round((movidas.length / conFecha) * 100) : null;
  const movidasTop = movidas.filter((tk) => tk.status !== "done").sort((a, b) => String(a.prevDueDate).localeCompare(String(b.prevDueDate))).slice(0, 5);
  const aiTasks = ct.filter((tk) => tk.aiUsage != null);
  const avgAi = aiTasks.length ? Math.round(aiTasks.reduce((a, tk) => a + Number(tk.aiUsage), 0) / aiTasks.length) : null;
  const toolFreq = {};
  for (const tk of ct) if (Array.isArray(tk.tools)) for (const tool of tk.tools) toolFreq[tool] = (toolFreq[tool] || 0) + 1;
  const toolsSorted = Object.entries(toolFreq).sort((a, b) => b[1] - a[1]);

  const subs = (clients && clients.length ? clients : [...new Set(ct.map((tk) => tk.client || "—"))]).filter(Boolean);
  const perSub = subs.map((cl) => {
    const ts = ct.filter((tk) => (tk.client || "—") === cl);
    const a = ts.filter((tk) => tk.status !== "done");
    return { cl, total: ts.length, active: a.length, review: a.filter((tk) => tk.status === "review").length, blocked: a.filter((tk) => tk.status === "blocked").length, overdue: a.filter(isOverdue).length, done: ts.filter((tk) => tk.status === "done").length };
  });
  const catCount = {};
  for (const tk of active) catCount[tk.category || "Sin categoría"] = (catCount[tk.category || "Sin categoría"] || 0) + 1;
  const compo = Object.entries(catCount).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(" · ") || "—";
  const overdueTop = [...overdue].sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "") || (a.priority === "alta" ? -1 : 1)).slice(0, 6);

  const sign = (n) => `${n > 0 ? "+" : ""}${n}%`;
  // Semáforos → {txt, tone}
  const predSem = predictPct == null ? PENDIENTE : predictPct >= 85 ? { txt: `${predictPct}%`, tone: "g" } : predictPct >= 60 ? { txt: `${predictPct}%`, tone: "a" } : { txt: `${predictPct}%`, tone: "r" };
  const reviewSem = review.length <= 4 ? { txt: "En rango", tone: "g" } : review.length <= 8 ? { txt: "Atención", tone: "a" } : { txt: "Crítico", tone: "r" };
  const satSem = avg == null ? PENDIENTE : avg >= 4.5 ? { txt: "En meta", tone: "g" } : avg >= 4 ? { txt: "Cerca", tone: "a" } : { txt: "Bajo", tone: "r" };
  const devSem = deviationPct == null ? PENDIENTE : Math.abs(deviationPct) <= 10 ? { txt: sign(deviationPct), tone: "g" } : Math.abs(deviationPct) <= 25 ? { txt: sign(deviationPct), tone: "a" } : { txt: sign(deviationPct), tone: "r" };
  const velSem = velocity == null ? PENDIENTE : velocity >= 8 && velocity <= 12 ? { txt: "En rango", tone: "g" } : { txt: "Ajustar", tone: "a" };
  const utilSem = avgUtil == null ? PENDIENTE : avgUtil >= 70 && avgUtil <= 90 ? { txt: "Óptima", tone: "g" } : avgUtil > 90 ? { txt: "Sobrecarga", tone: "r" } : { txt: "Holgura", tone: "a" };
  const defSem = defectsPer10 == null ? PENDIENTE : defectsPer10 <= 2 ? { txt: "En meta", tone: "g" } : defectsPer10 <= 4 ? { txt: "Atención", tone: "a" } : { txt: "Alto", tone: "r" };
  const crSem = crCount ? { txt: `${crCount} abierto(s)`, tone: "a" } : crTotal ? { txt: "Resueltos", tone: "g" } : { txt: "Ninguno", tone: "g" };
  const reworkSem = reworkPct == null ? PENDIENTE : reworkPct <= 20 ? { txt: "En meta", tone: "g" } : reworkPct <= 35 ? { txt: "Atención", tone: "a" } : { txt: "Alto", tone: "r" };
  const origenSem = crTotal === 0 ? { txt: "Sin retrabajo", tone: "g" } : crCliente > crInterno ? { txt: "Alcance flojo", tone: "r" } : { txt: "Filtro interno OK", tone: "g" };
  const movSem = conFecha === 0 ? PENDIENTE : movidasPct <= 15 ? { txt: "Estable", tone: "g" } : movidasPct <= 30 ? { txt: "Inestable", tone: "a" } : { txt: "Muy inestable", tone: "r" };
  const overdueSem = overdue.length === 0 ? { txt: "Al día", tone: "g" } : overdue.length <= 3 ? { txt: `${overdue.length} vencida(s)`, tone: "a" } : { txt: `${overdue.length} vencidas`, tone: "r" };

  const focos = [];
  if (review.length >= 4) focos.push(`vaciar la cola de revisión (${review.length})`);
  if (overdue.length) focos.push(`cerrar las ${overdue.length} vencidas`);
  if (blocked.length) focos.push(`destrabar ${blocked.length} bloqueada(s)`);
  const focoTxt = focos.length ? focos.join(" y ") : "sostener el ritmo y documentar entregas";
  const satTxt = avg != null ? `satisfacción ${avg.toFixed(1)}/5` : "satisfacción aún sin evaluar";

  const recs = [];
  if (review.length >= 4) recs.push(`Vaciar la cola de revisión (${review.length} tareas): agendar un bloque de revisión/aprobación antes de tomar trabajo nuevo.`);
  if (overdue.length) recs.push(`Priorizar las ${overdue.length} vencidas${overdueTop[0] ? ` (la más antigua venció el ${fmtDate(overdueTop[0].dueDate)})` : ""}.`);
  if (blocked.length) recs.push(`Destrabar ${blocked.length} bloqueada(s): resolver el acceso, decisión o dependencia que las frena.`);
  if (reworkPct != null && reworkPct > 20) recs.push(`Bajar el retrabajo (${reworkPct}% de tareas con request review): ${crCliente > crInterno ? "el cliente pide más cambios que la revisión interna — cerrar mejor el alcance ANTES de diseñar." : "la mayoría son ajustes internos — reforzar la autorrevisión antes de mostrar."}`);
  if (crCount) recs.push(`Cerrar los ${crCount} request review abiertos: cada uno es trabajo comprometido sin resolver que bloquea la aprobación.`);
  if (movidasPct != null && movidasPct > 15) recs.push(`Estabilizar la planeación: al ${movidasPct}% de las tareas con fecha se le corrió el vencimiento. Revisar estimación inicial o dependencias externas.`);
  recs.push(`Instrumentar puntos de diseño en los proyectos activos para reportar velocidad y utilización reales el próximo corte.`);
  recs.push(`Formalizar Change Requests desde la aprobación del diseño, para que los ajustes del cliente no se absorban en el alcance.`);

  // ---------- Render ----------
  const doc = await newDoc();
  const logo = await loadImage(logoUrl).catch(() => null);
  let y = header(doc, {
    title: `Reporte DesignOps · ${periodLabel}`,
    subtitle: "DesignOps · Visibilidad de producto",
    metaLines: [
      `Cliente: ${company.name}`,
      subs.length ? subs.join(" · ").slice(0, 60) : "",
      `Periodo ${periodLabel} · corte ${now.getDate()} ${MESES[now.getMonth()]}`,
      `Semana ${isoWeek(now)}`,
    ].filter(Boolean),
    logo,
  });

  y = paragraph(doc, y, `El área de diseño de ${company.name} tiene ${active.length} tarea(s) activa(s) en ${subs.length || 1} subproyecto(s) (${done.length} cerrada(s)), con ${satTxt}. El foco de la semana es ${focoTxt}. La predictibilidad de fecha ${predictPct == null ? "aún no tiene base suficiente" : `es del ${predictPct}%`}${predictPct != null && predictPct < 85 ? ", por debajo de la meta (>=85%)" : ""}.`, { size: 9 });

  y = tiles(doc, y, [
    { k: "Tareas activas", v: active.length, s: `${done.length} cerradas`, color: C.teal },
    { k: "En revisión", v: review.length, s: "esperan aprob.", color: C.violet },
    { k: "Vencidas", v: overdue.length, s: `${blocked.length} bloqueada(s)`, color: C.red },
    { k: "Satisfacción", v: avg != null ? avg.toFixed(1) : "—", s: `/5 · ${rated.length} eval.`, color: C.green },
  ]);

  // 1. Tablero de indicadores
  y = sectionTitle(doc, y, "1. Tablero de indicadores DesignOps");
  const indCols = [
    { header: "Categoría", dataKey: "cat", width: 26 },
    { header: "Indicador", dataKey: "ind" },
    { header: "Valor", dataKey: "val", width: 20, align: "center" },
    { header: "Meta", dataKey: "meta", width: 22, align: "center" },
    { header: "Estado", dataKey: "est", width: 26, align: "center" },
  ];
  const indRows = [
    { cat: "Predictibilidad", ind: "Entregas en fecha / comprometidas", val: predictPct == null ? "—" : predictPct + "%", meta: ">= 85%", est: predSem.txt, _tone: predSem.tone },
    { cat: "", ind: "Desviación promedio de fechas", val: deviationPct == null ? "—" : sign(deviationPct), meta: "<= 10%", est: devSem.txt, _tone: devSem.tone },
    { cat: "", ind: "Compromisos movidos (fecha corrida)", val: `${movidas.length}${movidasPct == null ? "" : ` · ${movidasPct}%`}`, meta: "<= 15%", est: movSem.txt, _tone: movSem.tone },
    { cat: "", ind: "Tareas vencidas sin cerrar", val: String(overdue.length), meta: "0", est: overdueSem.txt, _tone: overdueSem.tone },
    { cat: "Eficiencia", ind: "Tasa de retrabajo (request review)", val: reworkPct == null ? "—" : reworkPct + "%", meta: "<= 20%", est: reworkSem.txt, _tone: reworkSem.tone },
    { cat: "", ind: "Request review abiertos / totales", val: `${crCount} / ${crTotal}`, meta: "0 abiertos", est: crSem.txt, _tone: crSem.tone },
    { cat: "", ind: "Origen retrabajo (cliente / interno)", val: `${crCliente} / ${crInterno}`, meta: "cli <= int", est: origenSem.txt, _tone: origenSem.tone },
    { cat: "", ind: "Tareas en revisión (cola)", val: String(review.length), meta: "<= 4", est: reviewSem.txt, _tone: reviewSem.tone },
    { cat: "Capacidad", ind: "Velocidad real de diseño (pts/sem)", val: velocity == null ? "—" : String(velocity), meta: "8-12", est: velSem.txt, _tone: velSem.tone },
    { cat: "", ind: "Utilización por diseñador", val: avgUtil == null ? "—" : avgUtil + "%", meta: "70-90%", est: utilSem.txt, _tone: utilSem.tone },
    { cat: "Calidad", ind: "Satisfacción del Product Owner", val: avg != null ? avg.toFixed(1) + " /5" : "—", meta: ">= 4,5", est: satSem.txt, _tone: satSem.tone },
    { cat: "", ind: "Defectos UX/UI en QA (por 10 entregas)", val: defectsPer10 == null ? "—" : String(defectsPer10), meta: "<= 2", est: defSem.txt, _tone: defSem.tone },
  ];
  y = table(doc, y, indCols, indRows, {
    didParseCell: (data) => {
      if (data.section !== "body") return;
      const row = indRows[data.row.index];
      if (data.column.index === 0) data.cell.styles.fontStyle = "bold";
      if (data.column.index === 4) { data.cell.styles.textColor = TONE[row._tone] || C.gray; data.cell.styles.fontStyle = "bold"; }
    },
  });

  // Flujo del trabajo
  y = tiles(doc, y, [
    { k: "Cycle time medio", v: cycleTime == null ? "—" : Math.round(cycleTime), s: "días creada->cerrada", color: C.teal },
    { k: "Throughput", v: throughputWk, s: "cerradas / semana", color: C.green },
    { k: "WIP en progreso", v: wip, s: "trabajo simultáneo", color: C.amber },
  ]);
  if (utils.length) y = paragraph(doc, y, `Utilización por diseñador: ${utils.sort((a, b) => b.pct - a.pct).slice(0, 6).map((u) => `${u.name} ${u.pct}%`).join(" · ")}. Objetivo 70-90%.`, { size: 8, color: C.gray });

  // 2. Estado de proyectos
  y = sectionTitle(doc, y, "2. Estado de los proyectos");
  const subCols = [
    { header: "Subproyecto", dataKey: "cl" },
    { header: "Total", dataKey: "total", width: 16, align: "center" },
    { header: "Activas", dataKey: "active", width: 16, align: "center" },
    { header: "Revisión", dataKey: "review", width: 18, align: "center" },
    { header: "Bloq.", dataKey: "blocked", width: 15, align: "center" },
    { header: "Vencidas", dataKey: "overdue", width: 18, align: "center" },
    { header: "Cerradas", dataKey: "done", width: 18, align: "center" },
  ];
  const subRows = [
    ...perSub.map((s) => ({ cl: s.cl, total: s.total, active: s.active, review: s.review, blocked: s.blocked, overdue: s.overdue, done: s.done })),
    { cl: `Total ${company.name}`, total: ct.length, active: active.length, review: review.length, blocked: blocked.length, overdue: overdue.length, done: done.length, _bold: true },
  ];
  y = table(doc, y, subCols, subRows, {
    didParseCell: (data) => {
      if (data.section === "body" && subRows[data.row.index]._bold) data.cell.styles.fontStyle = "bold";
    },
  });
  y = paragraph(doc, y, `Composición del trabajo activo: ${compo}.`, { size: 8, color: C.gray });

  // 3. Predictibilidad y cumplimiento
  y = sectionTitle(doc, y, "3. Predictibilidad y cumplimiento");
  y = paragraph(doc, y, `De las entregas con fecha comprometida, ${onTime} de ${dueDone.length} salieron a tiempo${predictPct != null ? ` (${predictPct}%)` : ""}. Hay ${overdue.length} tarea(s) vencida(s) sin cerrar.`, { size: 9 });
  if (movidas.length) {
    y = paragraph(doc, y, `Compromisos movidos: a ${movidas.length} tarea(s)${movidasPct != null ? ` (${movidasPct}% de las que tienen fecha)` : ""} se les corrió el vencimiento al menos una vez. Cada corrimiento queda con su fecha anterior como soporte.${movidasTop.length ? ` Abiertas con fecha movida: ${movidasTop.map((tk) => `${tk.title} (antes ${fmtDate(tk.prevDueDate)} -> ahora ${tk.dueDate ? fmtDate(tk.dueDate) : "sin fecha"})`).join(" · ")}.` : ""}`, { size: 8, color: C.gray });
  } else {
    y = paragraph(doc, y, "Ningún compromiso de fecha se ha movido en el periodo: la planeación se está sosteniendo.", { size: 8, color: C.gray });
  }
  const odCols = [
    { header: "Ref", dataKey: "ref", width: 16 },
    { header: "Tarea", dataKey: "title" },
    { header: "Subproyecto", dataKey: "client", width: 40 },
    { header: "Venció", dataKey: "due", width: 20, align: "center" },
  ];
  const odRows = overdueTop.length ? overdueTop.map((tk) => ({ ref: tk.ref || "", title: tk.title, client: tk.client || "—", due: fmtDate(tk.dueDate), _r: true })) : [{ ref: "", title: "Sin tareas vencidas.", client: "", due: "", _r: false }];
  y = table(doc, y, odCols, odRows, {
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 3 && odRows[data.row.index]._r) { data.cell.styles.textColor = C.red; data.cell.styles.fontStyle = "bold"; }
    },
  });
  if (review.length >= 4 || overdue.length) {
    y = callout(doc, y, [`Cuello de botella (Teoría de Restricciones): ${review.length >= 4 ? `${review.length} tareas terminadas esperan revisión/aprobación — la salida, no la entrada.` : `${overdue.length} vencidas acumuladas.`} Destrabar esa cola libera avance sin agregar carga nueva.`], "red");
  }

  // 4. Capacidad
  y = sectionTitle(doc, y, "4. Capacidad — modelo de puntos de diseño");
  const capCols = [
    { header: "Pts", dataKey: "pts", width: 14, align: "center" },
    { header: "Nivel", dataKey: "niv", width: 30 },
    { header: "Ejemplo", dataKey: "ej" },
  ];
  y = table(doc, y, capCols, [
    { pts: "1", niv: "Simple", ej: "Login, error, splash" },
    { pts: "2", niv: "Media", ej: "Formulario, listado, filtros" },
    { pts: "4", niv: "Compleja", ej: "Dashboard, multi-step" },
  ]);
  y = paragraph(doc, y, "Fórmulas: Velocidad = puntos cerrados / semanas (ref. 8-12 pts/sem senior). Duración = puntos del proyecto / velocidad. Fecha = inicio + duración + 20% buffer. La fase de diseño debe ocupar 20-30% del proyecto; al superar 30% se suma un diseñador. Utilización objetivo 70-90%.", { size: 8, color: C.gray });

  // 5. IA y herramientas
  y = sectionTitle(doc, y, "5. IA y herramientas");
  y = paragraph(doc, y, `Consumo de IA: ${avgAi == null ? "aún sin registrar (captúralo por tarea, % IA)" : `${avgAi}% uso medio por tarea (medido en ${aiTasks.length} de ${ct.length} tarea(s))`}.`, { size: 9 });
  y = paragraph(doc, y, `Herramientas: ${toolsSorted.length ? toolsSorted.map(([tool, n]) => `${tool} (${n})`).join(" · ") : "aún sin registrar. Marca las herramientas por tarea (Figma, Claude, etc.)."}`, { size: 9 });

  // 6. Recomendaciones
  y = sectionTitle(doc, y, "6. Recomendaciones de la semana");
  y = callout(doc, y, recs, "teal");

  footer(doc, `MediaLab Ingenieria · Reporte DesignOps — ${company.name}`);
  save(doc, `Reporte-DesignOps-${safeName(company.name)}-${period}.pdf`);
}
