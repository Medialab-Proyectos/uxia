import React from "react";
import ReactDOM from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CheckCircle2,
  Database,
  Download,
  FileText,
  GitBranch,
  Layers3,
  LineChart,
  Network,
  Plus,
  RefreshCcw,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  UsersRound,
  Workflow,
} from "lucide-react";
import logoUrl from "./logos/logo.svg";

const STORE_KEY = "uxia.mdssp.prototype.v3"; // v3: motor de fuerzas (catalogo + pesos)

const DIMENSIONS = [
  {
    id: "humano",
    name: "Factor humano",
    icon: UsersRound,
    color: "#17727A",
    thesis: "Roles, habilidades, fatiga, confianza, participacion y resistencia al cambio.",
    variables: ["rol", "experiencia digital", "carga cognitiva", "confianza", "participacion", "fatiga"],
  },
  {
    id: "tarea",
    name: "Tarea y flujo",
    icon: Workflow,
    color: "#B54708",
    thesis: "Objetivo, presion de tiempo, frecuencia, pasos criticos, dependencias y puntos de espera.",
    variables: ["frecuencia", "complejidad", "presion temporal", "dependencias", "retrabajo", "handoff"],
  },
  {
    id: "tecnologia",
    name: "Software / tecnologia",
    icon: SlidersHorizontal,
    color: "#1570EF",
    thesis: "Claridad de estructura, consistencia, integraciones, latencia, errores y recuperacion.",
    variables: ["claridad", "consistencia", "integracion", "latencia", "fallos", "recuperacion"],
  },
  {
    id: "interaccion",
    name: "Interaccion UX",
    icon: BrainCircuit,
    color: "#C11574",
    thesis: "Eficacia, eficiencia, satisfaccion, accesibilidad, comprension y costo de aprendizaje.",
    variables: ["eficacia", "eficiencia", "satisfaccion", "accesibilidad", "aprendizaje", "errores de uso"],
  },
  {
    id: "organizacion",
    name: "Organizacion",
    icon: Layers3,
    color: "#6941C6",
    thesis: "Cultura, reglas, responsables, seguimiento, comunicacion y aprendizaje compartido.",
    variables: ["responsable", "canales", "decision", "seguimiento", "cultura", "capacidad de cambio"],
  },
  {
    id: "contexto",
    name: "Contexto externo",
    icon: Network,
    color: "#0D7A4F",
    thesis: "Mercado, regulacion, recursos, clientes, dispositivos, entorno fisico y restricciones.",
    variables: ["cliente", "mercado", "norma", "presupuesto", "entorno", "madurez"],
  },
];

const LIMITS = [
  { id: "observacion", name: "Observacion", short: "OBS", minRisk: 0, color: "#0D7A4F", insetRatio: 0.36 },
  { id: "accion", name: "Accion", short: "ACCION", minRisk: 45, color: "#B54708", insetRatio: 0.25 },
  { id: "alarma", name: "Alarma", short: "ALARMA", minRisk: 70, color: "#B42318", insetRatio: 0.15 },
  { id: "fracaso", name: "Fracaso", short: "FRACASO", minRisk: 86, color: "#151B23", insetRatio: 0.07 },
];

const MODEL_ACTORS = [
  { key: "personas-1", label: "Personas", name: "Equipo del proyecto", type: "personas", color: "#5BAE2D", role: "Usuarios internos, equipo y aprobadores." },
  { key: "personas-2", label: "Personas", name: "Usuario final", type: "personas", color: "#8BB400", role: "Quien vive la friccion de uso." },
  { key: "dispositivos-1", label: "Dispositivos", name: "Software principal", type: "dispositivos", color: "#5B35D5", role: "Aplicacion, IA, flujos e interfaces." },
  { key: "dispositivos-2", label: "Dispositivos", name: "Datos e integraciones", type: "dispositivos", color: "#7137D6", role: "Fuentes, APIs, analitica y automatizaciones." },
  { key: "organizacion", label: "Organizacion", name: "Gobierno del servicio", type: "organizacion", color: "#C82121", role: "Contrato, responsables, presupuesto y decisiones." },
  { key: "entorno", label: "Entorno", name: "Operacion del cliente", type: "entorno", color: "#F6B400", role: "Restricciones del trabajo real." },
  { key: "entorno-2", label: "Entorno", name: "Mercado y regulacion", type: "entorno", color: "#B52121", role: "Presiones externas a la empresa." },
];

const SIGNAL_TO_ACTOR_TYPE = {
  humano: "personas",
  tarea: "personas",
  interaccion: "personas",
  tecnologia: "dispositivos",
  organizacion: "organizacion",
  contexto: "entorno",
};

const INITIAL_PROJECTS = [
  {
    // Ejemplo con los proyectos reales de BID (espejo de los datos del Centro al 2026-07-15).
    id: "bid-demo",
    name: "BID",
    type: "Empresa · 2 proyectos",
    stage: "operacion",
    criticality: 4,
    users: "ClientPortal, Interfaz Fiduciaria",
    goal: "Proyectos: ClientPortal · Interfaz Fiduciaria",
    clients: ["ClientPortal", "Interfaz Fiduciaria"],
  },
  {
    id: "centro-operativo",
    name: "Centro operativo MediaLab",
    type: "Sistema interno",
    stage: "operacion",
    criticality: 4,
    users: "CEO, PM, diseno, desarrollo",
    goal: "Coordinar tareas, evidencias, responsables y satisfaccion por empresa.",
  },
  {
    id: "radar-uxia",
    name: "Radar UXIA",
    type: "Prospeccion / empleabilidad",
    stage: "aprendizaje",
    criticality: 3,
    users: "Direccion, comercial, talento",
    goal: "Detectar oportunidades, priorizarlas y convertirlas en accion.",
  },
  {
    id: "xtreme-collision",
    name: "Xtreme Collision",
    type: "Subproyecto cliente",
    stage: "diagnostico",
    criticality: 4,
    users: "Cliente, usuarios finales, equipo UX",
    goal: "Reducir friccion en conversion, formularios, identidad y confianza.",
  },
];

const INITIAL_SIGNALS = [
  // ---- Ejemplo BID (datos reales del Centro de Operaciones, 2026-07-15) ----
  // ClientPortal: pocos datos aun → fuerzas moderadas, se mantiene cerca del centro.
  {
    id: "bid-sig-1", projectId: "bid-demo", client: "ClientPortal",
    force: "bloqueos", intensity: 0.4,
    title: "3 bloqueos activos",
    evidence: "Data issues con Arvin, bug de login y dependencia del equipo SG Delta.",
  },
  {
    id: "bid-sig-2", projectId: "bid-demo", client: "ClientPortal",
    force: "tardanza", intensity: 0.22,
    title: "1 entrega fuera de fecha",
    evidence: "Entrega completada despues de la fecha comprometida.",
  },
  {
    id: "bid-sig-2b", projectId: "bid-demo", client: "ClientPortal",
    force: "incumplimiento", intensity: 0.28,
    title: "14 de 18 tareas sin cumplir",
    evidence: "Muchas tareas del periodo siguen abiertas.",
  },
  // Interfaz Fiduciaria: solo una vencida → deriva leve hacia alta carga.
  {
    id: "bid-sig-3", projectId: "bid-demo", client: "Interfaz Fiduciaria",
    force: "vencidas", intensity: 0.25,
    title: "1 tarea vencida",
    evidence: "'Ajustar Figma para Rafa' vencio el 2026-07-14 y sigue abierta.",
  },
  {
    id: "sig-1",
    projectId: "xtreme-collision",
    dimension: "interaccion",
    title: "No esta claro donde llegan los formularios",
    evidence: "Capturas y nota de tarea pendiente en inbox del proyecto.",
    severity: 5,
    probability: 4,
    detectability: 2,
    confidence: 3,
    trend: "sube",
  },
  {
    id: "sig-2",
    projectId: "centro-operativo",
    dimension: "organizacion",
    title: "Tareas sin responsable explicito",
    evidence: "Estado operativo: tareas por subproyecto con asignacion pendiente.",
    severity: 3,
    probability: 4,
    detectability: 4,
    confidence: 4,
    trend: "estable",
  },
  {
    id: "sig-3",
    projectId: "radar-uxia",
    dimension: "tecnologia",
    title: "Dependencia de procesamiento manual con IA",
    evidence: "Los insumos se cargan y luego se procesan con un run externo.",
    severity: 3,
    probability: 3,
    detectability: 3,
    confidence: 3,
    trend: "baja",
  },
];

const LIVING_REQUIREMENTS = [
  ["Memoria", "Guardar senales, fuentes, decisiones, cambios de estado y versiones del diagnostico."],
  ["Retroalimentacion", "Cada entrega, queja, metrica o reunion debe alimentar el modelo y no quedar como nota suelta."],
  ["Causalidad", "Relacionar senal -> factor -> impacto -> accion -> resultado para aprender que funciona."],
  ["Tiempo", "Registrar tendencia, recurrencia, antiguedad y velocidad de respuesta, no solo el estado actual."],
  ["Gobernanza", "Responsables, umbrales, reglas de escalamiento y cadencia de revision."],
  ["Observabilidad", "Datos de uso, errores, tiempos, satisfaccion, retrabajo y evidencia cualitativa."],
  ["Adaptacion", "Pesos variables por tipo de empresa, etapa del proyecto, criticidad y madurez del cliente."],
  ["Interoperabilidad", "Conectar tareas, documentos, tableros, CRM, analitica, soporte y repositorios."],
];

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return { projects: INITIAL_PROJECTS, signals: INITIAL_SIGNALS };
}

// ================= DATOS REALES DEL CENTRO DE OPERACIONES =================
// El mapa es POR EMPRESA (cada empresa tiene varios proyectos/subproyectos). Se leen
// empresas y tareas de Supabase con la sesion de la app principal (mismo dominio), y se
// derivan senales automaticas: vencidas/tiempo → carga; bloqueantes/entregas tardias →
// rendimiento; satisfaccion tras entrega → falla economica.
const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

function readSessionToken() {
  try {
    const raw = localStorage.getItem("uxia.supabaseSession");
    return raw ? (JSON.parse(raw)?.access_token || "") : "";
  } catch {
    return "";
  }
}

function deriveSignalsForCompany(tasks, projectId) {
  const out = [];
  const today = new Date().toISOString().slice(0, 10);
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const byClient = {};
  for (const t of tasks) (byClient[t.client || "General"] ||= []).push(t);

  // Cada FUERZA lleva `force` (clave del catalogo), `intensity` 0..1 (que tan fuerte segun
  // los datos) y opcionalmente `weight` (si no, usa el peso por defecto del catalogo).
  // La intensidad se mide en TIEMPOS RELATIVOS: mas vencidas/bloqueos frente al total del
  // proyecto = fuerza mas grande. Ademas, CONFIANZA por cantidad de datos: con poca
  // informacion la fuerza se atenua (evita diagnosticar "falla" con casi nada).
  for (const [client, list] of Object.entries(byClient)) {
    const active = list.filter((t) => t.status !== "done");
    const activeBase = Math.max(1, active.length);
    // Confianza global del proyecto: crece con la cantidad de tareas observadas (satura en ~8).
    const confidence = Math.min(1, list.length / 8);

    // 1) Tareas vencidas (solo VENCIDAS jalan; las en progreso aun no). Intensidad = cuantas
    //    vencidas hay respecto a las tareas activas del proyecto.
    const overdue = active.filter((t) => t.due_date && t.due_date < today && t.status !== "review");
    if (overdue.length) {
      out.push({
        id: `auto-${projectId}-${client}-vencidas`, projectId, client, auto: true,
        force: "vencidas", intensity: confidence * clamp01(overdue.length / activeBase),
        title: `${overdue.length} tarea(s) vencida(s)`,
        evidence: overdue.slice(0, 3).map((t) => t.title).join(" · "),
      });
    }

    // 2) Bloqueos activos → rendimiento. Intensidad = bloqueadas / activas.
    const blocked = active.filter((t) => t.status === "blocked");
    if (blocked.length) {
      out.push({
        id: `auto-${projectId}-${client}-bloqueadas`, projectId, client, auto: true,
        force: "bloqueos", intensity: confidence * clamp01(blocked.length / activeBase),
        title: `${blocked.length} bloqueo(s) activo(s)`,
        evidence: blocked.slice(0, 3).map((t) => t.title).join(" · "),
      });
    }

    const done = list.filter((t) => t.status === "done");
    const totalConDue = list.filter((t) => t.due_date).length;

    // 3) Incumplimiento del periodo: del total de tareas del proyecto, cuantas SIGUEN sin
    //    cumplirse (activas). Muchas pendientes vs cumplidas → deriva lenta a economica.
    if (list.length >= 4) {
      const pendRatio = active.length / list.length;
      if (pendRatio > 0.5) {
        out.push({
          id: `auto-${projectId}-${client}-incumplimiento`, projectId, client, auto: true,
          force: "incumplimiento", intensity: confidence * clamp01((pendRatio - 0.5) * 2),
          title: `${active.length} de ${list.length} tareas sin cumplir`,
          evidence: "Muchas tareas del periodo siguen abiertas.",
        });
      }
    }

    // 4) Tardanza: entregas completadas despues de su fecha → economica.
    const late = done.filter((t) => t.due_date && t.completed_at && t.completed_at.slice(0, 10) > t.due_date);
    if (late.length) {
      out.push({
        id: `auto-${projectId}-${client}-tarde`, projectId, client, auto: true,
        force: "tardanza", intensity: confidence * clamp01(late.length / Math.max(1, totalConDue)),
        title: `${late.length} entrega(s) fuera de fecha`,
        evidence: late.slice(0, 3).map((t) => t.title).join(" · "),
      });
    }

    // 5) Satisfaccion tras entrega (rating 1..5). Baja → calidad insuficiente (rendimiento);
    //    ALTA (≥4) → SALUD: jala el proyecto hacia el centro (contrarresta lo negativo).
    const rated = done.filter((t) => t.rating != null);
    if (rated.length) {
      const avg = rated.reduce((sum, t) => sum + Number(t.rating), 0) / rated.length;
      if (avg < 3) {
        out.push({
          id: `auto-${projectId}-${client}-calidad`, projectId, client, auto: true,
          force: "calidad", intensity: confidence * clamp01((3 - avg) / 2),
          title: `Calidad insuficiente (satisfaccion ${avg.toFixed(1)}/5)`,
          evidence: `${rated.length} entrega(s) calificada(s).`,
        });
      } else if (avg < 4) {
        out.push({
          id: `auto-${projectId}-${client}-feedback`, projectId, client, auto: true,
          force: "usabilidad", intensity: confidence * clamp01((4 - avg) / 1.5),
          title: `Feedback de usuarios regular (${avg.toFixed(1)}/5)`,
          evidence: `${rated.length} entrega(s) calificada(s).`,
        });
      } else {
        // Confianza por CANTIDAD de calificaciones (1 rating no da salud maxima).
        out.push({
          id: `auto-${projectId}-${client}-salud`, projectId, client, auto: true,
          force: "salud", intensity: clamp01(rated.length / 4) * clamp01((avg - 4) / 1),
          title: `Producto saludable (satisfaccion ${avg.toFixed(1)}/5)`,
          evidence: `${rated.length} entrega(s) bien calificada(s).`,
        });
      }
    }

    // 6) Tiempo elevado por entrega (horas laborales) → carga.
    const hours = done.filter((t) => t.worked_hours != null && Number(t.worked_hours) > 0);
    if (hours.length) {
      const avgH = hours.reduce((sum, t) => sum + Number(t.worked_hours), 0) / hours.length;
      if (avgH > 24) {
        out.push({
          id: `auto-${projectId}-${client}-horas`, projectId, client, auto: true,
          force: "tiempo", intensity: confidence * clamp01((avgH - 24) / 56),
          title: `Tiempo elevado: ${Math.round(avgH)} h por entrega`,
          evidence: `${hours.length} entrega(s) con horas registradas.`,
        });
      }
    }
  }
  return out;
}

async function fetchLiveData() {
  const token = readSessionToken();
  if (!SUPABASE_URL || !SUPABASE_ANON || !token) return null;
  const headers = { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` };
  const [companiesRes, projectsRes, tasksRes, measuresRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,name,status&order=name.asc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/projects?select=company_id,name,status`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/tasks?select=company_id,client,title,status,due_date,completed_at,worked_hours,rating`, { headers }),
    // Mediciones de producto (de documentos/feedback sin tareas). Si la tabla aun no existe, se ignora.
    fetch(`${SUPABASE_URL}/rest/v1/product_signals?select=id,company_id,client,force,intensity,weight,title,evidence,source&status=eq.activa`, { headers }).catch(() => null),
  ]);
  if (!companiesRes.ok || !tasksRes.ok) return null;
  const companies = await companiesRes.json();
  const subprojects = projectsRes.ok ? await projectsRes.json() : [];
  const tasks = await tasksRes.json();
  const measures = measuresRes && measuresRes.ok ? await measuresRes.json() : [];
  const projects = companies
    .filter((c) => c.status !== "inactiva")
    .map((c) => {
      const subs = subprojects.filter((p) => p.company_id === c.id && p.status !== "archived").map((p) => p.name);
      return {
        id: c.id,
        name: c.name,
        type: `Empresa · ${subs.length} proyecto(s)`,
        stage: "operacion",
        criticality: 3,
        users: subs.join(", ") || "Sin subproyectos",
        goal: subs.length ? `Proyectos: ${subs.join(" · ")}` : "Sin subproyectos activos.",
        clients: subs,
      };
    });
  const signals = [];
  for (const c of companies) {
    signals.push(...deriveSignalsForCompany(tasks.filter((t) => t.company_id === c.id), c.id));
  }
  // Mediciones de producto (bugs, quejas, satisfaccion equipo, presupuesto, mercado...):
  // vienen de documentos SIN tareas analizados por el run diario, o capturadas a mano.
  for (const m of measures) {
    signals.push({
      id: m.id,
      projectId: m.company_id,
      client: m.client || undefined,
      force: m.force,
      intensity: m.intensity != null ? Number(m.intensity) : 0.4,
      weight: m.weight != null ? Number(m.weight) : undefined,
      title: m.title || m.force,
      evidence: m.evidence || m.source || "",
    });
  }
  return { projects, signals };
}

// Guarda una medicion de producto a mano (variable no derivable de tareas) → tabla
// product_signals. Requiere sesion de la app principal. Devuelve true si se guardo.
async function saveProductSignal({ companyId, client, force, intensity, title, evidence }) {
  const token = readSessionToken();
  if (!SUPABASE_URL || !SUPABASE_ANON || !token) return false;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/product_signals`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify({
      company_id: companyId,
      client: client || null,
      force,
      intensity,
      title: title || (FORCE_CATALOG[force]?.label ?? force),
      evidence: evidence || null,
      source: "Captura manual",
      status: "activa",
    }),
  });
  return res.ok;
}

function riskScore(signal) {
  const sev = Number(signal.severity || 1);
  const prob = Number(signal.probability || 1);
  const det = Number(signal.detectability || 1);
  const conf = Number(signal.confidence || 1);
  return Math.round(((sev * 0.38 + prob * 0.3 + (6 - det) * 0.18 + conf * 0.14) / 5) * 100);
}

function healthColor(value) {
  if (value >= 70) return "#B42318";
  if (value >= 45) return "#B54708";
  return "#0D7A4F";
}

function limitForRisk(value) {
  return [...LIMITS].reverse().find((limit) => value >= limit.minRisk) || LIMITS[0];
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

// Modo EMBED: el Centro de Operaciones embebe este mapa por empresa via
// /mdssp.html?embed=1&company=<id>. Mismo codigo, una sola fuente del core.
const EMBED_PARAMS = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : new URLSearchParams();
const EMBED = EMBED_PARAMS.get("embed") === "1";
const EMBED_COMPANY = EMBED_PARAMS.get("company") || "";

function App() {
  const [state, setState] = React.useState(loadState);
  const [activeProject, setActiveProject] = React.useState(EMBED_COMPANY || state.projects[0]?.id || "");
  const [tab, setTab] = React.useState("sistema");
  const [draft, setDraft] = React.useState({
    title: "",
    evidence: "",
    dimension: "interaccion",
    severity: 3,
    probability: 3,
    detectability: 3,
    confidence: 3,
    trend: "estable",
  });

  const [live, setLive] = React.useState(null);

  React.useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(state));
  }, [state]);

  const [liveAt, setLiveAt] = React.useState(null);
  const [refreshing, setRefreshing] = React.useState(false);

  // Datos reales del Centro de Operaciones (empresas + tareas de Supabase, sesion compartida).
  // Se recalcula el punto de partida CADA VEZ que se entra (mount) con las condiciones
  // actuales; el boton "Actualizar" vuelve a leer la ultima informacion cargada.
  const loadLive = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await fetchLiveData();
      if (data?.projects?.length) {
        setLive(data);
        setLiveAt(new Date());
        setActiveProject((prev) => {
          if (EMBED_COMPANY && data.projects.some((p) => p.id === EMBED_COMPANY)) return EMBED_COMPANY;
          return data.projects.some((p) => p.id === prev) ? prev : data.projects[0].id;
        });
      }
    } catch {
      // se mantiene el demo local
    } finally {
      setRefreshing(false);
    }
  }, []);

  React.useEffect(() => { loadLive(); }, [loadLive]);

  // En modo EMBED: reporta la altura del CONTENIDO INTERNO al Centro (no del documento,
  // para NO crear un bucle con el alto que el iframe recibe). Solo publica cuando cambia
  // de verdad (>2px). Asi el iframe crece sin scroll y sin parpadeo/mareo.
  React.useEffect(() => {
    if (!EMBED || typeof window === "undefined") return undefined;
    const root = document.querySelector(".mdssp-embed-inner");
    if (!root) return undefined;
    let last = 0;
    const post = () => {
      const h = Math.ceil(root.getBoundingClientRect().height) + 10;
      if (Math.abs(h - last) < 3) return; // dedupe: evita el bucle de realimentacion
      last = h;
      try { window.parent?.postMessage({ type: "mdssp-height", height: h }, "*"); } catch { /* ignore */ }
    };
    post();
    const ro = new ResizeObserver(post);
    ro.observe(root);
    return () => ro.disconnect();
  }, []);

  const projects = live?.projects?.length ? live.projects : state.projects;
  const project = projects.find((item) => item.id === activeProject) || projects[0];
  // Referencia estable: solo cambia cuando cambian los datos reales, no en cada render
  // (evita reinicializar la simulacion y que las particulas salten).
  const projectSignals = React.useMemo(() => [
    ...(live?.signals || []).filter((signal) => signal.projectId === project?.id),
    ...state.signals.filter((signal) => signal.projectId === project?.id),
  ], [live, state.signals, project?.id]);
  const avgRisk = projectSignals.length
    ? Math.round(projectSignals.reduce((sum, signal) => sum + riskScore(signal), 0) / projectSignals.length)
    : 0;
  const limitCounts = LIMITS.reduce((acc, limit) => ({ ...acc, [limit.id]: 0 }), {});
  for (const signal of projectSignals) {
    const limit = limitForRisk(riskScore(signal));
    limitCounts[limit.id] += 1;
  }
  const vitality = Math.max(0, Math.min(100, Math.round(
    62
    + projectSignals.length * 5
    + projectSignals.filter((signal) => signal.confidence >= 4).length * 5
    - projectSignals.filter((signal) => riskScore(signal) >= 70).length * 10
  )));
  const strongestDimension = DIMENSIONS
    .map((dimension) => ({
      ...dimension,
      count: projectSignals.filter((signal) => signal.dimension === dimension.id).length,
      risk: projectSignals
        .filter((signal) => signal.dimension === dimension.id)
        .reduce((sum, signal) => sum + riskScore(signal), 0),
    }))
    .sort((a, b) => b.risk - a.risk)[0];

  function addSignal(event) {
    event.preventDefault();
    if (!draft.title.trim() || !project) return;
    setState((prev) => ({
      ...prev,
      signals: [
        {
          ...draft,
          id: uid("sig"),
          projectId: project.id,
          title: draft.title.trim(),
          evidence: draft.evidence.trim() || "Observacion directa sin fuente formal.",
        },
        ...prev.signals,
      ],
    }));
    setDraft((prev) => ({ ...prev, title: "", evidence: "" }));
  }

  function resetDemo() {
    setState({ projects: INITIAL_PROJECTS, signals: INITIAL_SIGNALS });
    setActiveProject(INITIAL_PROJECTS[0].id);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mdssp-uxia.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  // Vista EMBEBIDA (dentro del Centro de Operaciones): solo el mapa + su panel de info/
  // parametrizacion, sin cabecera ni barra lateral. Mismo motor y datos.
  if (EMBED) {
    return (
      <main className="mdssp-app mdssp-embed">
        <Style />
        <div className="mdssp-embed-inner">
          <ParticleSimulation
            project={project}
            signals={projectSignals}
            clients={project?.clients?.length ? project.clients : ["General"]}
          />
          <details className="pm-collapse">
            <summary>Cómo leer · Medición · Resortes</summary>
            <InfoPanel
              companyId={project?.id}
              clients={project?.clients?.length ? project.clients : []}
              onSaved={loadLive}
              canSave={!!live}
            />
          </details>
        </div>
      </main>
    );
  }

  return (
    <main className="mdssp-app">
      <Style />
      <header className="topbar">
        <div className="brand">
          <img src={logoUrl} alt="MediaLab Ingenieria" />
          <div>
            <p>UXIA / Modelo dinamico</p>
            <h1>MDSSP aplicado a usabilidad empresarial</h1>
          </div>
        </div>
        <div className="top-actions">
          <button type="button" onClick={exportJson} title="Exportar JSON"><Download size={16} /> Exportar</button>
          <button type="button" onClick={resetDemo} title="Restaurar datos semilla"><RefreshCcw size={16} /> Reiniciar</button>
        </div>
      </header>

      <section className="workspace">
        <aside className="sidebar">
          <p className="eyebrow">{live ? "Empresas (datos reales)" : "Proyecto observado (demo)"}</p>
          {live ? (
            <div style={{ display: "flex", alignItems: "center", gap: 6, margin: "0 0 8px", flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#0D7A4F", fontWeight: 700 }}>Conectado al Centro</span>
              <button
                type="button"
                onClick={loadLive}
                disabled={refreshing}
                title="Recalcular con la ultima informacion cargada"
                style={{ fontSize: 11, fontWeight: 700, border: "1px solid #cbd5e1", borderRadius: 6, padding: "2px 8px", background: "#fff", cursor: "pointer", color: "#334155" }}
              >
                {refreshing ? "Actualizando…" : "↻ Actualizar"}
              </button>
              {liveAt && <span style={{ fontSize: 10, color: "#98928A" }}>{liveAt.toLocaleTimeString()}</span>}
            </div>
          ) : (
            <p className="live-note" style={{ fontSize: 11, color: "#8b8272", margin: "0 0 8px" }}>Inicia sesion en la app principal para ver tus empresas.</p>
          )}
          <div className="project-list">
            {projects.map((item) => (
              <button
                key={item.id}
                type="button"
                className={item.id === project?.id ? "project active" : "project"}
                onClick={() => setActiveProject(item.id)}
              >
                <span>{item.name}</span>
                <small>{item.type}</small>
              </button>
            ))}
          </div>

          <nav className="tabs" aria-label="Secciones MDSSP">
            {[
              ["sistema", Activity, "Sistema"],
              ["variables", GitBranch, "Variables"],
              ["senales", AlertTriangle, "Senales"],
              ["vivo", ShieldCheck, "Sistema vivo"],
            ].map(([id, Icon, label]) => (
              <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="content">
          <section className="project-head">
            <div>
              <p className="eyebrow">Contexto de uso</p>
              <h2>{project?.name}</h2>
              <p>{project?.goal}</p>
            </div>
            <div className="meta-grid">
              <Metric label="Riesgo UX" value={`${avgRisk}%`} color={healthColor(avgRisk)} />
              <Metric label="Vitalidad" value={`${vitality}%`} color={vitality >= 72 ? "#0D7A4F" : "#B54708"} />
              <Metric label="Alarma" value={limitCounts.alarma} color="#B42318" />
              <Metric label="Fracaso" value={limitCounts.fracaso} color="#D0D5DD" />
            </div>
          </section>

          {tab === "sistema" && (
            <section className="system-layout">
              <article className="panel particle-panel">
                <div className="panel-title">
                  <LineChart size={18} />
                  <h3>Modelo fisico MDSSP: particulas y limites</h3>
                </div>
                <ParticleSimulation
                  project={project}
                  signals={projectSignals}
                  clients={project?.clients?.length ? project.clients : ["General"]}
                />
              </article>
              <InfoPanel
                companyId={project?.id}
                clients={project?.clients?.length ? project.clients : []}
                onSaved={loadLive}
                canSave={!!live}
              />
            </section>
          )}

          {tab === "variables" && (
            <section className="dimension-grid">
              {DIMENSIONS.map((dimension) => (
                <DimensionCard key={dimension.id} dimension={dimension} />
              ))}
            </section>
          )}

          {tab === "senales" && (
            <section className="panel-grid">
              <article className="panel">
                <div className="panel-title">
                  <Plus size={18} />
                  <h3>Nueva senal</h3>
                </div>
                <SignalForm draft={draft} setDraft={setDraft} onSubmit={addSignal} />
              </article>
              <article className="panel wide">
                <div className="panel-title">
                  <FileText size={18} />
                  <h3>Eventos de friccion</h3>
                </div>
                <div className="signals">
                  {projectSignals.map((signal) => (
                    <SignalCard key={signal.id} signal={signal} />
                  ))}
                  {!projectSignals.length && <p className="empty">Aun no hay senales para este proyecto.</p>}
                </div>
              </article>
            </section>
          )}

          {tab === "vivo" && (
            <section className="panel-grid">
              <article className="panel wide">
                <div className="panel-title">
                  <Database size={18} />
                  <h3>Que falta para que se comporte como sistema vivo</h3>
                </div>
                <div className="requirements">
                  {LIVING_REQUIREMENTS.map(([title, text]) => (
                    <div key={title}>
                      <CheckCircle2 size={17} />
                      <span>{title}</span>
                      <p>{text}</p>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel">
                <div className="panel-title">
                  <Save size={18} />
                  <h3>Siguiente salto tecnico</h3>
                </div>
                <ol className="steps">
                  <li>Crear tablas `mdssp_projects`, `mdssp_signals`, `mdssp_actions`, `mdssp_sources` y `mdssp_links`.</li>
                  <li>Conectar tareas actuales de UXIA como acciones del modelo.</li>
                  <li>Guardar evidencias desde documentos, capturas, entrevistas, analitica y feedback.</li>
                  <li>Recalcular pesos por proyecto y mostrar tendencia semanal.</li>
                </ol>
              </article>
            </section>
          )}
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, color }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function Progress({ label, value, color }) {
  return (
    <div className="progress">
      <div>
        <span>{label}</span>
        <b>{value}</b>
      </div>
      <i><em style={{ width: `${value}%`, backgroundColor: color }} /></i>
    </div>
  );
}

// =====================================================================================
// MOTOR FISICO MDSSP — puerto JS fiel del fork traer.physics de la tesis
// (G:\TesisDC\Netbeans\JavaFXApplication3\src\traer\physics) y del documento
// "5. Modelo del sistema fisico.docx":
//  - Particulas con masa = 1 constante (tesis), posicion, velocidad, fuerza.
//  - Cuerdas (ley de Hooke) con constante k, amortiguacion y longitud de reposo (ec. 1).
//  - Friccion -gamma*v (ec. 2) para suprimir la oscilacion armonica.
//  - Fuerzas externas persistentes E que empujan a los limites (ec. 3).
//  - Integracion Runge-Kutta 4 (a = F/m, ec. 4).
//  - Centro de masas con masa amplificada cuyo delta arrastra al sistema (ec. 5,
//    "Referencia2" en el Java con constantedemasa = 80).
//  - Limites: cada variable de entrada es un circulo (cir = extremos, cirm = marginales);
//    la region factible es su interseccion y el sistema se inicializa en el circulo
//    maximo inscrito, con particulas equidistantes a r/2 (posicionamiento circular).
//  - Equilibrio: tras un tiempo limite se verifica la pertenencia de CADA particula a
//    CADA circulo → equilibrio / riesgo (cruza marginal) / desequilibrio (cruza extremo,
//    la simulacion SE DETIENE y se reporta la variable violada). Sin rebotes.
// =====================================================================================

const K_MIN = 0.6;            // rango modelado de la constante de cuerda (tesis; Java: fsola/fentre)
const K_MAX = 1.5;
const CENTER_K = 1.0;         // rigidez de la cuerda al punto ideal (retorno al centro)
const GAMMA = 1.4;            // sobre-amortiguado: la particula NO resortea, deriva y se asienta
const SPRING_DAMPING = 1.0;   // amortiguacion de cuerda (Java: d = 1.0)
const PARTICLE_MASS = 1;      // tesis: masa = 1 y constante en todas las particulas
const MARGINAL_RATIO = 0.93;  // circulos marginales (cirm) respecto a los extremos (cir): amarillo cerca del rojo
const WARMUP_FRAMES = 90;     // Java: limitetiempo — tiempo antes de evaluar equilibrio
const DT = 0.1;               // paso de integracion RK4 (pequeno = deriva lenta y suave)

// ============================ CATALOGO DE FUERZAS =====================================
// Cada variable que afecta un subproyecto es una FUERZA con: (1) el BORDE hacia el que
// empuja, (2) un PESO 0..1 (cuanto "le duele" al producto — parametrizable por proyecto),
// (3) su signo: la mayoria empuja hacia afuera (riesgo); "salud" jala hacia el centro.
// axis: 'economica' (arriba) · 'rendimiento' (derecha) · 'carga' (abajo) · 'centro' (adentro)
const FORCE_CATALOG = {
  // --- Se calculan hoy con datos del Centro de Operaciones ---  (cada fuerza tiene su color)
  vencidas:      { axis: "carga",       weight: 0.70, color: "#E8751A", label: "Tareas vencidas" },
  tardanza:      { axis: "economica",   weight: 0.80, color: "#D4351C", label: "Entregas tardias" },
  tiempo:        { axis: "carga",       weight: 0.55, color: "#B45309", label: "Tiempo elevado por entrega" },
  bloqueos:      { axis: "rendimiento", weight: 0.85, color: "#7C3AED", label: "Bloqueos activos" },
  incumplimiento:{ axis: "economica",   weight: 0.75, color: "#0E7490", label: "Tareas no cumplidas (del total)" },
  calidad:       { axis: "rendimiento", weight: 1.00, color: "#BE123C", label: "Calidad insuficiente (satisfaccion)" },
  usabilidad:    { axis: "rendimiento", weight: 0.60, color: "#C026D3", label: "Feedback de usuarios / usabilidad" },
  salud:         { axis: "centro",      weight: 0.70, color: "#2D9A5A", label: "Producto saludable (jala al centro)" },
  // --- Requieren capturar nuevas variables (ver panel de recomendaciones) ---
  bugs:          { axis: "rendimiento", weight: 0.90, color: "#DC2626", label: "Bugs abiertos del producto" },
  satisfaccion_equipo: { axis: "carga", weight: 0.65, color: "#EA580C", label: "Baja satisfaccion del equipo" },
  presupuesto:   { axis: "economica",   weight: 0.70, color: "#CA8A04", label: "Bajo presupuesto / recursos limitados" },
  tecnologia:    { axis: "rendimiento", weight: 0.60, color: "#9333EA", label: "Tecnologia insuficiente" },
  dependencias:  { axis: "economica",   weight: 0.55, color: "#0891B2", label: "Dependencias externas / normas" },
  mercado:       { axis: "economica",   weight: 0.50, color: "#4F46E5", label: "Referente de mercado / competencia" },
};

// Colores hacia afuera (riesgo) y hacia adentro (retorno / salud) — el usuario los pidio
// diferenciados por DIRECCION en el mapa; el color por tipo de fuerza va en el panel.
const OUT_COLOR = "#E8751A";   // fuerzas que empujan al borde (riesgo)
const RETURN_COLOR = "#1570EF"; // fuerza de retorno al centro
const HEALTH_COLOR = "#2D9A5A"; // producto saludable (jala adentro, "bueno")

// Un color por subproyecto (particula).
const PARTICLE_PALETTE = ["#0EA5E9", "#8B5CF6", "#F59E0B", "#10B981", "#EF4444", "#EC4899"];

// Por que existe cada fuerza y como afecta (para el resumen al hacer click).
const FORCE_WHY = {
  vencidas: "Tareas que pasaron su fecha y siguen abiertas. Consumen equipo sin avanzar → empujan a alta carga.",
  tardanza: "Entregas que se cerraron despues de lo comprometido. Erosionan la confianza del cliente → falla economica.",
  tiempo: "Cada entrega consume muchas horas laborales. El esfuerzo por resultado es alto → alta carga.",
  bloqueos: "Tareas frenadas por defectos o dependencias. El producto no avanza → rendimiento inaceptable.",
  incumplimiento: "Del total del periodo, muchas tareas siguen sin cumplirse. Ritmo lento → falla economica.",
  calidad: "La satisfaccion tras entrega es baja: el producto no cumple lo esperado → rendimiento inaceptable.",
  usabilidad: "Feedback regular de usuarios: fricciones de uso que restan valor → rendimiento inaceptable.",
  salud: "El producto esta bien calificado: es una fuerza BUENA que lo jala de vuelta al centro.",
  bugs: "Bugs abiertos del producto en el periodo → rendimiento inaceptable.",
  satisfaccion_equipo: "El equipo reporta baja satisfaccion/sobrecarga → alta carga de trabajo.",
  presupuesto: "Presupuesto ajustado obliga a recortar alcance o herramientas → falla economica.",
  tecnologia: "La tecnologia disponible es insuficiente para lo requerido → rendimiento inaceptable.",
  dependencias: "Normas o terceros condicionan el lanzamiento → falla economica.",
  mercado: "Referente/competencia marca una brecha frente al producto → falla economica.",
};

// Variables que NO se pueden derivar de tareas y hay que capturar por proyecto.
const MANUAL_VARIABLES = [
  ["bugs", "Bugs abiertos del producto (por periodo)"],
  ["satisfaccion_equipo", "Satisfaccion del equipo (encuesta)"],
  ["calidad", "Calidad/rendimiento probado del producto"],
  ["usabilidad", "Quejas de usuarios / usabilidad"],
  ["presupuesto", "Presupuesto o recursos limitados"],
  ["tecnologia", "Tecnologia insuficiente"],
  ["dependencias", "Dependencias externas / normas"],
  ["mercado", "Referente de mercado / urgencia del producto"],
];

// Grafo socio-tecnico de interacciones actor-actor (cuerdas alpha).
const INTERACTION_GRAPH = [
  ["personas-1", "personas-2"],
  ["personas-1", "dispositivos-1"],
  ["personas-2", "entorno"],
  ["organizacion", "entorno"],
  ["organizacion", "dispositivos-1"],
  ["dispositivos-2", "personas-1"],
  ["entorno-2", "entorno"],
];

class TParticle {
  constructor(mass = 1, meta = {}) {
    this.mass = mass;
    this.position = { x: 0, y: 0, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.force = { x: 0, y: 0, z: 0 };
    // "adicionarfuerza" del fork: fuerza de entrada persistente (termino E de la ec. 3)
    this.persistent = { x: 0, y: 0, z: 0 };
    this.fixed = false;
    this.meta = meta;
  }
  isFree() { return !this.fixed; }
  makeFixed() { this.fixed = true; this.velocity = { x: 0, y: 0, z: 0 }; }
  addPersistentForce(fx, fy, fz = 0) {
    this.persistent.x += fx; this.persistent.y += fy; this.persistent.z += fz;
  }
}

class TSpring {
  constructor(a, b, ks, damping, restLength, kind = "interaccion") {
    this.a = a; this.b = b;
    this.ks = ks; this.damping = damping; this.restLength = restLength;
    this.kind = kind;
    this.on = true;
    this.tension = 0;
  }
  // Puerto exacto de Spring.apply() del Java (fuerza de cuerda + amortiguacion axial).
  apply() {
    const { a, b } = this;
    if (!this.on || (!a.isFree() && !b.isFree())) return;
    let dx = a.position.x - b.position.x;
    let dy = a.position.y - b.position.y;
    let dz = a.position.z - b.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist === 0) { dx = 0; dy = 0; dz = 0; } else { dx /= dist; dy /= dist; dz /= dist; }
    const springForce = -(dist - this.restLength) * this.ks;
    const vx = a.velocity.x - b.velocity.x;
    const vy = a.velocity.y - b.velocity.y;
    const vz = a.velocity.z - b.velocity.z;
    const dampingForce = -this.damping * (dx * vx + dy * vy + dz * vz);
    const r = springForce + dampingForce;
    this.tension = this.restLength > 0.0001 ? Math.abs(dist - this.restLength) / this.restLength : 0;
    if (a.isFree()) { a.force.x += dx * r; a.force.y += dy * r; a.force.z += dz * r; }
    if (b.isFree()) { b.force.x -= dx * r; b.force.y -= dy * r; b.force.z -= dz * r; }
  }
}

class TSystem {
  constructor(gravityY = 0, drag = 0) {
    this.particles = [];
    this.springs = [];
    this.gravity = { x: 0, y: gravityY, z: 0 };
    this.drag = drag;
  }
  makeParticle(mass, x, y, z, meta) {
    const p = new TParticle(mass, meta);
    p.position = { x, y, z };
    this.particles.push(p);
    return p;
  }
  makeSpring(a, b, ks, damping, restLength, kind) {
    const s = new TSpring(a, b, ks, damping, restLength, kind);
    this.springs.push(s);
    return s;
  }
  applyForces() {
    for (const p of this.particles) {
      if (this.gravity.y !== 0) p.force.y += this.gravity.y;
      // termino E (fuerzas de entrada persistentes) + friccion -gamma*v (ec. 2 y 3)
      p.force.x += p.persistent.x - this.drag * p.velocity.x;
      p.force.y += p.persistent.y - this.drag * p.velocity.y;
      p.force.z += p.persistent.z - this.drag * p.velocity.z;
    }
    for (const s of this.springs) s.apply();
  }
  tick(dt = 1) { rk4Step(this, dt); }
}

// Puerto exacto de RungeKuttaIntegrator.step() del Java (4 evaluaciones de fuerza).
function rk4Step(s, dt) {
  const ps = s.particles;
  const op = [], ov = [], k1f = [], k1v = [], k2f = [], k2v = [], k3f = [], k3v = [], k4f = [], k4v = [];
  for (const p of ps) {
    op.push({ ...p.position });
    ov.push({ ...p.velocity });
    p.force = { x: 0, y: 0, z: 0 };
  }
  s.applyForces(); // k1
  for (const p of ps) { k1f.push({ ...p.force }); k1v.push({ ...p.velocity }); p.force = { x: 0, y: 0, z: 0 }; }

  ps.forEach((p, i) => {
    if (!p.isFree()) return;
    p.position = {
      x: op[i].x + k1v[i].x * 0.5 * dt,
      y: op[i].y + k1v[i].y * 0.5 * dt,
      z: op[i].z + k1v[i].z * 0.5 * dt,
    };
    p.velocity = {
      x: ov[i].x + (k1f[i].x * 0.5 * dt) / p.mass,
      y: ov[i].y + (k1f[i].y * 0.5 * dt) / p.mass,
      z: ov[i].z + (k1f[i].z * 0.5 * dt) / p.mass,
    };
  });
  s.applyForces(); // k2
  for (const p of ps) { k2f.push({ ...p.force }); k2v.push({ ...p.velocity }); p.force = { x: 0, y: 0, z: 0 }; }

  ps.forEach((p, i) => {
    if (!p.isFree()) return;
    p.position = {
      x: op[i].x + k2v[i].x * 0.5 * dt,
      y: op[i].y + k2v[i].y * 0.5 * dt,
      z: op[i].z + k2v[i].z * 0.5 * dt,
    };
    p.velocity = {
      x: ov[i].x + (k2f[i].x * 0.5 * dt) / p.mass,
      y: ov[i].y + (k2f[i].y * 0.5 * dt) / p.mass,
      z: ov[i].z + (k2f[i].z * 0.5 * dt) / p.mass,
    };
  });
  s.applyForces(); // k3
  for (const p of ps) { k3f.push({ ...p.force }); k3v.push({ ...p.velocity }); p.force = { x: 0, y: 0, z: 0 }; }

  ps.forEach((p, i) => {
    if (!p.isFree()) return;
    p.position = {
      x: op[i].x + k3v[i].x * dt,
      y: op[i].y + k3v[i].y * dt,
      z: op[i].z + k3v[i].z * dt,
    };
    p.velocity = {
      x: ov[i].x + (k3f[i].x * dt) / p.mass,
      y: ov[i].y + (k3f[i].y * dt) / p.mass,
      z: ov[i].z + (k3f[i].z * dt) / p.mass,
    };
  });
  s.applyForces(); // k4
  for (const p of ps) { k4f.push({ ...p.force }); k4v.push({ ...p.velocity }); }

  ps.forEach((p, i) => {
    if (!p.isFree()) return;
    p.position = {
      x: op[i].x + (dt / 6) * (k1v[i].x + 2 * k2v[i].x + 2 * k3v[i].x + k4v[i].x),
      y: op[i].y + (dt / 6) * (k1v[i].y + 2 * k2v[i].y + 2 * k3v[i].y + k4v[i].y),
      z: op[i].z + (dt / 6) * (k1v[i].z + 2 * k2v[i].z + 2 * k3v[i].z + k4v[i].z),
    };
    p.velocity = {
      x: ov[i].x + (dt / (6 * p.mass)) * (k1f[i].x + 2 * k2f[i].x + 2 * k3f[i].x + k4f[i].x),
      y: ov[i].y + (dt / (6 * p.mass)) * (k1f[i].y + 2 * k2f[i].y + 2 * k3f[i].y + k4f[i].y),
      z: ov[i].z + (dt / (6 * p.mass)) * (k1f[i].z + 2 * k2f[i].z + 2 * k3f[i].z + k4f[i].z),
    };
  });
}

// Circulo maximo inscrito en la interseccion de circulos (region factible).
// f(p) = min_i(r_i - |p - c_i|) es concava: se maximiza con busqueda de patron
// (equivale al CentrePolygon/programacion lineal del Java y la tesis).
function maxInscribedCircle(circles) {
  const f = (x, y) => Math.min(...circles.map((c) => c.r - Math.hypot(x - c.x, y - c.y)));
  let x = circles.reduce((sum, c) => sum + c.x, 0) / circles.length;
  let y = circles.reduce((sum, c) => sum + c.y, 0) / circles.length;
  let best = f(x, y);
  let step = Math.max(...circles.map((c) => c.r)) / 2;
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [0.707, 0.707], [0.707, -0.707], [-0.707, 0.707], [-0.707, -0.707]];
  let guard = 0;
  while (step > 0.001 && guard < 500) {
    guard += 1;
    let improved = false;
    for (const [ddx, ddy] of dirs) {
      const v = f(x + ddx * step, y + ddy * step);
      if (v > best) { best = v; x += ddx * step; y += ddy * step; improved = true; }
    }
    if (!improved) step /= 2;
  }
  return { x, y, r: best };
}

// Los TRES ejes/limites del modelo (figura de la tesis y listacirculosBD() del Java:
// exactamente 3 circulos cuyos arcos forman el triangulo curvo de operacion factible).
// Los 3 ejes/limites del sistema son los de la TESIS (figura original). Las condiciones
// de negocio (calidad, usabilidad, tardanza, tiempo, recursos, feedback...) son FUERZAS
// que empujan a los proyectos hacia estos limites.
// Cada eje/borde tiene su propio color; su vector de fuerza usa el MISMO color.
const AXIS_COLORS = {
  economica: "#C2410C",   // naranja quemado (arriba)
  rendimiento: "#6D28D9", // violeta (derecha)
  carga: "#0E7490",       // teal (abajo)
};
const LIMIT_AXES = [
  { id: "economica", name: "Falla economica", labelAngle: -Math.PI / 2, color: AXIS_COLORS.economica },
  { id: "rendimiento", name: "Rendimiento inaceptable", labelAngle: 0, color: AXIS_COLORS.rendimiento },
  { id: "carga", name: "Alta carga de trabajo", labelAngle: Math.PI / 2, color: AXIS_COLORS.carga },
];

// Las 6 dimensiones de senales se agregan sobre los 3 ejes del sistema.
const AXIS_FROM_DIMENSION = {
  humano: "carga",
  tarea: "carga",
  tecnologia: "rendimiento",
  interaccion: "rendimiento",
  organizacion: "economica",
  contexto: "economica",
};

// Los 3 bordes son FIJOS (umbrales del negocio): 3 circulos centrados al lado OPUESTO de
// su etiqueta (triangulo de Reuleaux). NO dependen de los datos: lo que se mueve es la
// particula del proyecto empujada por sus fuerzas, no el borde.
function buildInputCircles() {
  const DIST = 3.2;
  const R = 6.5;
  const cir = LIMIT_AXES.map((axis) => {
    const centerAngle = axis.labelAngle + Math.PI; // centro opuesto al rotulo
    return {
      id: axis.id,
      name: axis.name,
      color: axis.color,
      labelAngle: axis.labelAngle,
      x: Math.cos(centerAngle) * DIST,
      y: Math.sin(centerAngle) * DIST,
      r: R,
      risk: 0,
    };
  });
  const cirm = cir.map((c) => ({ ...c, r: c.r * MARGINAL_RATIO }));
  return { cir, cirm };
}

function ParticleSimulation({ project, signals, clients }) {
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const [status, setStatus] = React.useState({ kind: "corriendo", text: "Inicializando sistema..." });
  const [violations, setViolations] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [runId, setRunId] = React.useState(0);
  const [zoom, setZoom] = React.useState(1);
  const selectedKeyRef = React.useRef(null);
  const hoverKeyRef = React.useRef(null);
  const zoomRef = React.useRef(1);

  React.useEffect(() => {
    selectedKeyRef.current = selected?.key || null;
  }, [selected]);

  React.useEffect(() => { zoomRef.current = zoom; }, [zoom]);
  const zoomIn = () => setZoom((z) => Math.min(2.2, +(z * 1.2).toFixed(2)));
  const zoomOut = () => setZoom((z) => Math.max(0.55, +(z / 1.2).toFixed(2)));

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    let width = 0;
    let height = 0;
    let scale = 1;
    let fitScale = 1; // escala de ajuste (solo cambia al redimensionar, no cada frame)
    let animation = 0;
    let frames = 0;
    let stopped = false;
    let lastStatusText = "";
    let lastViolationSync = 0;

    // ---- 1) Limites FIJOS: los 3 bordes del negocio + region factible ----
    const { cir, cirm } = buildInputCircles();
    const feasible = maxInscribedCircle(cir);
    const infeasible = feasible.r <= 0.45;
    const violated = { cir: new Set(), cirm: new Set() };

    // Direccion unitaria del centro hacia cada borde (hacia donde empuja cada fuerza).
    const axisDir = {};
    for (const c of cir) {
      const dx = c.x - feasible.x; // el centro del circulo esta al lado opuesto del borde...
      const dy = c.y - feasible.y;
      const len = Math.hypot(dx, dy) || 1;
      axisDir[c.id] = { x: -dx / len, y: -dy / len }; // ...asi que -dir apunta al borde/etiqueta
    }
    // Cuanto empuja una fuerza al 100%: llega justo al borde rojo (intensidad×peso = 1).
    const FORCE_GAIN = CENTER_K * feasible.r * 1.02;

    // ---- 2) CADA SUBPROYECTO ES UNA PARTICULA independiente ----
    const clusterNames = (clients && clients.length ? clients : ["General"]).slice(0, 6);
    // Senales por proyecto: las que traen `client` van a su proyecto; las de empresa
    // (manuales, sin client) o compartidas (clients[]) aplican a los proyectos que nombran.
    const signalsFor = (name) => signals.filter((sg) =>
      (!sg.client && (!sg.clients || !sg.clients.length)) ||
      sg.client === name ||
      (sg.clients && sg.clients.includes(name)));

    const sys = new TSystem(0, GAMMA);
    let anchor = null;
    let centers = [];

    if (!infeasible) {
      // Ancla FIJA en el punto ideal de operacion (centro de la region factible).
      anchor = sys.makeParticle(1, feasible.x, feasible.y, 0, { kind: "anchor" });
      anchor.makeFixed();

      // Sin datos → en el centro. Con varios proyectos, un pequeno "hogar" para no solapar.
      const home = clusterNames.length > 1 ? feasible.r * 0.14 : 0;

      clusterNames.forEach((name, i) => {
        const ang = -Math.PI / 2 + (i / clusterNames.length) * Math.PI * 2;
        const cx = feasible.x + Math.cos(ang) * home;
        const cy = feasible.y + Math.sin(ang) * home;

        const center = sys.makeParticle(PARTICLE_MASS, cx, cy, 0, {
          kind: "center", key: `c-${name}`, name, homeAng: ang,
          color: PARTICLE_PALETTE[i % PARTICLE_PALETTE.length], // cada proyecto su color
          phase: i * 1.7, // desfase de "respiracion" para que no se muevan al unisono
        });
        // Cuerda al punto ideal: rigidez constante, reposo = hogar (retorna al centro).
        sys.makeSpring(center, anchor, CENTER_K, SPRING_DAMPING, home, "centro");
        centers.push(center);

        // FUERZAS del proyecto (trazables): cada senal → fuerza catalogada con peso y borde.
        center.meta.conditions = signalsFor(name).map((sg) => {
          const spec = FORCE_CATALOG[sg.force] || null;
          const axis = sg.axis || spec?.axis || AXIS_FROM_DIMENSION[sg.dimension] || "rendimiento";
          const weight = sg.weight != null ? sg.weight : (spec?.weight ?? 0.6);
          return {
            axis,
            intensity: sg.intensity != null ? sg.intensity : riskScore(sg) / 100, // 0..1 segun datos
            weight,                          // 0..1: cuanto le duele al producto
            source: sg.title,
            kind: sg.force || "otro",
            color: sg.color || spec?.color || (axis === "centro" ? "#2D9A5A" : "#E8751A"),
          };
        }).sort((a, b) => (b.intensity * b.weight) - (a.intensity * a.weight));
      });
    }

    // El sistema NO resortea: la suma de condiciones da un VECTOR RESULTANTE y la particula
    // deriva LENTO en esa direccion (hacia afuera o adentro) hasta asentarse ("morir
    // despacio"). Los resortes solo aportan la friccion de retorno (evitan salidas rapidas y
    // fluctuaciones largas). Una respiracion MINIMA y lenta mantiene el sistema vivo sin
    // parecer un resorte. Sin condiciones → fuerza 0 → se queda en el centro.
    const BREATHE_W = (Math.PI * 2) / 14; // periodo ~14 s (lento)
    function applyForces(t = 0) {
      for (const center of centers) {
        const breathe = 1 + 0.04 * Math.sin(t * BREATHE_W + (center.meta.phase || 0));
        // Suma de fuerzas de RIESGO (hacia afuera) — direccion FIJA (no depende de la
        // posicion) → el vector resultante no gira.
        let fx = 0;
        let fy = 0;
        let healthMag = 0;
        for (const cond of center.meta.conditions || []) {
          const mag = cond.intensity * cond.weight * FORCE_GAIN * breathe;
          if (mag <= 0) continue;
          if (cond.axis === "centro") {
            healthMag += mag; // la salud NO es un vector propio: reduce el empuje de riesgo
          } else {
            const dir = axisDir[cond.axis];
            if (!dir) continue;
            fx += dir.x * mag;
            fy += dir.y * mag;
          }
        }
        // La salud (producto sano) acerca al centro: recorta la MAGNITUD del empuje neto,
        // manteniendo su direccion (estable). Si la salud supera al riesgo → queda en 0.
        const ol = Math.hypot(fx, fy);
        if (ol > 0 && healthMag > 0) {
          const reduced = Math.max(0, ol - healthMag);
          fx = (fx / ol) * reduced;
          fy = (fy / ol) * reduced;
        }
        center.persistent = { x: fx, y: fy, z: 0 };
        center.meta.netForce = Math.hypot(fx, fy);
        center.meta.healthMag = healthMag;
      }
    }
    applyForces(0);

    // ---- Utilidades ----
    // El canvas se dibuja al TAMANO REAL del contenedor (ancho responsivo, alto fijo por
    // CSS) con devicePixelRatio → siempre nitido, nunca se pixela. El triangulo se ajusta
    // al lado menor y queda centrado. Zoom manual via zoomRef.
    const extent = Math.max(...cir.map((c) => c.r - Math.hypot(c.x, c.y))) + 2.8;
    function toScreen(x, y) {
      return { x: width / 2 + x * scale, y: height / 2 + y * scale };
    }

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const nw = Math.max(280, Math.floor(wrap.clientWidth || rect.width || 320));
      const nh = Math.max(280, Math.floor(wrap.clientHeight || rect.height || 320));
      // Debounce: ignora micro-cambios (ej. scrollbar) para que la escala no tiemble.
      if (canvas.width && Math.abs(nw - width) < 3 && Math.abs(nh - height) < 3) return;
      width = nw;
      height = nh;
      fitScale = Math.min(width, height) / 2 / extent; // se fija aqui, NO cada frame
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function pushStatus(kind, text) {
      if (text === lastStatusText) return;
      lastStatusText = text;
      setStatus({ kind, text });
    }

    // ---- Evaluacion: el diagnostico es por el CENTRO DE MASAS de cada proyecto ----
    function evaluate() {
      violated.cir.clear();
      violated.cirm.clear();
      const found = [];
      let extreme = null;
      let marginal = null;
      for (const center of centers) {
        for (const c of cir) {
          if (Math.hypot(center.position.x - c.x, center.position.y - c.y) > c.r) {
            violated.cir.add(c.id);
            if (!extreme) extreme = { c, center };
            found.push({ key: `${center.meta.key}-${c.id}`, label: `Proyecto ${center.meta.name}`, limit: `Falla: cruza ${c.name}`, color: "#B42318" });
          }
        }
        for (const c of cirm) {
          if (Math.hypot(center.position.x - c.x, center.position.y - c.y) > c.r) {
            violated.cirm.add(c.id);
            if (!marginal) marginal = { c, center };
            if (!violated.cir.has(c.id)) {
              found.push({ key: `${center.meta.key}-${c.id}-m`, label: `Proyecto ${center.meta.name}`, limit: `Riesgo: limite marginal de ${c.name}`, color: "#E8751A" });
            }
          }
        }
      }
      if (extreme) {
        stopped = true; // el Java detiene la simulacion al perder el equilibrio
        pushStatus("desequilibrio", `Falla: ${extreme.c.name} · ${extreme.center.meta.name}`);
      } else if (marginal) {
        pushStatus("riesgo", `Riesgo: ${marginal.c.name} · ${marginal.center.meta.name}`);
      } else {
        pushStatus("equilibrio", "Sistema en equilibrio");
      }
      if (performance.now() - lastViolationSync > 240) {
        setViolations(found.slice(0, 4));
        lastViolationSync = performance.now();
      }
    }

    const AXIS_NAME = { economica: "Falla economica", rendimiento: "Rendimiento inaceptable", carga: "Alta carga de trabajo", centro: "Salud (al centro)" };
    function snapshot(p) {
      const dist = Math.hypot(p.position.x - feasible.x, p.position.y - feasible.y);
      const proximity = Math.min(100, Math.round((dist / feasible.r) * 100));
      const conds = (p.meta.conditions || [])
        .map((c) => ({
          ...c,
          effect: c.intensity * c.weight,
          axisName: AXIS_NAME[c.axis] || c.axis,
          why: FORCE_WHY[c.kind] || "",
        }))
        .sort((a, b) => b.effect - a.effect);
      // Variables aun no capturadas para este proyecto (afinarian el diagnostico).
      const present = new Set((p.meta.conditions || []).map((c) => c.kind));
      const missing = MANUAL_VARIABLES.filter(([k]) => !present.has(k)).map(([, label]) => label);
      return {
        key: p.meta.key,
        label: "Subproyecto",
        name: p.meta.name,
        color: p.meta.color || "#21A7D8",
        role: conds.length
          ? "Cada fuerza jala este proyecto hacia un borde; la fuerza azul lo devuelve al centro. Se recalcula con la ultima informacion cargada."
          : "Sin datos suficientes: el proyecto esta en el centro. Al cargar tareas o feedback se movera segun sus fuerzas.",
        proximity,
        netForce: Math.round((p.meta.netForce || 0) * 100) / 100,
        conditions: conds.slice(0, 8),
        missing: missing.slice(0, 6),
      };
    }

    function hitParticle(event) {
      const rect = canvas.getBoundingClientRect();
      // Mapea el clic (px mostrados) al espacio de dibujo (width/height logicos).
      const x = (event.clientX - rect.left) * (width / (rect.width || width));
      const y = (event.clientY - rect.top) * (height / (rect.height || height));
      for (const p of [...centers].reverse()) {
        const s = toScreen(p.position.x, p.position.y);
        if (Math.hypot(x - s.x, y - s.y) <= 15) return p;
      }
      return null;
    }

    // ---- Dibujo ----
    function draw() {
      // Escala estable (fijada al redimensionar) × zoom manual. NO se recalcula desde
      // width/height cada frame → nada tiembla aunque el contenedor micro-cambie.
      scale = fitScale * (zoomRef.current || 1);
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, width, height);

      // 1) Circulos COMPLETOS pero muy atenuados: se ven tenues fuera de la zona de
      //    interaccion sin ensuciar. 2) Encima, los arcos claros SOLO del borde de la
      //    interseccion de los tres circulos (zona de interaccion real).
      // -- capa tenue (circulos completos) --
      for (const c of cir) {
        const s = toScreen(c.x, c.y);
        context.save();
        context.globalAlpha = 0.12;
        context.beginPath();
        context.arc(s.x, s.y, c.r * scale, 0, Math.PI * 2);
        context.strokeStyle = c.color;
        context.lineWidth = 1.4;
        context.stroke();
        context.restore();
      }
      for (const c of cirm) {
        const s = toScreen(c.x, c.y);
        context.save();
        context.globalAlpha = 0.18;
        context.beginPath();
        context.setLineDash([5, 4]);
        context.arc(s.x, s.y, c.r * scale, 0, Math.PI * 2);
        context.strokeStyle = c.color;
        context.lineWidth = 1;
        context.stroke();
        context.setLineDash([]);
        context.restore();
      }
      // -- capa clara: SOLO el borde de la interseccion de los 3 circulos. Para cada
      //    circulo se recorta a la interseccion de los OTROS DOS antes de trazarlo, asi
      //    unicamente queda el arco que forma la zona donde los tres coinciden.
      function strokeBoundary(list, styleFor) {
        for (const a of list) {
          context.save();
          for (const b of list) {
            if (b === a) continue;
            const sb = toScreen(b.x, b.y);
            context.beginPath();
            context.arc(sb.x, sb.y, b.r * scale, 0, Math.PI * 2);
            context.clip();
          }
          const sa = toScreen(a.x, a.y);
          styleFor(a);
          context.beginPath();
          context.arc(sa.x, sa.y, a.r * scale, 0, Math.PI * 2);
          context.stroke();
          context.setLineDash([]);
          context.restore();
        }
      }
      strokeBoundary(cir, (a) => {
        context.strokeStyle = violated.cir.has(a.id) ? "#B42318" : a.color;
        context.lineWidth = violated.cir.has(a.id) ? 4.4 : 3.4;
      });
      strokeBoundary(cirm, (a) => {
        context.setLineDash([5, 4]);
        context.globalAlpha = violated.cirm.has(a.id) ? 1 : 0.55;
        context.strokeStyle = violated.cirm.has(a.id) ? "#E8751A" : a.color;
        context.lineWidth = violated.cirm.has(a.id) ? 2.4 : 1.6;
      });
      context.globalAlpha = 1;

      // Etiquetas de los 3 ejes. Fuente ADAPTABLE al ancho (en movil se achican para no
      // cortarse) y siempre en dos lineas para ocupar menos horizontal.
      const centerScreen = toScreen(feasible.x, feasible.y);
      const labelPx = Math.max(9, Math.min(13, Math.round(width / 30)));
      const lineH = labelPx + 3;
      for (const c of cir) {
        const reach = c.r - Math.hypot(c.x, c.y);
        const bx0 = Math.cos(c.labelAngle) * (reach + 0.35);
        const by0 = Math.sin(c.labelAngle) * (reach + 0.35);
        const s = toScreen(bx0, by0);
        context.font = `700 ${labelPx}px Poppins, Segoe UI, sans-serif`;
        const lines = splitTwoLines(c.name);
        const w = Math.max(...lines.map((l) => context.measureText(l).width));
        const boxW = w + 10;
        const boxH = (lines[1] ? lineH * 2 : lineH) + 6;
        // Empuja la caja hacia AFUERA (evita cruzar el borde): segun la direccion en pantalla.
        let sdx = s.x - centerScreen.x;
        let sdy = s.y - centerScreen.y;
        const slen = Math.hypot(sdx, sdy) || 1;
        sdx /= slen; sdy /= slen;
        let bx = s.x + sdx * (boxW / 2 + 2) - boxW / 2;
        let by = s.y + sdy * (boxH / 2 + 2) - boxH / 2;
        bx = Math.max(3, Math.min(width - boxW - 3, bx));
        by = Math.max(3, Math.min(height - boxH - 3, by));
        context.fillStyle = "rgba(255,255,255,.92)";
        roundRect(context, bx, by, boxW, boxH, 5);
        context.fill();
        context.fillStyle = c.color; // etiqueta al color de su eje
        lines.forEach((line, i) => {
          if (!line) return;
          const lw = context.measureText(line).width;
          context.fillText(line, bx + boxW / 2 - lw / 2, by + labelPx + 2 + i * lineH);
        });
      }

      if (infeasible) return;

      // Circulo maximo inscrito
      const fs = toScreen(feasible.x, feasible.y);
      context.beginPath();
      context.setLineDash([3, 4]);
      context.arc(fs.x, fs.y, feasible.r * scale, 0, Math.PI * 2);
      context.strokeStyle = "rgba(102,112,133,.4)";
      context.lineWidth = 1.1;
      context.stroke();
      context.setLineDash([]);

      // Cuerdas
      for (const s of sys.springs) {
        const a = toScreen(s.a.position.x, s.a.position.y);
        const b = toScreen(s.b.position.x, s.b.position.y);
        const tension = Math.min(1, s.tension || 0);
        if (s.kind === "centro") {
          context.setLineDash([4, 5]);
          context.strokeStyle = tension > 0.5 ? "rgba(180,35,24,.6)" : "rgba(102,112,133,.45)";
          context.lineWidth = 1.2 + tension;
        } else {
          context.strokeStyle = tension > 0.5 ? "rgba(18,112,122,.85)" : "rgba(18,112,122,.45)";
          context.lineWidth = 1.4 + tension * 2;
        }
        context.beginPath();
        context.moveTo(a.x, a.y);
        context.lineTo(b.x, b.y);
        context.stroke();
        context.setLineDash([]);
      }

      // Ancla (punto ideal de operacion de la empresa)
      const anchorS = toScreen(anchor.position.x, anchor.position.y);
      context.beginPath();
      context.arc(anchorS.x, anchorS.y, 4, 0, Math.PI * 2);
      context.fillStyle = "#667085";
      context.fill();
      context.font = "italic 11px Lato, Segoe UI, sans-serif";
      context.fillStyle = "#667085";
      context.fillText("Punto ideal", anchorS.x + 8, anchorS.y - 4);

      // TODAS las fuerzas de cada particula como flechas. Se abren en abanico (offset
      // perpendicular) para que las que van al mismo borde no se solapen. Naranja solida =
      // empuja al riesgo (afuera); verde punteada = salud (jala al centro, adentro). SIN
      // texto en el mapa — el nombre y peso de cada fuerza estan en el panel al hacer click.
      for (const p of centers) {
        const conds = (p.meta.conditions || []).filter((c) => c.intensity * c.weight > 0.01);
        const s = toScreen(p.position.x, p.position.y);

        // Flechita reutilizable.
        const arrow = (ux, uy, start, len, color, lw, dash, headLen, alpha) => {
          context.save();
          context.globalAlpha = alpha;
          context.strokeStyle = color;
          context.fillStyle = color;
          context.lineWidth = lw;
          if (dash) context.setLineDash(dash);
          const ex = s.x + ux * (start + len);
          const ey = s.y + uy * (start + len);
          context.beginPath();
          context.moveTo(s.x + ux * start, s.y + uy * start);
          context.lineTo(ex, ey);
          context.stroke();
          context.setLineDash([]);
          const angle = Math.atan2(uy, ux);
          context.beginPath();
          context.moveTo(ex, ey);
          context.lineTo(ex - Math.cos(angle - 0.45) * headLen, ey - Math.sin(angle - 0.45) * headLen);
          context.lineTo(ex - Math.cos(angle + 0.45) * headLen, ey - Math.sin(angle + 0.45) * headLen);
          context.closePath();
          context.fill();
          context.restore();
        };

        // COMBINAR por direccion: las fuerzas que empujan al MISMO eje se suman en UN vector.
        // Quedan hasta 3 vectores de borde (economica/rendimiento/carga) + salud (adentro).
        const byAxis = {};
        for (const cond of conds) {
          byAxis[cond.axis] = (byAxis[cond.axis] || 0) + cond.intensity * cond.weight;
        }

        // 1) RESULTANTE detras (negro PUNTEADO, mas largo): suma de las fuerzas de las
        //    condiciones = rumbo de la tarea.
        const rl = Math.hypot(p.persistent.x, p.persistent.y);
        if (rl > 0.03) {
          const ux = p.persistent.x / rl;
          const uy = p.persistent.y / rl;
          arrow(ux, uy, 14, 34 + Math.min(1.6, rl / (FORCE_GAIN || 1)) * 40, "#151B23", 1.8, [6, 4], 9, 1);
        }

        // 2) Retorno al centro (azul, tenue).
        const dcx = feasible.x - p.position.x;
        const dcy = feasible.y - p.position.y;
        const dcl = Math.hypot(dcx, dcy);
        if (dcl > 0.12) {
          const mag = Math.min(1, (CENTER_K * dcl) / (feasible.r || 1));
          arrow(dcx / dcl, dcy / dcl, 14, 12 + mag * 18, RETURN_COLOR, 1.1, null, 6, 0.6);
        }

        // 3) Los TRES vectores de eje ENCIMA (siempre los 3: cada tarea esta influenciada
        //    por los tres bordes). Cada eje su COLOR (igual al de su borde). Grosor UNIFORME
        //    y visible; solo el LARGO cambia con la fuerza (stub minimo si no hay datos).
        for (const axis of ["economica", "rendimiento", "carga"]) {
          const dir = axisDir[axis];
          if (!dir) continue;
          const mag = byAxis[axis] || 0;
          arrow(dir.x, dir.y, 14, 14 + Math.min(1.4, mag) * 30, AXIS_COLORS[axis], 1.6, null, 8, 1);
        }
        // Salud (adentro) si el producto esta bien calificado.
        if (byAxis.centro) {
          const dx = feasible.x - p.position.x;
          const dy = feasible.y - p.position.y;
          const l = Math.hypot(dx, dy) || 1;
          arrow(dx / l, dy / l, 14, 14 + Math.min(1.4, byAxis.centro) * 30, HEALTH_COLOR, 1.6, [5, 3], 8, 1);
        }
      }

      // Centros de masas (cada uno = un PROYECTO de la empresa): lo mas importante del
      // mapa — grandes, con halo blanco y dibujados al final (nada los tapa).
      for (const center of centers) {
        const s = toScreen(center.position.x, center.position.y);
        const highlighted = selectedKeyRef.current === center.meta.key || hoverKeyRef.current === center.meta.key;
        context.beginPath();
        context.arc(s.x, s.y, 13, 0, Math.PI * 2);
        context.fillStyle = "rgba(255,255,255,.92)";
        context.fill();
        if (highlighted) {
          context.beginPath();
          context.arc(s.x, s.y, 16, 0, Math.PI * 2);
          context.strokeStyle = "#151B23";
          context.lineWidth = 2.4;
          context.stroke();
        }
        const pColor = center.meta.color || "#21A7D8";
        context.beginPath();
        context.arc(s.x, s.y, 9.5, 0, Math.PI * 2);
        context.fillStyle = pColor;
        context.fill();
        context.strokeStyle = "#1D2939";
        context.lineWidth = 1.6;
        context.stroke();
        // Etiqueta del nombre a la IZQUIERDA (no hay eje hacia la izquierda, no tapa vectores).
        const namePx = Math.max(9, Math.min(11, Math.round(width / 36)));
        context.font = `500 ${namePx}px Poppins, Segoe UI, sans-serif`;
        const w = context.measureText(center.meta.name).width;
        let lblX = s.x - 14 - (w + 10); // caja a la izquierda de la particula
        if (lblX < 3) lblX = s.x + 14;   // si no cabe, va a la derecha
        context.fillStyle = "rgba(255,255,255,.92)";
        roundRect(context, lblX, s.y - 9, w + 10, 18, 4);
        context.fill();
        context.fillStyle = pColor;
        context.fillText(center.meta.name, lblX + 5, s.y + namePx / 2 - 1);
      }

      // Particula ENFOCADA (hover o seleccion): se redibuja ENCIMA de todo con su nombre
      // iluminado, para que nunca quede tapada por otras particulas/flechas. Al salir el
      // mouse vuelve a su estado normal (este realce solo dura mientras esta enfocada).
      const focusKey = hoverKeyRef.current || selectedKeyRef.current;
      const focusCenter = focusKey && centers.find((c) => c.meta.key === focusKey);
      if (focusCenter) {
        const s = toScreen(focusCenter.position.x, focusCenter.position.y);
        const pColor = focusCenter.meta.color || "#21A7D8";
        // halo + punto por encima
        context.beginPath();
        context.arc(s.x, s.y, 16, 0, Math.PI * 2);
        context.fillStyle = "rgba(255,255,255,.95)";
        context.fill();
        context.strokeStyle = "#151B23";
        context.lineWidth = 2.4;
        context.stroke();
        context.beginPath();
        context.arc(s.x, s.y, 9.5, 0, Math.PI * 2);
        context.fillStyle = pColor;
        context.fill();
        context.strokeStyle = "#1D2939";
        context.lineWidth = 1.6;
        context.stroke();
        // nombre resaltado (mas grande, fondo del color de la particula)
        const fpx = Math.max(11, Math.min(14, Math.round(width / 28)));
        context.font = `700 ${fpx}px Poppins, Segoe UI, sans-serif`;
        const fw = context.measureText(focusCenter.meta.name).width;
        let fx = s.x - 16 - (fw + 14);
        if (fx < 4) fx = s.x + 16;
        context.fillStyle = pColor;
        roundRect(context, fx, s.y - 12, fw + 14, 24, 6);
        context.fill();
        context.fillStyle = "#fff";
        context.fillText(focusCenter.meta.name, fx + 7, s.y + fpx / 2 - 2);
      }
    }

    // ---- Bucle ----
    const startTime = performance.now();
    function frame() {
      if (!infeasible) {
        // Fuerzas VIVAS cada frame: respiran con el tiempo (hacia afuera y adentro).
        applyForces((performance.now() - startTime) / 1000);
        sys.tick(DT);
        // Solo un tope de seguridad alto (evita explosiones); la lentitud la da el DT
        // pequeno. La particula no sale del mapa: si cruza un borde queda justo afuera
        // y ademas se le frena la velocidad para que NO rebote (evita el temblor).
        for (const p of centers) {
          const v = Math.hypot(p.velocity.x, p.velocity.y);
          if (v > 0.6) { p.velocity.x *= 0.6 / v; p.velocity.y *= 0.6 / v; }
          for (const c of cir) {
            const dx = p.position.x - c.x;
            const dy = p.position.y - c.y;
            const d = Math.hypot(dx, dy);
            const max = c.r + 0.4;
            if (d > max) {
              p.position.x = c.x + (dx / d) * max;
              p.position.y = c.y + (dy / d) * max;
              // frena la velocidad hacia afuera para que no rebote contra el borde
              const nx = dx / d;
              const ny = dy / d;
              const vn = p.velocity.x * nx + p.velocity.y * ny;
              if (vn > 0) { p.velocity.x -= vn * nx; p.velocity.y -= vn * ny; }
            }
          }
        }
        frames += 1;
        if (frames > WARMUP_FRAMES) evaluate();
        else pushStatus("corriendo", "Analizando la salud de los proyectos...");
      }
      draw();
      animation = requestAnimationFrame(frame);
    }

    function handlePointerMove(event) {
      const p = hitParticle(event);
      hoverKeyRef.current = p?.meta.key || null;
      canvas.style.cursor = p ? "pointer" : "default";
    }
    function handlePointerLeave() {
      hoverKeyRef.current = null;
      canvas.style.cursor = "default";
    }
    function handleClick(event) {
      const p = hitParticle(event);
      setSelected(p ? snapshot(p) : null);
    }

    canvas.addEventListener("pointermove", handlePointerMove);
    canvas.addEventListener("pointerleave", handlePointerLeave);
    canvas.addEventListener("click", handleClick);

    resize();
    if (infeasible) {
      pushStatus("desequilibrio", "Sin region factible: los limites de las variables no se intersecan");
      setViolations([]);
    }
    frame();
    const observer = new ResizeObserver(resize);
    observer.observe(wrap);
    return () => {
      cancelAnimationFrame(animation);
      canvas.removeEventListener("pointermove", handlePointerMove);
      canvas.removeEventListener("pointerleave", handlePointerLeave);
      canvas.removeEventListener("click", handleClick);
      observer.disconnect();
    };
  }, [project, signals, clients, runId]);

  const statusColors = {
    equilibrio: { bg: "#EDF7DF", border: "#5BAE2D", text: "#3D7A16" },
    riesgo: { bg: "#FDEFD9", border: "#E8751A", text: "#9A4B08" },
    desequilibrio: { bg: "#FDE4E1", border: "#B42318", text: "#8A1B12" },
    corriendo: { bg: "#EAF2FB", border: "#1570EF", text: "#1D5A99" },
  };
  const sc = statusColors[status.kind] || statusColors.corriendo;

  return (
    <div className="particle-sim">
    <div className="particle-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute", top: 8, left: 8, right: 8, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 6, padding: "6px 9px", borderRadius: 8,
          background: sc.bg, border: `1px solid ${sc.border}`, fontSize: 12, fontWeight: 700, color: sc.text,
        }}
      >
        <span style={{ minWidth: 0, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{status.text}</span>
        <button
          type="button"
          onClick={() => setRunId((v) => v + 1)}
          title="Reiniciar simulacion"
          aria-label="Reiniciar simulacion"
          style={{
            flex: "0 0 auto", border: `1px solid ${sc.border}`, background: "#fff", color: sc.text, borderRadius: 6,
            padding: "3px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          ↻
        </button>
      </div>
      <div className="particle-zoom">
        <button type="button" onClick={zoomIn} aria-label="Acercar" title="Acercar">+</button>
        <button type="button" onClick={zoomOut} aria-label="Alejar" title="Alejar">−</button>
        <button type="button" onClick={() => setZoom(1)} aria-label="Zoom original" title="Zoom original">⤢</button>
      </div>
      {!selected && <div className="particle-help">Haz click en un proyecto para ver sus fuerzas</div>}
      {selected && (
        <aside className="particle-detail" style={{ borderColor: `${selected.color}66` }}>
          <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar detalle">x</button>
          <b style={{ color: selected.color }}>{selected.label}</b>
          <h4>{selected.name}</h4>
          <p>{selected.role}</p>
          <dl>
            <div><dt>Cercania al borde</dt><dd>{selected.proximity}%</dd></div>
            <div><dt>Fuerza neta</dt><dd>{selected.netForce}</dd></div>
          </dl>
          {selected.conditions?.length > 0 ? (
            <div style={{ marginTop: 6 }}>
              <b style={{ fontSize: 11 }}>Fuerzas (efecto = dato × peso):</b>
              <div style={{ marginTop: 4 }}>
                {selected.conditions.map((cond, i) => (
                  <details key={i} className="force-acc">
                    <summary>
                      <i style={{ display: "inline-block", width: 8, height: 8, borderRadius: 2, background: cond.color || "#E8751A", marginRight: 6 }} />
                      <span style={{ color: cond.color || (cond.axis === "centro" ? "#0D7A4F" : "#9A4B08"), fontWeight: 700 }}>
                        {cond.axis === "centro" ? "↺ " : "→ "}{cond.source}
                      </span>
                      <span style={{ float: "right", color: "#667085", fontWeight: 700 }}>{Math.round(cond.effect * 100)}%</span>
                    </summary>
                    <div className="force-acc-body">
                      empuja a <b>{cond.axisName}</b> · dato {Math.round(cond.intensity * 100)}% × peso {Math.round(cond.weight * 100)}%
                      {cond.why && <><br /><span style={{ color: "#98928A", fontStyle: "italic" }}>{cond.why}</span></>}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 11, marginTop: 6, color: "#0D7A4F" }}>Sin fuerzas negativas: el proyecto esta saludable, en el centro.</p>
          )}
          {selected.missing?.length > 0 && (
            <details className="force-acc" style={{ marginTop: 8 }}>
              <summary style={{ color: "#667085" }}>Para afinar (capturar por proyecto)</summary>
              <ul style={{ margin: "3px 0 0", paddingLeft: 16, fontSize: 11, color: "#98928A" }}>
                {selected.missing.map((m, i) => <li key={i}>{m}</li>)}
              </ul>
            </details>
          )}
        </aside>
      )}
      </div>
      <div className="particle-legend">
        <span><i className="line marginal" style={{ background: "#151B23" }} /> <b>Vector resultante</b> (negro punteado): rumbo de la tarea</span>
        <span><i className="line force" style={{ background: "#C2410C" }} /> Falla economica</span>
        <span><i className="line force" style={{ background: "#6D28D9" }} /> Rendimiento</span>
        <span><i className="line force" style={{ background: "#0E7490" }} /> Alta carga</span>
        <span><i className="line force" style={{ background: "#2D9A5A" }} /> Salud (adentro)</span>
        <span><i className="line center-spring" style={{ background: "#1570EF" }} /> Retorno al centro</span>
      </div>
    </div>
  );
}

// Formulario para capturar A MANO una medicion de producto (variables que NO salen de las
// tareas: bugs, satisfaccion del equipo, presupuesto, mercado...). Escribe en product_signals.
// Panel unico con TABS: Como leer · Medicion · Resortes.
function InfoPanel({ companyId, clients, onSaved, canSave }) {
  const [tab, setTab] = React.useState("leer");
  const [force, setForce] = React.useState("bugs");
  const [client, setClient] = React.useState("");
  const [intensity, setIntensity] = React.useState(0.5);
  const [title, setTitle] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  async function submit(e) {
    e.preventDefault();
    if (!companyId) { setMsg("Selecciona una empresa con datos reales."); return; }
    setSaving(true);
    setMsg("");
    const ok = await saveProductSignal({
      companyId, client: client || null, force, intensity: Number(intensity),
      title: title || FORCE_CATALOG[force]?.label,
    }).catch(() => false);
    setSaving(false);
    if (ok) {
      setMsg("Guardado. Actualizando mapa…");
      setTitle("");
      onSaved?.();
      setTimeout(() => setMsg(""), 2500);
    } else {
      setMsg("No se pudo guardar (revisa sesion / corre setup.sql).");
    }
  }

  const TABS = [["leer", "Como leer"], ["medicion", "Medicion"], ["resortes", "Resortes"]];

  return (
    <article className="panel info-panel">
      <div className="info-tabs" role="tablist">
        {TABS.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id}
            className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {tab === "leer" && (
        <div className="research-grid">
          {[
            ["Particulas", "Cada particula es un subproyecto. Es lo mas importante del mapa."],
            ["Vectores", "Los 3 vectores de color empujan a cada borde (economica, rendimiento, carga); el negro punteado es el resultante (rumbo). Verde = salud (adentro), azul = retorno al centro."],
            ["Cuerdas", "Cada proyecto es independiente: su cuerda al punto ideal lo trae de vuelta cuando las fuerzas lo empujan."],
            ["Limites", "Amarillo = riesgo (marginal). Borde de color = falla del eje: la simulacion lo senala."],
          ].map(([t, text]) => (
            <div key={t}><b>{t}</b><p>{text}</p></div>
          ))}
        </div>
      )}

      {tab === "medicion" && (
        <>
          <p className="note" style={{ marginTop: 0 }}>
            Captura variables que no vienen de las tareas (bugs, satisfaccion del equipo,
            presupuesto, tecnologia, mercado…). Mueven la particula del subproyecto.
          </p>
          {!canSave && <p style={{ fontSize: 12, color: "#B54708" }}>Inicia sesion en la app principal para guardar mediciones reales.</p>}
          <form onSubmit={submit} style={{ display: "grid", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Fuerza
              <select value={force} onChange={(e) => setForce(e.target.value)} style={{ width: "100%", marginTop: 3, padding: "6px 8px" }}>
                {Object.entries(FORCE_CATALOG).map(([k, spec]) => <option key={k} value={k}>{spec.label}</option>)}
              </select>
            </label>
            {clients.length > 0 && (
              <label style={{ fontSize: 12, fontWeight: 700 }}>
                Subproyecto
                <select value={client} onChange={(e) => setClient(e.target.value)} style={{ width: "100%", marginTop: 3, padding: "6px 8px" }}>
                  <option value="">Toda la empresa</option>
                  {clients.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </label>
            )}
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Intensidad: {Math.round(intensity * 100)}% (que tan fuerte es la evidencia)
              <input type="range" min="0" max="1" step="0.05" value={intensity} onChange={(e) => setIntensity(e.target.value)} style={{ width: "100%" }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Nota (opcional)
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={FORCE_CATALOG[force]?.label} style={{ width: "100%", marginTop: 3, padding: "6px 8px" }} />
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="submit" disabled={saving || !canSave} style={{ padding: "6px 14px", fontWeight: 700, borderRadius: 6, border: "1px solid #17727A", background: "#17727A", color: "#fff", cursor: "pointer" }}>
                {saving ? "Guardando…" : "Guardar medicion"}
              </button>
              {msg && <span style={{ fontSize: 12, color: "#0D7A4F" }}>{msg}</span>}
            </div>
          </form>
        </>
      )}

      {tab === "resortes" && (
        <div className="spring-meaning">
          <p><b>Rigidez</b> = que tan dificil es deformar una relacion del sistema.</p>
          <p><b>Longitud de reposo</b> = distancia esperada para que la relacion este alineada.</p>
          <p><b>Amortiguacion</b> = perdida por friccion, retrabajo, espera o ruido organizacional.</p>
          <p><b>Estiramiento</b> = tension: cuanto mas se alarga, mas cerca esta de accion, alarma o fracaso.</p>
        </div>
      )}
    </article>
  );
}

// Parte un rotulo en dos lineas balanceadas por palabras (para que no se corte).
function splitTwoLines(text) {
  const words = String(text).split(" ");
  if (words.length < 2) return [text, ""];
  let best = 1;
  let bestDiff = Infinity;
  for (let i = 1; i < words.length; i += 1) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const diff = Math.abs(a.length - b.length);
    if (diff < bestDiff) { bestDiff = diff; best = i; }
  }
  return [words.slice(0, best).join(" "), words.slice(best).join(" ")];
}

function roundRect(context, x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function DimensionCard({ dimension }) {
  const Icon = dimension.icon;
  return (
    <article className="dimension">
      <div className="dimension-head">
        <span style={{ backgroundColor: `${dimension.color}20`, color: dimension.color }}><Icon size={18} /></span>
        <h3>{dimension.name}</h3>
      </div>
      <p>{dimension.thesis}</p>
      <div className="chips">
        {dimension.variables.map((variable) => <span key={variable}>{variable}</span>)}
      </div>
    </article>
  );
}

function SignalForm({ draft, setDraft, onSubmit }) {
  return (
    <form className="signal-form" onSubmit={onSubmit}>
      <label>
        Titulo de la senal
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ej. usuarios abandonan el formulario" />
      </label>
      <label>
        Evidencia
        <textarea value={draft.evidence} onChange={(event) => setDraft({ ...draft, evidence: event.target.value })} rows="3" placeholder="Fuente, captura, entrevista, metrica o tarea relacionada" />
      </label>
      <label>
        Dimension
        <select value={draft.dimension} onChange={(event) => setDraft({ ...draft, dimension: event.target.value })}>
          {DIMENSIONS.map((dimension) => <option key={dimension.id} value={dimension.id}>{dimension.name}</option>)}
        </select>
      </label>
      {[
        ["severity", "Severidad"],
        ["probability", "Probabilidad"],
        ["detectability", "Detectabilidad"],
        ["confidence", "Confianza evidencia"],
      ].map(([key, label]) => (
        <label key={key}>
          {label}: {draft[key]}/5
          <input type="range" min="1" max="5" value={draft[key]} onChange={(event) => setDraft({ ...draft, [key]: Number(event.target.value) })} />
        </label>
      ))}
      <button type="submit"><Plus size={16} /> Agregar senal</button>
    </form>
  );
}

function SignalCard({ signal }) {
  const dimension = DIMENSIONS.find((item) => item.id === signal.dimension) || DIMENSIONS[0];
  const score = riskScore(signal);
  const limit = limitForRisk(score);
  return (
    <article className="signal">
      <div>
        <span style={{ color: dimension.color }}>{dimension.name}</span>
        <h4>{signal.title}</h4>
        <p>{signal.evidence}</p>
      </div>
      <div className="risk" style={{ color: limit.color, borderColor: `${limit.color}55` }}>
        <strong>{score}</strong>
        <small>{limit.name}</small>
      </div>
    </article>
  );
}

function Style() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      body { margin: 0; background: #F7F4EF; color: #1D2939; font-family: Lato, Segoe UI, system-ui, sans-serif; }
      button, input, select, textarea { font: inherit; }
      button { cursor: pointer; }
      .mdssp-app { min-height: 100vh; }
      .mdssp-embed { min-height: 0; background: transparent; overflow: hidden; }
      .mdssp-embed-inner { padding: 4px; }
      /* Embed: alto fijo (comodo) y ancho fluido que llena el panel. */
      .mdssp-embed .particle-wrap { height: 440px; max-width: 100%; }
      /* Leyenda como carrusel horizontal (no ocupa varias filas). */
      .mdssp-embed .particle-legend { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
      .mdssp-embed .particle-legend span { flex: 0 0 auto; }
      /* Panel de info colapsable. */
      .pm-collapse { margin-top: 12px; border: 1px solid #E4DED6; border-radius: 8px; background: #FFFCF7; }
      .pm-collapse > summary { cursor: pointer; list-style: none; padding: 12px 14px; font-weight: 800; color: #17727A; font-size: 13px; }
      .pm-collapse > summary::-webkit-details-marker { display: none; }
      .pm-collapse > summary::after { content: "▸"; float: right; color: #98A2B3; }
      .pm-collapse[open] > summary::after { content: "▾"; }
      .pm-collapse .panel, .pm-collapse .info-panel { border: none; padding: 0 14px 14px; background: transparent; }
      .topbar { position: sticky; top: 0; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 22px; background: #FFFCF7; border-bottom: 1px solid #E7E0D5; }
      .brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
      .brand img { width: 36px; height: 36px; object-fit: contain; }
      .brand p, .eyebrow { margin: 0; color: #667085; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; }
      .brand h1, .project-head h2, h3, h4 { font-family: Poppins, Segoe UI Semibold, sans-serif; }
      .brand h1 { margin: 1px 0 0; font-size: 18px; line-height: 1.2; }
      .top-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
      .top-actions button, .signal-form button { display: inline-flex; align-items: center; gap: 7px; min-height: 38px; border: 1px solid #D9D2C7; border-radius: 6px; background: #fff; color: #344054; padding: 0 11px; font-weight: 700; font-size: 13px; }
      .workspace { display: grid; grid-template-columns: 260px 1fr; gap: 18px; max-width: 1480px; margin: 0 auto; padding: 18px; }
      .sidebar { align-self: start; position: sticky; top: 82px; display: grid; gap: 16px; }
      .project-list, .tabs { display: grid; gap: 8px; }
      .project, .tabs button { border: 1px solid #E4DED6; border-radius: 6px; background: #FFFCF7; text-align: left; padding: 11px; color: #344054; }
      .project span { display: block; font-weight: 800; }
      .project small { color: #667085; }
      .project.active, .tabs button.active { border-color: #17727A; background: #EAF4F2; color: #17727A; }
      .tabs button { display: flex; align-items: center; gap: 8px; font-weight: 800; }
      .content { display: grid; gap: 18px; min-width: 0; }
      .project-head { display: grid; grid-template-columns: minmax(0, 1fr) minmax(340px, 460px); gap: 18px; align-items: stretch; background: #151B23; color: #E8EDF3; border-radius: 8px; padding: 20px; }
      .project-head h2 { margin: 4px 0 6px; font-size: clamp(24px, 3vw, 38px); letter-spacing: 0; }
      .project-head p { margin: 0; color: #BFC7D1; line-height: 1.5; }
      .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .metric { border: 1px solid #28313E; border-radius: 6px; background: #1B232E; padding: 12px; }
      .metric span { display: block; color: #8B97A6; font-size: 12px; font-weight: 700; }
      .metric strong { display: block; margin-top: 4px; font-family: Jost, ui-monospace, monospace; font-size: 30px; line-height: 1; }
      .system-layout { display: grid; grid-template-columns: minmax(280px, .9fr) minmax(280px, 1.1fr); gap: 18px; align-items: start; }
      .particle-panel { grid-column: 1 / -1; }
      .diagnosis-panel, .spring-panel, .enterprise-panel { min-height: 100%; }
      .spring-meaning { display: grid; gap: 9px; }
      .spring-meaning p { margin: 0; color: #667085; line-height: 1.5; font-size: 13px; }
      .spring-meaning b { color: #344054; }
      .panel-grid { display: grid; grid-template-columns: minmax(280px, .8fr) minmax(0, 1.2fr); gap: 18px; }
      .panel, .dimension { border: 1px solid #E4DED6; border-radius: 8px; background: #FFFCF7; padding: 16px; }
      .panel.wide { grid-column: span 1; }
      .panel-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #17727A; }
      .panel-title h3, .dimension h3, .signal h4 { margin: 0; font-size: 15px; }
      .particle-sim { display: block; }
      /* Canvas de ALTO FIJO y ANCHO fluido (se dibuja al tamano real → siempre nitido).
         El triangulo se ajusta al lado menor y queda centrado. */
      .particle-wrap { position: relative; overflow: hidden; border: 1px solid #E4DED6; border-radius: 6px; background: #fff; height: clamp(420px, 60vh, 560px); }
      .particle-wrap canvas { display: block; width: 100%; height: 100%; }
      .particle-zoom { position: absolute; top: 46px; right: 8px; z-index: 3; display: flex; flex-direction: column; gap: 4px; }
      .particle-zoom button { width: 30px; height: 30px; display: grid; place-items: center; border: 1px solid #D9D2C7; border-radius: 6px; background: rgba(255,252,247,.96); color: #344054; font-size: 17px; font-weight: 800; line-height: 1; cursor: pointer; box-shadow: 0 2px 6px rgba(21,27,35,.1); }
      .particle-zoom button:hover { background: #fff; border-color: #17727A; color: #17727A; }
      .boundary-alerts { position: absolute; top: 54px; right: 10px; z-index: 2; display: grid; gap: 6px; width: min(280px, calc(100% - 20px)); pointer-events: none; }
      .boundary-alerts div { border: 1px solid; border-radius: 6px; background: rgba(255,252,247,.96); box-shadow: 0 8px 22px rgba(21,27,35,.12); padding: 8px 10px; }
      .boundary-alerts b { display: block; font-family: Poppins, Segoe UI Semibold, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
      .boundary-alerts span { display: block; margin-top: 2px; color: #344054; font-size: 12px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .particle-help { position: absolute; bottom: 10px; left: 10px; z-index: 2; border: 1px solid #E4DED6; border-radius: 999px; background: rgba(255,252,247,.94); color: #475467; padding: 6px 10px; font-size: 11px; font-weight: 900; pointer-events: none; }
      .particle-detail { position: absolute; top: 54px; left: 10px; z-index: 3; width: min(310px, calc(100% - 20px)); max-height: calc(100% - 120px); overflow-y: auto; border: 1px solid; border-radius: 7px; background: rgba(255,252,247,.98); box-shadow: 0 14px 34px rgba(21,27,35,.18); padding: 12px; }
      .force-acc { border: 1px solid #E4DED6; border-radius: 6px; background: #fff; margin-bottom: 5px; }
      .force-acc > summary { cursor: pointer; list-style: none; padding: 6px 8px; font-size: 11px; }
      .force-acc > summary::-webkit-details-marker { display: none; }
      .force-acc-body { padding: 0 8px 8px; font-size: 11px; color: #667085; }
      .info-panel .info-tabs { display: flex; gap: 4px; margin-bottom: 12px; border-bottom: 1px solid #E4DED6; }
      .info-panel .info-tabs button { flex: 1; border: none; background: transparent; padding: 8px 6px; font-size: 12px; font-weight: 800; color: #667085; border-bottom: 2px solid transparent; cursor: pointer; }
      .info-panel .info-tabs button.active { color: #17727A; border-bottom-color: #17727A; }
      .particle-detail button { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid #D9D2C7; border-radius: 999px; background: #fff; color: #344054; font-weight: 900; line-height: 1; }
      .particle-detail b { display: block; padding-right: 30px; font-size: 11px; text-transform: uppercase; letter-spacing: .07em; }
      .particle-detail h4 { margin: 3px 28px 4px 0; color: #1D2939; font-size: 16px; }
      .particle-detail p { margin: 0 0 10px; color: #667085; line-height: 1.45; font-size: 13px; }
      .particle-detail dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 0; }
      .particle-detail dl div { min-width: 0; border: 1px solid #E4DED6; border-radius: 6px; background: #fff; padding: 7px; }
      .particle-detail dt { color: #667085; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
      .particle-detail dd { margin: 2px 0 0; color: #1D2939; font-size: 12px; font-weight: 900; overflow-wrap: anywhere; }
      .particle-legend { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
      .particle-legend span { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; border: 1px solid #E4DED6; border-radius: 999px; background: #FFFCF7; color: #475467; padding: 4px 9px; font-size: 11px; font-weight: 800; }
      .dot { display: inline-block; width: 8px; height: 8px; border-radius: 999px; }
      .dot.var { background: #17727A; }
      .dot.signal { background: #B42318; }
      .line { display: inline-block; width: 18px; height: 2px; background: rgba(102,112,133,.55); }
      .line.spring { background: linear-gradient(90deg, rgba(23,114,122,.75), rgba(181,71,8,.75), rgba(180,35,24,.75)); }
      .line.center-spring { background: repeating-linear-gradient(90deg, rgba(102,112,133,.7) 0 4px, transparent 4px 7px); }
      .line.force { background: #E8751A; position: relative; }
      .line.force::after { content: ""; position: absolute; right: -1px; top: -3px; border-left: 6px solid #E8751A; border-top: 4px solid transparent; border-bottom: 4px solid transparent; }
      .line.marginal { background: #FFB35F; }
      .line.outer { height: 3px; background: #0B69B7; }
      .note, .diagnosis, .dimension p, .signal p, .requirements p, .steps, .research-grid p, .enterprise-map p { color: #667085; line-height: 1.55; font-size: 14px; }
      .limit-strip { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
      .limit-strip div { min-width: 0; border: 1px solid; border-radius: 6px; background: #fff; padding: 9px; }
      .limit-strip span { display: inline-block; width: 9px; height: 9px; border-radius: 999px; margin-right: 6px; }
      .limit-strip b { font-size: 12px; font-family: Poppins, Segoe UI Semibold, sans-serif; }
      .limit-strip small { display: block; margin-top: 3px; color: #667085; font-size: 11px; font-weight: 800; }
      .stack { display: grid; gap: 10px; }
      .progress div { display: flex; justify-content: space-between; gap: 8px; color: #344054; font-size: 12px; font-weight: 800; }
      .progress i { display: block; height: 8px; margin-top: 4px; background: #F2F4F7; border-radius: 999px; overflow: hidden; }
      .progress em { display: block; height: 100%; border-radius: inherit; }
      .research-grid, .enterprise-map { display: grid; gap: 8px; }
      .research-grid div, .enterprise-map div { border: 1px solid #E4DED6; border-radius: 6px; background: #fff; padding: 10px; }
      .research-grid b, .enterprise-map span { display: block; color: #344054; font-weight: 900; font-size: 12px; text-transform: uppercase; letter-spacing: .05em; }
      .research-grid p, .enterprise-map p { margin: 5px 0 0; font-size: 13px; }
      .dimension-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
      .dimension-head { display: flex; align-items: center; gap: 10px; }
      .dimension-head span { display: inline-flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 6px; }
      .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
      .chips span { border: 1px solid #D9D2C7; border-radius: 999px; background: #fff; color: #475467; padding: 4px 9px; font-size: 12px; font-weight: 700; }
      .signal-form { display: grid; gap: 12px; }
      .signal-form label { display: grid; gap: 5px; color: #344054; font-size: 12px; font-weight: 800; }
      .signal-form input, .signal-form select, .signal-form textarea { width: 100%; border: 1px solid #D0D5DD; border-radius: 6px; background: #fff; color: #1D2939; padding: 9px 10px; outline-color: #E8751A; }
      .signal-form input[type="range"] { padding: 0; accent-color: #17727A; }
      .signal-form button { justify-content: center; background: #17727A; color: white; border-color: #17727A; }
      .signals { display: grid; gap: 10px; }
      .signal { display: grid; grid-template-columns: minmax(0, 1fr) 76px; gap: 12px; align-items: center; border: 1px solid #E4DED6; border-radius: 7px; background: #fff; padding: 12px; }
      .signal span { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; }
      .signal h4 { margin-top: 3px; }
      .signal p { margin: 4px 0 0; font-size: 13px; }
      .risk { display: grid; place-items: center; border: 1px solid; border-radius: 6px; padding: 8px 4px; }
      .risk strong { font-family: Jost, ui-monospace, monospace; font-size: 28px; line-height: 1; }
      .risk small { font-size: 11px; font-weight: 800; }
      .requirements { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .requirements div { border: 1px solid #E4DED6; border-radius: 7px; background: #fff; padding: 12px; }
      .requirements svg { color: #0D7A4F; vertical-align: -3px; margin-right: 6px; }
      .requirements span { font-weight: 900; color: #344054; }
      .requirements p { margin: 6px 0 0; font-size: 13px; }
      .steps { margin: 0; padding-left: 20px; }
      .steps li + li { margin-top: 9px; }
      .empty { color: #667085; border: 1px dashed #C8BFB3; border-radius: 6px; padding: 16px; text-align: center; }
      @media (max-width: 920px) {
        .workspace, .project-head, .panel-grid, .dimension-grid, .system-layout { grid-template-columns: 1fr; }
        .sidebar { position: static; }
        .project-list { grid-template-columns: repeat(3, minmax(0, 1fr)); }
      }
      @media (max-width: 640px) {
        .topbar { align-items: flex-start; flex-direction: column; padding: 12px; }
        .workspace { padding: 12px; }
        .project-list, .meta-grid, .requirements, .limit-strip { grid-template-columns: 1fr; }
        .signal { grid-template-columns: 1fr; }
        /* La grafica ya se escala sola (canvas cuadrado con zoom por ancho). */
        /* Indicadores como CARRUSEL horizontal (no se apilan) */
        .particle-legend { flex-wrap: nowrap; overflow-x: auto; -webkit-overflow-scrolling: touch; padding-bottom: 4px; }
        .particle-legend span { flex: 0 0 auto; font-size: 10px; padding: 4px 8px; }
        .particle-detail { width: calc(100% - 20px); max-height: calc(100% - 90px); }
        .particle-help { font-size: 10px; }
      }
    `}</style>
  );
}

ReactDOM.createRoot(document.getElementById("mdssp-root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
