import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Circle, Download, ExternalLink, ListChecks, LoaderCircle, MessageCircle, Paperclip, Plus, Send, Trash2, UserRound } from "lucide-react";
import * as opsData from "./opsData.js";
import logoUrl from "./logos/logo-medialab.png";

const STATUS = {
  backlog: "Por ordenar",
  ready: "Pendiente",
  doing: "En proceso",
  review: "En revisión",
  blocked: "Bloqueada",
  done: "Finalizada",
};

// Color por estado (semántico, aparte del acento de marca).
const STATUS_TONE = {
  backlog: { border: "#D0D5DD", bg: "#F2F4F7", text: "#475467" },
  ready:   { border: "#F2C879", bg: "#FFF7E6", text: "#8A5700" },
  doing:   { border: "#9CC7E4", bg: "#EAF2FB", text: "#1D5A99" },
  review:  { border: "#B7D8D4", bg: "#EAF4F2", text: "#17727A" },
  blocked: { border: "#F3B0A8", bg: "#FEF3F2", text: "#B42318" },
  done:    { border: "#A6D9C4", bg: "#E5F5EE", text: "#0D7A4F" },
};

function statusTone(status) {
  return STATUS_TONE[status] || STATUS_TONE.backlog;
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
      companyIds: Array.isArray(person.companyIds) && person.companyIds.length ? person.companyIds : ["metrics-lab"],
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
  return Boolean(task?.dueDate && task.dueDate < todayIso() && task.status !== "done");
}

function isValidPhone(value) {
  const clean = String(value || "").replace(/[^\d]/g, "");
  return !value || clean.length >= 8;
}

function personById(people, id) {
  return (people || []).find((person) => person.id === id) || null;
}

function personBelongsToCompany(person, companyId) {
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

export default function OperationsHub({ token = "" } = {}) {
  const [companies, setCompanies] = useState(defaultCompanies);
  const [tasks, setTasks] = useState(defaultTasks);
  const [sourceRecords, setSourceRecords] = useState([]);
  const [people, setPeople] = useState([]);
  const [activeCompany, setActiveCompany] = useState("metrics-lab");
  const [insumos, setInsumos] = useState([]);
  const [activeStatus, setActiveStatus] = useState("open");
  const [activeView, setActiveView] = useState("companies");
  const [asideOpen, setAsideOpen] = useState(false);
  const [inboxText, setInboxText] = useState(starterText);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [newClientName, setNewClientName] = useState("");
  const [newClientTool, setNewClientTool] = useState("No aplica");
  const [newClientBoardUrl, setNewClientBoardUrl] = useState("");
  const [newPerson, setNewPerson] = useState({ name: "", email: "", phone: "", type: "Empleado MediaLab", chatUrl: "", contactMethod: "auto" });
  const [contextPreview, setContextPreview] = useState({});
  const [loadedState, setLoadedState] = useState(false);
  const [saveStatus, setSaveStatus] = useState("Sin guardar");

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

  useEffect(() => {
    if (!loadedState) return;
    localStorage.setItem(STORE_KEY, JSON.stringify({ companies, tasks, sourceRecords, people, activeCompany }));
    if (!opsData.opsDataReady()) {
      setSaveStatus("Guardado solo en este navegador");
      return;
    }
    const timer = setTimeout(async () => {
      try {
        setSaveStatus("Guardando…");
        const saved = await opsData.saveState(token, { companies, tasks, sourceRecords, people, activeCompany });
        setSaveStatus(`Supabase: ${new Date(saved.updatedAt).toLocaleString()}`);
      } catch {
        setSaveStatus("Guardado solo en este navegador");
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [companies, tasks, sourceRecords, people, activeCompany, loadedState]);

  const company = companies.find((item) => item.id === activeCompany) || companies[0];
  const activeCompanyClients = activeClients(company);
  const companyTasks = tasks.filter((task) => task.companyId === company?.id);
  const visibleTasks = tasks.filter((task) => {
    if (activeStatus === "open") return task.status !== "done";
    if (activeStatus === "today") return task.dueDate <= todayIso() && task.status !== "done";
    return task.status === activeStatus;
  });

  const metrics = useMemo(() => {
    const open = tasks.filter((task) => task.status !== "done");
    return {
      open: open.length,
      dueToday: open.filter((task) => task.dueDate <= todayIso()).length,
      blocked: open.filter((task) => task.status === "blocked").length,
      companies: companies.length,
    };
  }, [companies.length, tasks]);

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
      setInsumos(await opsData.listInsumos(token, activeCompany));
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

  function createTaskFromInsumo(insumo) {
    const nextTask = {
      id: uid(),
      title: `Revisar insumo: ${insumo.fileName}`,
      companyId: insumo.companyId || activeCompany,
      client: insumo.client || activeCompanyClients[0] || "Sin subproyecto",
      role: "Project Manager",
      owner: "",
      priority: "media",
      status: "backlog",
      dueDate: addDays(2),
      deliveryDate: "",
      source: `Insumo: ${insumo.fileName}`,
      audience: "Interno MediaLab",
      syncMode: "Manual",
      evidence: "",
      attachments: insumo.url ? [{ type: "file", label: insumo.fileName, url: insumo.url, path: insumo.storagePath }] : [],
      createdAt: new Date().toISOString(),
    };
    setTasks((current) => [nextTask, ...current]);
    // keepFile: la tarea se queda con el archivo; solo se quita de "pendientes".
    opsData.deleteInsumo(token, insumo.id, { keepFile: true }).catch(() => {}).finally(loadInsumos);
    setActiveView("tasks");
    setActiveStatus("open");
    setNotice(`Tarea creada desde el insumo ${insumo.fileName}.`);
  }

  function updateTask(id, patch) {
    setTasks((current) => current.map((task) => (task.id === id ? { ...task, ...patch } : task)));
  }

  function deleteTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
    setSourceRecords((current) => current.map((record) => ({
      ...record,
      taskIds: (record.taskIds || []).filter((taskId) => taskId !== id),
      taskCount: Math.max(0, (record.taskIds || []).filter((taskId) => taskId !== id).length),
    })));
    setNotice("Tarea borrada por el manager.");
  }

  function deleteTaskAttachment(taskId, attachmentIndex) {
    setTasks((current) => current.map((task) => (
      task.id === taskId
        ? { ...task, attachments: (task.attachments || []).filter((_, index) => index !== attachmentIndex) }
        : task
    )));
    setNotice("Adjunto eliminado de la tarea.");
  }

  function addPerson() {
    const name = newPerson.name.trim();
    if (!name) return;
    const email = newPerson.email.trim();
    const phone = newPerson.phone.trim();
    if (email && !EMAIL_PATTERN.test(email)) {
      setNotice("Revisa el correo de la persona antes de guardarla.");
      return;
    }
    if (!isValidPhone(phone)) {
      setNotice("Revisa el WhatsApp: incluye indicativo y al menos 8 digitos.");
      return;
    }
    setPeople((current) => [
      ...current,
      {
        id: uid("person"),
        name,
        email,
        phone,
        type: newPerson.type,
        chatUrl: newPerson.chatUrl.trim(),
        contactMethod: newPerson.contactMethod || "auto",
        companyIds: [activeCompany],
      },
    ]);
    setNewPerson({ name: "", email: "", phone: "", type: "Empleado MediaLab", chatUrl: "", contactMethod: "auto" });
    setNotice(`Persona agregada: ${name}.`);
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
    const isImage = isTaskImageFile(file);
    if (!isText && !isImage) {
      setNotice("Sube tareas como .md, .txt o imagen. Máximo 1 MB.");
      return;
    }
    if (!opsData.opsDataReady()) { setNotice("Configura Supabase para subir insumos."); return; }
    try {
      if (isText) {
        const text = await file.text();
        const extracted = localFallbackAnalyze(text, activeCompany).map((task) => ({ ...task, client: task.client || client }));
        mergeTasks(extracted);
        if (extracted.length) {
          mergeRecords([buildPastedRecord({ text, companyId: activeCompany, client, tasks: extracted })]);
          setActiveView("tasks");
          setActiveStatus("open");
          setNotice(`${extracted.length} tareas creadas para ${client}.`);
        } else {
          setNotice(`El texto no generó tareas para ${client}.`);
        }
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
      setNotice(`Insumo (imagen) guardado para ${client}. Queda en "Insumos pendientes".`);
      loadInsumos();
    } catch (error) {
      setNotice(`No pude subir el insumo. ${error.message || "Revisa políticas de Storage."}`);
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
      title: "Tarea manual sin clasificar",
      companyId: activeCompany,
      client: activeCompanyClients[0] || "Sin subproyecto",
      role: "Project Manager",
      owner: "",
      priority: "media",
      status: "backlog",
      dueDate: addDays(2),
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
    setNotice("Tarea manual creada. Puedes completar responsable, proyecto y detalle.");
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
    <div className="min-h-screen bg-[#F7F4EF] text-[#202124]" style={{ fontFamily: "'Lato', 'Segoe UI', system-ui, sans-serif" }}>
      <header className="border-b border-[#D9D2C7] bg-[#FFFCF7]">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <img src={logoUrl} alt="MediaLab Ingeniería" className="h-8 w-auto shrink-0 sm:h-9" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#667085]">Centro operativo</p>
              <h1 className="text-lg font-semibold leading-tight text-[#1D2939] sm:text-xl">Pipeline de proyectos MediaLab</h1>
              <p className="mt-0.5 text-xs text-[#667085]">{saveStatus}</p>
            </div>
          </div>
          <p className="w-fit rounded-md border border-[#E4DED6] bg-white px-3 py-2 text-xs font-semibold text-[#667085]">
            Acceso operativo
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-5 sm:px-5 sm:py-6">
        {/* A-3 / WCAG 4.1.3 — region viva: anuncia a lectores de pantalla el
            resultado de procesar insumos sin que el usuario tenga que buscarlo. */}
        <div role="status" aria-live="polite">
          {notice && (
            <div className="mb-4 rounded-md border border-[#B7D8D4] bg-[#EAF4F2] px-4 py-3 text-sm font-semibold text-[#17727A] shadow-sm">
              {notice}
            </div>
          )}
        </div>

        {(metrics.dueToday > 0 || metrics.blocked > 0) && (
          <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border-l-4 border-[#E8751A] bg-[#FFF7E6] px-4 py-3 text-sm">
            <span className="font-semibold uppercase tracking-[0.08em] text-[#B76E00]">Requiere tu atención hoy</span>
            {metrics.dueToday > 0 && <span className="font-semibold text-[#8A5700]">{metrics.dueToday} vence(n) hoy</span>}
            {metrics.blocked > 0 && <span className="font-semibold text-[#B42318]">{metrics.blocked} con bloqueo</span>}
          </div>
        )}

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Metric label="Tareas abiertas" value={metrics.open} tone="#17727A" icon={ListChecks} />
          <Metric label="Vencen hoy" value={metrics.dueToday} tone="#B76E00" icon={CalendarDays} />
          <Metric label="Bloqueos" value={metrics.blocked} tone="#B42318" icon={AlertTriangle} />
          <Metric label="Empresas" value={metrics.companies} tone="#344054" icon={Building2} />
        </section>

        <div className="mt-5 flex gap-2 overflow-x-auto border-b border-[#D9D2C7]">
          {[
            ["companies", "Empresas y proyectos"],
            ["tasks", "Todas las tareas"],
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
            <p className="mt-1 text-xs text-[#8b8272]">Imágenes y archivos que subiste durante el día. Conviértelos en tarea, descárgalos o bórralos.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {insumos.map((insumo) => (
                <li key={insumo.id} className="flex items-center gap-3 rounded-md border border-[#E4DED6] bg-white p-2">
                  {insumo.url && /imagen|image/i.test(`${insumo.kind} ${insumo.contentType}`) ? (
                    <img src={insumo.url} alt={insumo.fileName} className="h-12 w-12 shrink-0 rounded object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded bg-[#F2F4F7] text-[#667085]"><Paperclip size={16} /></span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#344054]">{insumo.fileName}</p>
                    <p className="truncate text-xs text-[#8b8272]">{insumo.client || "Sin subproyecto"}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={() => createTaskFromInsumo(insumo)} title="Crear tarea desde este insumo" className="inline-flex min-h-[36px] items-center rounded-md bg-[#17727A] px-2 text-xs font-semibold text-white">Crear tarea</button>
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
            <div className={asideOpen ? "grid gap-5 lg:grid-cols-[1fr_320px]" : ""}>
            <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-[#667085]">Empresa activa: <b className="text-[#1D2939]">{company?.name || "—"}</b></span>
              {!asideOpen && (
                <button
                  type="button"
                  onClick={() => setAsideOpen(true)}
                  className="inline-flex min-h-[40px] items-center gap-2 rounded-md border border-[#D0D5DD] bg-white px-3 py-1.5 text-sm font-semibold text-[#344054]"
                >
                  Empresas y personas <ChevronRight size={16} />
                </button>
              )}
            </div>

            <CompanyPanel
              company={company}
              tasks={tasks}
              people={people}
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
            onUploadLogo={uploadCompanyLogo}
            onUploadSourceDocument={uploadSourceDocument}
            onUploadTaskAttachment={uploadTaskAttachment}
            onDeleteTaskAttachment={deleteTaskAttachment}
              onUploadContextDocument={uploadContextDocument}
              onReadContextDocuments={readContextDocuments}
              contextPreview={contextPreview}
              onArchiveClient={(client) => setClientArchived(client, true)}
              onRestoreClient={(client) => setClientArchived(client, false)}
              onToggleStatus={() => {
                setCompanies((current) => current.map((item) => (
                  item.id === company.id
                    ? { ...item, status: item.status === "inactiva" ? "activa" : "inactiva" }
                    : item
                )));
              }}
            />
            </div>

            {asideOpen && (
              <aside className="space-y-3">
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
                {companies.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveCompany(item.id)}
                    className="w-full rounded-md border bg-white p-4 text-left shadow-sm"
                    style={{ borderColor: item.id === activeCompany ? "#17727A" : "#E4DED6" }}
                  >
                    <div className="flex items-start gap-3">
                      {item.logo?.url ? (
                        <img src={item.logo.url} alt={item.name} className="h-9 w-9 shrink-0 rounded-md border border-[#E4DED6] object-contain" />
                      ) : (
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-dashed border-[#C8BFB3] text-xs font-semibold text-[#8b8272]">
                          {item.name?.[0]?.toUpperCase() || "?"}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-[#1D2939]">{item.name}</p>
                        <p className="mt-1 truncate text-xs text-[#667085]">{item.workspaces.join(" + ")}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#EAF4F2] px-2 py-1 text-xs font-semibold text-[#17727A]">{item.status}</span>
                    </div>
                  </button>
                ))}
                <PeoplePanel
                  people={people}
                  newPerson={newPerson}
                  onNewPerson={setNewPerson}
                  onAddPerson={addPerson}
                  onUpdatePerson={updatePerson}
                  onDeletePerson={deletePerson}
                />
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
            onAddTask={addManualTask}
            onChangeTask={updateTask}
            onDeleteTask={deleteTask}
            onUploadAttachment={uploadTaskAttachment}
            onDeleteAttachment={deleteTaskAttachment}
          />
        )}
      </main>
    </div>
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
  onAddTask,
  onChangeTask,
  onDeleteTask,
  onUploadAttachment,
  onDeleteAttachment,
}) {
  return (
    <section className="mt-6 space-y-4">
      <div className="rounded-md border border-[#D9D2C7] bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[#1D2939]">Todas las tareas</h2>
            <p className="text-sm text-[#667085]">Toca una tarea para desplegar y editar lo que se requiere.</p>
          </div>
          <button onClick={onAddTask} className="min-h-[44px] rounded-md bg-[#17727A] px-3 py-2 text-sm font-semibold text-white">
            Crear tarea manual
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            ["open", "Abiertas"],
            ["today", "Por vencer"],
            ["blocked", "Bloqueadas"],
            ["review", "En revisión"],
            ["done", "Cerradas"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => onStatus(key)}
              className="rounded-md border px-3 py-1.5 text-sm font-semibold"
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
      </div>

      <div className="space-y-2">
        {tasks.length ? tasks.map((task) => (
          <ProjectTaskAccordion
            key={task.id}
            task={task}
            company={companies.find((item) => item.id === task.companyId) || companies[0]}
            people={people}
            onChangeTask={onChangeTask}
            onDeleteTask={onDeleteTask}
            onUploadAttachment={onUploadAttachment}
            onDeleteAttachment={onDeleteAttachment}
          />
        )) : (
          <div className="rounded-md border border-dashed border-[#C8BFB3] bg-white p-6 text-center text-sm text-[#667085]">
            No hay tareas en este filtro.
          </div>
        )}
      </div>
    </section>
  );
}

function PeoplePanel({ people, newPerson, onNewPerson, onAddPerson, onUpdatePerson, onDeletePerson }) {
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

function ProjectTaskAccordion({ task, company, people = [], onChangeTask, onDeleteTask, onUploadAttachment, onDeleteAttachment }) {
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
    ["done", "Finalizada", CheckCircle2],
  ];
  return (
    <details className="rounded-md border border-[#E4DED6] bg-[#FFFCF7] p-2">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-2 text-xs font-semibold text-[#1D2939]">
        <span className="min-w-0 flex-1 space-y-1">
          <span className="block break-words">{task.title}</span>
          <span className="flex flex-wrap gap-1 text-xs font-medium text-[#667085]">
            <span className="inline-flex items-center gap-1 rounded border border-[#E4DED6] bg-white px-1.5 py-0.5">
              <CalendarDays size={11} />
              Pub. {displayDate(task.createdAt)}
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-[#E4DED6] bg-white px-1.5 py-0.5">
              <CalendarDays size={11} />
              Vence {displayDate(task.dueDate)}
            </span>
            <span
              className="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-semibold"
              style={overdue
                ? { borderColor: "#B42318", background: "#FEF3F2", color: "#B42318" }
                : { borderColor: statusTone(task.status).border, background: statusTone(task.status).bg, color: statusTone(task.status).text }}
            >
              {overdue ? <AlertTriangle size={11} /> : <Circle size={11} />}
              {overdue ? "Vencida" : (STATUS[task.status] || task.status)}
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-[#E4DED6] bg-white px-1.5 py-0.5">
              <UserRound size={11} />
              {assignedPerson?.name || "Sin asignar"}
            </span>
            <span className="inline-flex items-center gap-1 rounded border border-[#E4DED6] bg-white px-1.5 py-0.5">
              <Send size={11} />
              {reportMedium}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {board.url && (
            <a
              href={board.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(event) => event.stopPropagation()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#D0D5DD] bg-white text-[#344054]"
              title={`Abrir/actualizar ${board.tool}`}
            >
              <ExternalLink size={14} />
            </a>
          )}
          {reportHref && (
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
          {overdue && delayHref && (
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
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (window.confirm("Borrar esta tarea?")) onDeleteTask(task.id);
            }}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-[#B42318] bg-white text-[#B42318]"
            title="Eliminar tarea"
          >
            <Trash2 size={14} />
          </button>
        </span>
      </summary>
      <div className="mt-2 space-y-2">
        <input
          value={task.title}
          onChange={(event) => onChangeTask(task.id, { title: event.target.value })}
          className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs font-semibold leading-snug text-[#1D2939] outline-none focus:border-[#17727A]"
          placeholder="Título de la tarea"
        />
        <textarea
          value={task.description || ""}
          onChange={(event) => onChangeTask(task.id, { description: event.target.value })}
          rows={2}
          className="w-full resize-none rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs leading-snug text-[#344054] outline-none focus:border-[#17727A]"
          placeholder="Descripción de la tarea"
        />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-1.5 sm:grid-cols-[minmax(110px,1fr)_auto] sm:items-center">
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
            {stateOptions.map(([key, label, Icon]) => (
              <button
                key={key}
                type="button"
                onClick={() => onChangeTask(task.id, { status: key })}
                className="inline-flex h-9 w-9 items-center justify-center rounded"
                style={task.status === key
                  ? { background: statusTone(key).text, color: "#fff" }
                  : { color: "#344054" }}
                title={label}
              >
                <Icon size={14} />
              </button>
            ))}
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
              onChange={(event) => onChangeTask(task.id, { dueDate: event.target.value })}
              className="min-w-0 flex-1 bg-transparent text-xs text-[#344054] outline-none"
              title="Vencimiento"
            />
          </label>
        </div>
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
        {(task.attachments || []).length > 0 && (
          <ul className="space-y-1 rounded-md border border-[#E4DED6] bg-white p-2">
            {task.attachments.map((attachment, index) => (
              <li key={`${attachment.path || attachment.label}-${index}`} className="flex items-center gap-1.5 text-xs text-[#475467]">
                <Paperclip size={12} className="shrink-0" />
                <span className="min-w-0 flex-1 break-all">{attachment.label || attachment.path || "Adjunto"}</span>
                {attachmentUrl(attachment) && (
                  <a
                    href={attachmentUrl(attachment)}
                    download
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-[#D0D5DD] text-[#344054]"
                    title="Descargar adjunto"
                  >
                    <Download size={12} />
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
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function CompanyPanel({
  company,
  tasks = [],
  people = [],
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
  onUploadLogo,
  onUploadSourceDocument,
  onUploadTaskAttachment,
  onDeleteTaskAttachment,
  onUploadContextDocument,
  onReadContextDocuments,
  contextPreview,
  onArchiveClient,
  onRestoreClient,
  onToggleStatus,
}) {
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [sideOpen, setSideOpen] = useState(true);
  if (!company) return null;
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
          {company.logo?.url ? (
            <img src={company.logo.url} alt={company.name} className="h-14 w-14 rounded-md border border-[#E4DED6] object-contain" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-md border border-dashed border-[#C8BFB3] bg-[#FFFCF7] text-xs font-semibold text-[#667085]">
              Logo
            </div>
          )}
          <div className="min-w-0">
          <h2 className="text-lg font-semibold text-[#1D2939]">{company.name}</h2>
          <p className="mt-1 text-sm text-[#667085]">
            {active.length ? `Subproyectos activos: ${active.join(", ")}` : "Sin subproyectos activos"}
          </p>
          <label className="mt-2 inline-flex cursor-pointer items-center rounded-md border border-[#D0D5DD] px-2.5 py-1.5 text-xs font-semibold text-[#344054]">
            Subir logo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onUploadLogo(file);
                event.target.value = "";
              }}
            />
          </label>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[#FFF2CC] px-3 py-1 text-sm font-semibold text-[#8A5700]">{company.owner}</span>
          <button onClick={onToggleStatus} className="rounded-md border border-[#D0D5DD] px-3 py-1.5 text-sm font-semibold text-[#344054]">
            {company.status === "inactiva" ? "Activar empresa" : "Desactivar empresa"}
          </button>
        </div>
      </div>
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
            className="flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md bg-[#C7532C] px-3 text-sm font-semibold text-white"
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
        <div className="rounded-md border border-[#E4DED6] bg-[#FFFCF7] p-3">
          {!sideOpen && (
            <button
              type="button"
              onClick={() => setSideOpen(true)}
              className="mb-3 inline-flex min-h-[36px] items-center gap-2 rounded-md border border-[#D0D5DD] bg-white px-3 py-1.5 text-sm font-semibold text-[#344054]"
            >
              <ChevronLeft size={16} /> Subproyecto y contexto
            </button>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold text-[#1D2939]">Proyectos y documentacion</h3>
          </div>
          <div className="mt-2 space-y-2">
            {active.length === 0 && (
              <div className="rounded-md border border-dashed border-[#C8BFB3] bg-white p-4 text-sm text-[#667085]">
                Crea un subproyecto real para subir y analizar documentacion.
              </div>
            )}
            {active.length > 0 && (
              <p className="rounded-md border border-[#E4DED6] bg-white p-2 text-xs text-[#667085]">
                Regla: sube .md, .txt o imagenes de menos de 1 MB. Si el archivo trae informacion util, se crean tareas editables; si no, se descarta.
              </p>
            )}
            {active.map((client) => {
              const projectTasks = (tasks || []).filter((task) => task.companyId === company.id && task.client === client);
              const pendingAssignment = projectTasks.filter((task) => !task.assigneeId && !task.owner).length;
              const overdueTasks = projectTasks.filter(taskIsOverdue).length;
              const contextKey = `${company.id}:${client || "_empresa"}`;
              const contextDocs = company.contextDocuments?.[client] || [];
              const readableDocs = contextPreview?.[contextKey] || [];
              return (
              <div key={client} className="rounded-md border border-[#E4DED6] bg-white p-3">
                <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-[#344054]">{client}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="inline-flex rounded-full bg-[#EAF4F2] px-2 py-0.5 text-xs font-semibold text-[#17727A]">{projectTasks.length} tareas</span>
                      <span className="inline-flex rounded-full bg-[#FFF7E6] px-2 py-0.5 text-xs font-semibold text-[#B76E00]">{pendingAssignment} sin asignar</span>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${overdueTasks ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#F2F4F7] text-[#475467]"}`}>{overdueTasks} vencidas</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => onArchiveClient(client)}
                      className="rounded-md border border-[#D0D5DD] px-2 py-1 text-xs font-semibold text-[#344054]"
                    >
                      Archivar
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mt-2 inline-flex cursor-pointer items-center rounded-md bg-[#17727A] px-3 py-2 text-sm font-semibold text-white">
                    Subir insumo
                    <input
                      type="file"
                      accept=".md,.txt,image/*"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) onUploadSourceDocument(client, file);
                        event.target.value = "";
                      }}
                    />
                  </label>
<label className="mt-2 block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[#667085]">Descripcion general del proyecto</span>
                    <textarea
                      value={company.projectDescriptions?.[client] || ""}
                      onChange={(event) => onUpdateProjectDescription(client, event.target.value)}
                      rows={3}
                      placeholder="Objetivo, alcance, contexto del cliente, responsables y notas generales del subproyecto"
                      className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054] outline-none focus:border-[#17727A]"
                    />
                  </label>
                  <div className="mt-2 grid gap-2 md:grid-cols-[140px_1fr]">
                    <select
                      value={getProjectBoardConfig(company, client).tool}
                      onChange={(event) => onUpdateProjectBoard(client, { tool: event.target.value })}
                      className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054] outline-none focus:border-[#17727A]"
                    >
                      {BOARD_TOOLS.map((tool) => <option key={tool}>{tool}</option>)}
                    </select>
                    <input
                      value={getProjectBoardConfig(company, client).url}
                      onChange={(event) => onUpdateProjectBoard(client, { url: event.target.value })}
                      placeholder="Link del tablero o herramienta"
                      className="w-full rounded-md border border-[#D0D5DD] bg-white px-2 py-1.5 text-xs text-[#344054] outline-none focus:border-[#17727A]"
                    />
                  </div>
                  {getProjectBoardConfig(company, client).url && (
                    <a href={getProjectBoardConfig(company, client).url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs font-semibold text-[#17727A]">
                      Abrir link
                    </a>
                  )}
                  <div className="mt-3 rounded-md border border-[#E4DED6] bg-[#FFFCF7] p-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#344054]">Contexto del subproyecto</p>
                        <p className="text-xs text-[#667085]">Documentos para entender convenio, alcance y criterios.</p>
                      </div>
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
                      <ul className="mt-2 space-y-1">
                        {contextDocs.map((doc, index) => (
                          <li key={`${doc.path}-${index}`} className="text-xs text-[#475467]">{doc.label}</li>
                        ))}
                      </ul>
                    )}
                    {readableDocs.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-[#17727A]">Ver documentos leidos ({readableDocs.length})</summary>
                        <div className="mt-2 space-y-2">
                          {readableDocs.map((doc) => (
                            <article key={doc.path} className="rounded-md border border-[#E4DED6] bg-white p-2">
                              <p className="text-xs font-semibold text-[#344054]">{doc.label} - {doc.scope}</p>
                              <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded-md bg-[#F7F4EF] p-2 text-xs text-[#475467]">{doc.text}</pre>
                            </article>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                  <details className="mt-3 rounded-md border border-[#E4DED6] bg-white p-2">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-[#344054]">Tareas del subproyecto</p>
                        <p className="text-xs text-[#667085]">Abrir para ver todas las tareas.</p>
                      </div>
                      <span className="flex flex-wrap gap-1">
                        <span className="rounded-full bg-[#EAF4F2] px-2 py-0.5 text-xs font-semibold text-[#17727A]">{projectTasks.length} tareas</span>
                        <span className="rounded-full bg-[#FFF7E6] px-2 py-0.5 text-xs font-semibold text-[#B76E00]">{pendingAssignment} sin asignar</span>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${overdueTasks ? "bg-[#FEF3F2] text-[#B42318]" : "bg-[#F2F4F7] text-[#475467]"}`}>{overdueTasks} vencidas</span>
                      </span>
                    </summary>
                    <div className="mt-2 space-y-2">
                      {projectTasks.length ? projectTasks.map((task) => (
                        <ProjectTaskAccordion
                          key={task.id}
                          task={task}
                          company={company}
                          people={companyPeople}
                          onChangeTask={onChangeTask}
                          onDeleteTask={onDeleteTask}
                          onUploadAttachment={onUploadTaskAttachment}
                          onDeleteAttachment={onDeleteTaskAttachment}
                        />
                      )) : (
                        <p className="rounded-md border border-dashed border-[#C8BFB3] bg-[#FFFCF7] p-3 text-xs text-[#667085]">
                          Aún no hay tareas creadas por el análisis de este subproyecto.
                        </p>
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
                    <button onClick={() => onRestoreClient(client)} className="rounded-md border border-[#17727A] px-2.5 py-1.5 text-xs font-semibold text-[#17727A]">
                      Reactivar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
