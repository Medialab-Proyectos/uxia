// Listado descargable de TAREAS VIGENTES (activas, sin cerrar) por empresa y subproyecto.
// PDF vectorial con jsPDF (texto seleccionable, nunca en blanco), agrupado por subproyecto.
import { newDoc, header, tiles, sectionTitle, table, footer, save, loadImage, safeName, C } from "./pdfKit.js";
import logoUrl from "./logos/logo-medialab.png";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
function todayIso() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}

const STATUS_LABEL = {
  backlog: "En cola", ready: "Sin iniciar", doing: "En progreso", blocked: "Bloqueada",
  review: "En revisión", verificacion: "Lista · por notificar", notificado: "Notificado",
};
const STATUS_ORDER = ["blocked", "doing", "review", "verificacion", "notificado", "ready", "backlog"];
const PRIO_LABEL = { alta: "Alta", media: "Media", baja: "Baja" };

// Descarga el listado de tareas vigentes como archivo PDF (sin diálogo de impresión).
export async function openActiveTasksReport({ company, tasks = [], people = [], client = "" }) {
  const today = todayIso();
  const now = new Date();
  const nameOf = (id) => people.find((p) => p.id === id)?.name || "";
  const isOverdue = (tk) => tk.dueDate && tk.dueDate < today && tk.status !== "done" && tk.status !== "review" && tk.status !== "verificacion" && tk.status !== "notificado";

  const ct = tasks.filter((tk) => tk.companyId === company.id && tk.status !== "done" && (!client || (tk.client || "") === client));
  const subs = [...new Set(ct.map((tk) => tk.client || "Sin subproyecto"))].sort((a, b) => a.localeCompare(b));

  const sortTasks = (arr) => [...arr].sort((a, b) => {
    const so = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
    if (so !== 0) return so;
    const ao = isOverdue(a) ? 0 : 1, bo = isOverdue(b) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    return String(a.dueDate || "9999").localeCompare(String(b.dueDate || "9999"));
  });

  const totalOverdue = ct.filter(isOverdue).length;
  const totalBlocked = ct.filter((tk) => tk.status === "blocked").length;
  const totalNoAssignee = ct.filter((tk) => !tk.assigneeId && !tk.owner).length;
  const scope = client ? `${company.name} · ${client}` : company.name;

  const doc = await newDoc();
  const logo = await loadImage(logoUrl).catch(() => null);

  let y = header(doc, {
    title: "Tareas vigentes",
    subtitle: "Centro de Operaciones · Tareas vigentes",
    metaLines: [scope, `Corte ${now.getDate()} ${MESES[now.getMonth()]} ${now.getFullYear()}`],
    logo,
  });

  y = tiles(doc, y, [
    { k: "Vigentes", v: ct.length, color: C.teal },
    { k: "Subproyectos", v: client ? 1 : subs.length, color: C.ink },
    { k: "Vencidas", v: totalOverdue, color: C.red },
    { k: "Bloqueadas", v: totalBlocked, color: C.amber },
    { k: "Sin asignar", v: totalNoAssignee, color: C.gray },
  ]);

  const columns = [
    { header: "Ref", dataKey: "ref", width: 14 },
    { header: "Tarea", dataKey: "tarea" },
    { header: "Estado", dataKey: "estado", width: 26 },
    { header: "Prioridad", dataKey: "prioridad", width: 18, align: "center" },
    { header: "Responsable", dataKey: "resp", width: 30 },
    { header: "Vence", dataKey: "vence", width: 16, align: "center" },
  ];

  if (!ct.length) {
    sectionTitle(doc, y, scope);
    footer(doc, `MediaLab Ingenieria · Tareas vigentes — ${scope}`);
    save(doc, `Tareas-vigentes-${safeName(scope)}.pdf`);
    return;
  }

  for (const cl of subs) {
    const list = sortTasks(ct.filter((tk) => (tk.client || "Sin subproyecto") === cl));
    y = sectionTitle(doc, y, cl, `· ${list.length} vigente(s)`);
    const rows = list.map((tk) => ({
      ref: tk.ref || "",
      tarea: tk.title + (tk.description ? `\n${tk.description}` : ""),
      estado: STATUS_LABEL[tk.status] || tk.status || "—",
      prioridad: PRIO_LABEL[tk.priority] || "—",
      resp: nameOf(tk.assigneeId) || (tk.owner || "—"),
      vence: tk.dueDate ? fmtDate(tk.dueDate) : "—",
      _overdue: isOverdue(tk),
      _status: tk.status,
      _prio: tk.priority,
    }));
    y = table(doc, y, columns, rows, {
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const row = rows[data.row.index];
        if (data.column.index === 5 && row._overdue) { data.cell.styles.textColor = C.red; data.cell.styles.fontStyle = "bold"; }
        if (data.column.index === 2) {
          const st = row._status;
          data.cell.styles.textColor = st === "blocked" ? C.red : st === "doing" ? C.amber : (st === "review" || st === "verificacion" || st === "notificado") ? C.teal : C.gray;
          data.cell.styles.fontStyle = "bold";
        }
        if (data.column.index === 3 && row._prio === "alta") { data.cell.styles.textColor = C.red; data.cell.styles.fontStyle = "bold"; }
        if (data.column.index === 1) {
          // Título en negrita; la descripción (2ª línea) queda en gris más pequeña vía split — jsPDF
          // no permite estilos por línea, así que solo resaltamos el bloque en tono normal.
        }
      },
    });
  }

  footer(doc, `MediaLab Ingenieria · Tareas vigentes — ${scope}`);
  save(doc, `Tareas-vigentes-${safeName(scope)}.pdf`);
}
