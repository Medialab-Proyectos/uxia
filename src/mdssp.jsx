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

const STORE_KEY = "uxia.mdssp.prototype.v2"; // v2: ejemplo BID con 2 proyectos

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
  {
    id: "bid-sig-1",
    projectId: "bid-demo",
    client: "ClientPortal",
    dimension: "tecnologia",
    axis: "rendimiento",
    title: "Bloqueos activos: 3 · ClientPortal",
    evidence: "Data issues con Arvin, bug de login y dependencia del equipo SG Delta.",
    severity: 5,
    probability: 4,
    detectability: 3,
    confidence: 5,
    trend: "sube",
  },
  {
    id: "bid-sig-2",
    projectId: "bid-demo",
    client: "ClientPortal",
    dimension: "organizacion",
    axis: "economica",
    title: "Tardanza en entregas: 1 fuera de fecha · ClientPortal",
    evidence: "Entrega completada despues de la fecha comprometida.",
    severity: 3,
    probability: 3,
    detectability: 3,
    confidence: 4,
    trend: "estable",
  },
  {
    id: "bid-sig-3",
    projectId: "bid-demo",
    client: "Interfaz Fiduciaria",
    dimension: "tarea",
    axis: "carga",
    title: "Mal uso de recursos: 1 vencida · Interfaz Fiduciaria",
    evidence: "'Ajustar Figma para Rafa' vencio el 2026-07-14 y sigue abierta.",
    severity: 3,
    probability: 4,
    detectability: 2,
    confidence: 5,
    trend: "sube",
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
  const byClient = {};
  for (const t of tasks) (byClient[t.client || "General"] ||= []).push(t);

  // FUERZAS DEL PROYECTO (se estiman por dia con los datos del Centro de Operaciones):
  // tardanza en entregas, tiempo elevado, mal uso de recursos, bloqueos, calidad
  // insuficiente y feedback de usuarios. Cada una tiene `axis` explicito (el minimo
  // que amenaza: calidad / usabilidad / rendimiento).
  for (const [client, list] of Object.entries(byClient)) {
    const active = list.filter((t) => t.status !== "done");
    // Mal uso de recursos: tareas vencidas sin terminar (en revision no cuenta) → RENDIMIENTO
    const overdue = active.filter((t) => t.due_date && t.due_date < today && t.status !== "review");
    if (overdue.length) {
      out.push({
        id: `auto-${projectId}-${client}-vencidas`, projectId, client, auto: true,
        dimension: "tarea", axis: "carga",
        title: `Mal uso de recursos: ${overdue.length} vencida(s) · ${client}`,
        evidence: overdue.slice(0, 3).map((t) => t.title).join(" · "),
        severity: Math.min(5, 2 + overdue.length), probability: 4, detectability: 2, confidence: 5, trend: "sube",
      });
    }
    // Bloqueos activos (defectos/dependencias que frenan) → CALIDAD
    const blocked = active.filter((t) => t.status === "blocked");
    if (blocked.length) {
      out.push({
        id: `auto-${projectId}-${client}-bloqueadas`, projectId, client, auto: true,
        dimension: "tecnologia", axis: "rendimiento",
        title: `Bloqueos activos: ${blocked.length} · ${client}`,
        evidence: blocked.slice(0, 3).map((t) => t.title).join(" · "),
        severity: Math.min(5, 2 + blocked.length * 2), probability: 4, detectability: 3, confidence: 5, trend: "sube",
      });
    }
    const done = list.filter((t) => t.status === "done");
    // Tardanza en las entregas (completadas despues de la fecha) → RENDIMIENTO
    const late = done.filter((t) => t.due_date && t.completed_at && t.completed_at.slice(0, 10) > t.due_date);
    if (late.length) {
      out.push({
        id: `auto-${projectId}-${client}-tarde`, projectId, client, auto: true,
        dimension: "organizacion", axis: "economica",
        title: `Tardanza en entregas: ${late.length} fuera de fecha · ${client}`,
        evidence: late.slice(0, 3).map((t) => t.title).join(" · "),
        severity: Math.min(5, 2 + late.length), probability: 3, detectability: 3, confidence: 4, trend: "estable",
      });
    }
    // Satisfaccion/feedback tras entrega (rating): <3 = calidad insuficiente (CALIDAD);
    // 3–4 = feedback de usuarios regular (USABILIDAD).
    const rated = done.filter((t) => t.rating != null);
    if (rated.length) {
      const avg = rated.reduce((sum, t) => sum + Number(t.rating), 0) / rated.length;
      if (avg < 3) {
        out.push({
          id: `auto-${projectId}-${client}-calidad`, projectId, client, auto: true,
          dimension: "tecnologia", axis: "rendimiento",
          title: `Calidad insuficiente: satisfaccion ${avg.toFixed(1)}/5 · ${client}`,
          evidence: `${rated.length} entrega(s) calificada(s).`,
          severity: avg < 2.5 ? 5 : 4, probability: 4, detectability: 3,
          confidence: Math.min(5, 2 + rated.length), trend: "sube",
        });
      } else if (avg < 4) {
        out.push({
          id: `auto-${projectId}-${client}-feedback`, projectId, client, auto: true,
          dimension: "interaccion", axis: "rendimiento",
          title: `Usabilidad / feedback de usuarios: ${avg.toFixed(1)}/5 · ${client}`,
          evidence: `${rated.length} entrega(s) calificada(s).`,
          severity: 3, probability: 3, detectability: 3,
          confidence: Math.min(5, 2 + rated.length), trend: "estable",
        });
      }
    }
    // Tiempo elevado por entrega (worked_hours laborales) → RENDIMIENTO
    const hours = done.filter((t) => t.worked_hours != null && Number(t.worked_hours) > 0);
    if (hours.length) {
      const avgH = hours.reduce((sum, t) => sum + Number(t.worked_hours), 0) / hours.length;
      if (avgH > 24) {
        out.push({
          id: `auto-${projectId}-${client}-horas`, projectId, client, auto: true,
          dimension: "tarea", axis: "carga",
          title: `Tiempo elevado: ${Math.round(avgH)} h laborales por entrega · ${client}`,
          evidence: `${hours.length} entrega(s) con horas registradas.`,
          severity: avgH > 60 ? 5 : avgH > 40 ? 4 : 3, probability: 3, detectability: 3, confidence: 4, trend: "estable",
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
  const [companiesRes, projectsRes, tasksRes] = await Promise.all([
    fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,name,status&order=name.asc`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/projects?select=company_id,name,status`, { headers }),
    fetch(`${SUPABASE_URL}/rest/v1/tasks?select=company_id,client,title,status,due_date,completed_at,worked_hours,rating`, { headers }),
  ]);
  if (!companiesRes.ok || !tasksRes.ok) return null;
  const companies = await companiesRes.json();
  const subprojects = projectsRes.ok ? await projectsRes.json() : [];
  const tasks = await tasksRes.json();
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
  return { projects, signals };
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

function App() {
  const [state, setState] = React.useState(loadState);
  const [activeProject, setActiveProject] = React.useState(state.projects[0]?.id || "");
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

  // Datos reales del Centro de Operaciones (empresas + tareas de Supabase, sesion compartida)
  React.useEffect(() => {
    let alive = true;
    fetchLiveData()
      .then((data) => {
        if (!alive || !data?.projects?.length) return;
        setLive(data);
        setActiveProject((prev) => (data.projects.some((p) => p.id === prev) ? prev : data.projects[0].id));
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const projects = live?.projects?.length ? live.projects : state.projects;
  const project = projects.find((item) => item.id === activeProject) || projects[0];
  const projectSignals = [
    ...(live?.signals || []).filter((signal) => signal.projectId === project?.id),
    ...state.signals.filter((signal) => signal.projectId === project?.id),
  ];
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
          {live
            ? <p className="live-note" style={{ fontSize: 11, color: "#0D7A4F", margin: "0 0 8px", fontWeight: 700 }}>Conectado al Centro de Operaciones</p>
            : <p className="live-note" style={{ fontSize: 11, color: "#8b8272", margin: "0 0 8px" }}>Inicia sesion en la app principal para ver tus empresas.</p>}
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
                <p className="note">
                  Simulacion fiel al modelo: cada variable de entrada es un circulo (limite extremo y marginal); la
                  region factible es su interseccion y el sistema se inicializa en el circulo maximo inscrito. Los
                  actores son particulas de masa 1 unidas por cuerdas (k desde los indices β y δ, rango 0.6–1.5),
                  integradas con Runge-Kutta 4 y arrastradas por el centro de masas. Si una particula cruza un limite
                  marginal el sistema esta en riesgo; si cruza un limite extremo entra en desequilibrio y la simulacion
                  se detiene senalando la variable violada.
                </p>
                <LimitStrip counts={limitCounts} />
              </article>
              <article className="panel diagnosis-panel">
                <div className="panel-title">
                  <BarChart3 size={18} />
                  <h3>Como leer el mapa</h3>
                </div>
                <div className="research-grid">
                  {[
                    ["Particulas", "Cada particula es un proyecto de la empresa. Es lo mas importante del mapa."],
                    ["Fuerzas", "Las flechas nacen de condiciones reales del proyecto: tardanza, bloqueos, tiempo elevado, mala satisfaccion. Cada flecha dice de que condicion viene."],
                    ["Cuerdas", "Cada proyecto es independiente: su cuerda al punto ideal es la que lo trae de vuelta al centro cuando las fuerzas lo empujan."],
                    ["Limites", "Linea naranja = riesgo (limite marginal). Linea azul = falla: la simulacion se detiene y senala que limite se cruzo y que proyecto fue."],
                  ].map(([title, text]) => (
                    <div key={title}>
                      <b>{title}</b>
                      <p>{text}</p>
                    </div>
                  ))}
                </div>
              </article>
              <article className="panel spring-panel">
                <div className="panel-title">
                  <GitBranch size={18} />
                  <h3>Significado de los resortes</h3>
                </div>
                <div className="spring-meaning">
                  <p><b>Rigidez</b> = que tan dificil es deformar una relacion del sistema.</p>
                  <p><b>Longitud de reposo</b> = distancia esperada para que la relacion este alineada.</p>
                  <p><b>Amortiguacion</b> = perdida por friccion, retrabajo, espera o ruido organizacional.</p>
                  <p><b>Estiramiento</b> = tension: cuanto mas se alarga, mas cerca esta de accion, alarma o fracaso.</p>
                </div>
              </article>
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

function LimitStrip({ counts }) {
  return (
    <div className="limit-strip">
      {LIMITS.map((limit) => (
        <div key={limit.id} style={{ borderColor: `${limit.color}55` }}>
          <span style={{ backgroundColor: limit.color }} />
          <b style={{ color: limit.color }}>{limit.name}</b>
          <small>{counts?.[limit.id] || 0} senal(es)</small>
        </div>
      ))}
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
const GAMMA = 0.25;           // coeficiente de friccion global (-gamma*v, ec. 2)
const SPRING_DAMPING = 1.0;   // amortiguacion de cuerda (Java: d = 1.0)
const PARTICLE_MASS = 1;      // tesis: masa = 1 y constante en todas las particulas
const REF_MASS_FACTOR = 80;   // Java: constantedemasa = 80 (particula del centro de masas)
const REF_FORCE_SCALE = 0.005; // fraccion de la resultante que arrastra el centro de masas
const MARGINAL_RATIO = 0.85;  // circulos marginales (cirm) respecto a los extremos (cir)
const WARMUP_FRAMES = 110;    // Java: limitetiempo — tiempo antes de evaluar equilibrio
const OP_CYCLE = 240;         // "tiempo de operacion" (tesis): cada ciclo se recargan las condiciones
const DT = 0.35;              // paso de integracion RK4

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
const LIMIT_AXES = [
  { id: "economica", name: "Falla economica", labelAngle: -Math.PI / 2, color: "#0B69B7" },
  { id: "rendimiento", name: "Rendimiento inaceptable", labelAngle: 0, color: "#0B69B7" },
  { id: "carga", name: "Alta carga de trabajo", labelAngle: Math.PI / 2, color: "#0B69B7" },
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

// Variables de entrada → 3 circulos (equivale a addCirculo(...) del Java). Cada circulo
// se centra al lado OPUESTO de su etiqueta (triangulo de Reuleaux: la region factible es
// la interseccion). El riesgo agregado de las senales CIERRA la tolerancia (radio).
function buildInputCircles(signals) {
  const byAxis = {};
  for (const signal of signals) {
    const axis = AXIS_FROM_DIMENSION[signal.dimension] || "rendimiento";
    (byAxis[axis] ||= []).push(riskScore(signal) / 100);
  }
  const DIST = 3.2;
  const cir = LIMIT_AXES.map((axis) => {
    const list = byAxis[axis.id] || [];
    const risk = list.length ? list.reduce((sum, v) => sum + v, 0) / list.length : 0;
    const centerAngle = axis.labelAngle + Math.PI; // centro opuesto al rotulo
    return {
      id: axis.id,
      name: axis.name,
      color: axis.color,
      labelAngle: axis.labelAngle,
      x: Math.cos(centerAngle) * DIST,
      y: Math.sin(centerAngle) * DIST,
      r: 6.5 - risk * 2.2,
      risk,
    };
  });
  const cirm = cir.map((c) => ({ ...c, r: c.r * MARGINAL_RATIO }));
  return { cir, cirm };
}

// Asignacion por profundidad (tesis): los actores mas conectados (wi = suma de k de sus
// cuerdas) se colocan primero y sus vecinos de grafo quedan contiguos en el circulo.
function depthAssign(actors, graph) {
  const weight = {};
  graph.forEach(([a, b]) => { weight[a] = (weight[a] || 0) + 1; weight[b] = (weight[b] || 0) + 1; });
  const remaining = [...actors].sort((a, b) => (weight[b.key] || 0) - (weight[a.key] || 0));
  const ordered = [remaining.shift()];
  while (remaining.length) {
    const last = ordered[ordered.length - 1];
    let idx = remaining.findIndex((actor) =>
      graph.some(([x, y]) => (x === last.key && y === actor.key) || (y === last.key && x === actor.key)));
    if (idx < 0) idx = 0;
    ordered.push(remaining.splice(idx, 1)[0]);
  }
  return ordered;
}

// Actores genericos de cada proyecto (cluster): rodean al centro de masas del proyecto.
const CLUSTER_ACTORS = [
  { type: "personas", label: "Personas", color: "#5BAE2D" },
  { type: "dispositivos", label: "Dispositivos", color: "#5B35D5" },
  { type: "organizacion", label: "Organizacion", color: "#C82121" },
  { type: "entorno", label: "Entorno", color: "#F6B400" },
];

function ParticleSimulation({ project, signals, clients }) {
  const canvasRef = React.useRef(null);
  const wrapRef = React.useRef(null);
  const [status, setStatus] = React.useState({ kind: "corriendo", text: "Inicializando sistema..." });
  const [violations, setViolations] = React.useState([]);
  const [selected, setSelected] = React.useState(null);
  const [runId, setRunId] = React.useState(0);
  const selectedKeyRef = React.useRef(null);
  const hoverKeyRef = React.useRef(null);

  React.useEffect(() => {
    selectedKeyRef.current = selected?.key || null;
  }, [selected]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;

    let width = 0;
    let height = 0;
    let scale = 1;
    let animation = 0;
    let frames = 0;
    let stopped = false;
    let lastStatusText = "";
    let lastViolationSync = 0;

    // ---- 1) Limites: los 3 ejes del sistema + region factible ----
    const { cir, cirm } = buildInputCircles(signals);
    const feasible = maxInscribedCircle(cir);
    const infeasible = feasible.r <= 0.45;
    const violated = { cir: new Set(), cirm: new Set() };

    // ---- 2) Clusters: CADA CENTRO DE MASAS ES UN PROYECTO INTERNO de la empresa ----
    const clusterNames = (clients && clients.length ? clients : ["General"]).slice(0, 6);
    // Senales por proyecto: las que traen `client` van a su proyecto; las de empresa
    // (manuales, sin client) aplican a todos los proyectos.
    const signalsFor = (name) => signals.filter((sg) => !sg.client || sg.client === name);

    // Riesgo total (para β = participacion de eventos adversos por proyecto)
    const totalRisk = signals.reduce((sum, sg) => sum + riskScore(sg) / 100, 0);
    const kFromBeta = (b) => K_MAX - Math.min(1, Math.max(0, b)) * (K_MAX - K_MIN);

    const sys = new TSystem(0, GAMMA);
    let anchor = null;
    let ref = null;
    let centers = [];
    let actors = [];
    let prevRef = { x: 0, y: 0 };

    if (!infeasible) {
      // Ancla FIJA en el punto ideal de operacion (centro del circulo maximo inscrito).
      anchor = sys.makeParticle(1, feasible.x, feasible.y, 0, { kind: "anchor" });
      anchor.makeFixed();

      const R = feasible.r / 2; // tesis: inicializacion equidistante a la mitad del radio
      const single = clusterNames.length === 1;

      clusterNames.forEach((name, i) => {
        const ang = -Math.PI / 2 + (i / clusterNames.length) * Math.PI * 2;
        const dist = single ? R * 0.35 : R;
        const cx = feasible.x + Math.cos(ang) * dist;
        const cy = feasible.y + Math.sin(ang) * dist;
        const clusterSignals = signalsFor(name);
        const clusterRisk = clusterSignals.reduce((sum, sg) => sum + riskScore(sg) / 100, 0);
        const beta = totalRisk > 0 ? clusterRisk / totalRisk : 0; // β: solidez del proyecto

        // CENTRO DE MASAS del proyecto: la particula que se diagnostica contra los bordes.
        // Su cuerda al ancla es "la fuerza que lo trae al centro"; k desde β (mas eventos
        // adversos → cuerda mas debil → el proyecto deriva hacia los limites).
        const center = sys.makeParticle(PARTICLE_MASS, cx, cy, 0, {
          kind: "center", key: `c-${name}`, name, beta,
        });
        sys.makeSpring(center, anchor, kFromBeta(beta), SPRING_DAMPING, dist, "centro");
        centers.push(center);

        // Condiciones del proyecto (trazables): cada senal → { eje, riesgo, fuente }.
        center.meta.conditions = clusterSignals.map((sg) => ({
          axis: sg.axis || AXIS_FROM_DIMENSION[sg.dimension] || "rendimiento",
          r: riskScore(sg) / 100,
          source: sg.title,
          type: SIGNAL_TO_ACTOR_TYPE[sg.dimension] || "entorno",
        })).sort((a, b) => b.r - a.r);

      });

      // Los proyectos son INDEPENDIENTES (decision de Christian): cada uno tiene sus
      // propias fuerzas y su cuerda al punto ideal. No hay cuerdas proyecto-proyecto.

      // Particula de referencia (momentum del sistema completo, "Referencia2" del Java).
      ref = sys.makeParticle(PARTICLE_MASS * Math.max(1, centers.length) * REF_MASS_FACTOR, feasible.x, feasible.y, 0, { kind: "ref" });
      prevRef = { x: ref.position.x, y: ref.position.y };

      applyOperationForces(0);
    }

    // Fuerzas externas (termino E): cada condicion empuja al CENTRO del proyecto (y al
    // actor de su tipo) LEJOS del punto ideal del eje correspondiente; la cuerda al ancla
    // lo trae de vuelta. Se recargan por "tiempos de operacion" (tesis) rotando condicion.
    function applyOperationForces(cycle) {
      let sumX = 0;
      let sumY = 0;
      for (const p of centers) p.persistent = { x: 0, y: 0, z: 0 };
      for (const center of centers) {
        const list = center.meta.conditions || [];
        if (!list.length) { center.meta.activeCondition = null; continue; }
        const cond = list[cycle % list.length];
        center.meta.activeCondition = cond;
        const circle = cir.find((c) => c.id === cond.axis);
        if (!circle) continue;
        const dx = feasible.x - circle.x;
        const dy = feasible.y - circle.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        center.persistent = { x: ux * cond.r * 1.9, y: uy * cond.r * 1.9, z: 0 };
        sumX += center.persistent.x;
        sumY += center.persistent.y;
      }
      if (ref) ref.persistent = { x: sumX * REF_FORCE_SCALE, y: sumY * REF_FORCE_SCALE, z: 0 };
    }

    // ---- Utilidades ----
    const extent = Math.max(...cir.map((c) => c.r - Math.hypot(c.x, c.y))) + 2.1;
    function toScreen(x, y) {
      return { x: width / 2 + x * scale, y: height / 2 + y * scale };
    }

    function resize() {
      width = Math.max(320, Math.floor(wrap.clientWidth || wrap.getBoundingClientRect().width));
      height = Math.max(420, Math.floor(wrap.clientHeight || wrap.getBoundingClientRect().height));
      scale = Math.min(width, height) / 2 / extent;
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
        pushStatus("desequilibrio", `Falla del sistema en: ${extreme.c.name} (proyecto ${extreme.center.meta.name})`);
      } else if (marginal) {
        pushStatus("riesgo", `Sistema en riesgo en: ${marginal.c.name} (proyecto ${marginal.center.meta.name})`);
      } else {
        pushStatus("equilibrio", "Sistema en equilibrio");
      }
      if (performance.now() - lastViolationSync > 240) {
        setViolations(found.slice(0, 4));
        lastViolationSync = performance.now();
      }
    }

    function snapshot(p) {
      if (p.meta.kind === "center") {
        const spring = sys.springs.find((s) => s.kind === "centro" && s.a === p);
        return {
          key: p.meta.key,
          label: "Proyecto (centro de masas)",
          name: p.meta.name,
          color: "#21A7D8",
          role: "El diagnostico del sistema se hace por este centro: si se acerca o cruza los bordes, el proyecto esta en riesgo o falla.",
          kCentro: spring ? spring.ks.toFixed(2) : "-",
          tension: Math.round((spring?.tension || 0) * 100),
          beta: Math.round((p.meta.beta || 0) * 100),
          conditions: (p.meta.conditions || []).slice(0, 5),
          active: p.meta.activeCondition,
        };
      }
      const spring = sys.springs.find((s) => s.kind === "interaccion" && s.a === p);
      return {
        key: p.meta.key,
        label: `${p.meta.name} · ${p.meta.cluster}`,
        name: p.meta.name,
        color: p.meta.color,
        role: `Actor ${p.meta.type} del proyecto ${p.meta.cluster}.`,
        kCentro: p.meta.k ? p.meta.k.toFixed(2) : "-",
        tension: Math.round((spring?.tension || 0) * 100),
        beta: null,
        conditions: [],
        active: null,
      };
    }

    function hitParticle(event) {
      const rect = canvas.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      for (const p of [...centers].reverse()) {
        const s = toScreen(p.position.x, p.position.y);
        if (Math.hypot(x - s.x, y - s.y) <= 13) return p;
      }
      return null;
    }

    // ---- Dibujo ----
    function draw() {
      context.clearRect(0, 0, width, height);
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, width, height);

      for (const c of cir) {
        const s = toScreen(c.x, c.y);
        const isViolated = violated.cir.has(c.id);
        context.beginPath();
        context.arc(s.x, s.y, c.r * scale, 0, Math.PI * 2);
        context.strokeStyle = isViolated ? "#B42318" : c.color;
        context.lineWidth = isViolated ? 4.4 : 3.4;
        context.stroke();
      }
      for (const c of cirm) {
        const s = toScreen(c.x, c.y);
        const isViolated = violated.cirm.has(c.id);
        context.beginPath();
        context.setLineDash([5, 4]);
        context.arc(s.x, s.y, c.r * scale, 0, Math.PI * 2);
        context.strokeStyle = isViolated ? "#E8751A" : "#FFB35F";
        context.lineWidth = isViolated ? 2.4 : 1.4;
        context.stroke();
        context.setLineDash([]);
      }

      // Etiquetas de los 3 ejes
      for (const c of cir) {
        const reach = c.r - Math.hypot(c.x, c.y);
        const lx = Math.cos(c.labelAngle) * (reach + 0.85);
        const ly = Math.sin(c.labelAngle) * (reach + 0.85);
        const s = toScreen(lx, ly);
        context.font = "700 14px Poppins, Segoe UI, sans-serif";
        const label = c.risk > 0 ? `${c.name} (riesgo ${Math.round(c.risk * 100)}%)` : c.name;
        const w = context.measureText(label).width;
        context.fillStyle = "rgba(255,255,255,.9)";
        roundRect(context, s.x - w / 2 - 6, s.y - 16, w + 12, 21, 5);
        context.fill();
        context.fillStyle = "#1D2939";
        context.fillText(label, s.x - w / 2, s.y);
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

      // Fuerzas activas: flechas visibles pero que NO tapan la particula (nacen desde su
      // borde) y con el NOMBRE de la condicion que las genera, para saber de donde salen.
      for (const p of centers) {
        const mag = Math.hypot(p.persistent.x, p.persistent.y);
        if (mag < 0.02) continue;
        const s = toScreen(p.position.x, p.position.y);
        const ux = p.persistent.x / mag;
        const uy = p.persistent.y / mag;
        const start = 20; // separada del borde: la flecha NO toca la particula
        const len = 16 + mag * 7;
        context.strokeStyle = "rgba(232,117,26,.45)";
        context.fillStyle = "rgba(232,117,26,.45)";
        context.lineWidth = 1.1;
        context.beginPath();
        context.moveTo(s.x + ux * start, s.y + uy * start);
        context.lineTo(s.x + ux * (start + len), s.y + uy * (start + len));
        context.stroke();
        const tipX = s.x + ux * (start + len);
        const tipY = s.y + uy * (start + len);
        const angle = Math.atan2(uy, ux);
        context.beginPath();
        context.moveTo(tipX, tipY);
        context.lineTo(tipX - Math.cos(angle - 0.5) * 6, tipY - Math.sin(angle - 0.5) * 6);
        context.lineTo(tipX - Math.cos(angle + 0.5) * 6, tipY - Math.sin(angle + 0.5) * 6);
        context.closePath();
        context.fill();
        // Nombre corto de la condicion junto a la flecha (de donde sale la fuerza)
        const source = p.meta.activeCondition?.source || "";
        if (source) {
          const short = source.length > 34 ? `${source.slice(0, 32)}…` : source;
          context.font = "600 10px Lato, Segoe UI, sans-serif";
          const w = context.measureText(short).width;
          const lx = tipX + ux * 6 - (ux < 0 ? w : 0);
          context.fillStyle = "rgba(255,255,255,.85)";
          roundRect(context, lx - 3, tipY - 10, w + 6, 13, 3);
          context.fill();
          context.fillStyle = "rgba(154,75,8,.9)";
          context.fillText(short, lx, tipY);
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
        context.beginPath();
        context.arc(s.x, s.y, 9.5, 0, Math.PI * 2);
        context.fillStyle = "#21A7D8";
        context.fill();
        context.strokeStyle = "#1D2939";
        context.lineWidth = 1.6;
        context.stroke();
        context.font = "700 13px Poppins, Segoe UI, sans-serif";
        const w = context.measureText(center.meta.name).width;
        context.fillStyle = "rgba(255,255,255,.92)";
        roundRect(context, s.x + 13, s.y - 18, w + 12, 20, 4);
        context.fill();
        context.fillStyle = "#0B69B7";
        context.fillText(center.meta.name, s.x + 19, s.y - 3);
      }
    }

    // ---- Bucle ----
    function frame() {
      if (!stopped && !infeasible) {
        sys.tick(DT);
        const difx = ref.position.x - prevRef.x;
        const dify = ref.position.y - prevRef.y;
        if (difx !== 0 || dify !== 0) {
          for (const p of sys.particles) {
            if (p === ref) continue;
            p.position.x += difx;
            p.position.y += dify;
          }
        }
        prevRef = { x: ref.position.x, y: ref.position.y };
        // Saturacion: un proyecto (o actor) NO "sale volando" del mapa. Si cruza un limite
        // queda retenido justo afuera del borde (la falla se marca igual) + tope de velocidad.
        for (const p of centers) {
          const v = Math.hypot(p.velocity.x, p.velocity.y);
          if (v > 0.5) { p.velocity.x *= 0.5 / v; p.velocity.y *= 0.5 / v; }
          for (const c of cir) {
            const dx = p.position.x - c.x;
            const dy = p.position.y - c.y;
            const d = Math.hypot(dx, dy);
            const max = c.r + 0.55;
            if (d > max) {
              p.position.x = c.x + (dx / d) * max;
              p.position.y = c.y + (dy / d) * max;
            }
          }
        }
        frames += 1;
        if (frames % OP_CYCLE === 0) applyOperationForces(Math.floor(frames / OP_CYCLE));
        if (frames > WARMUP_FRAMES) evaluate();
        else pushStatus("corriendo", "Simulando: el sistema busca su punto de operacion...");
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
    <div className="particle-wrap" ref={wrapRef}>
      <canvas ref={canvasRef} />
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "absolute", top: 10, left: 10, right: 10, display: "flex", alignItems: "center",
          justifyContent: "space-between", gap: 8, padding: "7px 10px", borderRadius: 8,
          background: sc.bg, border: `1px solid ${sc.border}`, fontSize: 13, fontWeight: 700, color: sc.text,
        }}
      >
        <span>{status.text}</span>
        <button
          type="button"
          onClick={() => setRunId((v) => v + 1)}
          style={{
            border: `1px solid ${sc.border}`, background: "#fff", color: sc.text, borderRadius: 6,
            padding: "3px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}
        >
          Reiniciar simulacion
        </button>
      </div>
      {violations.length > 0 && (
        <div className="boundary-alerts" aria-live="polite">
          {violations.map((alert) => (
            <div key={alert.key} style={{ borderColor: `${alert.color}66` }}>
              <b style={{ color: alert.color }}>{alert.limit}</b>
              <span>{alert.label}</span>
            </div>
          ))}
        </div>
      )}
      <div className="particle-help">Haz click en un centro (proyecto) o actor para ver de donde salen sus fuerzas.</div>
      {selected && (
        <aside className="particle-detail" style={{ borderColor: `${selected.color}66` }}>
          <button type="button" onClick={() => setSelected(null)} aria-label="Cerrar detalle">x</button>
          <b style={{ color: selected.color }}>{selected.label}</b>
          <h4>{selected.name}</h4>
          <p>{selected.role}</p>
          <dl>
            <div><dt>k cuerda</dt><dd>{selected.kCentro}</dd></div>
            <div><dt>Tension</dt><dd>{selected.tension}%</dd></div>
            {selected.beta != null && <div><dt>β eventos adversos</dt><dd>{selected.beta}%</dd></div>}
          </dl>
          {selected.active && (
            <p style={{ fontSize: 11, marginTop: 6 }}>
              <b style={{ color: "#E8751A" }}>Fuerza activa:</b> {selected.active.source} → empuja hacia <b>{selected.active.axis}</b>
            </p>
          )}
          {selected.conditions?.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <b style={{ fontSize: 11 }}>Condiciones que generan fuerza:</b>
              <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 11 }}>
                {selected.conditions.map((cond, i) => (
                  <li key={i}>{cond.source} <span style={{ color: "#667085" }}>(riesgo {Math.round(cond.r * 100)}% → {cond.axis})</span></li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      )}
      <div className="particle-legend">
        <span><i className="dot var" style={{ background: "#21A7D8" }} /> Particula = proyecto de la empresa (centro de masas)</span>
        <span><i className="line center-spring" /> Cuerda al punto ideal (lo trae al centro)</span>
        <span><i className="line force" /> Fuerza con su condicion (tarea/senal de origen)</span>
        <span><i className="line marginal" /> Limites marginales</span>
        <span><i className="line outer" /> Limites extremos (3 ejes)</span>
      </div>
    </div>
  );
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
      .particle-wrap { position: relative; height: clamp(560px, 72vh, 760px); overflow: hidden; border: 1px solid #E4DED6; border-radius: 6px; background: #fff; }
      .particle-wrap canvas { position: absolute; inset: 0; display: block; width: 100%; height: 100%; }
      .boundary-alerts { position: absolute; top: 10px; right: 10px; z-index: 2; display: grid; gap: 6px; width: min(310px, calc(100% - 20px)); pointer-events: none; }
      .boundary-alerts div { border: 1px solid; border-radius: 6px; background: rgba(255,252,247,.96); box-shadow: 0 8px 22px rgba(21,27,35,.12); padding: 8px 10px; }
      .boundary-alerts b { display: block; font-family: Poppins, Segoe UI Semibold, sans-serif; font-size: 11px; text-transform: uppercase; letter-spacing: .06em; }
      .boundary-alerts span { display: block; margin-top: 2px; color: #344054; font-size: 12px; font-weight: 800; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .particle-help { position: absolute; top: 10px; left: 10px; z-index: 2; border: 1px solid #E4DED6; border-radius: 999px; background: rgba(255,252,247,.94); color: #475467; padding: 6px 10px; font-size: 11px; font-weight: 900; pointer-events: none; }
      .particle-detail { position: absolute; top: 46px; left: 10px; z-index: 3; width: min(310px, calc(100% - 20px)); border: 1px solid; border-radius: 7px; background: rgba(255,252,247,.98); box-shadow: 0 14px 34px rgba(21,27,35,.18); padding: 12px; }
      .particle-detail button { position: absolute; top: 8px; right: 8px; display: grid; place-items: center; width: 24px; height: 24px; border: 1px solid #D9D2C7; border-radius: 999px; background: #fff; color: #344054; font-weight: 900; line-height: 1; }
      .particle-detail b { display: block; padding-right: 30px; font-size: 11px; text-transform: uppercase; letter-spacing: .07em; }
      .particle-detail h4 { margin: 3px 28px 4px 0; color: #1D2939; font-size: 16px; }
      .particle-detail p { margin: 0 0 10px; color: #667085; line-height: 1.45; font-size: 13px; }
      .particle-detail dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 7px; margin: 0; }
      .particle-detail dl div { min-width: 0; border: 1px solid #E4DED6; border-radius: 6px; background: #fff; padding: 7px; }
      .particle-detail dt { color: #667085; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: .05em; }
      .particle-detail dd { margin: 2px 0 0; color: #1D2939; font-size: 12px; font-weight: 900; overflow-wrap: anywhere; }
      .particle-legend { position: absolute; left: 10px; right: 10px; bottom: 10px; display: flex; flex-wrap: wrap; gap: 8px; pointer-events: none; }
      .particle-legend span { display: inline-flex; align-items: center; gap: 6px; min-height: 24px; border: 1px solid #E4DED6; border-radius: 999px; background: rgba(255,252,247,.94); color: #475467; padding: 0 9px; font-size: 11px; font-weight: 800; }
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
        .particle-wrap { height: 520px; }
      }
      @media (max-width: 640px) {
        .topbar { align-items: flex-start; flex-direction: column; padding: 12px; }
        .workspace { padding: 12px; }
        .project-list, .meta-grid, .requirements, .limit-strip { grid-template-columns: 1fr; }
        .signal { grid-template-columns: 1fr; }
      }
    `}</style>
  );
}

ReactDOM.createRoot(document.getElementById("mdssp-root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
