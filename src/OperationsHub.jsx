import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Archive, BarChart3, Bell, Building2, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Circle, Clock, Construction, Contrast, Download, ExternalLink, FileText, HelpCircle, Link2, ListChecks, ListOrdered, LoaderCircle, MessageCircle, Paperclip, Pencil, Plus, Power, Save, Send, Sparkles, Star, Target, Trash2, UserRound, X } from "lucide-react";
import * as opsData from "./opsData.js";
import logoUrl from "./logos/logo-medialab.png";
import { openDesignOpsReport } from "./designopsReport.js";
import { openActiveTasksReport } from "./activeTasksReport.js";
import { notifyEvent } from "./notify.js";
import { encodeCompanyToken } from "./companyLink.js";

const STATUS = {
  backlog: "Pendiente",
  ready: "Pendiente",
  doing: "En proceso",
  review: "En revisión",
  verificacion: "Lista · por notificar",
  notificado: "Notificado",
  blocked: "Bloqueada",
  actualizada: "Actualizada",
  done: "Finalizada",
};

// Color por estado (semántico, aparte del acento de marca).
const STATUS_TONE = {
  backlog: { border: "#F2C879", bg: "#FFF7E6", text: "#8A5700" },
  ready:   { border: "#F2C879", bg: "#FFF7E6", text: "#8A5700" },
  doing:   { border: "#9CC7E4", bg: "#EAF2FB", text: "#1D5A99" },
  review:  { border: "#B7D8D4", bg: "#EAF4F2", text: "#17727A" },
  verificacion: { border: "#9CC7E4", bg: "#EAF2FB", text: "#175CD3" },
  notificado: { border: "#A6D9C4", bg: "#EAF4F2", text: "#0D7A4F" },
  blocked: { border: "#F3B0A8", bg: "#FEF3F2", text: "#B42318" },
  actualizada: { border: "#C4B5FD", bg: "#F5F3FF", text: "#6D28D9" },
  done:    { border: "#A6D9C4", bg: "#E5F5EE", text: "#0D7A4F" },
};

function statusTone(status) {
  return STATUS_TONE[status] || STATUS_TONE.backlog;
}

// Herramientas frecuentes (diseño + IA) para registrar el uso/consumo por tarea.
const TOOL_OPTIONS = ["Figma", "Claude", "ChatGPT", "Cursor", "Notion", "Midjourney", "v0", "Trello"];

// Acento diferencial por subproyecto: color saturado y estable derivado del nombre.
// Se usa como franja/borde e identificador para distinguir cada tarjeta y desplegable
// y mejorar la jerarquía de información. Se aplican como colores sólidos + tintes
// translúcidos (rgba con alpha en hex) para que funcionen igual en claro y oscuro.
const PROJECT_ACCENTS = ["#17727A", "#E8751A", "#6941C6", "#0D7A4F", "#B54708", "#1570EF", "#C11574", "#4E5BA6"];
function projectAccent(name) {
  const key = String(name || "");
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PROJECT_ACCENTS[h % PROJECT_ACCENTS.length];
}
function projectInitials(name) {
  const parts = String(name || "?").trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((w) => w[0]?.toUpperCase() || "").join("") || "?").slice(0, 2);
}

// Categorías de trabajo: alcance del contrato por empresa + tipo de cada tarea.
// En unas empresas MediaLab solo apoya diseño; en otras hace gestión total o desarrollo.
const TASK_CATEGORIES = ["Diseño UX/UI", "Diseño gráfico", "UX Research", "Producto", "Gestión de proyecto", "Desarrollo de software", "Apoyo"];
const CATEGORY_TONE = {
  "Diseño UX/UI": "#C11574",
  "Diseño gráfico": "#DD2590",
  "UX Research": "#6941C6",
  "Producto": "#B54708",
  "Gestión de proyecto": "#17727A",
  "Desarrollo de software": "#1570EF",
  "Apoyo": "#0D7A4F",
};
function categoryColor(category) {
  return CATEGORY_TONE[category] || "#667085";
}

// --- Horas laborales Colombia -------------------------------------------------
// Jornada 8:00–12:00 y 13:00–17:00 (8h, 1h de almuerzo), lunes a viernes,
// excluyendo festivos colombianos. Se usa para "horas cumplidas" al terminar una tarea.
// Los tiempos se interpretan en hora local del equipo (se asume zona Colombia, UTC-5).
function easterSunday(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nextMonday(d) {
  const x = new Date(d);
  const wd = x.getDay();
  if (wd !== 1) x.setDate(x.getDate() + ((8 - wd) % 7));
  return x;
}
const _holidayCache = {};
function colombianHolidays(year) {
  if (_holidayCache[year]) return _holidayCache[year];
  const set = new Set();
  const add = (dt) => set.add(isoDay(dt));
  // Fijos
  [[0, 1], [4, 1], [6, 20], [7, 7], [11, 8], [11, 25]].forEach(([m, dd]) => add(new Date(year, m, dd)));
  // Ley Emiliani: se trasladan al lunes siguiente
  [[0, 6], [2, 19], [5, 29], [7, 15], [9, 12], [10, 1], [10, 11]].forEach(([m, dd]) => add(nextMonday(new Date(year, m, dd))));
  // Basados en Pascua
  const easter = easterSunday(year);
  const rel = (days) => { const dt = new Date(easter); dt.setDate(dt.getDate() + days); return dt; };
  add(rel(-3)); // Jueves Santo
  add(rel(-2)); // Viernes Santo
  add(nextMonday(rel(39))); // Ascensión
  add(nextMonday(rel(60))); // Corpus Christi
  add(nextMonday(rel(68))); // Sagrado Corazón
  _holidayCache[year] = set;
  return set;
}
function isBusinessDay(d) {
  const wd = d.getDay();
  if (wd === 0 || wd === 6) return false;
  return !colombianHolidays(d.getFullYear()).has(isoDay(d));
}
function businessHoursBetween(startIso, endIso) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (!(start < end)) return 0;
  let total = 0;
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  while (cursor <= end) {
    if (isBusinessDay(cursor)) {
      for (const [h0, h1] of [[8, 12], [13, 17]]) {
        const wStart = new Date(cursor); wStart.setHours(h0, 0, 0, 0);
        const wEnd = new Date(cursor); wEnd.setHours(h1, 0, 0, 0);
        const s = Math.max(start.getTime(), wStart.getTime());
        const e = Math.min(end.getTime(), wEnd.getTime());
        if (e > s) total += (e - s) / 3600000;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.round(total * 10) / 10;
}


const PRIORITY = {
  alta: "#B42318",
  media: "#B76E00",
  baja: "#1570EF",
};

const ROLE_OPTIONS = [
  "Project Manager",
  "UX Research",
  "Product Designer",
  "UI Designer",
  "Contenido",
  "Desarrollo",
  "QA",
  "Direccion",
];

const AUDIENCE_OPTIONS = ["Interno MediaLab", "Externo cliente", "Mixto"];
const SYNC_OPTIONS = ["Manual", "Crear en plataforma", "Actualizar plataforma", "Enviar por Google Chat"];
const BOARD_TOOLS = ["No aplica", "Trello", "Jira", "Notion", "Asana", "ClickUp", "Monday", "Otro"];
const PERSON_TYPES = ["Empleado MediaLab", "Externo"];
const CONTACT_METHODS = [
  ["auto", "Automático"],
  ["whatsapp", "WhatsApp"],
  ["chat", "Google Chat"],
  ["email", "Correo"],
];
const STORE_KEY = "uxia.operationsHub.v1";
const SAMPLE_CLIENTS = new Set(["Por clasificar", "FarmaNova", "RetailX", "Fintech Uno", "Proyecto interno", "Producto digital", "Operacion general", "MediaLab"]);
const DEMO_COMPANY_IDS = new Set(["notion-client", "jira-client"]);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_TASK_UPLOAD_BYTES = 1024 * 1024;
// Los PDF se suben sin comprimir (no son imágenes): se permite más peso porque el run diario
// los descarga y Claude los lee página por página.
const MAX_PDF_INSUMO_BYTES = 8 * 1024 * 1024;
const IMAGE_UPLOAD_MAX_SIDE = 1600;

const starterText = `# Brief diario - Metrics Lab

Cliente: Nombre real del subproyecto
- Pega aqui una minuta, transcripcion o pedido real. Fecha limite: hoy.
- Bloqueo: falta confirmar a que subproyecto pertenece esta informacion.
- Describe una tarea concreta y el responsable sugerido si lo conoces.`;

function uid(prefix = "task") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function slugify(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-nombre";
}

function normalizeBoardConfig(value) {
  if (!value) return { tool: "No aplica", url: "" };
  if (typeof value === "object") {
    return { tool: value.tool || "No aplica", url: value.url || "" };
  }
  const text = String(value);
  const url = firstLink(text);
  const toolMatch = text.match(/^\s*([^:\n]+):/);
  return { tool: toolMatch?.[1]?.trim() || (url ? "Otro" : "No aplica"), url };
}

function getProjectBoardConfig(company, client) {
  const value = company?.projectLinks?.[client] || company?.projectBoards?.[client];
  return normalizeBoardConfig(value);
}

function boardLabel(company, client) {
  const board = getProjectBoardConfig(company, client);
  if (!board.url) return `${board.tool || "No aplica"} sin link`;
  return `${board.tool}: ${board.url}`;
}

function firstLink(value) {
  return String(value || "").match(/https?:\/\/\S+/i)?.[0] || "";
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function displayDate(value) {
  if (!value) return "Sin fecha";
  return String(value).slice(0, 10);
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes)) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isTaskImageFile(file) {
  return /^image\//i.test(file?.type || "") || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file?.name || "");
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

async function compressTaskImage(file) {
  if (!isTaskImageFile(file) || file.size <= MAX_TASK_UPLOAD_BYTES) return file;

  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
      image.src = imageUrl;
    });

    const scale = Math.min(1, IMAGE_UPLOAD_MAX_SIDE / Math.max(image.naturalWidth || 1, image.naturalHeight || 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round((image.naturalWidth || 1) * scale));
    canvas.height = Math.max(1, Math.round((image.naturalHeight || 1) * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const baseName = (file.name || "imagen").replace(/\.[^.]+$/, "");
    for (const quality of [0.82, 0.7, 0.58, 0.46]) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      if (!blob) continue;
      const compressed = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
      if (compressed.size < file.size) return compressed;
    }
    return file;
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function prepareTaskUploadFile(file) {
  return compressTaskImage(file);
}

function normalizeApiData(payload) {
  const companies = cleanCompanies(payload?.companies?.length ? payload.companies : defaultCompanies);
  const tasks = cleanTasks(payload?.tasks?.length ? payload.tasks : defaultTasks);
  const sourceRecords = cleanSourceRecords(payload?.sourceRecords || payload?.records || []);
  const people = Array.isArray(payload?.people)
    ? payload.people.map((person) => ({
      ...person,
      // Sin empresa asignada = disponible en TODAS (companyIds no se persiste; el equipo es global).
      companyIds: Array.isArray(person.companyIds) ? person.companyIds : [],
    }))
    : [];
  return { companies, tasks, sourceRecords, people };
}

function cleanCompanies(input) {
  const cleaned = input
    .filter((company) => !DEMO_COMPANY_IDS.has(company.id))
    .map((company) => {
      const rawClients = company.id === "metrics-lab"
        ? (company.clients || []).filter((client) => !SAMPLE_CLIENTS.has(client))
        : (company.clients || []).filter((client) => client !== "Por clasificar");
      const clients = [...new Set(rawClients)];
      const projectLinks = {};
      const projectDescriptions = {};
      for (const client of clients) {
        projectLinks[client] = normalizeBoardConfig(company.projectLinks?.[client] || company.projectBoards?.[client]);
        projectDescriptions[client] = company.projectDescriptions?.[client] || "";
      }
      const archivedClients = { ...(company.archivedClients || {}) };
      for (const sample of SAMPLE_CLIENTS) delete archivedClients[sample];
      return { ...company, clients, archivedClients, projectLinks, projectDescriptions, connectors: [] };
    });

  return cleaned.length ? cleaned : defaultCompanies;
}

function cleanTasks(input) {
  return input.filter((task) => !SAMPLE_CLIENTS.has(task.client) && task.source !== "Setup inicial" && !isAutoImageReviewTask(task));
}

function cleanSourceRecords(input) {
  return input
    .filter((record) => !SAMPLE_CLIENTS.has(record.client))
    .map((record) => {
      if (!isAutoImageSourceRecord(record)) return record;
      const fileName = record.fileName || String(record.source || "").replace(/^Imagen subida:\s*/i, "") || "imagen";
      return {
        ...record,
        source: `Insumo de imagen: ${fileName}`,
        summary: `Insumo de imagen pendiente de análisis: ${fileName}`,
        rawText: `Insumo de imagen pendiente de análisis: ${fileName}`,
        taskIds: [],
        taskCount: 0,
        deletedSource: false,
      };
    });
}

function isAutoImageReviewTask(task) {
  return /^Revisar imagen subida:/i.test(task?.title || "") || /^Imagen subida:/i.test(task?.source || "");
}

function isAutoImageSourceRecord(record) {
  return /^Imagen subida:/i.test(record?.source || "") || /^Imagen subida para revision:/i.test(record?.rawText || "");
}

function activeClients(company) {
  return (company?.clients || []).filter((client) => !company?.archivedClients?.[client]);
}

function archivedClients(company) {
  return (company?.clients || []).filter((client) => company?.archivedClients?.[client]);
}

function buildPastedRecord({ text, companyId, client, tasks }) {
  return {
    id: uid("record"),
    companyId,
    client,
    source: "MD pegado en la app",
    fileName: "entrada-manual.md",
    processedAt: new Date().toISOString(),
    summary: text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 4).join(" ").slice(0, 360),
    taskIds: tasks.map((task) => task.id),
    taskCount: tasks.length,
    attachments: tasks.flatMap((task) => task.attachments || []),
    rawText: text,
    deletedSource: false,
  };
}

function buildTaskEmail(task, company) {
  const board = boardLabel(company, task.client);
  const criteria = (task.acceptanceCriteria || []).map((item) => `- ${item}`).join("\n");
  const attachments = (task.attachments || []).map((item) => `- ${item.label}: ${item.path}`).join("\n") || "- Sin adjuntos detectados.";
  return [
    task.userStory || task.title,
    "",
    task.description || task.evidence || "",
    "",
    `Subproyecto: ${task.client}`,
    `Herramienta/link: ${board}`,
    `Fecha: ${task.dueDate}`,
    `Entrega opcional: ${task.deliveryDate || "No definida"}`,
    "",
    "Criterios de aceptacion:",
    criteria || "- Pendiente definir criterios.",
    "",
    "Adjuntos:",
    attachments,
  ].join("\n");
}

function buildContactMessage(task, company) {
  const board = getProjectBoardConfig(company, task.client);
  return [
    `Hola, te comparto esta tarea de ${company?.name || "MediaLab"} / ${task.client}:`,
    task.title,
    task.description ? `Detalle: ${task.description}` : "",
    task.dueDate ? `Fecha objetivo: ${task.dueDate}` : "",
    board.url ? `Actualizar seguimiento en ${board.tool}: ${board.url}` : "",
  ].filter(Boolean).join("\n");
}

function buildDelayMessage(task, company) {
  const board = getProjectBoardConfig(company, task.client);
  return [
    `Hola, reporto retraso en esta tarea de ${company?.name || "MediaLab"} / ${task.client}:`,
    task.title,
    `Vencia: ${displayDate(task.dueDate)}`,
    "Solicito revisar el bloqueo y ampliar la fecha de vencimiento.",
    board.url ? `Actualizar seguimiento en ${board.tool}: ${board.url}` : "",
  ].filter(Boolean).join("\n");
}

function whatsappUrl(phone, text = "") {
  const clean = String(phone || "").replace(/[^\d]/g, "");
  return clean ? `https://wa.me/${clean}${text ? `?text=${encodeURIComponent(text)}` : ""}` : "";
}

function mailtoUrl(email, subject, body) {
  return email ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` : "";
}

function attachmentUrl(attachment) {
  // El servidor ya entrega la URL correcta (Supabase Storage en Vercel, o
  // /operations-files en local). Se usa esa; el path solo es respaldo para
  // adjuntos viejos guardados antes de este cambio.
  if (attachment?.url) return attachment.url;
  const path = String(attachment?.path || "").replace(/\\/g, "/").replace(/^operations\//, "");
  return path ? `/operations-files/${path}` : "";
}

function taskIsOverdue(task) {
  // "En revisión", "Lista · por notificar" y "Notificado" no cuentan como vencidas: ya salieron de
  // manos del equipo (esperan feedback / entrega / ya se notificó al cliente), no están atrasadas.
  return Boolean(task?.dueDate && task.dueDate < todayIso() && task.status !== "done" && task.status !== "review" && task.status !== "verificacion" && task.status !== "notificado");
}

function isValidPhone(value) {
  const clean = String(value || "").replace(/[^\d]/g, "");
  return !value || clean.length >= 8;
}

function personById(people, id) {
  return (people || []).find((person) => person.id === id) || null;
}

function personBelongsToCompany(person, companyId) {
  // Si la persona tiene una empresa fija (externo atado a su empresa), solo aparece en ESA empresa.
  const single = person?.companyId || "";
  if (single) return single === companyId;
  // Si no, back-compat: lista de empresas o global (equipo MediaLab, disponible en todas).
  const companyIds = Array.isArray(person?.companyIds) ? person.companyIds : [];
  return companyIds.length === 0 || companyIds.includes(companyId);
}

function interpretRequirementTitle(text) {
  const cleaned = String(text || "")
    .replace(/\s*responsable sugerido:.+$/i, "")
    .replace(/\bcmabair\b|\bcambair\b/gi, "cambiar")
    .replace(/\binfromacion\b/gi, "informacion")
    .trim();
  const url = cleaned.match(/https?:\/\/[^\s)]+/i)?.[0] || "";
  if (/logo/i.test(cleaned) && /pagina|web|sitio|landing/i.test(cleaned)) {
    return `Cambiar logo de la pagina${url ? ` ${url}` : ""}`.slice(0, 140);
  }
  if (/formularios/i.test(cleaned) && /(no se sabe|donde van|informacion|datos)/i.test(cleaned)) {
    return "Verificar destino de la informacion enviada por los formularios";
  }
  if (/no se sabe/i.test(cleaned)) {
    return `Verificar ${cleaned.replace(/^no se sabe\s*/i, "").trim()}`.slice(0, 140);
  }
  return cleaned.slice(0, 140);
}

function localFallbackAnalyze(text, companyId = "metrics-lab") {
  const lines = text
    .split(/\r?\n|(?<=\.)\s+/)
    .map((line) => line.replace(/^[-*]\s*(\[ \])?\s*/, "").trim())
    .filter(Boolean);

  let currentClient = "";
  const tasks = [];
  for (const line of lines) {
    const clientMatch = line.match(/cliente\s*:\s*(.+)$/i);
    if (clientMatch) {
      currentClient = clientMatch[1].trim();
      continue;
    }

    const actionable = /(revisar|preparar|crear|ajustar|cambiar|cmabair|cambair|corregir|arreglar|enviar|validar|verificar|disenar|entregar|confirmar|actualizar|documentar|publicar|investigar|bloqueo|falta|pendiente|definir|montar|conectar|asignar|no se sabe|donde van|formularios)/i.test(line);
    if (!actionable) continue;

    const dueMatch = line.match(/(?:fecha limite|vencimiento|due|antes del)\s*:?\s*(\d{4}-\d{2}-\d{2}|hoy|manana|viernes|lunes|martes|miercoles|jueves)/i)
      || line.match(/\b(hoy|manana|lunes|martes|miercoles|jueves|viernes)\b/i);
    const blocked = /bloqueo|bloqueada|falta|pendiente de acceso/i.test(line);
    tasks.push({
      id: uid(),
      title: interpretRequirementTitle(line),
      companyId,
      client: currentClient || "Sin cliente interno",
      role: inferRole(line),
      owner: "",
      priority: blocked ? "alta" : /hoy|urgente|viernes|entregar/i.test(line) ? "alta" : "media",
      status: blocked ? "blocked" : "ready",
      dueDate: normalizeDue(dueMatch?.[1]),
      deliveryDate: "",
      source: "Inbox MD",
      audience: /cliente|externo|presentar|enviar/i.test(line) ? "Externo cliente" : "Interno MediaLab",
      syncMode: /google chat/i.test(line) ? "Enviar por Google Chat" : /trello|notion|jira/i.test(line) ? "Actualizar plataforma" : "Manual",
      evidence: line,
      createdAt: new Date().toISOString(),
    });
  }
  return tasks;
}

function inferRole(text) {
  if (/pantalla|flujo|figma|wireframe|prototipo|dashboard|onboarding|mobile/i.test(text)) return "Product Designer";
  if (/research|entrevista|usuario|hallazgo|validaci/i.test(text)) return "UX Research";
  if (/visual|ui|component|landing|pieza|grafica|gr[aá]fica/i.test(text)) return "UI Designer";
  if (/api|automat|integraci|deploy|datos|script/i.test(text)) return "Desarrollo";
  if (/copy|texto|contenido|post|resumen/i.test(text)) return "Contenido";
  if (/aprobar|presupuesto|alcance|prioridad|cliente/i.test(text)) return "Project Manager";
  return "Project Manager";
}

function normalizeDue(value) {
  if (!value) return addDays(2);
  const clean = value.toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (clean === "hoy") return todayIso();
  if (clean === "manana") return addDays(1);
  const weekdays = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6 };
  if (clean in weekdays) return nextWeekday(weekdays[clean]);
  return addDays(3);
}

function nextWeekday(targetDay) {
  const date = new Date();
  const diff = (targetDay - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

const defaultCompanies = [
  {
    id: "metrics-lab",
    name: "Metrics Lab",
    status: "activa",
    owner: "MediaLab",
    workspaces: ["Documentacion"],
    clients: [],
    archivedClients: {},
    projectLinks: {},
    projectDescriptions: {},
    contextDocuments: {},
    logo: null,
    connectors: [],
  },
];

const defaultTasks = [];

export default function OperationsHub({ token = "", theme = "light", onAuthError, focus = null, onFocusHandled } = {}) {
  const [companies, setCompanies] = useState(defaultCompanies);
  const [tasks, setTasks] = useState(defaultTasks);
  const [sourceRecords, setSourceRecords] = useState([]);
  const [people, setPeople] = useState([]);
  const [activeCompany, setActiveCompany] = useState("metrics-lab");
  const [insumos, setInsumos] = useState([]);
  const [activeStatus, setActiveStatus] = useState("open");
  const [assignFilter, setAssignFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [taskQuery, setTaskQuery] = useState("");
  const [highlightTaskId, setHighlightTaskId] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState("all"); // all | unowned (sin responsable)
  const [sortRecent, setSortRecent] = useState(false);    // ordenar por últimas incluidas
  const [activeView, setActiveView] = useState("companies");
  const [finalizeTask, setFinalizeTask] = useState(null); // tarea a finalizar desde la vista de prioridad
  const [growthPractices, setGrowthPractices] = useState([]); // buenas prácticas de crecimiento (MD)
  const [leads, setLeads] = useState([]); // líderes de subproyecto (company_id + client + email)
  const [alertDismissed, setAlertDismissed] = useState(false);
  // Foco desde una notificación del shell: abre "Todas las tareas" en el filtro indicado.
  useEffect(() => {
    if (!focus) return;
    setActiveView("tasks");
    setActiveStatus(focus);
    setCompanyFilter("all");
    setAssignFilter("all");
    setTaskQuery("");
    onFocusHandled?.();
  }, [focus]);
  const [asideOpen, setAsideOpen] = useState(false);
  const [asideTab, setAsideTab] = useState("empresas"); // "empresas" | "personas"
  const [globalOpen, setGlobalOpen] = useState(false);
  const [globalText, setGlobalText] = useState("");
  const [inboxText, setInboxText] = useState(starterText);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientTool, setNewClientTool] = useState("No aplica");
  const [newClientBoardUrl, setNewClientBoardUrl] = useState("");
  const [newPerson, setNewPerson] = useState({ name: "", email: "", phone: "", type: "Empleado MediaLab", chatUrl: "", contactMethod: "auto", password: "", companyId: "" });
  const [contextPreview, setContextPreview] = useState({});
  const [loadedState, setLoadedState] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  useEffect(() => {
    async function loadState() {
      try {
        if (!opsData.opsDataReady()) throw new Error("supabase sin configurar");
        const payload = await opsData.loadState(token);
        const normalized = normalizeApiData(payload);
        setCompanies(normalized.companies);
        setTasks(normalized.tasks);
        setSourceRecords(normalized.sourceRecords);
        setPeople(normalized.people);
        setActiveCompany(
          normalized.companies.some((item) => item.id === payload.activeCompany)
            ? payload.activeCompany
            : normalized.companies[0]?.id || "metrics-lab"
        );
        setSaveStatus(`Supabase: ${payload.updatedAt ? new Date(payload.updatedAt).toLocaleString() : "listo"}`);
      } catch {
        const local = localStorage.getItem(STORE_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          const cleanedCompanies = cleanCompanies(parsed.companies || defaultCompanies);
          const cleanedTasks = cleanTasks(parsed.tasks || defaultTasks);
          const cleanedRecords = cleanSourceRecords(parsed.sourceRecords || []);
          setCompanies(cleanedCompanies);
          setTasks(cleanedTasks);
          setSourceRecords(cleanedRecords);
          setPeople(Array.isArray(parsed.people) ? parsed.people : []);
          setActiveCompany(
            cleanedCompanies.some((item) => item.id === parsed.activeCompany)
              ? parsed.activeCompany
              : cleanedCompanies[0]?.id || "metrics-lab"
          );
          setSaveStatus("Usando respaldo local del navegador");
        } else {
          const normalized = normalizeApiData({ companies: defaultCompanies, tasks: defaultTasks });
          setCompanies(normalized.companies);
          setTasks(normalized.tasks);
          setSourceRecords(normalized.sourceRecords);
          setPeople(normalized.people);
          setSaveStatus("Sin estado central disponible");
        }
      } finally {
        setLoadedState(true);
      }
    }

    loadState();
  }, []);

  // Buenas prácticas de crecimiento (las genera el MD). Se cargan aparte del estado central.
  useEffect(() => {
    if (!token || !opsData.opsDataReady()) return;
    opsData.listGrowthPractices(token).then(setGrowthPractices).catch(() => {});
    opsData.listLeads(token).then(setLeads).catch(() => {});
  }, [token]);

  // Líderes de subproyecto (empleados MediaLab que pueden crear tareas/insumos en su subproyecto).
  async function assignLead(companyId, client, email) {
    try {
      await opsData.setLead(token, { companyId, client, email });
      setLeads(await opsData.listLeads(token));
      setNotice(`Líder asignado a ${client}.`);
    } catch { setNotice("No se pudo asignar el líder (¿corriste migration-subproject-leads.sql?)."); }
  }
  async function removeLeadFn(id) {
    try { await opsData.removeLead(token, id); setLeads((cur) => cur.filter((l) => l.id !== id)); }
    catch { setNotice("No se pudo quitar el líder."); }
  }

  // Autosave silencioso de respaldo (estructura: empresas, personas, insumos y también
  // tareas). NO se muestra un botón global "Guardar cambios" (confundía): el guardado
  // visible es POR TAREA (botón "Guardar tarea" en cada tarjeta, con su ✓). Este autosave
  // es solo la red de seguridad para que nada se pierda. Cache local inmediato + Supabase
  // con debounce.
  useEffect(() => {
    if (!loadedState) return undefined;
    localStorage.setItem(STORE_KEY, JSON.stringify({ companies, tasks, sourceRecords, people, activeCompany }));
    if (!opsData.opsDataReady()) return undefined;
    const timer = setTimeout(() => {
      opsData.saveState(token, { companies, tasks, sourceRecords, people, activeCompany })
        .then((saved) => { if (saved?.warning) setSaveStatus(`⚠ ${saved.warning}`); })
        .catch((e) => { if (opsData.isAuthError(e)) onAuthError?.(); });
    }, 800);
    return () => clearTimeout(timer);
  }, [companies, tasks, sourceRecords, people, activeCompany, loadedState, token]);

  // Asigna el codigo de referencia FIJO (AR01…) a las tareas que no lo tienen y lo persiste.
  // Se congela: una vez asignado no cambia aunque se borren o reordenen otras tareas.
  useEffect(() => {
    if (!loadedState || !tasks.length) return;
    const { tasks: withRefs, changed } = withAssignedRefs(tasks, companies);
    if (changed) setTasks(withRefs);
  }, [loadedState, tasks, companies]);

  const company = companies.find((item) => item.id === activeCompany) || companies[0];
  const activeCompanyClients = activeClients(company);
  const companyTasks = tasks.filter((task) => task.companyId === company?.id);
  const taskQ = taskQuery.trim().toLowerCase();
  const visibleTasks = tasks.filter((task) => {
    if (companyFilter !== "all" && task.companyId !== companyFilter) return false;
    // "Sin proyecto" = tareas en la bandeja "Por asignar" (companyId "por-asignar")
    // o sin subproyecto; "Con proyecto" = ya están en una empresa/subproyecto real.
    const sinProyecto = task.companyId === "por-asignar" || !task.client;
    if (assignFilter === "unassigned" && !sinProyecto) return false;
    if (assignFilter === "assigned" && sinProyecto) return false;
    // Responsable: "unowned" = sin persona; un id de persona = solo sus tareas.
    if (ownerFilter === "unowned" && (task.assigneeId || task.owner)) return false;
    if (ownerFilter !== "all" && ownerFilter !== "unowned" && task.assigneeId !== ownerFilter) return false;
    if (taskQ) {
      // Al buscar por palabras se ignora el filtro de estado, para encontrar también
      // las tareas FINALIZADAS (archivadas) en cualquier consulta.
      const c = companies.find((item) => item.id === task.companyId);
      const hay = `${task.title} ${task.description || ""} ${task.client || ""} ${c?.name || ""} ${task.category || ""} ${task.owner || ""}`.toLowerCase();
      return hay.includes(taskQ);
    }
    if (activeStatus === "open") return task.status !== "done";
    if (activeStatus === "today") return task.dueDate <= todayIso() && task.status !== "done";
    // "updated" = tocadas por un empleado y aún sin revisar por el admin.
    if (activeStatus === "updated") return Boolean(task.employeeTouchedAt);
    // "mdtouched" = la IA (MD) complementó la tarea (mdTouchedAt) y falta que el admin la revise.
    if (activeStatus === "mdtouched") return Boolean(task.mdTouchedAt);
    return task.status === activeStatus;
  });

  const metrics = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "done");
    return {
      open: open.length,
      dueToday: open.filter((task) => task.dueDate <= todayIso()).length,
      blocked: open.filter((task) => task.status === "blocked").length,
      companies: companies.length,
      // Actualizadas por un empleado y aún sin revisar (employeeTouchedAt presente).
      updatedPending: tasks.filter((task) => task.employeeTouchedAt).length,
      // El empleado la envió a revisión: el admin debe aprobar / pedir cambios / devolver.
      reviewPending: open.filter((task) => task.status === "review").length,
    };
  }, [companies.length, tasks]);

  // Si aparece algo nuevo por atender (sube el total pendiente), reabre el aviso.
  const alertTotal = metrics.dueToday + metrics.blocked + metrics.updatedPending + metrics.reviewPending;
  const prevAlertTotal = useRef(alertTotal);
  useEffect(() => {
    if (alertTotal > prevAlertTotal.current) setAlertDismissed(false);
    prevAlertTotal.current = alertTotal;
  }, [alertTotal]);

  const processedAlerts = useMemo(() => {
    return [...sourceRecords]
      .sort((a, b) => new Date(b.processedAt || 0) - new Date(a.processedAt || 0))
      .slice(0, 5);
  }, [sourceRecords]);

  const tasksByRole = useMemo(() => {
    return ROLE_OPTIONS.map((role) => ({
      role,
      count: companyTasks.filter((task) => task.role === role && task.status !== "done").length,
    })).filter((item) => item.count > 0);
  }, [companyTasks]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    loadInsumos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCompany, loadedState]);

  async function analyzeInbox() {
    setIsAnalyzing(true);
    setNotice("");
    try {
      const extracted = localFallbackAnalyze(inboxText, activeCompany);
      mergeTasks(extracted);
      if (extracted.length) {
        mergeRecords([
          buildPastedRecord({
            text: inboxText,
            companyId: activeCompany,
            client: extracted[0]?.client || activeCompanyClients[0] || "Sin subproyecto",
            tasks: extracted,
          }),
        ]);
      }
      setNotice(`${extracted.length} tareas detectadas y agregadas al pipeline.`);
    } finally {
      setIsAnalyzing(false);
    }
  }

  function mergeTasks(incoming) {
    setTasks((current) => {
      const seen = new Set(current.map((task) => `${task.companyId}|${task.title.toLowerCase()}`));
      const unique = incoming.filter((task) => !seen.has(`${task.companyId}|${task.title.toLowerCase()}`));
      return [...unique, ...current];
    });
  }

  function mergeRecords(incoming) {
    setSourceRecords((current) => {
      const seen = new Set(current.map((record) => record.id));
      return [...incoming.filter((record) => !seen.has(record.id)), ...current];
    });
  }

  async function processInbox({ silentEmpty = false } = {}) {
    setNotice("");
    try {
      const pending = opsData.opsDataReady() ? await opsData.listInsumos(token, "") : [];
      const created = [];
      for (const insumo of pending.filter((item) => item.kind === "texto" && item.rawText)) {
        const extracted = localFallbackAnalyze(insumo.rawText, insumo.companyId);
        if (extracted.length) {
          mergeTasks(extracted);
          created.push(...extracted);
        }
        await opsData.deleteInsumo(token, insumo.id);
      }
      const pendingImages = pending.filter((item) => item.kind !== "texto").length;
      if (created.length) {
        setActiveView("tasks");
        setActiveStatus("open");
      }
      const pendingNote = pendingImages ? ` ${pendingImages} imagen(es) quedan para revisar (o córrelas con Claude Code: npm run daily:fetch).` : "";
      if (!silentEmpty || created.length || pendingImages) {
        setNotice(`${created.length} tareas creadas de insumos de texto.${pendingNote}`);
      }
      loadInsumos();
    } catch {
      setNotice("No pude procesar los insumos pendientes.");
    }
  }

  async function loadInsumos() {
    if (!opsData.opsDataReady()) { setInsumos([]); return; }
    try {
      // Muestra los insumos de la empresa activa Y los GLOBALES (companyId:"global",
      // subidos con "Subir insumo global"), para que no queden invisibles.
      const [own, global] = await Promise.all([
        opsData.listInsumos(token, activeCompany).catch(() => []),
        opsData.listInsumos(token, "global").catch(() => []),
      ]);
      const byId = new Map();
      [...global, ...own].forEach((i) => byId.set(i.id, i));
      setInsumos([...byId.values()]);
    } catch {
      setInsumos([]);
    }
  }

  async function removeInsumo(id) {
    try {
      await opsData.deleteInsumo(token, id);
    } catch {
      /* se refresca igual */
    }
    loadInsumos();
  }

  // Los insumos NO se convierten en tareas manualmente: solo el análisis del MD diario
  // (daily:fetch → Claude → daily:push) los interpreta. Aquí solo se descargan o borran.

  function updateTask(id, patch) {
    // Aviso instantáneo al RESPONSABLE cuando el admin le pide cambios (CR abierto). El responsable
    // no cambia con esta acción, así que el servidor lo resuelve bien aunque el guardado sea diferido.
    if (patch.changeRequest === true && patch.status === "doing" && Array.isArray(patch.changeRequests)) {
      notifyEvent(token, { type: "cr-opened", taskId: id });
    }
    setTasks((current) => current.map((task) => {
      if (task.id !== id) return task;
      const next = { ...task, ...patch };
      // Al TERMINAR (pasar a "done") se registra el momento y se calculan las horas
      // laborales cumplidas (8-17, 1h almuerzo, días hábiles, festivos CO) desde su creación.
      if (patch.status === "done" && task.status !== "done") {
        next.completedAt = new Date().toISOString();
        next.workedHours = businessHoursBetween(task.createdAt || next.completedAt, next.completedAt);
      }
      // Si se reabre, se limpian esos valores.
      if (patch.status && patch.status !== "done" && task.status === "done") {
        next.completedAt = "";
        next.workedHours = null;
      }
      // OJO: `prevDueDate` NO se sella aquí. Lo fija SOLO el popup de motivo (la primera vez que
      // se cambia una fecha ya guardada), para que los reajustes posteriores —mientras la tarjeta
      // sigue SIN guardar— no pisen la fecha original con un valor intermedio.
      // Sello de "el admin tocó esta tarea" → el empleado la verá "Actualizada" y le
      // sonará la campanita. Excepción: cambios de METADATA (puntos/tipo) NO son novedad para el
      // empleado (no los ve), así que no sellan adminTouchedAt.
      const keys = Object.keys(patch);
      const metaOnly = keys.length > 0 && keys.every((k) => k === "designPoints" || k === "category");
      if (!metaOnly) next.adminTouchedAt = new Date().toISOString();
      // "Actualizada por el empleado" (employeeTouchedAt) se limpia sola en cuanto el admin
      // ACCIONA sobre la tarea (cambia estado, categoría/tipo o pide un cambio); ya no hay
      // botón manual "marcar revisada": el estado de la tarea refleja lo que pasó.
      if (task.employeeTouchedAt && (patch.status || patch.category || patch.changeRequests)) {
        next.employeeTouchedAt = "";
      }
      return next;
    }));
  }

  // Guardado POR TAREA (botón "Guardar tarea"): persiste esa tarea de inmediato. Devuelve
  // una promesa para que la tarjeta muestre "Guardando…/Guardado ✓". El autosave sigue como
  // respaldo, pero este botón es el guardado visible y con control que pidieron.
  function saveTaskNow(id) {
    const task = tasks.find((t) => t.id === id);
    if (!task || !opsData.opsDataReady()) return Promise.resolve();
    return opsData.saveTask(token, task).catch((e) => {
      if (opsData.isAuthError(e)) onAuthError?.();
      throw e;
    });
  }

  function deleteTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
    setSourceRecords((current) => current.map((record) => ({
      ...record,
      taskIds: (record.taskIds || []).filter((taskId) => taskId !== id),
      taskCount: Math.max(0, (record.taskIds || []).filter((taskId) => taskId !== id).length),
    })));
    if (opsData.opsDataReady()) opsData.deleteTask(token, id).catch(() => {});
    setNotice("Tarea borrada.");
  }

  function deleteTaskAttachment(taskId, attachmentIndex) {
    setTasks((current) => current.map((task) => (
      task.id === taskId
        ? { ...task, attachments: (task.attachments || []).filter((_, index) => index !== attachmentIndex) }
        : task
    )));
    setNotice("Adjunto eliminado de la tarea.");
  }

  // Da/actualiza el acceso del empleado al portal (correo + contraseña) vía la función
  // serverless segura (usa service_role del lado servidor, no en el navegador).
  async function grantAccess(email, password, companyId = "", personId = "") {
    if (!email || !password) return;
    try {
      const res = await fetch("/api/employee", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email, password, companyId, personId }),
      });
      const data = await res.json().catch(() => ({}));
      setNotice(res.ok ? `Acceso ${data.created ? "creado" : "actualizado"} para ${email}.` : `No se pudo dar acceso: ${data.error || res.status}`);
    } catch {
      setNotice("No se pudo contactar el servicio de acceso.");
    }
  }

  function addPerson() {
    const name = newPerson.name.trim();
    if (!name) return;
    const email = newPerson.email.trim();
    const phone = newPerson.phone.trim();
    const password = (newPerson.password || "").trim();
    if (email && !EMAIL_PATTERN.test(email)) {
      setNotice("Revisa el correo de la persona antes de guardarla.");
      return;
    }
    if (!isValidPhone(phone)) {
      setNotice("Revisa el WhatsApp: incluye indicativo y al menos 8 digitos.");
      return;
    }
    if (password && !email) {
      setNotice("Para dar acceso con contraseña, la persona debe tener correo.");
      return;
    }
    if (password && password.length < 6) {
      setNotice("La contraseña de acceso debe tener al menos 6 caracteres.");
      return;
    }
    const personId = uid("person");
    const companyId = newPerson.companyId || "";
    if (password && email) grantAccess(email, password, companyId, personId);
    setPeople((current) => [
      ...current,
      {
        id: personId,
        name,
        email,
        phone,
        type: newPerson.type,
        chatUrl: newPerson.chatUrl.trim(),
        contactMethod: newPerson.contactMethod || "auto",
        // Empresa a la que pertenece. Vacío = equipo MediaLab (global, asignable en todas).
        companyId,
        companyIds: [],
      },
    ]);
    setNewPerson({ name: "", email: "", phone: "", type: "Empleado MediaLab", chatUrl: "", contactMethod: "auto", password: "", companyId: "" });
    const compName = companies.find((c) => c.id === companyId)?.name;
    setNotice(`Persona agregada: ${name}${compName ? ` · ${compName}` : " · equipo MediaLab"}.`);
  }

  function updatePerson(id, patch) {
    if (patch.email && !EMAIL_PATTERN.test(patch.email)) {
      setNotice("Correo inválido. Usa un formato como nombre@empresa.com.");
      return;
    }
    if (patch.phone && !isValidPhone(patch.phone)) {
      setNotice("WhatsApp inválido. Incluye indicativo y número completo.");
      return;
    }
    setPeople((current) => current.map((person) => (person.id === id ? { ...person, ...patch } : person)));
  }

  function deletePerson(id) {
    const person = people.find((item) => item.id === id);
    if (!window.confirm(`¿Eliminar a ${person?.name || "esta persona"}? Las tareas asignadas quedarán sin responsable.`)) return;
    setPeople((current) => current.filter((item) => item.id !== id));
    setTasks((current) => current.map((task) => (task.assigneeId === id ? { ...task, assigneeId: "", owner: "" } : task)));
    if (opsData.opsDataReady()) opsData.deletePersonRow(token, id).catch(() => {});
    setNotice("Persona eliminada.");
  }

  function createCompany() {
    const name = newCompanyName.trim();
    if (!name) return;
    const id = slugify(name);
    if (companies.some((item) => item.id === id)) {
      setActiveCompany(id);
      setNewCompanyName("");
      setNotice(`La empresa ${name} ya existe. La deje seleccionada.`);
      return;
    }

    const nextCompany = {
      id,
      name,
      status: "activa",
      owner: "MediaLab",
      workspaces: ["Documentacion"],
      clients: [],
      archivedClients: {},
      projectLinks: {},
      projectDescriptions: {},
      contextDocuments: {},
      logo: null,
      connectors: [],
    };
    setCompanies((current) => [...current, nextCompany]);
    setActiveCompany(id);
    setNewCompanyName("");
    setNotice("Empresa creada. Agrega el primer subproyecto real para subir documentacion.");
  }

  function addClient() {
    const name = newClientName.trim();
    if (!name || !company) return;
    setCompanies((current) => current.map((item) => {
      if (item.id !== company.id) return item;
      if (item.clients.includes(name)) return item;
      return {
        ...item,
        clients: [...item.clients, name],
        archivedClients: { ...(item.archivedClients || {}), [name]: false },
        projectLinks: {
          ...(item.projectLinks || {}),
          [name]: { tool: newClientTool, url: newClientBoardUrl.trim() },
        },
        projectDescriptions: {
          ...(item.projectDescriptions || {}),
          [name]: "",
        },
      };
    }));
    setNewClientName("");
    setNewClientTool("No aplica");
    setNewClientBoardUrl("");
    setNotice(`Subproyecto creado. Ya puedes subir documentacion en ${name}.`);
  }

  function setClientArchived(client, archived) {
    if (!company) return;
    setCompanies((current) => current.map((item) => (
      item.id === company.id
        ? { ...item, archivedClients: { ...(item.archivedClients || {}), [client]: archived } }
        : item
    )));
  }

  // Borrar un subproyecto por completo. Solo se permite en la bandeja temporal
  // "Por asignar": las empresas reales solo archivan, no borran (conservan histórico).
  function deleteClient(client) {
    if (!company || company.id !== "por-asignar") return;
    const projectTasks = (tasks || []).filter((t) => t.companyId === company.id && t.client === client);
    const drop = (obj) => {
      if (!obj || typeof obj !== "object" || !(client in obj)) return obj;
      const { [client]: _omit, ...rest } = obj;
      return rest;
    };
    setCompanies((current) => current.map((item) => {
      if (item.id !== company.id) return item;
      return {
        ...item,
        clients: (item.clients || []).filter((c) => c !== client),
        archivedClients: drop(item.archivedClients),
        projectLinks: drop(item.projectLinks),
        projectDescriptions: drop(item.projectDescriptions),
        projectImages: drop(item.projectImages),
        contextDocuments: drop(item.contextDocuments),
      };
    }));
    setTasks((current) => current.filter((t) => !(t.companyId === company.id && t.client === client)));
    if (opsData.opsDataReady()) {
      for (const t of projectTasks) opsData.deleteTask(token, t.id).catch(() => {});
      opsData.deleteProject(token, company.id, client).catch(() => {});
    }
    setNotice(`Subproyecto "${client}" borrado de la bandeja.`);
  }

  function updateProjectBoard(client, patch) {
    if (!company) return;
    setCompanies((current) => current.map((item) => {
      if (item.id !== company.id) return item;
      const currentBoard = getProjectBoardConfig(item, client);
      return {
        ...item,
        projectLinks: {
          ...(item.projectLinks || {}),
          [client]: { ...currentBoard, ...patch },
        },
      };
    }));
  }

  function updateProjectDescription(client, description) {
    if (!company) return;
    setCompanies((current) => current.map((item) => (
      item.id === company.id
        ? { ...item, projectDescriptions: { ...(item.projectDescriptions || {}), [client]: description } }
        : item
    )));
  }

  // Corregir el nombre de la empresa (el id no cambia; solo el nombre visible).
  function renameCompany(newName) {
    const clean = (newName || "").trim();
    if (!clean || !company || clean === company.name) return;
    setCompanies((current) => current.map((item) => (item.id === company.id ? { ...item, name: clean } : item)));
    setNotice(`Empresa renombrada a "${clean}".`);
  }

  // Corregir el nombre de un subproyecto y propagarlo a tareas y datos asociados.
  function renameClient(oldName, newName) {
    const clean = (newName || "").trim();
    if (!clean || !company || clean === oldName) return;
    if ((company.clients || []).includes(clean)) { setNotice("Ya existe un subproyecto con ese nombre."); return; }
    const swap = (obj) => {
      if (!obj || typeof obj !== "object" || !(oldName in obj)) return obj;
      const { [oldName]: val, ...rest } = obj;
      return { ...rest, [clean]: val };
    };
    setCompanies((current) => current.map((item) => {
      if (item.id !== company.id) return item;
      return {
        ...item,
        clients: (item.clients || []).map((c) => (c === oldName ? clean : c)),
        archivedClients: swap(item.archivedClients),
        projectLinks: swap(item.projectLinks),
        projectDescriptions: swap(item.projectDescriptions),
        projectImages: swap(item.projectImages),
        contextDocuments: swap(item.contextDocuments),
      };
    }));
    setTasks((current) => current.map((t) => (t.companyId === company.id && t.client === oldName ? { ...t, client: clean } : t)));
    if (opsData.opsDataReady()) opsData.deleteProject(token, company.id, oldName).catch(() => {});
    setNotice(`Subproyecto renombrado a "${clean}".`);
  }

  // Alcance del contrato por empresa: alterna una categoría de trabajo.
  function toggleCompanyScope(category) {
    if (!company) return;
    setCompanies((current) => current.map((item) => {
      if (item.id !== company.id) return item;
      const set = new Set(item.scope || []);
      if (set.has(category)) set.delete(category); else set.add(category);
      return { ...item, scope: [...set] };
    }));
  }

  async function uploadTaskAttachment(taskId, file) {
    if (!file || !company) return;
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (!opsData.opsDataReady()) { setNotice("Configura Supabase para subir adjuntos."); return; }
    try {
      const attachment = await opsData.saveTaskAttachment(token, { companyId: task.companyId, client: task.client, file });
      updateTask(taskId, { attachments: [...(task.attachments || []), attachment] });
      setNotice(`Adjunto agregado: ${attachment.label}`);
    } catch (error) {
      setNotice(`No pude subir el adjunto. ${error.message || "Revisa permisos/políticas de Storage."}`);
    }
  }

  async function uploadSourceDocument(client, file) {
    if (!file || !company) return;
    const isText = /\.(md|txt)$/i.test(file.name);
    const isPdf = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
    const isImage = isTaskImageFile(file);
    if (!isText && !isImage && !isPdf) {
      setNotice("Sube insumos como .md, .txt, .pdf o imagen.");
      return;
    }
    if (!opsData.opsDataReady()) { setNotice("Configura Supabase para subir insumos."); return; }
    try {
      // PDF: se sube TAL CUAL (sin comprimir) como insumo pendiente; el run diario lo descarga
      // y Claude lo lee página por página.
      if (isPdf) {
        if (file.size > MAX_PDF_INSUMO_BYTES) {
          setNotice(`El PDF pesa ${formatFileSize(file.size)}. Debe quedar por debajo de 8 MB.`);
          return;
        }
        await opsData.saveInsumo(token, { companyId: company.id, client, file, kind: "pdf" });
        setNotice(`Insumo (PDF) guardado para ${client || "toda la empresa"}. Se convierte en tareas cuando corra el MD diario.`);
        loadInsumos();
        return;
      }
      if (isText) {
        // El texto NO se convierte en tareas al instante: queda como insumo pendiente
        // (con su contenido en raw_text) y la corrida diaria del MD lo interpreta.
        const text = await file.text();
        await opsData.saveInsumo(token, { companyId: company.id, client, file, kind: "texto", rawText: text });
        setNotice(`Insumo (texto) guardado para ${client || "toda la empresa"}. Se convierte en tareas cuando corra el MD diario.`);
        loadInsumos();
        return;
      }
      // Imagen: se guarda como insumo pendiente (Claude Code la analiza en el run diario).
      const prepared = await prepareTaskUploadFile(file);
      if (prepared.size > MAX_TASK_UPLOAD_BYTES) {
        setNotice(`La imagen pesa ${formatFileSize(prepared.size)}. Debe quedar por debajo de 1 MB.`);
        return;
      }
      const named = prepared instanceof File ? prepared : new File([prepared], file.name, { type: prepared.type || file.type });
      await opsData.saveInsumo(token, { companyId: company.id, client, file: named, kind: "imagen" });
      setNotice(`Insumo (imagen) guardado para ${client || "toda la empresa"}. Queda en "Insumos pendientes".`);
      loadInsumos();
    } catch (error) {
      setNotice(`No pude subir el insumo. ${error.message || "Revisa políticas de Storage."}`);
    }
  }

  // Insumo GLOBAL: el CEO escribe todo de corrido (o sube una imagen) sin elegir proyecto.
  // Se guarda con companyId:"global"; el MD diario lo reparte entre los proyectos y, si no
  // existe el proyecto mencionado, lo deja pendiente hasta que exista.
  async function uploadGlobalInsumo({ text, file }) {
    if (!opsData.opsDataReady()) { setNotice("Configura Supabase para subir insumos."); return; }
    try {
      if (file) {
        const isTextFile = /\.(md|txt)$/i.test(file.name);
        const isPdfFile = /\.pdf$/i.test(file.name) || file.type === "application/pdf";
        if (isTextFile) {
          const content = await file.text();
          await opsData.saveInsumo(token, { companyId: "global", client: "", file, kind: "texto", rawText: content });
        } else if (isPdfFile) {
          // PDF tal cual: el run diario lo descarga y Claude lo lee página por página.
          if (file.size > MAX_PDF_INSUMO_BYTES) { setNotice(`El PDF pesa ${formatFileSize(file.size)}. Debe ser menor a 8 MB.`); return; }
          await opsData.saveInsumo(token, { companyId: "global", client: "", file, kind: "pdf" });
        } else if (isTaskImageFile(file)) {
          const prepared = await prepareTaskUploadFile(file);
          if (prepared.size > MAX_TASK_UPLOAD_BYTES) { setNotice(`La imagen pesa ${formatFileSize(prepared.size)}. Debe ser menor a 1 MB.`); return; }
          const named = prepared instanceof File ? prepared : new File([prepared], file.name, { type: prepared.type || file.type });
          await opsData.saveInsumo(token, { companyId: "global", client: "", file: named, kind: "imagen" });
        } else {
          setNotice("El archivo debe ser .txt, .md, .pdf o una imagen (jpg, png, webp…).");
          return;
        }
      } else {
        const clean = (text || "").trim();
        if (!clean) { setNotice("Escribe algo antes de subir el insumo global."); return; }
        const named = new File([clean], `global-${Date.now()}.txt`, { type: "text/plain" });
        await opsData.saveInsumo(token, { companyId: "global", client: "", file: named, kind: "texto", rawText: clean });
      }
      setNotice("Insumo global guardado. El MD diario lo repartirá entre los proyectos.");
      loadInsumos();
    } catch (error) {
      setNotice(`No pude subir el insumo global. ${error.message || "Revisa políticas de Storage."}`);
    }
  }

  async function uploadCompanyLogo(file) {
    if (!file || !company) return;
    if (!opsData.opsDataReady()) { setNotice("Configura Supabase para subir el logo."); return; }
    try {
      const logo = await opsData.saveCompanyLogo(token, { companyId: company.id, file });
      setCompanies((current) => current.map((item) => item.id === company.id ? { ...item, logo } : item));
      setNotice(`Logo actualizado: ${logo.label}`);
    } catch (error) {
      setNotice(`No pude subir el logo. ${error.message || ""}`);
    }
  }

  // Fondo del logo de la empresa: el usuario elige negro o blanco (se guarda en logo.bg).
  function toggleLogoBg() {
    if (!company) return;
    setCompanies((current) => current.map((item) => (
      item.id === company.id
        ? { ...item, logo: { ...(item.logo || {}), bg: (item.logo?.bg === "white" ? "black" : "white") } }
        : item
    )));
  }

  // Fondo de la imagen de un subproyecto (se guarda en projectImages[client].bg).
  function toggleProjectImageBg(client) {
    if (!company) return;
    setCompanies((current) => current.map((item) => {
      if (item.id !== company.id) return item;
      const cur = item.projectImages?.[client] || {};
      return { ...item, projectImages: { ...(item.projectImages || {}), [client]: { ...cur, bg: cur.bg === "white" ? "black" : "white" } } };
    }));
  }

  async function uploadProjectImage(client, file) {
    if (!file || !company) return;
    if (!isTaskImageFile(file)) { setNotice("La imagen del subproyecto debe ser una imagen (jpg, png, webp…)."); return; }
    if (!opsData.opsDataReady()) { setNotice("Configura Supabase para subir la imagen."); return; }
    try {
      const image = await opsData.saveProjectImage(token, { companyId: company.id, client, file });
      setCompanies((current) => current.map((item) => (
        item.id === company.id
          ? { ...item, projectImages: { ...(item.projectImages || {}), [client]: image } }
          : item
      )));
      setNotice(`Imagen actualizada para ${client || "toda la empresa"}.`);
    } catch (error) {
      setNotice(`No pude subir la imagen. ${error.message || "Revisa políticas de Storage."}`);
    }
  }

  async function uploadContextDocument(client, file) {
    if (!file || !company) return;
    if (!opsData.opsDataReady()) { setNotice("Configura Supabase para subir documentos."); return; }
    try {
      const document = await opsData.saveContextDocument(token, { companyId: company.id, client, file });
      const key = client || "_empresa";
      setCompanies((current) => current.map((item) => (
        item.id === company.id
          ? {
              ...item,
              contextDocuments: {
                ...(item.contextDocuments || {}),
                [key]: [...(item.contextDocuments?.[key] || []), document],
              },
            }
          : item
      )));
      setNotice(`Documento de contexto agregado: ${document.label}`);
      readContextDocuments(client);
    } catch (error) {
      setNotice(`No pude subir el documento de contexto. ${error.message || ""}`);
    }
  }

  async function readContextDocuments(client = "") {
    if (!company) return;
    const key = `${company.id}:${client || "_empresa"}`;
    const docs = company.contextDocuments?.[client || "_empresa"] || [];
    try {
      const readable = [];
      for (const doc of docs) {
        if (doc.readable && doc.url) {
          try {
            const res = await fetch(doc.url);
            const text = res.ok ? await res.text() : "";
            readable.push({ label: doc.label, path: doc.path, text: text.slice(0, 4000) });
          } catch {
            /* ignora un documento que no se pudo leer */
          }
        }
      }
      setContextPreview((current) => ({ ...current, [key]: readable }));
      setNotice(`Contexto leído: ${readable.length} documento(s).`);
    } catch {
      setNotice("No pude leer el contexto.");
    }
  }

  function addManualTask() {
    const nextTask = {
      id: uid(),
      title: "Nueva tarea",
      companyId: activeCompany,
      client: activeCompanyClients[0] || "Sin subproyecto",
      role: "Project Manager",
      owner: "",
      priority: "media",
      status: "ready",
      dueDate: addDays(2),
      // Tarea RECIÉN creada, aún sin guardar: la fecha por defecto no es un compromiso todavía,
      // así que cambiarla no pide motivo hasta el primer "Guardar tarea". No se persiste (taskToRow
      // no lo mapea).
      _unsaved: true,
      deliveryDate: "",
      source: "Manual",
      audience: "Interno MediaLab",
      syncMode: "Manual",
      evidence: "",
      createdAt: new Date().toISOString(),
    };
    setTasks((current) => [
      nextTask,
      ...current,
    ]);
    setActiveView("tasks");
    setActiveStatus("open");
    setAssignFilter("all");
    setHighlightTaskId(nextTask.id);
    setNotice("Tarea creada. Aparece arriba y abierta para que la completes.");
  }

  // Crea una tarea ya asignada a un subproyecto concreto (botón dentro de cada subproyecto).
  function addTaskForClient(client) {
    const target = client || activeCompanyClients[0] || "Sin subproyecto";
    const nextTask = {
      id: uid(),
      title: "Nueva tarea",
      companyId: activeCompany,
      client: target,
      role: "Project Manager",
      owner: "",
      priority: "media",
      status: "ready",
      dueDate: addDays(2),
      _unsaved: true, // ver addManualTask: sin compromiso de fecha hasta el primer guardado
      deliveryDate: "",
      source: "Manual",
      audience: "Interno MediaLab",
      syncMode: "Manual",
      evidence: "",
      createdAt: new Date().toISOString(),
    };
    setTasks((current) => [nextTask, ...current]);
    setHighlightTaskId(nextTask.id);
    setNotice(`Tarea creada en ${target}. Aparece arriba y abierta para completarla.`);
  }

  // Convierte una BUENA PRÁCTICA de crecimiento en una tarea del subproyecto (hereda tipo/puntos).
  function convertPracticeToTask(p) {
    const puntos = p.esfuerzo === "alto" ? 4 : p.esfuerzo === "bajo" ? 1 : 2;
    const nextTask = {
      id: uid(), title: p.titulo, companyId: p.companyId,
      client: p.client || activeCompanyClients[0] || "Sin subproyecto",
      role: "Product", owner: "", priority: p.impacto === "alto" ? "alta" : "media", status: "ready",
      dueDate: "", _unsaved: true, deliveryDate: "", source: "Práctica de crecimiento",
      audience: "Interno MediaLab", syncMode: "Manual", evidence: "", category: "Producto", designPoints: puntos,
      description: `${p.porque ? p.porque + "\n\n" : ""}Cómo: ${p.como || ""}${p.marco ? `\n\nMarco: ${p.marco}` : ""}`.trim(),
      createdAt: new Date().toISOString(),
    };
    setTasks((current) => [nextTask, ...current]);
    setHighlightTaskId(nextTask.id);
    setGrowthPractices((cur) => cur.filter((x) => x.id !== p.id));
    if (opsData.opsDataReady()) opsData.updateGrowthPractice(token, p.id, { status: "convertida" }).catch(() => {});
    setNotice(`"${p.titulo}" convertida en tarea.`);
  }
  function dismissPractice(id) {
    setGrowthPractices((cur) => cur.filter((x) => x.id !== id));
    if (opsData.opsDataReady()) opsData.updateGrowthPractice(token, id, { status: "descartada" }).catch(() => {});
  }

  function dailyBrief() {
    const rows = companyTasks
      .filter((task) => task.status !== "done")
      .sort((a, b) => `${a.dueDate}${a.title}`.localeCompare(`${b.dueDate}${b.title}`))
      .map((task) => `- ${task.title} | ${task.client} | ${task.role}${task.owner ? ` (${task.owner})` : ""} | ${task.audience || "Interno MediaLab"} | ${task.syncMode || "Manual"} | herramienta: ${boardLabel(company, task.client)} | publicada: ${displayDate(task.createdAt)} | vence: ${displayDate(task.dueDate)}${task.deliveryDate ? ` | entrega: ${task.deliveryDate}` : ""} | estado: ${STATUS[task.status]}`)
      .join("\n");

    return `# Brief operativo - ${company?.name} - ${todayIso()}

## Foco del dia
${rows || "- No hay tareas abiertas para esta empresa."}

## Bloqueos
${companyTasks.filter((task) => task.status === "blocked").map((task) => `- ${task.title}`).join("\n") || "- Sin bloqueos registrados."}

## Fuentes conectadas
${company?.connectors?.map((connector) => `- ${connector.name}: ${connector.state}`).join("\n") || "- Sin fuentes configuradas."}
`;
  }

  async function copyBrief() {
    await navigator.clipboard.writeText(dailyBrief());
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div data-ops-theme={theme} className="min-h-screen bg-[#F7F4EF] text-[#202124]" style={{ fontFamily: "'Lato', 'Segoe UI', system-ui, sans-serif" }}>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
        {/* El header de marca (logo + nav) lo pone el shell (main.jsx); aquí solo el título de la
            vista + el estado de guardado, para no duplicar el encabezado. */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#667085]">Centro operativo</p>
            <h1 className="text-lg font-semibold leading-tight text-[#1D2939] sm:text-xl">Pipeline de proyectos MediaLab</h1>
          </div>
          <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <button
              type="button"
              onClick={() => setGlobalOpen((v) => !v)}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md bg-[#E8751A] px-3 py-2 text-sm font-semibold text-white sm:w-auto"
              title="Escribe todo de corrido; el MD lo reparte entre los proyectos"
            >
              <Plus size={16} /> Subir insumo global
            </button>
            {saveStatus && <p className="text-xs" style={{ color: "#B54708" }}>{saveStatus}</p>}
          </div>
        </div>

        {/* Insumo global: capturar rápido sin elegir proyecto. */}
        {globalOpen && (
          <div className="mb-4 rounded-md border border-[#F2C879] bg-[#FFF7E6] p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-[#8A5700]">Subir insumo global</h2>
                <p className="mt-0.5 text-xs text-[#8b8272]">Escribe todo de corrido (menciona el proyecto si puedes). El MD diario lo reparte entre los proyectos; lo que no tenga proyecto queda pendiente hasta que exista.</p>
              </div>
              <button type="button" onClick={() => setGlobalOpen(false)} className="rounded-md border border-[#D0D5DD] bg-white px-2 py-1 text-xs font-semibold text-[#344054]">Cerrar</button>
            </div>
            <textarea
              value={globalText}
              onChange={(event) => setGlobalText(event.target.value)}
              rows={5}
              placeholder="Ej.: Para Corvus hay que ajustar el onboarding y entregar el viernes. En Phoenix falta el tablero de métricas. Nuevo proyecto Delta: definir alcance…"
              className="mt-3 w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={async () => { await uploadGlobalInsumo({ text: globalText }); setGlobalText(""); }}
                className="inline-flex min-h-[40px] items-center gap-1.5 rounded-md bg-[#17727A] px-3 py-1.5 text-sm font-semibold text-white"
              >
                <Send size={15} /> Guardar texto
              </button>
              <label className="inline-flex min-h-[40px] cursor-pointer items-center gap-1.5 rounded-md border border-[#D0D5DD] bg-white px-3 py-1.5 text-sm font-semibold text-[#344054]">
                <Paperclip size={15} /> Adjuntar archivo
                <input
                  type="file"
                  accept=".md,.txt,.pdf,image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) uploadGlobalInsumo({ file });
                    event.target.value = "";
                  }}
                />
              </label>
              <span className="w-full text-xs text-[#8b8272] sm:w-auto">Escribe en el cuadro o adjunta un archivo. Queda en “Insumos pendientes” hasta la corrida del MD.</span>
            </div>
          </div>
        )}

        {/* A-3 / WCAG 4.1.3 — region viva: anuncia a lectores de pantalla el
            resultado de procesar insumos sin que el usuario tenga que buscarlo. */}
        <div role="status" aria-live="polite">
          {notice && (
            <div className="mb-4 rounded-md border border-[#B7D8D4] bg-[#EAF4F2] px-4 py-3 text-sm font-semibold text-[#17727A] shadow-sm">
              {notice}
            </div>
          )}
        </div>

        {(metrics.dueToday > 0 || metrics.blocked > 0 || metrics.updatedPending > 0 || metrics.reviewPending > 0) && !alertDismissed && (
          <div className="relative mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border-l-4 border-[#E8751A] bg-[#FFF7E6] px-4 py-3 pr-10 text-sm">
            <span className="font-semibold uppercase tracking-[0.08em] text-[#B76E00]">Requiere tu atención hoy</span>
            {metrics.reviewPending > 0 && (
              <button type="button" onClick={() => { setActiveView("tasks"); setActiveStatus("review"); setCompanyFilter("all"); setAssignFilter("all"); setTaskQuery(""); }}
                className="inline-flex items-center gap-1 font-semibold text-[#17727A] underline-offset-2 hover:underline" title="Ver las tareas en revisión (por aprobar)">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#17727A" }} />
                {metrics.reviewPending} por aprobar (revisión)
              </button>
            )}
            {metrics.updatedPending > 0 && (
              <button type="button" onClick={() => { setActiveView("tasks"); setActiveStatus("updated"); setCompanyFilter("all"); setAssignFilter("all"); setTaskQuery(""); }}
                className="inline-flex items-center gap-1 font-semibold text-[#6D28D9] underline-offset-2 hover:underline" title="Ver las tareas actualizadas por revisar">
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#6D28D9" }} />
                {metrics.updatedPending} actualizada(s) por revisar
              </button>
            )}
            {metrics.dueToday > 0 && (
              <button type="button" onClick={() => { setActiveView("tasks"); setActiveStatus("today"); setCompanyFilter("all"); setAssignFilter("all"); setTaskQuery(""); }}
                className="font-semibold text-[#8A5700] underline-offset-2 hover:underline" title="Ver las tareas que vencen hoy">{metrics.dueToday} vence(n) hoy</button>
            )}
            {metrics.blocked > 0 && (
              <button type="button" onClick={() => { setActiveView("tasks"); setActiveStatus("blocked"); setCompanyFilter("all"); setAssignFilter("all"); setTaskQuery(""); }}
                className="font-semibold text-[#B42318] underline-offset-2 hover:underline" title="Ver las tareas bloqueadas">{metrics.blocked} con bloqueo</button>
            )}
            <button type="button" onClick={() => setAlertDismissed(true)} title="Cerrar (ya lo vi)" aria-label="Cerrar aviso" className="absolute right-1.5 top-1.5 inline-flex h-6 w-6 items-center justify-center rounded-md text-[#B76E00] hover:bg-[#F2C879]/40">
              <X size={14} />
            </button>
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-6">
          <Metric label="Tareas abiertas" value={metrics.open} tone="#17727A" icon={ListChecks} />
          <button type="button" onClick={() => { setActiveView("tasks"); setActiveStatus("review"); setCompanyFilter("all"); setAssignFilter("all"); setTaskQuery(""); }} className="text-left" title="Ver las tareas en revisión (por aprobar / pedir cambios)">
            <Metric label="Por aprobar (revisión)" value={metrics.reviewPending} tone="#17727A" icon={Clock} />
          </button>
          <button type="button" onClick={() => { setActiveView("tasks"); setActiveStatus("updated"); setCompanyFilter("all"); setAssignFilter("all"); setTaskQuery(""); }} className="text-left" title="Ver las tareas actualizadas por revisar">
            <Metric label="Actualizadas por revisar" value={metrics.updatedPending} tone="#6D28D9" icon={MessageCircle} />
          </button>
          <Metric label="Vencen hoy" value={metrics.dueToday} tone="#B76E00" icon={CalendarDays} />
          <Metric label="Bloqueos" value={metrics.blocked} tone="#B42318" icon={AlertTriangle} />
          <Metric label="Empresas" value={metrics.companies} tone="#344054" icon={Building2} />
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto border-b border-[#D9D2C7]">
          {[
            ["companies", "Empresas"],
            ["tasks", "Todas las tareas"],
            ["priority", "Prioridad"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setActiveView(key)}
              className="shrink-0 border-b-2 px-3 py-2 text-sm font-semibold"
              style={{
                borderColor: activeView === key ? "#17727A" : "transparent",
                color: activeView === key ? "#17727A" : "#667085",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {activeView === "companies" && insumos.length > 0 && (
          <section className="mt-6 rounded-md border border-[#F2C879] bg-[#FFF7E6] p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-[#8A5700]">Insumos pendientes de revisar ({insumos.length})</h2>
            <p className="mt-1 text-xs text-[#8b8272]">Imágenes y textos que subiste durante el día. El análisis del MD diario los convierte en tareas; aquí solo puedes descargarlos o borrarlos.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {insumos.map((insumo) => (
                <li key={insumo.id} className="flex min-w-0 items-center gap-3 rounded-md border border-[#E4DED6] bg-white p-2">
                  {insumo.url && /imagen|image/i.test(`${insumo.kind} ${insumo.contentType}`) ? (
                    <img src={insumo.url} alt={insumo.fileName} className="h-12 w-12 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[#F2F4F7] text-[#667085]"><Paperclip size={16} /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#344054]">{insumo.fileName}</p>
                    <p className="flex min-w-0 items-center gap-1 text-xs text-[#8b8272]">
                      {insumo.companyId === "global"
                        ? <span className="shrink-0 rounded-full bg-[#E8751A] px-1.5 py-0.5 text-[10px] font-bold text-white">GLOBAL</span>
                        : <span className="truncate">{insumo.client || "Sin subproyecto"}</span>}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {insumo.url && (
                      <a href={insumo.url} download target="_blank" rel="noopener noreferrer" title="Descargar" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]"><Download size={14} /></a>
                    )}
                    <button type="button" onClick={() => removeInsumo(insumo.id)} title="Borrar insumo" className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#D0D5DD] text-[#B42318]"><Trash2 size={14} /></button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {activeView === "companies" && (
          <section className="mt-6">
            <div>
            {!asideOpen && (
            <div className="min-w-0">
            {/* Carrusel de empresas (tarjetas cuadradas). Naranja = seleccionada. */}
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start">
              <div className="flex flex-1 gap-2 overflow-x-auto pb-1">
                {companies.filter((c) => c.status !== "inactiva").map((c) => {
                  const on = c.id === activeCompany;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setActiveCompany(c.id)}
                      className="flex w-20 shrink-0 flex-col items-center gap-1 rounded-md p-2 text-center"
                      style={{ border: `${on ? 2 : 1}px solid ${on ? "#E8751A" : "#E4DED6"}`, background: "#fff" }}
                    >
                      {c.logo?.url
                        ? <img src={c.logo.url} alt="" className="h-9 w-9 rounded object-contain" style={{ background: c.logo?.bg === "white" ? "#fff" : "#000" }} />
                        : <span className="flex h-9 w-9 items-center justify-center rounded text-xs font-bold" style={{ background: on ? "#E8751A" : "#000", color: "#fff" }}>{projectInitials(c.name)}</span>}
                      <span className="w-full truncate text-[10px] font-semibold" style={{ color: on ? "#E8751A" : "#667085" }}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
              {!asideOpen && (
                <button
                  type="button"
                  onClick={() => setAsideOpen(true)}
                  className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold text-[#344054] sm:w-auto"
                >
                  Empresas y personas <ChevronRight size={16} />
                </button>
              )}
            </div>

            <CompanyPanel
              company={company}
              companies={companies}
              highlightId={highlightTaskId}
              tasks={tasks}
              people={people}
              growthPractices={growthPractices}
              onConvertPractice={convertPracticeToTask}
              onDismissPractice={dismissPractice}
              leads={leads}
              onAssignLead={assignLead}
              onRemoveLead={removeLeadFn}
              newClientName={newClientName}
              newClientTool={newClientTool}
              newClientBoardUrl={newClientBoardUrl}
              sourceRecords={sourceRecords}
              onNewClientName={setNewClientName}
              onNewClientTool={setNewClientTool}
              onNewClientBoardUrl={setNewClientBoardUrl}
              onAddClient={addClient}
              onUpdateProjectBoard={updateProjectBoard}
              onUpdateProjectDescription={updateProjectDescription}
            onChangeTask={updateTask}
            onDeleteTask={deleteTask}
            onSaveTask={saveTaskNow}
            onUploadLogo={uploadCompanyLogo}
            onToggleLogoBg={toggleLogoBg}
            onToggleProjectImageBg={toggleProjectImageBg}
            onUploadProjectImage={uploadProjectImage}
            onRenameCompany={renameCompany}
            onRenameClient={renameClient}
            onToggleScope={toggleCompanyScope}
            onAddTaskToClient={addTaskForClient}
            onUploadSourceDocument={uploadSourceDocument}
            onUploadTaskAttachment={uploadTaskAttachment}
            onDeleteTaskAttachment={deleteTaskAttachment}
              onUploadContextDocument={uploadContextDocument}
              onReadContextDocuments={readContextDocuments}
              contextPreview={contextPreview}
              onArchiveClient={(client) => setClientArchived(client, true)}
              onRestoreClient={(client) => setClientArchived(client, false)}
              onDeleteClient={deleteClient}
              onToggleStatus={() => {
                setCompanies((current) => current.map((item) => (
                  item.id === company.id
                    ? { ...item, status: item.status === "inactiva" ? "activa" : "inactiva" }
                    : item
                )));
              }}
            />
            </div>
            )}

            {asideOpen && (
              <aside className="mx-auto max-w-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-[#667085]">Empresas y personas</h2>
                  <button
                    type="button"
                    onClick={() => setAsideOpen(false)}
                    title="Ocultar"
                    className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-[#D0D5DD] bg-white px-2 text-xs font-semibold text-[#344054]"
                  >
                    Ocultar <ChevronRight size={14} />
                  </button>
                </div>
                {/* Tabs para alternar entre empresas y personas (antes se apilaban las dos). */}
                <div className="flex gap-1 rounded-md border border-[#E4DED6] bg-[#F9FAFB] p-1">
                  {[["empresas", "Empresas", Building2], ["personas", "Personas", UserRound]].map(([id, label, Icon]) => (
                    <button key={id} type="button" onClick={() => setAsideTab(id)}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-1.5 text-sm font-semibold"
                      style={asideTab === id ? { background: "#17727A", color: "#fff" } : { background: "transparent", color: "#667085" }}>
                      <Icon size={15} /> {label}
                    </button>
                  ))}
                </div>
                {asideTab === "empresas" && (<>
                <div className="rounded-md border border-[#E4DED6] bg-white p-3 shadow-sm">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Nueva empresa</span>
                    <input
                      value={newCompanyName}
                      onChange={(event) => setNewCompanyName(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && createCompany()}
                      placeholder="Ej: Metrics Lab"
                      className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
                    />
                  </label>
                  <button onClick={createCompany} className="mt-2 w-full rounded-md bg-[#17727A] px-3 py-2 text-sm font-semibold text-white">
                    Crear empresa
                  </button>
                </div>
                {/* Activas primero, inactivas después (atenuadas). */}
                {[...companies].sort((a, b) => (a.status === "inactiva" ? 1 : 0) - (b.status === "inactiva" ? 1 : 0)).map((item) => {
                  const inactiva = item.status === "inactiva";
                  return (
                  <button
                    key={item.id}
                    onClick={() => setActiveCompany(item.id)}
                    className="w-full rounded-md border bg-white p-4 text-left shadow-sm"
                    style={{ borderColor: item.id === activeCompany ? "#17727A" : "#E4DED6", opacity: inactiva ? 0.6 : 1 }}
                  >
                    <div className="flex items-start gap-3">
                      {item.logo?.url ? (
                        <img src={item.logo.url} alt={item.name} className="h-9 w-9 shrink-0 rounded-md border border-[#E4DED6] object-contain" style={{ background: item.logo?.bg === "white" ? "#fff" : "#000" }} />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-[#C8BFB3] text-xs font-semibold text-[#8b8272]">
                          {item.name?.[0]?.toUpperCase() || "?"}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#1D2939]">{item.name}</p>
                        <p className="mt-1 truncate text-xs text-[#667085]">{item.workspaces.join(" + ")}</p>
                      </div>
                      <span className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold" style={inactiva ? { background: "#F2F4F7", color: "#667085" } : { background: "#EAF4F2", color: "#17727A" }}>{item.status}</span>
                    </div>
                  </button>
                  );
                })}
                </>)}
                {asideTab === "personas" && (
                <PeoplePanel
                  companies={companies}
                  people={people}
                  newPerson={newPerson}
                  onNewPerson={setNewPerson}
                  onAddPerson={addPerson}
                  onUpdatePerson={updatePerson}
                  onDeletePerson={deletePerson}
                  onGrantAccess={grantAccess}
                />
                )}
              </aside>
            )}
            </div>
          </section>
        )}

        {activeView === "tasks" && (
          <TasksTable
            tasks={visibleTasks}
            companies={companies}
            people={people}
            activeStatus={activeStatus}
            onStatus={setActiveStatus}
            assignFilter={assignFilter}
            onAssignFilter={setAssignFilter}
            ownerFilter={ownerFilter}
            onOwnerFilter={setOwnerFilter}
            sortRecent={sortRecent}
            onSortRecent={setSortRecent}
            companyFilter={companyFilter}
            onCompanyFilter={setCompanyFilter}
            taskQuery={taskQuery}
            onTaskQuery={setTaskQuery}
            highlightId={highlightTaskId}
            onAddTask={addManualTask}
            onChangeTask={updateTask}
            onDeleteTask={deleteTask}
            onSaveTask={saveTaskNow}
            onUploadAttachment={uploadTaskAttachment}
            onDeleteAttachment={deleteTaskAttachment}
          />
        )}

        {activeView === "priority" && (
          <PriorityView
            tasks={tasks}
            companies={companies}
            people={people}
            onChangeStatus={(id, status) => {
              // Finalizar desde prioridad abre el popup de satisfacción (igual que en la tarjeta),
              // no cierra en silencio.
              if (status === "done") { const t = tasks.find((x) => x.id === id); if (t && t.status !== "done") { setFinalizeTask(t); return; } }
              updateTask(id, { status });
            }}
            onOpenTask={(t) => {
              setCompanyFilter("all");
              setAssignFilter("all");
              setActiveStatus("open");
              setTaskQuery("");
              setHighlightTaskId(t.id);
              setActiveView("tasks");
            }}
          />
        )}
      </main>
      {/* Popup de satisfacción al finalizar desde la vista de PRIORIDAD (la tarjeta usa el suyo). */}
      {finalizeTask && (
        <DoneFeedbackModal
          task={finalizeTask}
          onSave={(patch) => { updateTask(finalizeTask.id, { status: "done", ...patch }); setFinalizeTask(null); }}
          onDirect={() => { updateTask(finalizeTask.id, { status: "done" }); setFinalizeTask(null); }}
          onClose={() => setFinalizeTask(null)}
        />
      )}
    </div>
  );
}

// Priorizacion de TODAS las tareas segun los marcos del daily-run (Pareto 80/20,
// Theory of Constraints, Covey/Eisenhower, 12-Week-Year). Puntaje 0-100 por tarea:
// importancia (prioridad) + urgencia (fecha) + destrabar cuello de botella (bloqueada).
function scoreTask(task) {
  let score = 0;
  const reasons = [];
  // Importancia (Covey/Drucker): la prioridad marcada.
  const imp = task.priority === "alta" ? 40 : task.priority === "baja" ? 8 : 20;
  score += imp;
  if (task.priority === "alta") reasons.push("Prioridad alta");
  // Urgencia (fecha): vencida > hoy/pronto > esta semana.
  const today = todayIso();
  if (task.dueDate) {
    if (task.status !== "review" && task.status !== "verificacion" && task.status !== "notificado" && task.dueDate < today) { score += 35; reasons.push("Vencida"); }
    else {
      const days = Math.round((new Date(task.dueDate) - new Date(today)) / 86400000);
      if (days <= 2) { score += 25; reasons.push("Vence pronto"); }
      else if (days <= 7) { score += 15; reasons.push("Esta semana"); }
      else score += 5;
    }
  } else {
    score += 6;
  }
  // Cuello de botella (Goldratt): las bloqueadas frenan al resto → destrabar primero.
  if (task.status === "blocked") { score += 25; reasons.push("Cuello de botella"); }
  // En proceso avanzado tiene un pequeno empuje para cerrarlo (Gap and Gain).
  if (task.status === "doing") { score += 6; reasons.push("En proceso"); }
  return { score: Math.min(100, score), reasons };
}

// Candidatos de prefijo para una empresa, en orden de preferencia (2-3 letras).
function prefixCandidates(name) {
  const clean = String(name || "XX").toUpperCase().replace(/[^A-Z0-9 ]/g, "");
  const words = clean.split(/\s+/).filter(Boolean);
  const letters = clean.replace(/\s/g, "");
  const out = [];
  const push = (v) => { if (v && v.length >= 2 && !out.includes(v)) out.push(v); };
  if (words.length >= 2) push(words[0][0] + words[1][0]);            // iniciales de 2 palabras
  push(letters.slice(0, 2));                                          // primeras 2 letras
  if (letters[0] && letters[2]) push(letters[0] + letters[2]);        // 1a + 3a
  push(letters.slice(0, 3));                                          // primeras 3 letras
  for (let i = 1; i < letters.length; i += 1) push(letters[0] + letters[i]); // 1a + cada otra
  return out.length ? out : ["XX"];
}

// Asigna un prefijo UNICO a cada empresa (el sistema resuelve colisiones de iniciales),
// de forma determinista (orden por id) para que sea estable.
function assignCompanyPrefixes(companies) {
  const used = new Set();
  const map = {};
  const ordered = [...companies].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const c of ordered) {
    const cands = prefixCandidates(c.name || c.id);
    let chosen = cands.find((p) => !used.has(p));
    if (!chosen) {
      // Ultimo recurso: primera letra + digito incremental.
      const base = (cands[0] || "X")[0];
      let n = 2;
      while (used.has(`${base}${n}`)) n += 1;
      chosen = `${base}${n}`;
    }
    used.add(chosen);
    map[c.id] = chosen;
  }
  return map;
}

// Devuelve las tareas con un `ref` FIJO asignado: respeta los refs ya guardados (no
// cambian nunca) y solo asigna nuevos a las tareas que no tienen, continuando la
// numeracion de su empresa (ej. si existe AR03, la nueva sera AR04). El sistema resuelve
// prefijos unicos por empresa. Retorna { tasks, changed } para persistir si hubo cambios.
function withAssignedRefs(tasks, companies) {
  const usedPrefixes = new Set();
  const prefixByCompany = {};
  const maxNum = {};
  for (const t of tasks) {
    if (!t.ref) continue;
    const pfx = t.ref.replace(/\d+$/, "");
    prefixByCompany[t.companyId] = pfx;
    usedPrefixes.add(pfx);
    const m = t.ref.match(/(\d+)$/);
    if (m) maxNum[pfx] = Math.max(maxNum[pfx] || 0, parseInt(m[1], 10));
  }
  // Prefijo unico para empresas que aun no tienen ninguno (determinista por id).
  const ordered = [...companies].sort((a, b) => String(a.id).localeCompare(String(b.id)));
  for (const c of ordered) {
    if (prefixByCompany[c.id]) continue;
    const cands = prefixCandidates(c.name || c.id);
    let chosen = cands.find((p) => !usedPrefixes.has(p));
    if (!chosen) { const base = (cands[0] || "X")[0]; let n = 2; while (usedPrefixes.has(`${base}${n}`)) n += 1; chosen = `${base}${n}`; }
    usedPrefixes.add(chosen);
    prefixByCompany[c.id] = chosen;
  }
  const missingByCompany = {};
  for (const t of tasks) if (!t.ref) (missingByCompany[t.companyId || "sin"] ||= []).push(t);
  const newRef = {};
  let changed = false;
  for (const [cid, list] of Object.entries(missingByCompany)) {
    const pfx = prefixByCompany[cid] || "XX";
    list
      .slice()
      .sort((a, b) => `${a.createdAt || ""}${a.id}`.localeCompare(`${b.createdAt || ""}${b.id}`))
      .forEach((t) => { maxNum[pfx] = (maxNum[pfx] || 0) + 1; newRef[t.id] = `${pfx}${String(maxNum[pfx]).padStart(2, "0")}`; changed = true; });
  }
  if (!changed) return { tasks, changed: false };
  return { tasks: tasks.map((t) => (t.ref ? t : { ...t, ref: newRef[t.id] })), changed: true };
}

// Fallback de solo lectura (por si el ref aun no se persistio): calcula refs frescos.
function buildTaskRefs(tasks, companies) {
  return withAssignedRefs(tasks.map((t) => ({ ...t, ref: t.ref || "" })), companies)
    .tasks.reduce((acc, t) => { acc[t.id] = t.ref; return acc; }, {});
}

// Estados que el admin puede fijar rápido desde la vista de prioridad.
const QUICK_STATUSES = [["ready", "Pendiente", Circle], ["doing", "En proceso", LoaderCircle], ["review", "En revisión", Clock], ["verificacion", "Lista · por notificar", Send], ["notificado", "Notificado", Bell], ["blocked", "Bloqueada", AlertTriangle], ["done", "Finalizada", CheckCircle2]];

function PriorityView({ tasks, companies, people = [], onOpenTask, onChangeStatus }) {
  const [openId, setOpenId] = useState(null);
  const nameOf = (id) => companies.find((c) => c.id === id)?.name || id || "Sin empresa";
  const assigneeOf = (t) => {
    if (!t.assigneeId) return "Sin responsable";
    return (people.find((p) => p.id === t.assigneeId)?.name) || "Sin responsable";
  };
  const refs = buildTaskRefs(tasks, companies);
  const ranked = tasks
    .filter((t) => t.status !== "done")
    .map((t) => ({ ...t, ...scoreTask(t), ref: t.ref || refs[t.id] }))
    .sort((a, b) => b.score - a.score);

  const bottlenecks = ranked.filter((t) => t.status === "blocked");

  // Foco para HOY (vence hoy o vencidas) y ESTA SEMANA (proximos 7 dias), por prioridad.
  const today = todayIso();
  const hoy = ranked.filter((t) => t.dueDate && t.dueDate <= today && t.status !== "review" && t.status !== "verificacion" && t.status !== "notificado");
  const semana = ranked.filter((t) => {
    if (!t.dueDate || t.dueDate <= today) return false;
    const d = Math.round((new Date(t.dueDate) - new Date(today)) / 86400000);
    return d <= 7;
  });

  if (!ranked.length) {
    return <p className="mt-6 text-sm text-[#667085]">No hay tareas activas para priorizar.</p>;
  }

  const scoreColor = (s) => (s >= 70 ? "#B42318" : s >= 45 ? "#B76E00" : "#1570EF");

  const TaskRow = ({ t, rank }) => {
    const open = openId === t.id;
    return (
    <div className={`rounded-md border bg-white ${open ? "border-[#17727A]" : "border-[#E4DED6]"}`}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpenId(open ? null : t.id)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenId(open ? null : t.id); } }}
        title={open ? "Cerrar" : "Ver la tarea aquí mismo"}
        className="flex cursor-pointer items-start gap-3 p-3 hover:bg-[#F7FAFA]"
      >
        {rank != null && <span className="mt-0.5 w-5 shrink-0 text-sm font-bold text-[#98A2B3]">{rank}</span>}
        <span className="mt-0.5 inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: scoreColor(t.score) }}>{t.score}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[#1D2939]">
            {t.ref && <span className="mr-2 rounded border border-[#D9D2C7] bg-[#F7F4EF] px-1.5 py-0.5 font-mono text-[11px] font-bold text-[#475467]">{t.ref}</span>}
            {t.title}
          </p>
          <p className="truncate text-xs text-[#667085]">{nameOf(t.companyId)}{t.client ? ` · ${t.client}` : ""} · {STATUS[t.status] || t.status}{t.dueDate ? ` · vence ${displayDate(t.dueDate)}` : ""}</p>
          <p className="mt-0.5 flex items-center gap-1 truncate text-xs">
            <UserRound size={12} className={t.assigneeId ? "text-[#17727A]" : "text-[#B76E00]"} />
            <span className={t.assigneeId ? "font-semibold text-[#17727A]" : "font-semibold text-[#B76E00]"}>{assigneeOf(t)}</span>
          </p>
          {t.reasons.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {t.reasons.map((r, i) => (
                <span key={i} className="rounded-full border border-[#E4DED6] px-2 py-0.5 text-[10px] font-bold text-[#475467]">{r}</span>
              ))}
            </div>
          )}
        </div>
        <ChevronRight size={16} className={`mt-0.5 shrink-0 text-[#98A2B3] transition-transform ${open ? "rotate-90" : ""}`} />
      </div>
      {open && (
        <div className="border-t border-[#E4DED6] px-3 py-3">
          {t.description
            ? <p className="whitespace-pre-line text-sm text-[#475467]">{t.description}</p>
            : <p className="text-xs italic text-[#98A2B3]">Sin descripción.</p>}
          {/* Cambio rápido de estado (sin salir de Prioridad). */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[#667085]">Estado:</span>
            {QUICK_STATUSES.map(([k, label, Icon]) => {
              const on = t.status === k;
              const tone = statusTone(k);
              return (
                <button key={k} type="button"
                  onClick={(e) => { e.stopPropagation(); onChangeStatus?.(t.id, k); }}
                  className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold"
                  style={on ? { borderColor: tone.text, background: tone.bg, color: tone.text } : { borderColor: "#D0D5DD", color: "#475467" }}>
                  <Icon size={12} /> {label}
                </button>
              );
            })}
          </div>
          {/* Para cambiar responsable, fecha o el detalle: abrir el editor completo. */}
          <button type="button" onClick={(e) => { e.stopPropagation(); onOpenTask?.(t); }}
            className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-[#D0D5DD] px-3 py-1.5 text-xs font-semibold text-[#344054] hover:border-[#17727A] hover:text-[#17727A]">
            <Pencil size={13} /> Abrir para editar (responsable, fecha, detalle)
          </button>
        </div>
      )}
    </div>
    );
  };

  return (
    <div className="mt-5 space-y-5">
      <p className="text-sm text-[#667085]">
        Prioridad de <b>todas las tareas activas</b> ({ranked.length}), calculada con Pareto 80/20,
        Teoria de Restricciones (cuellos de botella) y urgencia. El puntaje 0-100 combina
        importancia, fecha y bloqueos. <b>Todas las secciones</b> —incluidas Hoy y Esta semana—
        van ordenadas por ese puntaje (el poco vital primero, Pareto).
      </p>

      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#17727A]"><Target size={16} /> Foco para hoy</h3>
        <p className="mb-2 text-xs text-[#98A2B3]">Lo mas importante que atender hoy (Pareto: el poco que mas mueve).</p>
        <div className="space-y-2">
          {hoy.length ? hoy.slice(0, 5).map((t) => <TaskRow key={t.id} t={t} />) : <p className="text-xs text-[#98A2B3]">Nada vence hoy.</p>}
          {hoy.length > 5 && <p className="text-xs text-[#98A2B3]">+{hoy.length - 5} mas para hoy (ver lista completa abajo).</p>}
        </div>
      </section>

      <section>
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-[#B76E00]"><CalendarDays size={16} /> Importante para esta semana</h3>
        <p className="mb-2 text-xs text-[#98A2B3]">Lo prioritario de los proximos 7 dias, para preparar con tiempo.</p>
        <div className="space-y-2">
          {semana.length ? semana.slice(0, 5).map((t) => <TaskRow key={t.id} t={t} />) : <p className="text-xs text-[#98A2B3]">Sin tareas con fecha en los proximos 7 dias.</p>}
          {semana.length > 5 && <p className="text-xs text-[#98A2B3]">+{semana.length - 5} mas esta semana (ver lista completa abajo).</p>}
        </div>
      </section>

      {bottlenecks.length > 0 && (
        <section>
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#B42318]"><Construction size={16} /> Cuellos de botella (destrabar primero)</h3>
          <div className="space-y-2">
            {bottlenecks.map((t) => <TaskRow key={t.id} t={t} />)}
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 flex items-center gap-1.5 text-sm font-bold text-[#344054]"><ListOrdered size={16} /> Todas, ordenadas por prioridad</h3>
        <div className="space-y-2">
          {ranked.map((t, i) => <TaskRow key={t.id} t={t} rank={i + 1} />)}
        </div>
      </section>
    </div>
  );
}

// "?" con explicación que se abre con TAP (funciona en móvil, a diferencia de title=).
// Fondo oscuro + texto blanco para contraste en claro y oscuro.
function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex align-middle">
      <button type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        aria-label="Más información"
        className="inline-flex items-center justify-center">
        <HelpCircle size={12} className="text-[#98A2B3]" />
      </button>
      {open && (
        <span role="tooltip" className="absolute left-1/2 top-5 z-40 w-52 max-w-[70vw] -translate-x-1/2 rounded-md bg-[#1D2939] px-2.5 py-1.5 text-[11px] font-normal normal-case leading-snug text-white shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

function Metric({ label, value, tone, icon: Icon }) {
  return (
    <div className="rounded-md border border-[#E4DED6] bg-white p-4 shadow-sm">
      <p className="flex items-center gap-1.5 text-sm text-[#667085]">
        {Icon && (
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md" style={{ background: `${tone}1A`, color: tone }}>
            <Icon size={14} />
          </span>
        )}
        {label}
      </p>
      <p className="mt-2 font-metrics text-3xl font-semibold tabular-nums" style={{ color: tone }}>{value}</p>
    </div>
  );
}

function TasksTable({
  tasks,
  companies,
  people,
  activeStatus,
  onStatus,
  assignFilter,
  onAssignFilter,
  ownerFilter,
  onOwnerFilter,
  sortRecent,
  onSortRecent,
  companyFilter,
  onCompanyFilter,
  taskQuery,
  onTaskQuery,
  highlightId,
  onAddTask,
  onChangeTask,
  onDeleteTask,
  onSaveTask,
  onUploadAttachment,
  onDeleteAttachment,
}) {
  const [openTaskId, setOpenTaskId] = useState(null);
  // Al crear una tarea nueva, se abre automáticamente para completarla.
  useEffect(() => { if (highlightId) setOpenTaskId(highlightId); }, [highlightId]);
  // Modo "Recientes": una sola lista con las últimas tareas incluidas (por fecha de creación).
  const recentGroups = sortRecent
    ? [{
        key: "__recent__",
        label: "Últimas tareas incluidas",
        bandeja: false,
        hasHighlight: tasks.some((t) => t.id === highlightId),
        tasks: [...tasks].sort((a, b) => {
          if (a.id === highlightId) return -1;
          if (b.id === highlightId) return 1;
          return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
        }),
      }]
    : null;
  // Agrupa por proyecto (empresa · subproyecto); lo que no tiene proyecto real va a "Bandeja".
  const groups = [];
  const byKey = new Map();
  for (const task of tasks) {
    const bandeja = task.companyId === "por-asignar" || !task.client;
    const key = bandeja ? `__bandeja__|${task.client || ""}` : `${task.companyId}|${task.client}`;
    if (!byKey.has(key)) {
      const c = companies.find((item) => item.id === task.companyId);
      const label = bandeja
        ? `Bandeja · ${task.client || "sin subproyecto"}`
        : `${c?.name || task.companyId} · ${task.client}`;
      const g = { key, label, bandeja, tasks: [] };
      byKey.set(key, g);
      groups.push(g);
    }
    byKey.get(key).tasks.push(task);
  }
  // Dentro de cada grupo: la recién creada (highlight) primero, luego lo más nuevo arriba.
  for (const g of groups) {
    g.hasHighlight = g.tasks.some((t) => t.id === highlightId);
    g.tasks.sort((a, b) => {
      if (a.id === highlightId) return -1;
      if (b.id === highlightId) return 1;
      return String(b.createdAt || "").localeCompare(String(a.createdAt || ""));
    });
  }
  // El grupo con la tarea recién creada va de primero; luego proyectos; bandejas al final.
  groups.sort((a, b) => {
    if (a.hasHighlight !== b.hasHighlight) return a.hasHighlight ? -1 : 1;
    if (a.bandeja !== b.bandeja) return a.bandeja ? 1 : -1;
    return a.label.localeCompare(b.label);
  });
  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-md border border-[#D9D2C7] bg-white p-4 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-[#1D2939]">Todas las tareas</h2>
          <p className="text-sm text-[#667085]">Toca una tarea para desplegar y editar lo que se requiere.</p>
        </div>
        {/* "Crear tarea manual" + "Ver archivo" (finalizadas) a lo ancho en responsive */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <button onClick={onAddTask} className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md bg-[#17727A] px-3 py-2 text-sm font-semibold text-white sm:w-auto">
            <Plus size={16} /> Crear tarea manual
          </button>
          <button onClick={() => onStatus(activeStatus === "done" ? "open" : "done")} className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-sm font-semibold sm:w-auto"
            style={activeStatus === "done" ? { borderColor: "#17727A", background: "#EAF4F2", color: "#17727A" } : { borderColor: "#D0D5DD", color: "#475467" }}>
            <Archive size={16} /> {activeStatus === "done" ? "Salir del archivo" : "Ver archivo (finalizadas)"}
          </button>
        </div>
        <input
          value={taskQuery}
          onChange={(event) => onTaskQuery(event.target.value)}
          placeholder="Buscar en todas las tareas por palabras (incluye finalizadas)…"
          className="mt-3 w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
        />
        {/* Chips de estado: en móvil carrusel horizontal (swipe); en web (sm+) se envuelven en
            varias líneas para poder tocarlos todos sin barra de scroll oculta. */}
        <div className={`mt-3 -mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-x-visible ${taskQuery.trim() ? "opacity-40 pointer-events-none" : ""}`} style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {[
            ["open", "Abiertas"],
            ["updated", "Actualizadas"],
            ["mdtouched", "Tocadas por IA"],
            ["today", "Por vencer"],
            ["blocked", "Bloqueadas"],
            ["review", "En revisión"],
            ["verificacion", "Lista · por notificar"],
            ["notificado", "Notificado"],
            ["done", "Finalizadas (archivo)"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => onStatus(key)}
              className="shrink-0 whitespace-nowrap rounded-md border px-3 py-1.5 text-sm font-semibold"
              style={{
                borderColor: activeStatus === key ? "#17727A" : "#D0D5DD",
                background: activeStatus === key ? "#EAF4F2" : "#FFFFFF",
                color: activeStatus === key ? "#17727A" : "#475467",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {/* Filtros: empresa y responsable como desplegables (pueden ser muchos); proyecto como carrusel. */}
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b8272]">Empresa</span>
              <select value={companyFilter} onChange={(event) => onCompanyFilter(event.target.value)}
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs font-semibold text-[#344054] outline-none focus:border-[#17727A]">
                <option value="all">Todas las empresas</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b8272]">Responsable</span>
              <select value={ownerFilter} onChange={(event) => onOwnerFilter?.(event.target.value)}
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs font-semibold text-[#344054] outline-none focus:border-[#B42318]">
                <option value="all">Todos los responsables</option>
                <option value="unowned">Sin responsable</option>
                {(people || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#8b8272]">Proyecto</span>
            <div className="-mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-0.5" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
              {[["all", "Todas"], ["unassigned", "Sin proyecto"], ["assigned", "Con proyecto"]].map(([key, label]) => (
                <button key={key} onClick={() => onAssignFilter(key)}
                  className="shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold"
                  style={{ borderColor: assignFilter === key ? "#B76E00" : "#D0D5DD", background: assignFilter === key ? "#FFF7E6" : "#FFFFFF", color: assignFilter === key ? "#B76E00" : "#667085" }}>
                  {label}
                </button>
              ))}
              <button onClick={() => onSortRecent?.(!sortRecent)}
                className="ml-1 inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold"
                style={{ borderColor: sortRecent ? "#17727A" : "#D0D5DD", background: sortRecent ? "#EAF4F2" : "#FFFFFF", color: sortRecent ? "#17727A" : "#667085" }}
                title="Ordenar por últimas tareas incluidas">
                <Clock size={12} /> Recientes
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {(recentGroups || groups).length ? (recentGroups || groups).map((group) => (
          <div key={group.key} className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-[0.1em]" style={{ color: group.bandeja ? "#B76E00" : "#17727A" }}>{group.label}</h3>
              <span className="rounded-full bg-[#F2F4F7] px-1.5 py-0.5 text-[10px] font-semibold text-[#475467]">{group.tasks.length}</span>
              <div className="h-px flex-1 bg-[#E4DED6]" />
            </div>
            {group.tasks.map((task) => (
              <ProjectTaskAccordion
                key={task.id}
                task={task}
                company={companies.find((item) => item.id === task.companyId) || companies[0]}
                companies={companies}
                people={people}
                open={openTaskId === task.id}
                onOpenChange={(isOpen) => setOpenTaskId((prev) => (isOpen ? task.id : prev === task.id ? null : prev))}
                onChangeTask={onChangeTask}
                onDeleteTask={onDeleteTask}
                onSaveTask={onSaveTask}
                onUploadAttachment={onUploadAttachment}
                onDeleteAttachment={onDeleteAttachment}
              />
            ))}
          </div>
        )) : (
          <div className="rounded-md border border-dashed border-[#C8BFB3] bg-white p-6 text-center text-sm text-[#667085]">
            No hay tareas en este filtro.
          </div>
        )}
      </div>
    </section>
  );
}

// Control de acceso por persona: fija/resetea la contraseña del portal (email + password).
function AccessControl({ person, onGrantAccess }) {
  const [pwd, setPwd] = useState("");
  const [saving, setSaving] = useState(false);
  const email = (person.email || "").trim();
  return (
    <div className="mt-2 rounded-md border border-[#E4DED6] bg-white p-2">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#667085]">Acceso al portal</p>
      {!email ? (
        <p className="text-[11px] text-[#8b8272]">Primero pon un correo arriba para dar acceso.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            placeholder="Contraseña (mín. 6)"
            type="password"
            autoComplete="new-password"
            className="min-w-0 flex-1 rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]"
          />
          <button
            type="button"
            disabled={saving || pwd.trim().length < 6}
            onClick={async () => { setSaving(true); await onGrantAccess?.(email, pwd.trim(), person.companyId || "", person.id || ""); setSaving(false); setPwd(""); }}
            className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            style={{ background: "#17727A" }}
          >
            {saving ? "Guardando…" : "Dar / resetear acceso"}
          </button>
        </div>
      )}
    </div>
  );
}

function PeoplePanel({ companies = [], people, newPerson, onNewPerson, onAddPerson, onUpdatePerson, onDeletePerson, onGrantAccess }) {
  const companyNameOf = (id) => companies.find((c) => c.id === id)?.name || "";
  return (
    <div className="rounded-md border border-[#E4DED6] bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[#1D2939]">Personas e integrantes</h3>
      <div className="mt-3 space-y-2">
        <input
          value={newPerson.name}
          onChange={(event) => onNewPerson({ ...newPerson, name: event.target.value })}
          placeholder="Nombre"
          className="w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm"
        />
        <label className="block text-xs font-semibold text-[#667085]">Empresa
          <select
            value={newPerson.companyId || ""}
            onChange={(event) => onNewPerson({ ...newPerson, companyId: event.target.value })}
            className="mt-1 w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#344054]"
          >
            <option value="">Equipo MediaLab (todas las empresas)</option>
            {companies.filter((c) => c.id !== "por-asignar").map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <span className="mt-1 block font-normal text-[#8b8272]">Externo de una empresa: elígela para que solo vea/aparezca en esa empresa y entre por su link.</span>
        </label>
        <label className="block text-xs font-semibold text-[#667085]">Correo
          <input
            value={newPerson.email}
            onChange={(event) => onNewPerson({ ...newPerson, email: event.target.value })}
            placeholder="nombre@empresa.com"
            type="email"
            className="mt-1 w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#344054]"
          />
        </label>
        <label className="block text-xs font-semibold text-[#667085]">WhatsApp
          <input
            value={newPerson.phone}
            onChange={(event) => onNewPerson({ ...newPerson, phone: event.target.value })}
            placeholder="+57 300 000 0000"
            inputMode="tel"
            className="mt-1 w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#344054]"
          />
        </label>
        <label className="block text-xs font-semibold text-[#667085]">Link de Google Chat
          <input
            value={newPerson.chatUrl}
            onChange={(event) => onNewPerson({ ...newPerson, chatUrl: event.target.value })}
            placeholder="https://chat.google.com/…"
            className="mt-1 w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#344054]"
          />
        </label>
        <label className="block text-xs font-semibold text-[#667085]">Tipo
          <select
            value={newPerson.type}
            onChange={(event) => onNewPerson({ ...newPerson, type: event.target.value })}
            className="mt-1 w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#344054]"
          >
            {PERSON_TYPES.map((type) => <option key={type}>{type}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-[#667085]">Método de conexión
          <select
            value={newPerson.contactMethod || "auto"}
            onChange={(event) => onNewPerson({ ...newPerson, contactMethod: event.target.value })}
            className="mt-1 w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#344054]"
          >
            {CONTACT_METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="block text-xs font-semibold text-[#667085]">Contraseña de acceso al portal (opcional)
          <input
            value={newPerson.password || ""}
            onChange={(event) => onNewPerson({ ...newPerson, password: event.target.value })}
            placeholder="Mín. 6 caracteres — deja vacío si no dará acceso"
            type="password"
            autoComplete="new-password"
            className="mt-1 w-full rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-normal text-[#344054]"
          />
          <span className="mt-1 block font-normal text-[#8b8272]">Con correo + contraseña, la persona podrá entrar al portal y ver solo SUS tareas.</span>
        </label>
        <p className="text-xs text-[#8b8272]">Así se envía la tarea a esta persona. "Automático" usa WhatsApp para externos, Google Chat para internos y el correo como respaldo.</p>
        <button onClick={onAddPerson} className="w-full rounded-md bg-[#17727A] px-3 py-2 text-sm font-semibold text-white">
          Agregar persona
        </button>
      </div>
      <div className="mt-3 space-y-2">
        {people.length === 0 ? (
          <p className="text-sm text-[#667085]">Sin personas registradas.</p>
        ) : people.map((person) => (
          <details key={person.id} className="rounded-md border border-[#E4DED6] bg-[#FFFCF7] p-2">
            <summary className="cursor-pointer text-sm font-semibold text-[#344054]">
              {person.name || "Persona sin nombre"} <span className="font-normal text-[#667085]">({person.type || "Empleado MediaLab"})</span>
              <span className="ml-1 rounded-full bg-[#EAF4F2] px-1.5 py-0.5 text-[10px] font-semibold text-[#17727A]">{person.companyId ? companyNameOf(person.companyId) : "Equipo MediaLab"}</span>
            </summary>
            <div className="mt-2 space-y-1">
              <input value={person.name} aria-label="Nombre de la persona" placeholder="Nombre" onChange={(event) => onUpdatePerson(person.id, { name: event.target.value })} className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]" />
              <input
                value={person.email || ""}
                onChange={(event) => onUpdatePerson(person.id, { email: event.target.value })}
                placeholder="correo"
                type="email"
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]"
              />
              <input
                value={person.phone || ""}
                onChange={(event) => onUpdatePerson(person.id, { phone: event.target.value })}
                placeholder="WhatsApp"
                inputMode="tel"
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]"
              />
              <select
                value={person.type || "Empleado MediaLab"}
                onChange={(event) => onUpdatePerson(person.id, { type: event.target.value })}
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]"
              >
                {PERSON_TYPES.map((type) => <option key={type}>{type}</option>)}
              </select>
              <select
                value={person.companyId || ""}
                aria-label="Empresa de la persona"
                onChange={(event) => onUpdatePerson(person.id, { companyId: event.target.value })}
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]"
              >
                <option value="">Empresa: Equipo MediaLab (todas)</option>
                {companies.filter((c) => c.id !== "por-asignar").map((c) => <option key={c.id} value={c.id}>Empresa: {c.name}</option>)}
              </select>
              <select
                value={person.contactMethod || "auto"}
                aria-label="Método de conexión"
                onChange={(event) => onUpdatePerson(person.id, { contactMethod: event.target.value })}
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]"
              >
                {CONTACT_METHODS.map(([value, label]) => <option key={value} value={value}>{label === "Automático" ? "Conexión: automática" : `Conexión: ${label}`}</option>)}
              </select>
              <input
                value={person.chatUrl || ""}
                aria-label="Link de Google Chat"
                onChange={(event) => onUpdatePerson(person.id, { chatUrl: event.target.value })}
                placeholder="Link de Google Chat"
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]"
              />
              <AccessControl person={person} onGrantAccess={onGrantAccess} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              {person.email && <a href={`mailto:${person.email}`} className="text-xs font-semibold text-[#17727A]">Correo</a>}
              {person.phone && <a href={whatsappUrl(person.phone)} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#17727A]">WhatsApp</a>}
              {person.chatUrl && <a href={person.chatUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-[#17727A]">Chat</a>}
              <button
                type="button"
                onClick={() => onDeletePerson(person.id)}
                className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-[#B42318]"
                title="Eliminar persona"
              >
                <Trash2 size={12} /> Eliminar
              </button>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

// Resuelve por qué medio contactar a la persona. Respeta el "método de conexión"
// elegido al crear la persona; si es "Automático", decide por tipo/datos disponibles.
function contactFor(person, message, subject) {
  const hasPhone = Boolean(person?.phone);
  const hasChat = Boolean(person?.chatUrl);
  const hasEmail = Boolean(person?.email);
  const chosen = person?.contactMethod && person.contactMethod !== "auto"
    ? person.contactMethod
    : person?.type === "Externo" && hasPhone ? "whatsapp"
      : person?.type === "Empleado MediaLab" && hasChat ? "chat"
        : hasEmail ? "email" : "none";
  if (chosen === "whatsapp" && hasPhone) return { href: whatsappUrl(person.phone, message), medium: "WhatsApp" };
  if (chosen === "chat" && hasChat) return { href: person.chatUrl, medium: "Google Chat" };
  if (chosen === "email" && hasEmail) return { href: mailtoUrl(person.email, subject, message), medium: "Correo" };
  return { href: "", medium: "Sin medio" };
}

// Popup de satisfacción/feedback al FINALIZAR una tarea. Reutilizable: sale tanto desde la
// tarjeta como desde la vista de prioridad. `onSave(patch)` recibe rating/feedback/ia/tools;
// `onDirect()` finaliza sin feedback; `onClose()` cierra sin finalizar.
function DoneFeedbackModal({ task, onSave, onDirect, onClose }) {
  const [mRating, setMRating] = useState(task?.rating || 0);
  const [mFeedback, setMFeedback] = useState(task?.ratingComment || "");
  const [mAi, setMAi] = useState(task?.aiUsage || 0);
  const [mTools, setMTools] = useState(Array.isArray(task?.tools) ? task.tools : []);
  if (!task) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-xl">
        <h3 className="text-sm font-semibold text-[#1D2939]">¿Cómo fue esta tarea?</h3>
        <p className="mt-0.5 text-xs text-[#667085]">Antes de finalizar, cuéntanos tu experiencia (opcional).</p>
        <div className="mt-3">
          <span className="text-xs font-semibold text-[#667085]">Experiencia (1–5)</span>
          <div className="mt-1 flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setMRating(n === mRating ? 0 : n)} className="p-0.5">
                <Star size={24} style={{ color: "#F2A93B" }} fill={n <= mRating ? "#F2A93B" : "none"} />
              </button>
            ))}
          </div>
        </div>
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[#667085]">Recomendaciones de mejora / feedback</span>
          <textarea value={mFeedback} onChange={(e) => setMFeedback(e.target.value)} rows={3} placeholder="¿Qué se puede mejorar en tareas de este tipo?" className="mt-1 w-full rounded-md border border-[#D0D5DD] px-2 py-1.5 text-sm text-[#344054] outline-none focus:border-[#17727A]" />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-semibold text-[#667085]">¿Cuánta IA se usó? <b className="text-[#6941C6]">{mAi}%</b></span>
          <input type="range" min="0" max="100" step="5" value={mAi} onChange={(e) => setMAi(Number(e.target.value))} className="mt-1 w-full" style={{ accentColor: "#6941C6" }} />
        </label>
        <div className="mt-3">
          <span className="text-xs font-semibold text-[#667085]">¿Con qué herramientas se trabajó?</span>
          <div className="mt-1 -mx-1 flex gap-1 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {TOOL_OPTIONS.map((tool) => {
              const on = mTools.includes(tool);
              return (
                <button key={tool} type="button"
                  onClick={() => setMTools((cur) => (on ? cur.filter((x) => x !== tool) : [...cur, tool]))}
                  className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold"
                  style={on ? { borderColor: "#6941C6", background: "#F4F1FD", color: "#6941C6" } : { borderColor: "#D0D5DD", color: "#667085" }}>
                  {tool}
                </button>
              );
            })}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onSave({ rating: mRating || null, ratingComment: mFeedback || "", aiUsage: mAi || null, tools: mTools })} className="flex-1 rounded-md bg-[#0D7A4F] px-3 py-2 text-sm font-semibold text-white">Guardar y finalizar</button>
          <button type="button" onClick={onDirect} className="rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-semibold text-[#344054]">Solo finalizar</button>
        </div>
        <button type="button" onClick={onClose} className="mt-2 w-full rounded-md px-3 py-2 text-sm font-semibold text-[#667085] hover:bg-[#F2F4F7]">Cancelar — no finalizar</button>
      </div>
    </div>,
    document.body,
  );
}

function ProjectTaskAccordion({ task, company, companies = [], people = [], open: openProp, onOpenChange, onChangeTask, onDeleteTask, onSaveTask, onUploadAttachment, onDeleteAttachment }) {
  // Tag "IA": la tarea la generó el MD (source ≠ Manual) y el admin AÚN NO la ha revisado. Es un
  // aviso de "historia de IA pendiente de revisar": desaparece en cuanto el admin la toca o la
  // GUARDA (adminTouchedAt). No se muestra si ya lleva "IA actualizó" (mdTouchedAt).
  const aiCreated = Boolean(task.source && !/^\s*manual\s*$/i.test(task.source));
  const showIA = aiCreated && !task.mdTouchedAt && !task.adminTouchedAt;
  const [taskSave, setTaskSave] = useState("idle"); // idle | saving | saved | error
  const doSaveTask = async () => {
    if (!onSaveTask) return;
    setTaskSave("saving");
    // Guardar la tarea = el admin la REVISÓ: sella adminTouchedAt (quita la píldora "IA") y
    // limpia mdTouchedAt (quita el tag "IA actualizó"): ya se revisó lo que complementó la IA.
    const patch = {};
    if (aiCreated && !task.adminTouchedAt) patch.adminTouchedAt = new Date().toISOString();
    if (task.mdTouchedAt) patch.mdTouchedAt = "";
    // Al GUARDAR, la tarea deja de ser "recién creada": su fecha ya es un compromiso guardado.
    if (task._unsaved) patch._unsaved = false;
    if (Object.keys(patch).length) onChangeTask(task.id, patch);
    try {
      await onSaveTask(task.id);
      // Guardada: el próximo cambio de fecha vuelve a pedir motivo (nuevo ciclo).
      setDueJustified(false);
      setTaskSave("saved"); setTimeout(() => setTaskSave("idle"), 2500);
    } catch { setTaskSave("error"); }
  };
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [openInternal, setOpenInternal] = useState(false);
  const [reply, setReply] = useState("");
  // Change Requests: texto + origen (CEO/cliente) del cambio a pedir.
  const [crText, setCrText] = useState("");
  const [crBy, setCrBy] = useState("ceo");
  const [crModal, setCrModal] = useState(false);
  const changeRequests = Array.isArray(task.changeRequests) ? task.changeRequests : [];
  const openCRs = changeRequests.filter((c) => !c.resolved);
  function addChangeRequest() {
    const text = crText.trim();
    if (!text) return;
    const cr = { id: `cr-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, at: new Date().toISOString(), by: crBy, text, resolved: false };
    // Pedir cambios devuelve la tarea a "en progreso" y avisa al empleado (adminTouchedAt).
    onChangeTask(task.id, { changeRequests: [...changeRequests, cr], changeRequest: true, status: "doing" });
    setCrText("");
  }
  function toggleCR(id, resolved) {
    const next = changeRequests.map((c) => (c.id === id ? { ...c, resolved, resolvedAt: resolved ? new Date().toISOString() : "" } : c));
    onChangeTask(task.id, { changeRequests: next, changeRequest: next.some((c) => !c.resolved) });
  }
  function approveReview() {
    // Aprobar la revisión del EMPLEADO: resuelve CR abiertos, deja nota "validado" y la manda a
    // Verificación (el cliente la revisa). No cierra la tarea todavía.
    const comments = Array.isArray(task.comments) ? task.comments : [];
    const patch = {
      status: "verificacion",
      comments: [...comments, { author: "Administrador", role: "admin", text: "Request review validado por el administrador · enviado a verificación del cliente.", at: new Date().toISOString() }],
    };
    if (openCRs.length) { patch.changeRequests = changeRequests.map((c) => ({ ...c, resolved: true })); patch.changeRequest = false; }
    onChangeTask(task.id, patch);
  }
  // Popup al finalizar: satisfacción (1-5) + recomendaciones + % de IA usada.
  const [doneModal, setDoneModal] = useState(false);
  const openDoneModal = () => setDoneModal(true);
  // Cambio de fecha con motivo: dueDraft = nueva fecha pendiente de confirmar; dueReason = por qué.
  // El motivo se pide UNA VEZ POR CICLO DE GUARDADO: si ya se justificó (o si es la primera fecha)
  // y la tarjeta AÚN NO se ha guardado, se puede seguir corrigiendo la fecha sin volver a pedirlo.
  // Al guardar se reinicia, así un cambio posterior vuelve a exigir motivo.
  const [dueDraft, setDueDraft] = useState("");
  const [dueReason, setDueReason] = useState("");
  const [dueJustified, setDueJustified] = useState(false);
  const confirmDueChange = () => {
    // prevDueDate = la fecha que estaba guardada al abrir el cambio (no un valor intermedio).
    onChangeTask(task.id, { dueDate: dueDraft, prevDueDate: task.dueDate, dueChangeReason: dueReason.trim() });
    setDueJustified(true);
    setDueDraft("");
  };
  // Acordeón controlado por la lista (solo una tarea abierta a la vez) o autónomo si no.
  const controlled = typeof onOpenChange === "function";
  const open = controlled ? Boolean(openProp) : openInternal;
  const handleToggle = (event) => {
    const isOpen = event.currentTarget.open;
    if (isOpen === open) return;
    if (controlled) onOpenChange(isOpen);
    else setOpenInternal(isOpen);
  };
  const scopeOptions = company?.scope?.length ? company.scope : TASK_CATEGORIES;
  // Opciones para MOVER la tarea: cada empresa + sus subproyectos activos.
  const allCompanies = companies.length ? companies : (company ? [company] : []);
  const locationOptions = [];
  for (const c of allCompanies) {
    const clients = (c.clients || []).filter((cl) => !c.archivedClients?.[cl]);
    for (const cl of clients) locationOptions.push({ value: `${c.id}|||${cl}`, label: `${c.name} · ${cl}` });
  }
  const assignedPerson = personById(people, task.assigneeId);
  const board = getProjectBoardConfig(company, task.client);
  const contactMessage = buildContactMessage(task, company);
  const delayMessage = buildDelayMessage(task, company);
  const overdue = taskIsOverdue(task);
  const report = contactFor(assignedPerson, contactMessage, `Tarea: ${task.title}`);
  const delay = contactFor(assignedPerson, delayMessage, `Retraso: ${task.title}`);
  const reportHref = report.href;
  const delayHref = delay.href;
  const reportMedium = report.medium;
  const stateOptions = [
    ["ready", "Pendiente", Circle],
    ["doing", "En proceso", LoaderCircle],
    ["review", "En revisión", Clock],
    ["verificacion", "Lista · por notificar", Send],
    ["notificado", "Notificado", Bell],
    ["blocked", "Bloqueada", AlertTriangle],
    ["done", "Finalizada", CheckCircle2],
  ];
  return (
    <details open={open} onToggle={handleToggle}
      className={`rounded-md border p-2 transition-colors ${open ? "border-[#17727A] bg-[#EAF4F2]" : "border-[#E4DED6] bg-[#FFFCF7]"}`}
      style={open ? { boxShadow: "0 0 0 1px #17727A55" } : undefined}>
      <summary className="flex cursor-pointer list-none flex-col gap-1.5 rounded text-xs font-semibold text-[#1D2939]">
        {/* Fila superior: chevron + título (2 columnas) + acciones (tacho a la derecha) */}
        <span className="flex w-full items-center gap-2">
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded"
          style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", color: "#17727A" }}
          aria-hidden="true"
        >
          <ChevronRight size={16} />
        </span>
        <span className="min-w-0 flex-1">
          {open ? (
            <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#17727A]">
              Editando tarea{task.ref ? ` · ${task.ref}` : ""}
            </span>
          ) : (
            <span className="block break-words">
              {task.ref && <span className="mr-1.5 rounded border border-[#D9D2C7] bg-[#F7F4EF] px-1 py-0.5 font-mono text-[10px] font-bold text-[#475467]">{task.ref}</span>}
              {task.title}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {/* Colapsada = solo eliminar. Enviar / retraso / adjuntar solo al abrir la tarea.
              (El botón de "abrir Jira/plataforma" por tarea se quitó: casi nadie lo usaba.) */}
          {open && reportHref && (
            <a
              href={reportHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#D0D5DD] bg-white text-[#344054]"
              title={`Reportar por ${reportMedium}`}
            >
              {reportMedium === "WhatsApp" ? <MessageCircle size={14} /> : <Send size={14} />}
            </a>
          )}
          {open && overdue && delayHref && (
            <a
              href={delayHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#B42318] bg-[#FEF3F2] text-[#B42318]"
              title="Reportar retraso y pedir ampliar fecha"
            >
              <AlertTriangle size={14} />
            </a>
          )}
          {open && (
            <label className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#D0D5DD] bg-white text-[#344054]" title="Subir adjunto">
              <Paperclip size={14} />
              <input
                type="file"
                className="hidden"
                onClick={(event) => event.stopPropagation()}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onUploadAttachment(task.id, file);
                  event.target.value = "";
                }}
              />
            </label>
          )}
          {confirmDelete ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-[#B42318] bg-[#FEF3F2] px-1.5 py-0.5">
              <span className="text-xs font-semibold text-[#B42318]">¿Borrar?</span>
              <button
                type="button"
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDeleteTask(task.id); }}
                className="inline-flex h-7 items-center rounded bg-[#B42318] px-2 text-xs font-semibold text-white"
                title="Confirmar borrado"
              >
                Sí
              </button>
              <button
                type="button"
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); setConfirmDelete(false); }}
                className="inline-flex h-7 items-center rounded border border-[#D0D5DD] bg-white px-2 text-xs font-semibold text-[#344054]"
                title="Cancelar"
              >
                No
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={(event) => { event.preventDefault(); event.stopPropagation(); setConfirmDelete(true); }}
              className={`inline-flex items-center justify-center rounded-md border border-[#B42318] bg-white text-[#B42318] ${open ? "h-9 w-9" : "h-7 w-7"}`}
              title="Eliminar tarea"
            >
              <Trash2 size={14} />
            </button>
          )}
        </span>
        </span>
        {/* Etiquetas A LO ANCHO debajo (no las tapa el tacho). Máx 3 filas:
            estado+tipo · persona+fecha · (actualizada su propia fila). */}
        {!open && (
          <span className="flex w-full flex-col gap-1 pl-7 text-xs font-medium text-[#667085]">
            <span className="flex flex-wrap items-center gap-1.5">
              <span
                className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-semibold"
                style={overdue
                  ? { borderColor: "#B42318", background: "#FEF3F2", color: "#B42318" }
                  : { borderColor: statusTone(task.status).border, background: statusTone(task.status).bg, color: statusTone(task.status).text }}
              >
                {overdue ? <AlertTriangle size={11} /> : <Circle size={11} />}
                {overdue ? "Vencida" : (STATUS[task.status] || task.status)}
              </span>
              {task.category && (
                <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded border px-1.5 py-0.5 font-semibold" style={{ borderColor: `${categoryColor(task.category)}66`, background: `${categoryColor(task.category)}14`, color: categoryColor(task.category) }}>
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(task.category) }} />
                  {task.category}
                </span>
              )}
            </span>
            {(task.dueDate || assignedPerson || (task.status === "done" && task.workedHours != null)) && (
              <span className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[#8b8272]">
                <span className="inline-flex items-center gap-1 truncate">{assignedPerson ? <><UserRound size={11} className="shrink-0" />{assignedPerson.name}</> : <span className="text-[#B76E00]">Sin responsable</span>}</span>
                {task.dueDate && <span className="inline-flex items-center gap-1"><CalendarDays size={11} className="shrink-0" />{displayDate(task.dueDate)}</span>}
                {task.status === "done" && task.workedHours != null && (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#0D7A4F]"><Clock size={11} />{task.workedHours} h</span>
                )}
              </span>
            )}
            {(showIA || task.employeeTouchedAt || task.mdTouchedAt || (Array.isArray(task.comments) && task.comments.length > 0)) && (
              <span className="flex flex-wrap items-center gap-1.5">
                {showIA && (
                  <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-bold" style={{ borderColor: "#67C6C0", background: "#E6F6F4", color: "#0E7C74" }} title={`Historia generada por la IA (MD), pendiente de revisar · ${task.source}`}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#0E7C74" }} /> IA
                  </span>
                )}
                {task.employeeTouchedAt && (
                  <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-bold" style={{ borderColor: "#8B5CF6", background: "#EDE9FE", color: "#6D28D9" }} title="El empleado la actualizó; falta que la revises">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#6D28D9" }} /> Actualizada
                  </span>
                )}
                {task.mdTouchedAt && (
                  <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-bold" style={{ borderColor: "#F2A93B", background: "#FFF7E6", color: "#B76E00" }} title="La IA (MD) complementó esta tarea existente; revísala">
                    <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#B76E00" }} /> IA actualizó
                  </span>
                )}
                {Array.isArray(task.comments) && task.comments.length > 0 && (
                  <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold" style={{ borderColor: "#C4B5FD", background: "#F5F3FF", color: "#6D28D9" }}>
                    <MessageCircle size={11} /> {task.comments.length}
                  </span>
                )}
              </span>
            )}
          </span>
        )}
      </summary>
      <div className="mt-2 space-y-2">
        {/* Tags de origen SIEMPRE visibles al abrir la tarea (no solo en la colapsada): así al
            cambiar persona/estado el sello "IA" no desaparece de la vista. */}
        {(showIA || task.category) && (
          <span className="flex flex-wrap items-center gap-1.5">
            {showIA && (
              <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-bold" style={{ borderColor: "#67C6C0", background: "#E6F6F4", color: "#0E7C74" }} title={`Historia generada por la IA (MD), pendiente de revisar · ${task.source}`}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#0E7C74" }} /> IA
              </span>
            )}
            {task.category && (
              <span className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: `${categoryColor(task.category)}66`, background: `${categoryColor(task.category)}14`, color: categoryColor(task.category) }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: categoryColor(task.category) }} />
                {task.category}{task.designPoints != null ? ` · ${task.designPoints} pts` : ""}
              </span>
            )}
          </span>
        )}
        {/* Nota antes del título: el empleado marcó lista (en revisión) — NO es un request review.
            Dos botones en la misma línea: Aprobar (manda al cliente) y Devolver. */}
        {task.status === "review" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#B7D8D4] bg-[#EAF4F2] px-2.5 py-1.5">
            <span className="min-w-0 text-[11px] font-semibold text-[#17727A]">El empleado la marcó lista (en revisión). Valídala y mándala a verificación, o devuélvela con un cambio.</span>
            <span className="flex shrink-0 gap-1.5">
              <button type="button" onClick={approveReview} className="inline-flex items-center gap-1 rounded-md bg-[#175CD3] px-2.5 py-1 text-xs font-semibold text-white"><Send size={12} /> Aprobar</button>
              <button type="button" onClick={() => { setCrText(""); setCrBy("ceo"); setCrModal(true); }} title="Devolver = abrir un request review con el motivo del cambio" className="inline-flex items-center gap-1 rounded-md border border-[#1570EF] px-2.5 py-1 text-xs font-semibold text-[#1570EF]">Devolver</button>
            </span>
          </div>
        )}
        {task.status === "verificacion" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#9CC7E4] bg-[#EAF2FB] px-2.5 py-1.5">
            <span className="min-w-0 text-[11px] font-semibold text-[#175CD3]">En verificación del cliente. Si aprueba, ciérrala; si pide ajustes, devuélvela con un cambio.</span>
            <span className="flex shrink-0 gap-1.5">
              <button type="button" onClick={openDoneModal} className="inline-flex items-center gap-1 rounded-md bg-[#0D7A4F] px-2.5 py-1 text-xs font-semibold text-white"><Check size={13} /> Finalizar</button>
              <button type="button" onClick={() => { setCrText(""); setCrBy("cliente"); setCrModal(true); }} title="Devolver = abrir un request review con el motivo del cambio" className="inline-flex items-center gap-1 rounded-md border border-[#1570EF] px-2.5 py-1 text-xs font-semibold text-[#1570EF]">Devolver</button>
            </span>
          </div>
        )}
        {task.status === "done" && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#A6D9C4] bg-[#E5F5EE] px-2.5 py-1.5">
            <span className="text-xs font-semibold text-[#0D7A4F]"><CheckCircle2 size={12} className="mr-1 inline align-[-2px]" /> Tarea finalizada (archivada){task.completedAt ? ` · ${new Date(task.completedAt).toLocaleDateString()}` : ""}</span>
            <button type="button" onClick={() => onChangeTask(task.id, { status: "doing" })}
              className="inline-flex items-center gap-1 rounded-md border border-[#17727A] px-2 py-0.5 text-[11px] font-semibold text-[#17727A]">
              <LoaderCircle size={12} /> Reactivar
            </button>
          </div>
        )}
        {task.mdTouchedAt && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#F2C879] bg-[#FFF7E6] px-2.5 py-1.5">
            <span className="text-xs font-semibold text-[#B76E00]">
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: "#B76E00" }} />
La IA (MD) complementó esta tarea · {new Date(task.mdTouchedAt).toLocaleString()}
            </span>
            <button type="button" onClick={() => onChangeTask(task.id, { mdTouchedAt: "" })}
              className="rounded border border-[#B76E00] px-2 py-0.5 text-[11px] font-semibold text-[#B76E00]">
              Visto
            </button>
          </div>
        )}

        {Array.isArray(task.comments) && task.comments.length > 0 && (
          <div className="rounded-md border border-[#C4B5FD] bg-[#F5F3FF] p-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#6D28D9]">
              <MessageCircle size={12} /> Comentarios ({task.comments.length})
              {task.comments.length > 3 && <span className="font-semibold normal-case text-[#98A2B3]">· se ven los 3 últimos, baja para ver más</span>}
            </div>
            {/* Se muestran los ÚLTIMOS 3 (recientes arriba); scroll para los anteriores. Cada
                comentario va acotado a 2 líneas para que se mantengan cortos e independientes. */}
            <ul className="mt-2 space-y-1.5 overflow-y-auto pr-0.5" style={{ maxHeight: "168px" }}>
              {[...task.comments].reverse().map((c, i) => (
                <li key={i} className="rounded-md border border-[#E4DED6] bg-white p-2 text-xs">
                  <span className="font-semibold text-[#344054]">{c.author}</span>
                  <span className="text-[#98A2B3]"> · {c.role === "employee" ? "empleado" : "admin"} · {String(c.at || "").slice(0, 10)}</span>
                  <p className="mt-0.5 text-[#667085]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{c.text}</p>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex items-center gap-2">
              <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Responder al empleado…"
                onKeyDown={(e) => { if (e.key === "Enter" && reply.trim()) { onChangeTask(task.id, { comments: [...task.comments, { author: "Administrador", role: "admin", text: reply.trim(), at: new Date().toISOString() }] }); setReply(""); } }}
                className="min-w-0 flex-1 rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054]" />
              <button type="button" disabled={!reply.trim()} onClick={() => { onChangeTask(task.id, { comments: [...task.comments, { author: "Administrador", role: "admin", text: reply.trim(), at: new Date().toISOString() }] }); setReply(""); }}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ background: "#6D28D9" }}>
                <Send size={12} /> Responder
              </button>
            </div>
          </div>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Título</span>
          <input
            value={task.title}
            onChange={(event) => onChangeTask(task.id, { title: event.target.value })}
            className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm font-semibold leading-snug text-[#1D2939] outline-none focus:border-[#17727A]"
            placeholder="Título de la tarea"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Descripción</span>
          <textarea
            value={task.description || ""}
            onChange={(event) => onChangeTask(task.id, { description: event.target.value })}
            rows={4}
            className="min-h-[88px] w-full resize-y rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm leading-relaxed text-[#344054] outline-none focus:border-[#17727A]"
            placeholder="Descripción de la tarea"
          />
        </label>
        <div>
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Tipo de tarea</span>
          {/* Carrusel horizontal (scroll con el dedo) en responsive */}
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            {scopeOptions.map((cat) => {
              const on = task.category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => onChangeTask(task.id, { category: on ? "" : cat })}
                  className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold"
                  style={on
                    ? { borderColor: categoryColor(cat), background: `${categoryColor(cat)}1A`, color: categoryColor(cat) }
                    : { borderColor: "#D0D5DD", background: "#fff", color: "#667085" }}
                  aria-pressed={on}
                >
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: on ? categoryColor(cat) : "#D0D5DD" }} />
                  {cat}
                </button>
              );
            })}
          </div>
        </div>
        {/* DesignOps ligero: puntos (la IA los estima, el admin los puede ajustar) + Request review. */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E4DED6] bg-[#FBFAF7] px-2 py-1.5">
          <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-[#667085]">
            <span className="inline-flex items-center gap-1">Puntos <InfoTip text="Puntos de ESFUERZO (0,5 trámite ≤10 min · 1 simple · 2 media · 4 compleja). El esfuerzo no es la prioridad: un trámite de 0,5 que desbloquea a alguien va primero. Los estima la IA; el admin los puede ajustar." />:</span>
            {[0.5, 1, 2, 4].map((n) => {
              const on = task.designPoints === n;
              return (
                <button key={n} type="button" onClick={() => onChangeTask(task.id, { designPoints: on ? null : n })}
                  title={n === 0.5 ? "Trámite (≤10 min)" : n === 1 ? "Simple" : n === 2 ? "Media" : "Compleja"}
                  className="inline-flex h-6 items-center justify-center rounded-full border px-1.5 text-[11px] font-bold"
                  style={on ? { borderColor: "#17727A", background: "#17727A", color: "#fff" } : { borderColor: "#D0D5DD", color: "#667085", background: "#fff" }}>
                  {n === 0.5 ? "½" : n}
                </button>
              );
            })}
            {task.designPoints == null && <span className="text-[#98A2B3]">(sin estimar)</span>}
          </span>
          <button type="button" onClick={() => { setCrText(""); setCrBy("ceo"); setCrModal(true); }}
            className="inline-flex w-full items-center justify-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold sm:w-auto sm:justify-start"
            style={openCRs.length ? { borderColor: "#B54708", background: "#FFF7E6", color: "#B54708" } : { borderColor: "#D0D5DD", color: "#475467" }}>
            <AlertTriangle size={12} /> Request review
          </button>
        </div>
        {/* Historial de request review: SOLO seguimiento (los cambios nuevos van por el popup de arriba).
            Colapsado por defecto; un puntico avisa si hay alguno abierto. */}
        {changeRequests.length > 0 && (
          <details className="rounded-md border border-[#E4DED6] bg-white px-2 py-1.5">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-[#667085]">
              <ChevronRight size={13} className="ops-caret transition-transform" />
              {openCRs.length > 0 && <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: "#B54708" }} title="Hay request review abiertos" />}
              Historial de request review ({changeRequests.length}{openCRs.length ? ` · ${openCRs.length} abierto(s)` : " · resueltos"})
            </summary>
            <ul className="mt-2 space-y-1.5">
              {[...changeRequests].reverse().map((c) => (
                <li key={c.id} className={`rounded-md border p-2 text-xs ${c.resolved ? "opacity-80" : ""}`} style={{ borderColor: c.resolved ? "#E4DED6" : "#F2C879", background: c.resolved ? "#FBFAF7" : "#FFFCF5" }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={c.by === "cliente" ? { background: "#EAF2FB", color: "#1D5A99" } : { background: "#FFF7E6", color: "#B54708" }}>{c.by === "cliente" ? "Cliente" : "CEO"}</span>
                      <span className="ml-1.5 text-[#98A2B3]">{new Date(c.at).toLocaleDateString()}</span>
                      {c.resolved ? <span className="ml-1.5 font-semibold text-[#0D7A4F]">✓ resuelto por el empleado</span> : <span className="ml-1.5 font-semibold text-[#B54708]">abierto</span>}
                      <p className="mt-0.5 text-[#475467]">{c.text}</p>
                      {(c.resolved_comment || c.resolvedComment) && <p className="mt-1 rounded border border-[#E4DED6] bg-white px-1.5 py-1 text-[#667085]"><b className="text-[#0D7A4F]">Empleado:</b> {c.resolved_comment || c.resolvedComment}</p>}
                    </span>
                    <button type="button" onClick={() => toggleCR(c.id, !c.resolved)} className="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold" style={{ borderColor: "#D0D5DD", color: "#475467" }}>{c.resolved ? "Reabrir" : "Resolver"}</button>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        )}
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Ubicación (empresa · subproyecto)</span>
          <select
            value={`${task.companyId}|||${task.client}`}
            onChange={(event) => { const [companyId, client] = event.target.value.split("|||"); onChangeTask(task.id, { companyId, client }); }}
            className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs font-semibold text-[#344054] outline-none focus:border-[#17727A]"
            title="Mueve la tarea a otra empresa o subproyecto"
          >
            {!locationOptions.some((o) => o.value === `${task.companyId}|||${task.client}`) && (
              <option value={`${task.companyId}|||${task.client}`}>{task.client || "Sin subproyecto"} (actual)</option>
            )}
            {locationOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(110px,1fr)_auto] sm:items-center">
          <div className="relative min-w-0">
            <UserRound className="pointer-events-none absolute left-2 top-1.5 text-[#667085]" size={13} />
            <select
              value={task.assigneeId || ""}
              onChange={(event) => {
                const person = personById(people, event.target.value);
                onChangeTask(task.id, {
                  assigneeId: event.target.value,
                  owner: person?.name || "",
                  emailTo: person?.email || "",
                  audience: person?.type === "Externo" ? "Externo cliente" : "Interno MediaLab",
                });
              }}
              className="w-full rounded-md border border-[#D0D5DD] bg-white py-1 pl-7 pr-2 text-xs text-[#344054] outline-none focus:border-[#17727A]"
              title="Asignar"
            >
              <option value="">Asignar</option>
              {people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
            </select>
          </div>
          <div className="flex rounded-md border border-[#D0D5DD] bg-white p-0.5">
            {stateOptions.map(([key, label, Icon]) => {
              // "En revisión" es un estado que pone el EMPLEADO: el admin no puede clicarlo
              // (sí se ilumina cuando la tarea está ahí). El admin la mueve con Aprobar/Devolver.
              const employeeOnly = key === "review";
              const isOn = task.status === key;
              return (
              <button
                key={key}
                type="button"
                disabled={employeeOnly && !isOn}
                onClick={() => { if (employeeOnly) return; if (key === "done" && task.status !== "done") openDoneModal(); else onChangeTask(task.id, { status: key }); }}
                className="inline-flex h-9 w-9 items-center justify-center rounded disabled:cursor-not-allowed disabled:opacity-40"
                style={isOn
                  ? { background: statusTone(key).text, color: "#fff" }
                  : { color: "#344054" }}
                title={employeeOnly ? `${label} (lo marca el empleado)` : label}
              >
                <Icon size={14} />
              </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          <div className="flex min-w-0 items-center gap-1.5 rounded-md border border-[#E4DED6] bg-white px-2 py-1 text-xs text-[#475467]">
            <CalendarDays size={13} className="shrink-0 text-[#667085]" />
            <span className="shrink-0 font-semibold text-[#344054]">Pub.</span>
            <span className="min-w-0 truncate">{displayDate(task.createdAt)}</span>
          </div>
          <label className="flex min-w-0 items-center gap-1.5 rounded-md border border-[#D0D5DD] bg-white px-2 py-1 text-xs text-[#475467]">
            <CalendarDays size={13} className="shrink-0 text-[#667085]" />
            <span className="shrink-0 font-semibold text-[#344054]">Vence</span>
            <input
              type="date"
              value={task.dueDate || ""}
              onChange={(event) => {
                const nueva = event.target.value;
                if (nueva === task.dueDate) return;
                // Se pone directo (sin pedir motivo) cuando: es la PRIMERA fecha; la tarea todavía
                // NO se ha guardado (recién creada: su fecha por defecto no es un compromiso aún);
                // o ya se justificó el cambio en este ciclo y no se ha vuelto a guardar (corregir un
                // error no debe re-preguntar).
                if (!task.dueDate || task._unsaved || dueJustified) { onChangeTask(task.id, { dueDate: nueva }); return; }
                // Cambiar una fecha YA GUARDADA exige motivo: se abre el popup y no se aplica aún.
                if (nueva) { setDueDraft(nueva); setDueReason(""); }
              }}
              className="min-w-0 flex-1 bg-transparent text-xs text-[#344054] outline-none"
              title="Vencimiento"
            />
          </label>
        </div>
        {/* Soporte del corrimiento: fecha ANTERIOR + MOTIVO del último cambio de vencimiento. */}
        {task.prevDueDate && task.prevDueDate !== task.dueDate && (
          <p className="-mt-1 text-[11px] text-[#B76E00]">
            <CalendarDays size={11} className="mr-1 inline align-[-1px]" />
            Fecha movida · antes vencía el <b>{displayDate(task.prevDueDate)}</b>
            {task.dueChangeReason ? <> · motivo: {task.dueChangeReason}</> : null}
          </p>
        )}
        {assignedPerson ? (
          reportHref ? (
            <a
              href={reportHref}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-md bg-[#17727A] px-3 text-sm font-semibold text-white"
            >
              {reportMedium === "WhatsApp" ? <MessageCircle size={16} /> : <Send size={16} />}
              Enviar a {assignedPerson.name} por {reportMedium}
            </a>
          ) : (
            <p className="rounded-md border border-dashed border-[#D0D5DD] px-3 py-2 text-xs text-[#8b8272]">
              {assignedPerson.name} no tiene {assignedPerson.type === "Externo" ? "WhatsApp" : "Google Chat"} ni correo. Agrégalo en Personas para poder enviarle.
            </p>
          )
        ) : (
          <p className="rounded-md border border-dashed border-[#D0D5DD] px-3 py-2 text-xs text-[#8b8272]">
            Asigna un responsable arriba para enviarle la tarea.
          </p>
        )}
        <div className="flex items-center gap-1.5">
          <Link2 size={13} className="shrink-0 text-[#667085]" />
          <input
            value={linkInput}
            onChange={(event) => setLinkInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && linkInput.trim()) {
                event.preventDefault();
                onChangeTask(task.id, { attachments: [...(task.attachments || []), { type: "link", label: linkInput.trim(), url: linkInput.trim() }] });
                setLinkInput("");
              }
            }}
            placeholder="Link a repositorio (GitHub, GitLab, Figma…)"
            className="min-w-0 flex-1 rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054] outline-none focus:border-[#17727A]"
          />
          <button
            type="button"
            onClick={() => {
              const url = linkInput.trim();
              if (!url) return;
              onChangeTask(task.id, { attachments: [...(task.attachments || []), { type: "link", label: url, url }] });
              setLinkInput("");
            }}
            className="shrink-0 rounded-md border border-[#17727A] px-2.5 py-1.5 text-xs font-semibold text-[#17727A]"
          >
            Agregar link
          </button>
        </div>
        {(task.attachments || []).length > 0 && (
          <ul className="space-y-1 rounded-md border border-[#E4DED6] bg-white p-2">
            {task.attachments.map((attachment, index) => {
              const isLink = attachment.type === "link" || (!attachment.path && attachment.url);
              return (
              <li key={`${attachment.path || attachment.url || attachment.label}-${index}`} className="flex items-center gap-1.5 text-xs text-[#475467]">
                {isLink ? <ExternalLink size={12} className="shrink-0 text-[#17727A]" /> : <Paperclip size={12} className="shrink-0" />}
                <span className="min-w-0 flex-1 break-all">{attachment.label || attachment.path || "Adjunto"}</span>
                {attachmentUrl(attachment) && (
                  <a
                    href={attachmentUrl(attachment)}
                    {...(isLink ? {} : { download: true })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]"
                    title={isLink ? "Abrir repositorio/link" : "Descargar adjunto"}
                  >
                    {isLink ? <ExternalLink size={12} /> : <Download size={12} />}
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => onDeleteAttachment(task.id, index)}
                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#D0D5DD] text-[#B42318]"
                  title="Eliminar adjunto"
                >
                  <Trash2 size={12} />
                </button>
              </li>
              );
            })}
          </ul>
        )}
        {task.status === "done" && (
          <div className="rounded-md border border-[#A6D9C4] bg-[#E5F5EE] p-2">
            <p className="text-xs font-semibold text-[#0D7A4F]">Satisfacción tras entrega (opcional)</p>
            <div className="mt-1 flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onChangeTask(task.id, { rating: n === task.rating ? null : n })}
                  title={`${n} estrella(s)`}
                  className="p-0.5"
                >
                  <Star size={18} style={{ color: "#F2A93B" }} fill={n <= (task.rating || 0) ? "#F2A93B" : "none"} />
                </button>
              ))}
              {task.rating ? <span className="ml-1 text-xs font-semibold text-[#0D7A4F]">{task.rating}/5</span> : <span className="ml-1 text-xs text-[#8b8272]">Sin calificar</span>}
            </div>
            <input
              value={task.ratingComment || ""}
              onChange={(event) => onChangeTask(task.id, { ratingComment: event.target.value })}
              placeholder="Comentario del cliente (opcional)"
              className="mt-2 w-full rounded-md border border-[#A6D9C4] bg-white px-2 py-1.5 text-xs text-[#344054] outline-none focus:border-[#0D7A4F]"
            />
            {task.aiUsage != null && <p className="mt-1 text-xs text-[#6941C6]">IA usada: {task.aiUsage}%</p>}
            {Array.isArray(task.tools) && task.tools.length > 0 && <p className="mt-0.5 text-xs text-[#6941C6]">Herramientas: {task.tools.join(", ")}</p>}
          </div>
        )}
        {/* Guardar TAREA (guardado por tarjeta, a ancho completo, con confirmación). */}
        {onSaveTask && (
          <div className="border-t border-[#E4DED6] pt-2">
            <button type="button" onClick={doSaveTask} disabled={taskSave === "saving"}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-semibold text-white"
              style={{ background: taskSave === "saving" ? "#7FB0B4" : "#17727A" }}>
              {taskSave === "saving" ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />}
              {taskSave === "saving" ? "Guardando…" : taskSave === "saved" ? "Guardada ✓" : "Guardar tarea"}
            </button>
            {taskSave === "error" && <p className="mt-1 text-center text-xs font-semibold text-[#B42318]">⚠ No se guardó. Reintenta.</p>}
          </div>
        )}
      </div>
      {doneModal && (
        <DoneFeedbackModal
          task={task}
          onSave={(patch) => { onChangeTask(task.id, { status: "done", ...patch }); setDoneModal(false); }}
          onDirect={() => { onChangeTask(task.id, { status: "done" }); setDoneModal(false); }}
          onClose={() => setDoneModal(false)}
        />
      )}
      {dueDraft && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setDueDraft(""); }}>
          <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-xl">
            <h3 className="text-sm font-semibold text-[#1D2939]"><CalendarDays size={14} className="mr-1 inline align-[-2px] text-[#B76E00]" /> Cambiar fecha de entrega</h3>
            <p className="mt-1 text-xs text-[#667085]">De <b>{task.dueDate ? displayDate(task.dueDate) : "sin fecha"}</b> a <b className="text-[#B76E00]">{displayDate(dueDraft)}</b>. Un cambio de fecha se hace por un request review o por algo externo a la tarea: <b>di por qué</b> antes de aceptar. Se guarda la fecha anterior como soporte.</p>
            <textarea value={dueReason} onChange={(e) => setDueReason(e.target.value)} rows={3} autoFocus placeholder="Motivo del cambio de fecha (ej. el cliente pidió más tiempo, dependencia externa, request review #…)"
              className="mt-3 w-full rounded-md border border-[#D0D5DD] px-2 py-1.5 text-sm text-[#344054] outline-none focus:border-[#B76E00]" />
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={!dueReason.trim()} onClick={confirmDueChange}
                className="flex-1 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#B76E00" }}>Aceptar cambio de fecha</button>
              <button type="button" onClick={() => setDueDraft("")} className="rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-semibold text-[#344054]">Cancelar</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      {crModal && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) setCrModal(false); }}>
          <div className="w-full max-w-sm rounded-md bg-white p-4 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#1D2939]"><AlertTriangle size={14} className="mr-1 inline align-[-2px] text-[#B54708]" /> Nuevo request review</h3>
                <p className="mt-0.5 text-xs text-[#667085]">Describe el cambio. La tarea vuelve a <b>en progreso</b> y le suena la campana al empleado.</p>
              </div>
              <button type="button" onClick={() => setCrModal(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#667085] hover:bg-[#F2F4F7]"><X size={16} /></button>
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#667085]">Lo pide:</span>
              <select value={crBy} onChange={(e) => setCrBy(e.target.value)} className="rounded-md border border-[#D0D5DD] bg-white px-2 py-1 text-xs font-semibold text-[#344054]">
                <option value="ceo">CEO (revisión interna)</option>
                <option value="cliente">Cliente</option>
              </select>
            </div>
            <textarea value={crText} onChange={(e) => setCrText(e.target.value)} rows={3} autoFocus placeholder="Describe el cambio que se necesita…"
              className="mt-2 w-full rounded-md border border-[#D0D5DD] px-2 py-1.5 text-sm text-[#344054] outline-none focus:border-[#B54708]" />
            <div className="mt-3 flex gap-2">
              <button type="button" disabled={!crText.trim()} onClick={() => { addChangeRequest(); setCrModal(false); }}
                className="flex-1 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#B54708" }}>Pedir cambio</button>
              <button type="button" onClick={() => setCrModal(false)} className="rounded-md border border-[#D0D5DD] px-3 py-2 text-sm font-semibold text-[#344054]">Cancelar</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </details>
  );
}

function CompanyPanel({
  company,
  companies = [],
  highlightId,
  tasks = [],
  people = [],
  growthPractices = [],
  onConvertPractice,
  onDismissPractice,
  newClientName,
  newClientTool,
  newClientBoardUrl,
  sourceRecords,
  onNewClientName,
  onNewClientTool,
  onNewClientBoardUrl,
  onAddClient,
  onUpdateProjectBoard,
  onUpdateProjectDescription,
  onChangeTask,
  onDeleteTask,
  onSaveTask,
  onUploadLogo,
  onToggleLogoBg,
  onToggleProjectImageBg,
  onUploadProjectImage,
  onRenameCompany,
  onRenameClient,
  onToggleScope,
  onAddTaskToClient,
  onUploadSourceDocument,
  onUploadTaskAttachment,
  onDeleteTaskAttachment,
  onUploadContextDocument,
  onReadContextDocuments,
  contextPreview,
  onArchiveClient,
  onDeleteClient,
  onRestoreClient,
  onToggleStatus,
  leads = [],
  onAssignLead,
  onRemoveLead,
}) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState(null);
  // Subproyectos con la lista "Tareas del subproyecto" desplegada (Set de nombres de client).
  const [expandedTaskLists, setExpandedTaskLists] = useState(() => new Set());
  useEffect(() => {
    if (!highlightId) return;
    setOpenTaskId(highlightId);
    // Al crear/resaltar una tarea, ABRE la lista de tareas del subproyecto donde cayó (si estaba
    // colapsada no se veía la tarea nueva).
    const t = (tasks || []).find((x) => x.id === highlightId);
    if (t && t.client) setExpandedTaskLists((prev) => new Set(prev).add(t.client));
  }, [highlightId, tasks]);
  const [editCompanyName, setEditCompanyName] = useState(null); // string en edición o null
  const [editClient, setEditClient] = useState(null); // { old, value } o null
  const [showKpi, setShowKpi] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false); // feedback al copiar el link de acceso
  // Subproyecto pendiente de confirmar borrado (bandeja). Sin window.confirm.
  const [confirmDeleteClient, setConfirmDeleteClient] = useState(null);
  // "Subproyecto y contexto" siempre oculto al abrir/cambiar de empresa.
  useEffect(() => { setSideOpen(false); }, [company?.id]);
  useEffect(() => { setConfirmDeleteClient(null); }, [company?.id]);
  if (!company) return null;
  // "Por asignar" es una bandeja temporal, no una empresa activa: sin
  // indicadores MDSSP y sus subproyectos sí se pueden borrar (los de empresas
  // reales no, para no perder histórico).
  const isBandeja = company.id === "por-asignar";
  const active = activeClients(company);
  const archived = archivedClients(company);
  const companyPeople = (people || []).filter((person) => personBelongsToCompany(person, company.id));
  const companyContextKey = `${company.id}:_empresa`;
  const companyContextDocs = company.contextDocuments?._empresa || [];
  const companyReadableDocs = contextPreview?.[companyContextKey] || [];
  return (
    <section className="rounded-md border border-[#D9D2C7] bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          {(() => { const logoBg = company.logo?.bg === "white" ? "#fff" : "#000"; const logoFg = company.logo?.bg === "white" ? "#667085" : "rgba(255,255,255,0.7)"; return (
          <label className="group relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md border border-[#E4DED6]" style={{ background: logoBg }} title="Subir o cambiar el logo">
            {company.logo?.url
              ? <img src={company.logo.url} alt={company.name} className="h-full w-full object-contain" />
              : <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold" style={{ color: logoFg }}>Logo</span>}
            <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] font-semibold text-white opacity-0 group-hover:opacity-100">Cambiar</span>
            <input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadLogo(file); event.target.value = ""; }} />
          </label>
          ); })()}
          <div className="min-w-0">
          {editCompanyName !== null ? (
            <div className="flex items-center gap-1">
              <input
                autoFocus
                value={editCompanyName}
                onChange={(event) => setEditCompanyName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") { onRenameCompany(editCompanyName); setEditCompanyName(null); }
                  if (event.key === "Escape") setEditCompanyName(null);
                }}
                className="w-full rounded-md border border-[#17727A] bg-white px-2 py-1 text-lg font-semibold text-[#1D2939] outline-none"
              />
              <button type="button" onClick={() => { onRenameCompany(editCompanyName); setEditCompanyName(null); }} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[#17727A] text-white" title="Guardar"><Check size={16} /></button>
              <button type="button" onClick={() => setEditCompanyName(null)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]" title="Cancelar"><X size={16} /></button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              <h2 className="text-lg font-semibold text-[#1D2939]">{company.name}</h2>
              <span className="rounded-full bg-[#EAF4F2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#17727A]">Empresa activa</span>
              <button type="button" onClick={() => setEditCompanyName(company.name)} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[#667085] hover:bg-[#F2F4F7]" title="Editar nombre de la empresa"><Pencil size={13} /></button>
            </div>
          )}
          <p className="mt-1 text-sm text-[#667085]">
            {active.length ? `Subproyectos activos: ${active.join(", ")}` : "Sin subproyectos activos"}
          </p>
          {/* Link de acceso de ESTA empresa: sus empleados externos entran por aquí (login branded
              con el logo de la empresa y vista acotada a sus tareas). MediaLab usa el link principal. */}
          {!isBandeja && (() => {
            const url = `${window.location.origin}/?c=${encodeCompanyToken(company.id)}`;
            const isHome = company.id === "medialab";
            return (
              <div className="mt-2">
                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-[#98A2B3]">
                  <Link2 size={11} /> {isHome ? "Link principal (MediaLab)" : "Link de acceso de la empresa"}
                </p>
                <div className="flex items-center gap-1.5">
                  <input readOnly value={url} onFocus={(e) => e.target.select()}
                    className="min-w-0 flex-1 rounded border border-[#E4DED6] bg-[#F9FAFB] px-2 py-1 font-mono text-[11px] text-[#475467]" title="Link de acceso" />
                  <button type="button"
                    onClick={async () => { try { await navigator.clipboard.writeText(url); setLinkCopied(true); setTimeout(() => setLinkCopied(false), 1500); } catch { /* ignore */ } }}
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded border border-[#D0D5DD] px-2 text-xs font-semibold text-[#344054] hover:border-[#17727A] hover:text-[#17727A]" title="Copiar link">
                    {linkCopied ? <Check size={13} /> : <Link2 size={13} />}{linkCopied ? "Copiado" : "Copiar"}
                  </button>
                </div>
              </div>
            );
          })()}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {/* Insumo a NIVEL EMPRESA: para reuniones que tocan varios subproyectos (sin elegir uno).
              El MD lo reparte entre los subproyectos de la empresa. Compacto (ícono), no infla el layout. */}
          {!isBandeja && (
            <label
              title="Subir insumo para toda la empresa (reunión de varios subproyectos)"
              aria-label="Subir insumo de empresa"
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-md border border-[#17727A] text-[#17727A]"
            >
              <Paperclip size={16} />
              <input type="file" accept=".md,.txt,.pdf,image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadSourceDocument("", f); e.target.value = ""; }} />
            </label>
          )}
          {/* Descargar tareas VIGENTES de la empresa (todas por subproyecto), junto a subir insumo. */}
          {!isBandeja && (
            <button
              type="button"
              onClick={() => openActiveTasksReport({ company, tasks, people, logoUrl })}
              title="Descargar las tareas vigentes de la empresa (todas por subproyecto)"
              aria-label="Descargar tareas vigentes de la empresa"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#B76E00] bg-[#FFF7E6] text-[#B76E00]"
            >
              <Download size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onToggleLogoBg}
            title="Fondo del logo (negro / blanco)"
            aria-label="Cambiar fondo del logo"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]"
          >
            <Contrast size={16} />
          </button>
          {!showKpi && !sideOpen && (
            <button
              type="button"
              onClick={() => setSideOpen(true)}
              title="Subproyecto y contexto"
              aria-label="Subproyecto y contexto"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]"
            >
              <FileText size={16} />
            </button>
          )}
          {!isBandeja && (
          <button
            type="button"
            onClick={() => setShowKpi((v) => !v)}
            title={showKpi ? "Ver proyectos" : "Ver indicadores"}
            aria-label={showKpi ? "Ver proyectos" : "Ver indicadores"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
            style={showKpi ? { borderColor: "#17727A", background: "#EAF4F2", color: "#17727A" } : { borderColor: "#D0D5DD", color: "#344054" }}
          >
            <BarChart3 size={16} />
          </button>
          )}
          <button
            type="button"
            onClick={onToggleStatus}
            title={company.status === "inactiva" ? "Activar empresa" : "Desactivar empresa"}
            aria-label={company.status === "inactiva" ? "Activar empresa" : "Desactivar empresa"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border"
            style={company.status === "inactiva" ? { borderColor: "#0D7A4F", color: "#0D7A4F", background: "#E5F5EE" } : { borderColor: "#D0D5DD", color: "#B42318" }}
          >
            <Power size={16} />
          </button>
        </div>
      </div>

      {/* Alcance del contrato: acordeón (oculto por defecto). */}
      <details className="mt-3 rounded-md border border-[#E4DED6] bg-[#FFFCF7] p-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
          <ChevronRight size={14} className="ops-caret" /> Alcance del contrato
        </summary>
        <p className="mt-1 text-xs text-[#8b8272]">Marca qué tipo de trabajo hace MediaLab aquí. Guía al MD al crear tareas y las etiqueta por tipo.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TASK_CATEGORIES.map((cat) => {
            const on = (company.scope || []).includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onToggleScope(cat)}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold"
                style={on
                  ? { borderColor: categoryColor(cat), background: `${categoryColor(cat)}1A`, color: categoryColor(cat) }
                  : { borderColor: "#D0D5DD", background: "#fff", color: "#667085" }}
                aria-pressed={on}
              >
                <span className="inline-block h-2 w-2 rounded-full" style={{ background: on ? categoryColor(cat) : "#D0D5DD" }} />
                {cat}
              </button>
            );
          })}
        </div>
      </details>

      {/* Líderes de subproyecto: empleados MediaLab que pueden subir tareas/insumos a ese
          subproyecto y editar solo las tareas que ellos crean. */}
      {!isBandeja && (
      <details className="mt-3 rounded-md border border-[#E4DED6] bg-[#FFFCF7] p-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#667085]">
          <ChevronRight size={14} className="ops-caret" /> Líderes de subproyecto
        </summary>
        <p className="mt-1 text-xs text-[#8b8272]">Un líder (empleado MediaLab) puede crear tareas e insumos en su subproyecto desde su portal, y editar solo las tareas que él crea.</p>
        <div className="mt-2 space-y-2">
          {active.length === 0 && <p className="text-xs text-[#98A2B3]">Sin subproyectos activos.</p>}
          {active.map((client) => {
            const mlPeople = people.filter((p) => (p.type || "Empleado MediaLab") === "Empleado MediaLab" && p.email);
            const current = leads.filter((l) => l.companyId === company.id && l.client === client);
            return (
              <div key={client} className="rounded-md border border-[#E4DED6] bg-white p-2">
                <p className="text-xs font-semibold text-[#344054]">{client}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {current.map((l) => (
                    <span key={l.id} className="inline-flex items-center gap-1 rounded-full bg-[#EAF4F2] px-2 py-0.5 text-[11px] font-semibold text-[#17727A]">
                      {mlPeople.find((p) => p.email.toLowerCase() === l.email)?.name || l.email}
                      <button type="button" onClick={() => onRemoveLead?.(l.id)} title="Quitar líder" className="text-[#B42318]"><X size={11} /></button>
                    </span>
                  ))}
                  <select
                    value=""
                    onChange={(e) => { if (e.target.value) onAssignLead?.(company.id, client, e.target.value); e.target.value = ""; }}
                    className="rounded-md border border-[#D0D5DD] bg-white px-2 py-1 text-xs text-[#344054]"
                  >
                    <option value="">+ Agregar líder…</option>
                    {mlPeople
                      .filter((p) => !current.some((l) => l.email === p.email.toLowerCase()))
                      .map((p) => <option key={p.id} value={p.email}>{p.name} ({p.email})</option>)}
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      </details>
      )}

      <div className={sideOpen ? "mt-4 grid gap-4 xl:grid-cols-[300px_1fr]" : "mt-4"}>
        {sideOpen && (
        <div className="rounded-md border border-[#E4DED6] bg-[#FFFCF7] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#667085]">Subproyecto y contexto</span>
            <button
              type="button"
              onClick={() => setSideOpen(false)}
              title="Ocultar"
              className="inline-flex min-h-[32px] items-center gap-1 rounded-md border border-[#D0D5DD] bg-white px-2 text-xs font-semibold text-[#344054]"
            >
              Ocultar <ChevronRight size={14} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setNewProjectOpen((value) => !value)}
            aria-expanded={newProjectOpen}
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border border-[#C7532C] bg-white px-3 text-sm font-semibold text-[#C7532C]"
          >
            <span className="inline-flex items-center gap-2"><Plus size={16} /> Nuevo subproyecto</span>
            <ChevronRight size={16} style={{ transform: newProjectOpen ? "rotate(90deg)" : "none", transition: "transform .15s" }} />
          </button>
          {newProjectOpen && (
          <div className="mt-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Nombre del subproyecto</span>
              <input
                value={newClientName}
                onChange={(event) => onNewClientName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && (onAddClient(), setNewProjectOpen(false))}
                placeholder="Nombre real del subproyecto"
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
              />
            </label>
            <div className="mt-2 grid gap-2 sm:grid-cols-[120px_1fr]">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Herramienta</span>
                <select
                  value={newClientTool}
                  onChange={(event) => onNewClientTool(event.target.value)}
                  className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
                >
                  {BOARD_TOOLS.map((tool) => <option key={tool}>{tool}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Link</span>
                <input
                  value={newClientBoardUrl}
                  onChange={(event) => onNewClientBoardUrl(event.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
                />
              </label>
            </div>
            <button
              onClick={() => { onAddClient(); setNewProjectOpen(false); }}
              className="mt-3 min-h-[44px] w-full rounded-md bg-[#C7532C] px-3 py-2 text-sm font-semibold text-white"
            >
              Agregar subproyecto
            </button>
          </div>
          )}
          <div className="mt-4 rounded-md border border-[#E4DED6] bg-white p-3">
            <h3 className="text-sm font-semibold text-[#1D2939]">Contexto de empresa</h3>
            <p className="mt-1 text-xs text-[#667085]">Convenio, alcance general, responsables y acuerdos marco.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <label className="cursor-pointer rounded-md border border-[#D0D5DD] px-2.5 py-1.5 text-xs font-semibold text-[#344054]">
                Subir documento
                <input
                  type="file"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onUploadContextDocument("", file);
                    event.target.value = "";
                  }}
                />
              </label>
              <button type="button" onClick={() => onReadContextDocuments("")} className="rounded-md border border-[#17727A] px-2.5 py-1.5 text-xs font-semibold text-[#17727A]">
                Leer contexto
              </button>
            </div>
            {companyContextDocs.length > 0 && (
              <ul className="mt-2 space-y-1">
                {companyContextDocs.map((doc, index) => (
                  <li key={`${doc.path}-${index}`} className="text-xs text-[#475467]">{doc.label}</li>
                ))}
              </ul>
            )}
            {companyReadableDocs.length > 0 && (
              <details className="mt-2 rounded-md bg-[#FFFCF7] p-2">
                <summary className="cursor-pointer text-xs font-semibold text-[#17727A]">Texto leido ({companyReadableDocs.length})</summary>
                <div className="mt-2 space-y-2">
                  {companyReadableDocs.map((doc) => (
                    <article key={doc.path}>
                      <p className="text-xs font-semibold text-[#344054]">{doc.label}</p>
                      <pre className="mt-1 max-h-36 overflow-auto whitespace-pre-wrap rounded-md bg-white p-2 text-xs text-[#475467]">{doc.text}</pre>
                    </article>
                  ))}
                </div>
              </details>
            )}
          </div>
        </div>
        )}
        {showKpi && !isBandeja ? (
          <CompanyKpiPanel company={company} tasks={tasks} clients={active} people={companyPeople}
            growthPractices={growthPractices} onConvertPractice={onConvertPractice} onDismissPractice={onDismissPractice} />
        ) : (
        <div className="min-w-0">
          <div className="mb-2 flex items-center gap-1.5">
            <h3 className="text-sm font-semibold text-[#1D2939]">Proyectos y documentación</h3>
            <span
              className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-[#C8BFB3] text-[10px] font-bold leading-none text-[#8b8272]"
              title="Sube .md, .txt o imágenes de menos de 1 MB. Si el archivo trae información útil, se crean tareas editables; si no, se descarta."
            >
              ?
            </span>
          </div>
          <div className="space-y-3">
            {active.length === 0 && (
              <div className="rounded-md border border-dashed border-[#C8BFB3] bg-white p-4 text-sm text-[#667085]">
                Crea un subproyecto real para subir y analizar documentación.
              </div>
            )}
            {active.map((client) => {
              const allProjectTasks = (tasks || []).filter((task) => task.companyId === company.id && task.client === client);
              // Las finalizadas se archivan: no van en la lista principal, pero se pueden consultar.
              const projectTasks = allProjectTasks.filter((task) => task.status !== "done");
              const doneTasks = allProjectTasks.filter((task) => task.status === "done");
              const pendingAssignment = projectTasks.filter((task) => !task.assigneeId && !task.owner).length;
              const overdueTasks = projectTasks.filter(taskIsOverdue).length;
              const contextKey = `${company.id}:${client || "_empresa"}`;
              const contextDocs = company.contextDocuments?.[client] || [];
              const readableDocs = contextPreview?.[contextKey] || [];
              const accent = projectAccent(client);
              const projectImage = company.projectImages?.[client];
              return (
              <div key={client} className="overflow-hidden rounded-md border border-[#E4DED6] bg-white" style={{ borderLeft: `4px solid ${accent}` }}>
                {/* Cabecera con acento diferencial + imagen del subproyecto */}
                <div className="flex items-start gap-3 border-b border-[#E4DED6] p-3" style={{ background: `${accent}14` }}>
                  <label
                    className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-md border"
                    style={{ borderColor: `${accent}55`, background: projectImage?.bg === "white" ? "#fff" : "#000" }}
                    title="Subir o cambiar la imagen del subproyecto"
                  >
                    {projectImage?.url ? (
                      <img src={projectImage.url} alt={client} className="h-full w-full object-contain" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-base font-bold" style={{ color: projectImage?.bg === "white" ? accent : "#fff" }}>{projectInitials(client)}</span>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadProjectImage(client, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <div className="min-w-0 flex-1">
                    {editClient && editClient.old === client ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={editClient.value}
                          onChange={(event) => setEditClient({ old: client, value: event.target.value })}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") { onRenameClient(client, editClient.value); setEditClient(null); }
                            if (event.key === "Escape") setEditClient(null);
                          }}
                          className="w-full rounded-md border px-2 py-1 text-sm font-semibold outline-none"
                          style={{ borderColor: accent, color: accent }}
                        />
                        <button type="button" onClick={() => { onRenameClient(client, editClient.value); setEditClient(null); }} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white" style={{ background: accent }} title="Guardar"><Check size={14} /></button>
                        <button type="button" onClick={() => setEditClient(null)} className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]" title="Cancelar"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="break-words text-sm font-semibold" style={{ color: accent }}>{client}</p>
                        <button type="button" onClick={() => setEditClient({ old: client, value: client })} className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md hover:bg-white/40" style={{ color: accent }} title="Editar nombre del subproyecto"><Pencil size={12} /></button>
                      </div>
                    )}
                    <div className="mt-1 flex flex-nowrap items-center gap-1 overflow-hidden">
                      <span className="whitespace-nowrap rounded-full bg-[#EAF4F2] px-1.5 py-0.5 text-[10px] font-semibold text-[#17727A]">{projectTasks.length} tareas</span>
                      <span className="whitespace-nowrap rounded-full bg-[#FFF7E6] px-1.5 py-0.5 text-[10px] font-semibold text-[#B76E00]">{pendingAssignment} sin asignar</span>
                      <span className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${overdueTasks ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#F2F4F7] text-[#475467]"}`}>{overdueTasks} vencidas</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openActiveTasksReport({ company, tasks, people, logoUrl, client })}
                      title="Descargar las tareas vigentes de este subproyecto"
                      aria-label="Descargar tareas vigentes del subproyecto"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#B76E00] bg-[#FFF7E6] text-[#B76E00]"
                    >
                      <Download size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleProjectImageBg(client)}
                      title="Fondo de la imagen (negro / blanco)"
                      aria-label="Cambiar fondo de la imagen"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]"
                    >
                      <Contrast size={14} />
                    </button>
                    {isBandeja ? (
                      confirmDeleteClient === client ? (
                        <span className="inline-flex items-center gap-1 rounded-md border border-[#B42318] bg-[#FEF3F2] px-1.5 py-0.5">
                          <span className="text-xs font-semibold text-[#B42318]">¿Borrar?</span>
                          <button
                            type="button"
                            onClick={() => { onDeleteClient(client); setConfirmDeleteClient(null); }}
                            className="inline-flex h-7 items-center rounded bg-[#B42318] px-2 text-xs font-semibold text-white"
                            title="Confirmar borrado"
                          >
                            Sí
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteClient(null)}
                            className="inline-flex h-7 items-center rounded border border-[#D0D5DD] bg-white px-2 text-xs font-semibold text-[#344054]"
                            title="Cancelar"
                          >
                            No
                          </button>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteClient(client)}
                          title="Borrar subproyecto de la bandeja"
                          aria-label="Borrar subproyecto de la bandeja"
                          className="inline-flex h-7 items-center gap-1 rounded-md border border-[#F2B8B0] px-2 py-1 text-xs font-semibold text-[#B42318]"
                        >
                          <Trash2 size={14} /> Borrar
                        </button>
                      )
                    ) : (
                      <button
                        type="button"
                        onClick={() => onArchiveClient(client)}
                        title="Archivar subproyecto"
                        aria-label="Archivar subproyecto"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]"
                      >
                        <Archive size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="p-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#17727A] px-3 py-2 text-sm font-semibold text-white">
                      <Plus size={15} /> Subir insumo
                      <input
                        type="file"
                        accept=".md,.txt,.pdf,image/*"
                        className="hidden"
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) onUploadSourceDocument(client, file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => onAddTaskToClient(client)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-2 text-sm font-semibold"
                      style={{ borderColor: accent, color: accent }}
                    >
                      <Plus size={15} /> Nueva tarea
                    </button>
                    {/* El acceso a la plataforma (Jira/Trello…) vive junto a su link en
                        "Ajustes y contexto del proyecto", no aquí (evita saturar). */}
                  </div>

                  <details className="border-t border-[#E4DED6] pt-2">
                    <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold text-[#667085]">
                      <ChevronRight size={15} className="ops-caret" />
                      Ajustes y contexto del proyecto
                    </summary>
                    <div className="mt-2 space-y-2">
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Descripción general del proyecto</span>
                        <textarea
                          value={company.projectDescriptions?.[client] || ""}
                          onChange={(event) => onUpdateProjectDescription(client, event.target.value)}
                          rows={3}
                          placeholder="Objetivo, alcance, contexto del cliente, responsables y notas generales del subproyecto"
                          className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054] outline-none focus:border-[#17727A]"
                        />
                      </label>
                      <div className="grid gap-2 md:grid-cols-[140px_1fr]">
                        <select
                          value={getProjectBoardConfig(company, client).tool}
                          onChange={(event) => onUpdateProjectBoard(client, { tool: event.target.value })}
                          className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054] outline-none focus:border-[#17727A]"
                        >
                          {BOARD_TOOLS.map((tool) => <option key={tool}>{tool}</option>)}
                        </select>
                        <div className="flex items-center gap-1.5">
                          <input
                            value={getProjectBoardConfig(company, client).url}
                            onChange={(event) => onUpdateProjectBoard(client, { url: event.target.value })}
                            placeholder="Link del tablero o herramienta"
                            className="min-w-0 flex-1 rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054] outline-none focus:border-[#17727A]"
                          />
                          {getProjectBoardConfig(company, client).url && (
                            <a href={getProjectBoardConfig(company, client).url} target="_blank" rel="noopener noreferrer"
                              title={`Ir a ${getProjectBoardConfig(company, client).tool}`}
                              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-[#17727A] px-2 text-xs font-semibold text-[#17727A]">
                              <ExternalLink size={13} /> Ir
                            </a>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <p className="text-xs font-semibold text-[#344054]">Documentos de contexto</p>
                        <div className="flex flex-wrap gap-2">
                          <label className="cursor-pointer rounded-md border border-[#D0D5DD] px-2.5 py-1.5 text-xs font-semibold text-[#344054]">
                            Subir
                            <input
                              type="file"
                              className="hidden"
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) onUploadContextDocument(client, file);
                                event.target.value = "";
                              }}
                            />
                          </label>
                          <button type="button" onClick={() => onReadContextDocuments(client)} className="rounded-md border border-[#17727A] px-2.5 py-1.5 text-xs font-semibold text-[#17727A]">
                            Leer
                          </button>
                        </div>
                      </div>
                      {contextDocs.length > 0 && (
                        <ul className="space-y-1">
                          {contextDocs.map((doc, index) => (
                            <li key={`${doc.path}-${index}`} className="text-xs text-[#475467]">{doc.label}</li>
                          ))}
                        </ul>
                      )}
                      {readableDocs.length > 0 && (
                        <details>
                          <summary className="cursor-pointer text-xs font-semibold text-[#17727A]">Ver documentos leídos ({readableDocs.length})</summary>
                          <div className="mt-2 space-y-2">
                            {readableDocs.map((doc) => (
                              <article key={doc.path}>
                                <p className="text-xs font-semibold text-[#344054]">{doc.label} - {doc.scope}</p>
                                <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-[#F7F4EF] p-2 text-xs text-[#475467]">{doc.text}</pre>
                              </article>
                            ))}
                          </div>
                        </details>
                      )}
                    </div>
                  </details>

                  <details className="border-t pt-2" style={{ borderTopColor: `${accent}66` }}
                    open={expandedTaskLists.has(client)}
                    onToggle={(e) => { const isOpen = e.currentTarget.open; setExpandedTaskLists((prev) => { const n = new Set(prev); if (isOpen) n.add(client); else n.delete(client); return n; }); }}>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5">
                        <ChevronRight size={16} className="ops-caret" style={{ color: accent }} />
                        <span className="text-xs font-semibold" style={{ color: accent }}>Tareas del subproyecto</span>
                      </span>
                      <span className="flex flex-nowrap items-center gap-1 overflow-hidden">
                        <span className="whitespace-nowrap rounded-full bg-[#EAF4F2] px-1.5 py-0.5 text-[10px] font-semibold text-[#17727A]">{projectTasks.length} tareas</span>
                        <span className="whitespace-nowrap rounded-full bg-[#FFF7E6] px-1.5 py-0.5 text-[10px] font-semibold text-[#B76E00]">{pendingAssignment} sin asignar</span>
                        <span className={`whitespace-nowrap rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${overdueTasks ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#F2F4F7] text-[#475467]"}`}>{overdueTasks} vencidas</span>
                      </span>
                    </summary>
                    <div className="mt-2 space-y-2">
                      {projectTasks.length ? projectTasks.map((task) => (
                        <ProjectTaskAccordion
                          key={task.id}
                          task={task}
                          company={company}
                          companies={companies}
                          people={companyPeople}
                          open={openTaskId === task.id}
                          onOpenChange={(isOpen) => setOpenTaskId((prev) => (isOpen ? task.id : prev === task.id ? null : prev))}
                          onChangeTask={onChangeTask}
                          onDeleteTask={onDeleteTask}
                          onSaveTask={onSaveTask}
                          onUploadAttachment={onUploadTaskAttachment}
                          onDeleteAttachment={onDeleteTaskAttachment}
                        />
                      )) : (
                        <p className="rounded-md border border-dashed border-[#C8BFB3] bg-[#FFFCF7] p-3 text-xs text-[#667085]">
                          No hay tareas activas en este subproyecto.
                        </p>
                      )}
                      {doneTasks.length > 0 && (
                        <p className="text-xs text-[#8b8272]">{doneTasks.length} finalizada(s) — consúltalas en «Todas las tareas» → Finalizadas.</p>
                      )}
                    </div>
                  </details>
                </div>
              </div>
            );})}
          </div>
          {archived.length > 0 && (
            <div className="mt-4 border-t border-[#E4DED6] pt-3">
              <h3 className="text-sm font-semibold text-[#1D2939]">Subproyectos archivados</h3>
              <div className="mt-2 space-y-2">
                {archived.map((client) => (
                  <div key={client} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[#E4DED6] bg-white p-2">
                    <div>
                      <p className="text-sm font-semibold text-[#667085]">{client}</p>
                      <span className="text-xs text-[#98A2B3]">Historial conservado</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => onRestoreClient(client)} className="rounded-md border border-[#17727A] px-2.5 py-1.5 text-xs font-semibold text-[#17727A]">
                        Reactivar
                      </button>
                      {isBandeja && (
                        confirmDeleteClient === client ? (
                          <span className="inline-flex items-center gap-1 rounded-md border border-[#B42318] bg-[#FEF3F2] px-1.5 py-0.5">
                            <span className="text-xs font-semibold text-[#B42318]">¿Borrar?</span>
                            <button
                              onClick={() => { onDeleteClient(client); setConfirmDeleteClient(null); }}
                              className="inline-flex h-7 items-center rounded bg-[#B42318] px-2 text-xs font-semibold text-white"
                              title="Confirmar borrado"
                            >
                              Sí
                            </button>
                            <button
                              onClick={() => setConfirmDeleteClient(null)}
                              className="inline-flex h-7 items-center rounded border border-[#D0D5DD] bg-white px-2 text-xs font-semibold text-[#344054]"
                              title="Cancelar"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteClient(client)}
                            title="Borrar subproyecto de la bandeja"
                            aria-label="Borrar subproyecto de la bandeja"
                            className="inline-flex h-[30px] items-center gap-1 rounded-md border border-[#F2B8B0] px-2 py-1 text-xs font-semibold text-[#B42318]"
                          >
                            <Trash2 size={14} /> Borrar
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        )}
      </div>
    </section>
  );
}

// Panel de indicadores (KPI) por empresa: cumplidas vs total, por subproyecto, salud,
// satisfacción (rating de tareas) y curva de crecimiento por periodo.
function CompanyKpiPanel({ company, tasks = [], clients = [], people = [], growthPractices = [], onConvertPractice, onDismissPractice }) {
  const [growthOpen, setGrowthOpen] = useState(false);
  const myPractices = growthPractices.filter((p) => p.companyId === company.id);
  const [period, setPeriod] = useState("trimestre");
  const [fbPage, setFbPage] = useState(0); // paginacion del feedback (10 por pagina)
  const companyTasks = tasks.filter((t) => t.companyId === company.id);
  const now = new Date();
  const cutoff = new Date(now);
  if (period === "mes") cutoff.setMonth(now.getMonth() - 1);
  else if (period === "trimestre") cutoff.setMonth(now.getMonth() - 3);
  else if (period === "semestre") cutoff.setMonth(now.getMonth() - 6);
  else cutoff.setFullYear(now.getFullYear() - 1);
  const done = companyTasks.filter((t) => t.status === "done");
  const doneInPeriod = done.filter((t) => t.completedAt && new Date(t.completedAt) >= cutoff);
  const total = companyTasks.length;
  const pctDone = total ? Math.round((done.length / total) * 100) : 0;
  const ratedAll = done.filter((t) => t.rating);
  const avg = ratedAll.length ? ratedAll.reduce((s, t) => s + Number(t.rating), 0) / ratedAll.length : null;
  const activas = companyTasks.filter((t) => t.status !== "done");
  const enProgreso = companyTasks.filter((t) => t.status === "doing").length;
  const enRevision = companyTasks.filter((t) => t.status === "review").length;
  const bloqueadas = companyTasks.filter((t) => t.status === "blocked").length;
  const pendientes = companyTasks.filter((t) => t.status === "ready" || t.status === "backlog").length;
  const vencidas = companyTasks.filter(taskIsOverdue).length;
  // Índice de cumplimiento (periodo) = cumplidas a tiempo ÷ (cumplidas + vencidas sin hacer).
  // "A tiempo" = cumplida sin fecha (no hay plazo que incumplir) o cerrada <= su fecha.
  // Las cumplidas tarde y las vencidas sin hacer bajan el índice.
  const overdueActive = companyTasks.filter((t) => t.status !== "done" && taskIsOverdue(t));
  const doneOnTime = doneInPeriod.filter((t) => !t.dueDate || (t.completedAt && t.completedAt.slice(0, 10) <= t.dueDate)).length;
  const cumplDenom = doneInPeriod.length + overdueActive.length;
  const onTimePct = cumplDenom ? Math.round((doneOnTime / cumplDenom) * 100) : null;
  const seg = [
    ["Entregadas", done.length, "#0D7A4F"],
    ["En revisión", enRevision, "#17727A"],
    ["En progreso", enProgreso, "#1570EF"],
    ["Bloqueadas", bloqueadas, "#B42318"],
    ["Pendientes", pendientes, "#B76E00"],
  ].filter(([, v]) => v > 0);
  const aiTasks = companyTasks.filter((t) => t.aiUsage != null);
  const avgAi = aiTasks.length ? Math.round(aiTasks.reduce((s, t) => s + Number(t.aiUsage), 0) / aiTasks.length) : null;

  // Métricas DesignOps EN PANTALLA (proceso total) — mismas que el reporte, por periodo.
  const DAY_MS = 86400000;
  const weeksP = Math.max(1, ({ mes: 30, trimestre: 90, semestre: 180, "año": 365 }[period] || 90) / 7);
  const cycArr = doneInPeriod.filter((t) => t.createdAt && t.completedAt).map((t) => (new Date(t.completedAt) - new Date(t.createdAt)) / DAY_MS).filter((d) => d >= 0);
  const cycleTime = cycArr.length ? Math.round(cycArr.reduce((a, b) => a + b, 0) / cycArr.length) : null;
  const throughputWk = +(doneInPeriod.length / weeksP).toFixed(1);
  const wip = enProgreso;
  const withPts = companyTasks.filter((t) => t.designPoints != null);
  const velocity = withPts.length ? +(doneInPeriod.reduce((a, t) => a + (Number(t.designPoints) || 0), 0) / weeksP).toFixed(1) : null;
  // Utilización = carga de diseño PENDIENTE ÷ capacidad del PERIODO (ritmo senior 10 pts/sem × semanas
  // del periodo). NO se divide por la velocidad medida (con poca historia tiende a ~0 y dispara el %
  // a cientos). La carga cuenta solo trabajo por hacer: excluye lo entregado/fuera de manos
  // (review, "lista por notificar", notificado), que no es carga real del diseñador.
  const REF_WEEKLY_PTS = 10;
  const capPeriod = REF_WEEKLY_PTS * weeksP;
  const isPendingLoad = (t) => t.status !== "review" && t.status !== "verificacion" && t.status !== "notificado";
  const byDes = {};
  for (const t of activas) if (t.assigneeId && t.designPoints != null && isPendingLoad(t)) byDes[t.assigneeId] = (byDes[t.assigneeId] || 0) + Number(t.designPoints);
  const utilVals = Object.values(byDes).map((p) => Math.round((p / capPeriod) * 100));
  const avgUtil = utilVals.length ? Math.round(utilVals.reduce((a, b) => a + b, 0) / utilVals.length) : null;
  const devArr = doneInPeriod.filter((t) => t.dueDate && t.createdAt && t.completedAt).map((t) => { const est = (new Date(t.dueDate) - new Date(t.createdAt)) / DAY_MS; const real = (new Date(t.completedAt) - new Date(t.createdAt)) / DAY_MS; return est > 0 ? (real - est) / est : null; }).filter((v) => v != null);
  const deviationPct = devArr.length ? Math.round((devArr.reduce((a, b) => a + b, 0) / devArr.length) * 100) : null;
  const defTasks2 = companyTasks.filter((t) => t.qaDefects != null);
  const defectsPer10 = defTasks2.length && doneInPeriod.length ? +(defTasks2.reduce((a, t) => a + (Number(t.qaDefects) || 0), 0) / doneInPeriod.length * 10).toFixed(1) : null;
  const crCount = companyTasks.reduce((a, t) => a + (Array.isArray(t.changeRequests) ? t.changeRequests.filter((c) => !c.resolved).length : (t.changeRequest ? 1 : 0)), 0);
  const toolFreq = {};
  for (const t of companyTasks) if (Array.isArray(t.tools)) for (const tool of t.tools) toolFreq[tool] = (toolFreq[tool] || 0) + 1;
  const toolsSorted = Object.entries(toolFreq).sort((a, b) => b[1] - a[1]);

  const bySub = clients.map((cl) => {
    const ts = companyTasks.filter((t) => t.client === cl);
    const d = ts.filter((t) => t.status === "done").length;
    const overdue = ts.filter(taskIsOverdue).length;
    const blocked = ts.filter((t) => t.status === "blocked").length;
    const donePct = ts.length ? d / ts.length : 0;
    const health = Math.max(0, Math.min(100, Math.round(donePct * 100 - overdue * 15 - blocked * 10)));
    return { cl, total: ts.length, done: d, overdue, blocked, health };
  }).sort((a, b) => a.health - b.health); // peor salud (más deuda) primero

  const months = [];
  for (let i = 5; i >= 0; i -= 1) months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
  const series = months.map((m) => {
    const ds = done.filter((t) => {
      if (!t.completedAt) return false;
      const c = new Date(t.completedAt);
      return c.getFullYear() === m.getFullYear() && c.getMonth() === m.getMonth();
    });
    const r = ds.filter((t) => t.rating);
    return { label: m.toLocaleDateString("es-CO", { month: "short" }), done: ds.length, sat: r.length ? r.reduce((s, t) => s + Number(t.rating), 0) / r.length : 0 };
  });
  const feedback = done.filter((t) => t.rating || t.ratingComment).slice().reverse();
  const healthColor = (hh) => (hh >= 70 ? "#0D7A4F" : hh >= 40 ? "#B76E00" : "#B42318");

  return (
    <div id="kpi-report" className="mt-3 space-y-4">
      {/* Cabecera solo para impresión (reporte entregable con logo). */}
      <div className="mb-2 hidden items-center gap-3 border-b border-[#E4DED6] pb-2 print:flex">
        <img src={company.logo?.url || logoUrl} alt="" className="h-10 w-auto" />
        <div>
          <p className="text-base font-semibold text-[#1D2939]">Reporte de indicadores — {company.name}</p>
          <p className="text-xs text-[#667085]">Generado el {new Date().toLocaleDateString("es-CO")} · MediaLab Ingeniería</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[#1D2939]">Indicadores de {company.name}</h3>
        <div className="flex flex-wrap items-center gap-1">
          {[["mes", "Mes"], ["trimestre", "Trimestre"], ["semestre", "Semestre"], ["año", "Año"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setPeriod(k)} className="rounded-full border px-2.5 py-1 text-xs font-semibold" style={period === k ? { borderColor: "#17727A", background: "#EAF4F2", color: "#17727A" } : { borderColor: "#D0D5DD", color: "#667085" }}>{l}</button>
          ))}
          <button type="button" onClick={() => openDesignOpsReport({ company, tasks, people, clients, logoUrl, period })} className="no-print ml-1 inline-flex items-center gap-1 rounded-full border border-[#17727A] bg-[#EAF4F2] px-2.5 py-1 text-xs font-semibold text-[#17727A]" title={`Descargar el reporte DesignOps (${period}, a corte de hoy)`}><Download size={12} /><span className="hidden sm:inline"> Reporte DesignOps</span></button>
          {/* Botón de CRECIMIENTO: buenas prácticas del proyecto (las genera el MD). */}
          <button type="button" onClick={() => setGrowthOpen(true)} className="no-print inline-flex items-center gap-1 rounded-full border border-[#6941C6] bg-[#F4F1FD] px-2.5 py-1 text-xs font-semibold text-[#6941C6]" title="Buenas prácticas para crecer con este proyecto">
            <Sparkles size={12} /><span className="hidden sm:inline"> Crecimiento</span>{myPractices.length ? ` · ${myPractices.length}` : ""}
          </button>
        </div>
      </div>
      {growthOpen && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={(e) => { if (e.target === e.currentTarget) setGrowthOpen(false); }}>
          <div className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-md bg-white shadow-xl">
            <div className="flex items-start justify-between border-b border-[#E4DED6] p-4">
              <div>
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-[#1D2939]"><Sparkles size={15} className="text-[#6941C6]" /> Crecimiento — {company.name}</h3>
                <p className="mt-0.5 text-xs text-[#667085]">Buenas prácticas para crecer con este cliente (las genera el MD como consultor). Convierte en tarea lo que quieras ejecutar.</p>
              </div>
              <button type="button" onClick={() => setGrowthOpen(false)} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-[#667085] hover:bg-[#F2F4F7]"><X size={16} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {myPractices.length === 0 ? (
                <p className="text-sm text-[#98A2B3]">Aún no hay prácticas para {company.name}. El MD las genera en su corrida (o cuando subas contexto/insumos del proyecto).</p>
              ) : (
                <ul className="space-y-2.5">
                  {myPractices.map((p) => (
                    <li key={p.id} className="rounded-md border border-[#E4DED6] p-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-semibold text-[#1D2939]">{p.titulo}</span>
                        <span className="flex shrink-0 gap-1">
                          <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={p.impacto === "alto" ? { background: "#E5F5EE", color: "#0D7A4F" } : { background: "#F2F4F7", color: "#667085" }}>impacto {p.impacto}</span>
                          <span className="rounded-full bg-[#F2F4F7] px-1.5 py-0.5 text-[10px] font-bold text-[#667085]">esf. {p.esfuerzo}</span>
                        </span>
                      </div>
                      {p.client && <p className="mt-0.5 text-[11px] font-semibold text-[#6941C6]">{p.client}</p>}
                      {p.porque && <p className="mt-1 text-xs text-[#475467]"><b>Por qué:</b> {p.porque}</p>}
                      {p.como && <p className="mt-0.5 text-xs text-[#475467]"><b>Cómo:</b> {p.como}</p>}
                      {p.marco && <p className="mt-0.5 text-[11px] italic text-[#98A2B3]">{p.marco}</p>}
                      <div className="mt-2 flex gap-1.5">
                        <button type="button" onClick={() => { onConvertPractice?.(p); setGrowthOpen(false); }} className="inline-flex items-center gap-1 rounded-md bg-[#6941C6] px-2.5 py-1 text-xs font-semibold text-white"><Plus size={12} /> Convertir en tarea</button>
                        <button type="button" onClick={() => onDismissPractice?.(p.id)} className="rounded-md border border-[#D0D5DD] px-2.5 py-1 text-xs font-semibold text-[#667085]">Descartar</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}

      {/* Mapa dinámico MDSSP: solo dentro de los indicadores de la empresa. */}
      <CompanyMdsspMap company={company} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-md border border-[#E4DED6] bg-white p-3">
          <p className="text-xs text-[#667085]">Tareas cumplidas</p>
          <p className="mt-1 font-metrics text-2xl font-semibold text-[#0D7A4F]">{done.length}<span className="text-base text-[#98A2B3]"> de {total}</span></p>
          <div className="mt-1 h-1.5 w-full rounded-full bg-[#F2F4F7]"><div className="h-1.5 rounded-full bg-[#0D7A4F]" style={{ width: `${pctDone}%` }} /></div>
        </div>
        <div className="rounded-md border border-[#E4DED6] bg-white p-3">
          <p className="text-xs text-[#667085]">Índice de cumplimiento ({period})</p>
          <p className="mt-1 font-metrics text-2xl font-semibold text-[#17727A]">{onTimePct === null ? "—" : `${onTimePct}%`}</p>
          <p className="text-[10px] text-[#98A2B3]">{doneOnTime} a tiempo · {overdueActive.length} vencida(s) sin hacer</p>
        </div>
        <div className="rounded-md border border-[#E4DED6] bg-white p-3">
          <p className="text-xs text-[#667085]">Satisfacción</p>
          <p className="mt-1 flex items-center gap-1 font-metrics text-2xl font-semibold text-[#F2A93B]">{avg ? avg.toFixed(1) : "—"} <Star size={16} fill="#F2A93B" style={{ color: "#F2A93B" }} /></p>
          <p className="text-[10px] text-[#98A2B3]">{ratedAll.length} calificada(s)</p>
        </div>
        <div className="rounded-md border border-[#E4DED6] bg-white p-3">
          <p className="text-xs text-[#667085]">Vencidas · activas</p>
          <p className="mt-1 font-metrics text-2xl font-semibold"><span className="text-[#B42318]">{vencidas}</span> <span className="text-base text-[#98A2B3]">· {activas.length}</span></p>
          <p className="text-[10px] text-[#98A2B3]">{bloqueadas} bloqueada(s)</p>
        </div>
      </div>

      {/* Indicadores DesignOps EN PANTALLA (proceso total) — colapsable, alineado a REACH. */}
      <details className="rounded-md border border-[#E4DED6] bg-white p-3">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#17727A]">
          <ChevronRight size={14} className="ops-caret transition-transform" />
          Indicadores DesignOps <span className="font-normal normal-case text-[#98A2B3]">· proceso total (REACH · {period})</span>
        </summary>
        <div className="mt-2 space-y-3">
        {/* Flujo del trabajo — con ayuda de qué significa cada término */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Cycle time", cycleTime == null ? "—" : `${cycleTime} d`, "días creada→cerrada", "Tiempo de ciclo: días promedio desde que se crea una tarea hasta que se cierra. Mide qué tan rápido fluye el trabajo."],
            ["Throughput", throughputWk, "cerradas/sem", "Rendimiento: cuántas tareas se cierran por semana en promedio. Mide la capacidad de entrega."],
            ["WIP", wip, "en progreso", "Work In Progress: cuántas tareas están en progreso a la vez. Mucho WIP fragmenta el foco y alarga el cycle time."],
            ["Velocidad", velocity == null ? "—" : `${velocity}`, "pts diseño/sem", "Puntos de diseño cerrados por semana (ref. 8–12 senior). Requiere que las tareas tengan puntos estimados."]].map(([k, v, s, help]) => (
            <div key={k} className="rounded-md bg-[#F7FAFA] p-2">
              <p className="flex items-center gap-1 text-[10px] uppercase tracking-[0.06em] text-[#667085]">{k} <InfoTip text={help} /></p>
              <p className="font-metrics text-lg font-semibold text-[#17727A]">{v}</p>
              <p className="text-[9px] text-[#98A2B3]">{s}</p>
            </div>
          ))}
        </div>
        {/* Tabla de indicadores por categoría (valor · meta) */}
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead><tr className="text-[10px] uppercase tracking-[0.05em] text-[#98A2B3]"><th className="py-1 pr-2 font-semibold">Indicador</th><th className="py-1 pr-2 font-semibold">Valor</th><th className="py-1 font-semibold">Meta</th></tr></thead>
            <tbody className="text-[#475467]">
              {[["Predictibilidad de fecha", onTimePct == null ? "—" : `${onTimePct}%`, "≥ 85%"],
                ["Desviación de fechas", deviationPct == null ? "—" : `${deviationPct > 0 ? "+" : ""}${deviationPct}%`, "≤ 10%"],
                ["Utilización por diseñador", avgUtil == null ? "—" : `${avgUtil}%`, "70–90%"],
                ["Defectos UX/UI (por 10)", defectsPer10 == null ? "—" : `${defectsPer10}`, "≤ 2"],
                ["Satisfacción del PO", avg == null ? "—" : `${avg.toFixed(1)} / 5`, "≥ 4,5", "Promedio de calificación del cliente al cerrar la tarea (1–5)."],
                ["Change Requests", `${crCount}`, "documentar", "Cambios que pidió el cliente DESPUÉS de aprobar el diseño (no son alcance original). 'Documentar' = registrarlos siempre para no absorberlos gratis; se marcan en cada tarjeta de tarea."],
                ["Consumo de IA", avgAi == null ? "—" : `${avgAi}%`, "—", "% promedio de IA usada, capturado al cerrar la tarea."]].map(([k, v, m, help]) => (
                <tr key={k} className="border-t border-[#F2F4F7]"><td className="py-1 pr-2"><span className="inline-flex items-center gap-1">{k}{help && <InfoTip text={help} />}</span></td><td className="py-1 pr-2 font-semibold text-[#1D2939]">{v}</td><td className="py-1 text-[#98A2B3]">{m}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        {toolsSorted.length > 0 && (
          <p className="text-[11px] text-[#6941C6]">Herramientas: {toolsSorted.map(([t, n]) => `${t} (${n})`).join(" · ")}</p>
        )}
        <p className="text-[10px] text-[#98A2B3]">Los indicadores con "—" necesitan capturar el dato (puntos de diseño, defectos). El reporte descargable trae este mismo detalle.</p>
        </div>
      </details>

      {/* Distribución de tareas por estado */}
      <div className="rounded-md border border-[#E4DED6] bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-[#344054]">Distribución de tareas ({total})</p>
        {total ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#F2F4F7]">
              {seg.map(([l, v, c]) => <div key={l} title={`${l}: ${v}`} style={{ width: `${(v / total) * 100}%`, background: c }} />)}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[#667085]">
              {seg.map(([l, v, c]) => <span key={l} className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />{l} {v}</span>)}
            </div>
          </>
        ) : <p className="text-xs text-[#8b8272]">Sin tareas.</p>}
      </div>

      {/* Consumo de IA (promedio de las tareas con dato) */}
      <div className="rounded-md border border-[#E4DED6] bg-white p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-[#344054]">Consumo de IA (promedio)</span>
          <span className="font-semibold text-[#6941C6]">{avgAi === null ? "—" : `${avgAi}%`}</span>
        </div>
        <div className="mt-1 h-2 w-full rounded-full bg-[#F2F4F7]"><div className="h-2 rounded-full" style={{ width: `${avgAi || 0}%`, background: "#6941C6" }} /></div>
        <p className="mt-1 text-[10px] text-[#98A2B3]">{aiTasks.length} tarea(s) con dato de IA</p>
      </div>

      <div className="rounded-md border border-[#E4DED6] bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-[#344054]">Curva de cumplimiento y satisfacción (últimos 6 meses)</p>
        <KpiSparkline series={series} />
      </div>

      <div className="rounded-md border border-[#E4DED6] bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-[#344054]">Salud por subproyecto <span className="font-normal text-[#98A2B3]">(más deuda primero)</span></p>
        {bySub.length ? (
          <div className="space-y-2">
            {bySub.map((s) => (
              <div key={s.cl}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-semibold text-[#344054]">{s.cl}</span>
                  <span className="shrink-0 text-[#667085]">{s.done}/{s.total} · {s.overdue} venc · {s.blocked} bloq · <b style={{ color: healthColor(s.health) }}>{s.health}%</b></span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-[#F2F4F7]"><div className="h-2 rounded-full" style={{ width: `${s.health}%`, background: healthColor(s.health) }} /></div>
              </div>
            ))}
          </div>
        ) : <p className="text-xs text-[#8b8272]">Sin subproyectos.</p>}
      </div>

      <div className="rounded-md border border-[#E4DED6] bg-white p-3">
        <p className="mb-2 text-xs font-semibold text-[#344054]">Feedback tras entrega ({feedback.length})</p>
        {feedback.length ? (() => {
          const perPage = 10;
          const pages = Math.max(1, Math.ceil(feedback.length / perPage));
          const page = Math.min(fbPage, pages - 1);
          const shown = feedback.slice(page * perPage, page * perPage + perPage);
          return (
            <>
              <ul className="space-y-2">
                {shown.map((t) => (
                  <li key={t.id} className="rounded-md border border-[#E4DED6] p-2">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => <Star key={n} size={12} fill={n <= (t.rating || 0) ? "#F2A93B" : "none"} style={{ color: "#F2A93B" }} />)}
                      <span className="ml-1 truncate text-xs font-semibold text-[#344054]">{t.title}</span>
                    </div>
                    {t.ratingComment && <p className="mt-0.5 text-xs text-[#667085]">«{t.ratingComment}»</p>}
                  </li>
                ))}
              </ul>
              {pages > 1 && (
                <div className="mt-2 flex items-center justify-between gap-2 print:hidden">
                  <button type="button" onClick={() => setFbPage((p) => Math.max(0, p - 1))} disabled={page === 0}
                    className="inline-flex items-center gap-1 rounded-md border border-[#D0D5DD] bg-white px-2 py-1 text-xs font-semibold text-[#344054] disabled:opacity-40">
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span className="text-xs text-[#667085]">Página {page + 1} de {pages}</span>
                  <button type="button" onClick={() => setFbPage((p) => Math.min(pages - 1, p + 1))} disabled={page >= pages - 1}
                    className="inline-flex items-center gap-1 rounded-md border border-[#D0D5DD] bg-white px-2 py-1 text-xs font-semibold text-[#344054] disabled:opacity-40">
                    Siguiente <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          );
        })() : <p className="text-xs text-[#8b8272]">Aún no hay calificaciones. Al finalizar una tarea puedes darle estrellas.</p>}
      </div>
    </div>
  );
}

// Mapa dinamico MDSSP embebido (parametrico por empresa). Reusa /mdssp.html en modo embed;
// mapea los subproyectos de ESTA empresa como particulas. El iframe crece con su contenido
// (sin scroll). Un cambio en el core del mapa afecta a todas las empresas.
function CompanyMdsspMap({ company }) {
  const mapRef = useRef(null);
  const [mapHeight, setMapHeight] = useState(520);
  useEffect(() => {
    const onMsg = (e) => {
      if (e.data?.type !== "mdssp-height" || !e.data.height) return;
      if (mapRef.current && e.source !== mapRef.current.contentWindow) return;
      setMapHeight(Math.max(420, Math.min(2200, Math.ceil(e.data.height) + 6)));
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);
  return (
    <div className="mt-3 rounded-md border border-[#E4DED6] bg-white p-3 print:hidden">
      <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#344054]">
        <BarChart3 size={14} /> Mapa dinámico de proyectos (MDSSP)
      </p>
      <p className="mb-2 text-xs text-[#667085]">Cada subproyecto es una partícula; las fuerzas (tareas, bloqueos, satisfacción, mediciones) lo mueven hacia los bordes de riesgo.</p>
      <iframe
        ref={mapRef}
        title={`Mapa MDSSP de ${company.name}`}
        src={`/mdssp.html?embed=1&company=${encodeURIComponent(company.id)}`}
        loading="lazy"
        scrolling="no"
        className="block rounded-md border border-[#E4DED6]"
        style={{ height: mapHeight, width: "100%", background: "#fff", overflow: "hidden" }}
      />
    </div>
  );
}

function KpiSparkline({ series }) {
  const w = 320, h = 70, pad = 6;
  const maxDone = Math.max(1, ...series.map((s) => s.done));
  const n = series.length;
  const x = (i) => pad + (i * (w - 2 * pad)) / Math.max(1, n - 1);
  const yDone = (v) => h - pad - (v / maxDone) * (h - 2 * pad);
  const ySat = (v) => h - pad - (v / 5) * (h - 2 * pad);
  const line = (acc, yfn) => series.map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${yfn(acc(s)).toFixed(1)}`).join(" ");
  return (
    <div className="overflow-x-auto">
      <svg width={w} height={h + 16} viewBox={`0 0 ${w} ${h + 16}`} className="max-w-full">
        <path d={line((s) => s.done, yDone)} fill="none" stroke="#17727A" strokeWidth="2" />
        <path d={line((s) => s.sat, ySat)} fill="none" stroke="#F2A93B" strokeWidth="2" strokeDasharray="3 2" />
        {series.map((s, i) => <text key={i} x={x(i)} y={h + 12} textAnchor="middle" fontSize="9" fill="#98A2B3">{s.label}</text>)}
      </svg>
      <div className="mt-1 flex gap-4 text-[10px] text-[#667085]">
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: "#17727A" }} /> Cumplidas</span>
        <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: "#F2A93B" }} /> Satisfacción</span>
      </div>
    </div>
  );
}
