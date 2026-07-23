// Listado descargable de TAREAS VIGENTES (activas, sin cerrar) por empresa y subproyecto.
// Descarga directa a PDF (archivo), agrupado por subproyecto.
import { downloadHtmlAsPdf } from "./pdf.js";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function esc(s) { return String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function todayIso() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return esc(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

// Vigentes = todo lo que no está cerrado. El orden refleja el flujo de trabajo.
const STATUS_LABEL = {
  backlog: "En cola", ready: "Sin iniciar", doing: "En progreso", blocked: "Bloqueada",
  review: "En revisión", verificacion: "Lista · por notificar", notificado: "Notificado",
};
const STATUS_ORDER = ["blocked", "doing", "review", "verificacion", "notificado", "ready", "backlog"];
const PRIO_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };

function statusChip(st) {
  const label = STATUS_LABEL[st] || st || "—";
  const kind = st === "blocked" ? "r" : st === "doing" ? "a" : (st === "review" || st === "verificacion" || st === "notificado") ? "v" : "n";
  return `<span class="chip ${kind}">${esc(label)}</span>`;
}
function prioChip(p) {
  const label = PRIO_LABEL[p] || "—";
  const kind = p === "alta" ? "r" : p === "media" ? "a" : "n";
  return `<span class="chip ${kind}">${esc(label)}</span>`;
}

export function buildActiveTasksReportHtml({ company, tasks = [], people = [], client = "", logoUrl = "" }) {
  const today = todayIso();
  const now = new Date();
  const nameOf = (id) => people.find((p) => p.id === id)?.name || "";
  const isOverdue = (t) => t.dueDate && t.dueDate < today && t.status !== "done" && t.status !== "review";

  // Universo: empresa + (opcional) un solo subproyecto. Vigentes = no cerradas.
  const ct = tasks.filter((t) => t.companyId === company.id && t.status !== "done" && (!client || (t.client || "") === client));
  const subs = [...new Set(ct.map((t) => t.client || "Sin subproyecto"))].sort((a, b) => a.localeCompare(b));

  const sortTasks = (arr) => [...arr].sort((a, b) => {
    const so = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (so !== 0) return so;
    const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
  });

  const totalOverdue = ct.filter(isOverdue).length;
  const totalBlocked = ct.filter((t) => t.status === "blocked").length;
  const totalNoAssignee = ct.filter((t) => !t.assigneeId && !t.owner).length;

  const scope = client ? `${esc(company.name)} · ${esc(client)}` : esc(company.name);

  const sections = subs.map((cl) => {
    const list = sortTasks(ct.filter((t) => (t.client || "Sin subproyecto") === cl));
    const rows = list.map((t) => {
      const over = isOverdue(t);
      return `<tr>
        <td class="ref">${esc(t.ref || "")}</td>
        <td><b>${esc(t.title)}</b>${t.description ? `<div class="desc">${esc(t.description)}</div>` : ""}</td>
        <td class="center">${statusChip(t.status)}</td>
        <td class="center">${prioChip(t.priority)}</td>
        <td>${esc(nameOf(t.assigneeId) || (t.owner || "—"))}</td>
        <td class="center">${t.dueDate ? (over ? `<span class="chip r">${fmtDate(t.dueDate)}</span>` : fmtDate(t.dueDate)) : "—"}</td>
      </tr>`;
    }).join("");
    return `<h2>${esc(cl)} <span class="count">· ${list.length} vigente(s)</span></h2>
      <table class="avoid"><thead><tr>
        <th>Ref</th><th>Tarea</th><th class="center">Estado</th><th class="center">Prioridad</th><th>Responsable</th><th class="center">Vence</th>
      </tr></thead><tbody>${rows || `<tr><td colspan="6" class="muted">Sin tareas vigentes.</td></tr>`}</tbody></table>`;
  }).join("");

  const logoAbs = logoUrl ? (() => { try { return new URL(logoUrl, window.location.href).href; } catch { return logoUrl; } })() : "";

  return `<!doctype html><html lang="es"><head><meta charset="utf-8" />
<title>Tareas vigentes — ${scope}</title>
<style>
  @page { size: A4; margin: 14mm 15mm 16mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family:"Segoe UI","Helvetica Neue",Arial,sans-serif; color:#1D2939; font-size:10pt; line-height:1.45; }
  .wrap { max-width:720px; margin:0 auto; }
  h2 { font-size:12pt; font-weight:700; color:#17727A; margin:18px 0 6px; padding-bottom:4px; border-bottom:2px solid #17727A; break-after:avoid; }
  h2 .count { font-size:9pt; font-weight:600; color:#667085; }
  .head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; border-bottom:3px solid #17727A; padding-bottom:12px; }
  .brand { display:flex; align-items:center; gap:10px; } .logo { width:34px; height:34px; object-fit:contain; }
  .brand .name { font-size:13pt; font-weight:700; letter-spacing:0.02em; }
  .brand .tag { font-size:8pt; color:#667085; text-transform:uppercase; letter-spacing:0.14em; }
  .head .meta { text-align:right; font-size:8.5pt; color:#667085; } .head .meta .big { font-size:11pt; color:#1D2939; font-weight:700; }
  .tiles { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
  .tile { flex:1 1 0; min-width:110px; border:1px solid #E4DED6; border-radius:8px; padding:8px 10px; }
  .tile .k { font-size:7.5pt; text-transform:uppercase; letter-spacing:0.08em; color:#667085; }
  .tile .v { font-size:18pt; font-weight:700; line-height:1.1; margin-top:2px; font-variant-numeric:tabular-nums; }
  table { width:100%; border-collapse:collapse; margin:6px 0 4px; font-size:8.7pt; }
  th,td { text-align:left; padding:5px 7px; border-bottom:1px solid #E4DED6; vertical-align:top; }
  thead th { background:#1D2939; color:#fff; font-size:7.8pt; text-transform:uppercase; letter-spacing:0.05em; border:none; }
  tbody tr:nth-child(even) { background:#FBFAF7; }
  td.center,th.center { text-align:center; } td.ref { color:#98A2B3; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .desc { color:#667085; font-size:8pt; margin-top:2px; }
  .muted { color:#98A2B3; }
  .chip { display:inline-block; padding:1px 8px; border-radius:999px; font-size:7.8pt; font-weight:700; white-space:nowrap; }
  .g { background:#E5F5EE; color:#0D7A4F; } .a { background:#FFF7E6; color:#B76E00; }
  .r { background:#FEF3F2; color:#B42318; } .n { background:#F2F4F7; color:#667085; } .v { background:#EAF4F2; color:#17727A; }
  .foot { margin-top:18px; border-top:1px solid #E4DED6; padding-top:8px; font-size:8pt; color:#667085; display:flex; justify-content:space-between; }
  .avoid { break-inside:avoid; }
</style></head><body><div class="wrap">

  <div class="head">
    <div class="brand">
      ${logoAbs ? `<img class="logo" src="${esc(logoAbs)}" alt="MediaLab" />` : ""}
      <div><div class="name">MediaLab Ingeniería</div><div class="tag">Centro de Operaciones · Tareas vigentes</div></div>
    </div>
    <div class="meta">
      <div class="big">Tareas vigentes</div>
      <div>${scope}</div>
      <div>Corte ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}</div>
    </div>
  </div>

  <div class="tiles">
    <div class="tile"><div class="k">Vigentes</div><div class="v" style="color:#17727A">${ct.length}</div></div>
    <div class="tile"><div class="k">Subproyectos</div><div class="v" style="color:#1D2939">${client ? 1 : subs.length}</div></div>
    <div class="tile"><div class="k">Vencidas</div><div class="v" style="color:#B42318">${totalOverdue}</div></div>
    <div class="tile"><div class="k">Bloqueadas</div><div class="v" style="color:#B76E00">${totalBlocked}</div></div>
    <div class="tile"><div class="k">Sin asignar</div><div class="v" style="color:#667085">${totalNoAssignee}</div></div>
  </div>

  ${sections || `<p class="muted">No hay tareas vigentes en este alcance.</p>`}

  <div class="foot"><span>MediaLab Ingeniería · Tareas vigentes — ${scope}</span><span>Confidencial · generado ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}</span></div>

</div></body></html>`;
}

// Descarga el listado de tareas vigentes como archivo PDF (sin diálogo de impresión).
export function openActiveTasksReport(args) {
  const html = buildActiveTasksReportHtml(args);
  const scope = args.client ? `${args.company?.name}-${args.client}` : args.company?.name;
  return downloadHtmlAsPdf(html, `Tareas-vigentes-${scope}`);
}
