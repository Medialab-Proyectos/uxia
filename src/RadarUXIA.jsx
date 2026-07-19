import { useState, useEffect } from "react";
import { Heart, ExternalLink, Trash2, Upload, Briefcase, Globe, MapPin, X, Check } from "lucide-react";
import logoLight from "./logos/logouxia.fw.png";
import logoDark from "./logos/logouxiaoscuro.fw.png";
import * as opsData from "./opsData.js";

// ─── Almacenamiento local (reemplaza window.storage del artefacto) ──────────
// Persiste en el navegador con localStorage. Mismo API async que usaba el artefacto.
const storage = {
  async get(key) {
    const value = localStorage.getItem(key);
    return value !== null ? { key, value } : null;
  },
  async set(key, value) {
    localStorage.setItem(key, value);
    return { key, value };
  },
};

// ─── Llamada a la API de Claude ─────────────────────────────────────────────
// IMPORTANTE: fuera de Claude.ai necesitas tu propia API key de Anthropic.
// Define VITE_ANTHROPIC_API_KEY en un archivo .env (ver README).
//
// El navegador NO puede llamar a api.anthropic.com directamente por CORS.
// Dos opciones:
//   A) Usar un backend/proxy propio que reenvíe la petición (RECOMENDADO en producción).
//   B) Para PRUEBAS locales, Anthropic permite el header
//      "anthropic-dangerous-direct-browser-access": "true" (expone tu key en el navegador).
//
// Cambia API_ENDPOINT por la URL de tu proxy si usas la opción A.
const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY || "";
const API_ENDPOINT = "https://api.anthropic.com/v1/messages";
// Endpoints relativos: en local los atiende Express (vía proxy de Vite),
// en Vercel los atienden las funciones serverless de /api.
const SCRAPER_ENDPOINT =
  import.meta.env.VITE_UXIA_SCRAPER_ENDPOINT || "/api/scrape";
const OPP_ENDPOINT =
  import.meta.env.VITE_UXIA_OPP_ENDPOINT || "/api/opportunities";

// Días transcurridos desde que se capturó/guardó una vacante.
function parseCapture(job) {
  if (job.capturedAt) return job.capturedAt;
  if (job.fecha) {
    const m = String(job.fecha).match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])).getTime();
  }
  return null;
}

function daysSince(job) {
  const t = parseCapture(job);
  if (t == null) return null;
  return Math.floor((Date.now() - t) / 86400000);
}

const STALE_DAYS = 3; // días sin acción para considerarse pendiente

// Identidad estable de un resultado, para marcarlo entre búsquedas distintas.
function interesKey(job) {
  return String(job.url || `${job.titulo || ""}|${job.empresa || ""}`).toLowerCase().trim();
}

async function callClaude(body) {
  if (!API_KEY) {
    throw new Error("Falta VITE_ANTHROPIC_API_KEY en el archivo .env");
  }
  const headers = { "Content-Type": "application/json" };
  headers["x-api-key"] = API_KEY;
  headers["anthropic-version"] = "2023-06-01";
  headers["anthropic-dangerous-direct-browser-access"] = "true";
  const response = await fetch(API_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Error llamando a Claude");
  }
  return data;
}

// ─── Paleta ────────────────────────────────────────────────────────────────
const LIGHT = {
  bg: "#F7F4EF", panel: "#FFFCF7", panelHi: "#F5F0E9", border: "#E7E0D5",
  text: "#1D2939", dim: "#667085", faint: "#8b8272",
  amber: "#E8751A", cyan: "#2AABB3", coral: "#C0362C", green: "#0D8F7D",
};
const DARK = {
  bg: "#0E1116", panel: "#151B23", panelHi: "#1B232E", border: "#28313E",
  text: "#E8EDF3", dim: "#8B97A6", faint: "#5B6675",
  amber: "#E8751A", cyan: "#2AABB3", coral: "#FF6B57", green: "#4ADE80",
};
let _radarTheme = "light";
try { _radarTheme = localStorage.getItem("radar-theme") || "light"; } catch { _radarTheme = "light"; }
// C es reactivo al tema vía Proxy: cada uso de C.x lee la paleta actual, y un
// setState en el toggle fuerza el re-render de todo el árbol.
const C = new Proxy({}, { get: (_t, k) => (_radarTheme === "dark" ? DARK : LIGHT)[k] });

const FONT = {
  display: "'Poppins', 'Segoe UI Semibold', sans-serif",
  body: "'Lato', 'Segoe UI', system-ui, sans-serif",
};

// Prioridad de empleos: Colombia + remoto + español PRIMERO, luego LATAM,
// y EE.UU./inglés al final (pero se muestran). Menor rank = más arriba.
function jobRank(j) {
  const loc = `${j.ubicacion || ""}`.toLowerCase();
  const remote = j.remoto === "remoto";
  const co = Boolean(j.esColombia) || /colombia|bogot|medell|cali|barranquilla|bucaramanga/.test(loc);
  const es = j.idioma === "español";
  const latam = es || /latam|latino|latin|m[eé]xico|argentin|chile|per[uú]|brasil|brazil|uruguay|ecuador|panam/.test(loc);
  if (co && remote) return 0;
  if (co) return 1;
  if (latam && remote) return 2;
  if (latam) return 3;
  return 4;
}

// Días desde que se capturó (created_at de Supabase). Ofertas viejas pueden estar
// vencidas — se avisa en la tarjeta.
function diasDesde(createdAt) {
  if (!createdAt) return null;
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
}

// Probabilidad de recordación según cuándo se capturó (created_at). Las empresas suelen
// contratar en las primeras 48h; después de 3 días baja rápido; a los 5 se archiva.
function frescura(createdAt) {
  const d = diasDesde(createdAt);
  if (d == null) return null;
  if (d <= 2) return { label: "A tiempo", detail: "dentro de 48h", tone: "green" };
  if (d <= 3) return { label: "Poco probable", detail: "3 días", tone: "amber" };
  if (d <= 5) return { label: "Baja probabilidad", detail: `${d} días`, tone: "coral" };
  return { label: "Vencida", detail: `${d} días`, tone: "coral" };
}

// Un "listado" es un enlace de búsqueda de una plataforma (no una oferta específica). Se
// separan de los empleos: se acceden por los botones de plataforma (pestaña Radar), no en
// la lista de ofertas.
function esListado(j) {
  if (!j) return false;
  if (j.esListado || j.tipo === "listado") return true;
  const e = String(j.empresa || "").toLowerCase();
  const t = String(j.titulo || "").toLowerCase();
  return /\(listado/.test(e) || /\bofertas\b|resultados de b|ver ofertas|listado de/.test(t);
}

// Filtro por periodicidad (cuándo se capturó, según created_at de Supabase).
function withinPeriod(createdAt, periodo) {
  if (periodo === "todas" || !createdAt) return true;
  const days = (Date.now() - new Date(createdAt).getTime()) / 86400000;
  if (periodo === "hoy") return days <= 1;
  if (periodo === "semana") return days <= 7;
  if (periodo === "quincena") return days <= 15;
  return true;
}

// ─── Fuentes de empleo ─────────────────────────────────────────────────────
function buildSources(q, remoteOnly) {
  const enc = encodeURIComponent(q);
  const slug = q.trim().toLowerCase().replace(/\s+/g, "-");
  return [
    {
      name: "LinkedIn",
      desc: "Vacantes en español · filtro remoto aplicado",
      url: `https://www.linkedin.com/jobs/search/?keywords=${enc}&location=Am%C3%A9rica%20Latina${remoteOnly ? "&f_WT=2" : ""}&sortBy=DD`,
      tag: "Global / LATAM",
    },
    {
      name: "Magneto",
      desc: "Portal colombiano · ofertas en español",
      url: `https://www.magneto365.com/co/trabajos/buscar/${encodeURIComponent(slug.split("-")[0] || "ux")}?q=${enc}${remoteOnly ? "&workModality=remote" : ""}`,
      tag: "Colombia",
    },
    {
      name: "Computrabajo",
      desc: "Búsqueda por término · revisa el filtro 'Desde casa'",
      url: `https://co.computrabajo.com/trabajo-de-${encodeURIComponent(slug)}`,
      tag: "Colombia",
    },
    {
      name: "elempleo",
      desc: "Portal colombiano de gran volumen · ofertas en español",
      url: `https://www.elempleo.com/co/ofertas-empleo/trabajo-${encodeURIComponent(slug)}`,
      tag: "Colombia",
    },
    {
      name: "Get on Board",
      desc: "Tech LATAM · fuerte en remoto y diseño",
      url: `https://www.getonbrd.com/jobs?q=${enc}${remoteOnly ? "&remote=true" : ""}`,
      tag: "LATAM remoto",
    },
    {
      name: "Torre",
      desc: "Matching LATAM · remoto en español",
      url: `https://torre.ai/search/jobs?q=${enc}`,
      tag: "LATAM",
    },
    {
      name: "Indeed Colombia",
      desc: "Agregador amplio en español",
      url: `https://co.indeed.com/jobs?q=${enc}${remoteOnly ? "&l=Remoto" : ""}`,
      tag: "Colombia",
    },
  ];
}

// Señales de demanda: directivos y empresas que expresan retos/dolores de UX
function buildOpportunitySources(q) {
  const enc = encodeURIComponent(q);
  return [
    {
      name: "LinkedIn · Retos de líderes",
      desc: "Posts de CEO, fundadores y líderes de talento que describen retos de producto o UX",
      url: `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(`(CEO OR fundador OR "talento humano" OR "head of product") (reto OR desafío OR "necesitamos") (UX OR UI OR producto)`)}&sortBy=%22date_posted%22`,
      tag: "Prospección",
    },
    {
      name: "LinkedIn · Dolores de UX",
      desc: "Empresas que mencionan problemas de usabilidad, retención o conversión",
      url: `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(`(problema OR dolor OR "estamos teniendo") (usabilidad OR UX OR retención OR conversión)`)}&sortBy=%22date_posted%22`,
      tag: "Prospección",
    },
    {
      name: "LinkedIn · Busca consultoría / agencia",
      desc: "Empresas que buscan consultoría, agencia, aliado o partner de UX",
      url: `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(`("buscamos agencia" OR "consultoría UX" OR "aliado de diseño" OR "partner de UX" OR "socio de diseño")`)}&sortBy=%22date_posted%22`,
      tag: "Prospección",
    },
    {
      name: "Google X-ray · consultoría / partner UX",
      desc: "Empresas o agencias buscando consultoría, aliado o partner de UX",
      url: `https://www.google.com/search?q=site%3Alinkedin.com%2Fposts+(%22buscamos+agencia%22+OR+%22consultor%C3%ADa+UX%22+OR+%22aliado+de+UX%22+OR+%22partner+de+dise%C3%B1o%22)+${enc}&tbs=qdr%3Am`,
      tag: "Sin sesión",
    },
    {
      name: "Google X-ray · rediseño / mejorar UX",
      desc: "Empresas hablando de rediseñar su app o mejorar su UX",
      url: `https://www.google.com/search?q=site%3Alinkedin.com%2Fposts+(%22redise%C3%B1ar%22+OR+%22mejorar+la+UX%22+OR+%22nuestro+producto+digital%22)+(UX+OR+app+OR+plataforma)&tbs=qdr%3Am`,
      tag: "Sin sesión",
    },
  ];
}

// Búsquedas en publicaciones (posts del feed), no en bolsas de empleo
function buildPostSources(q) {
  const enc = encodeURIComponent(q);
  const encVacante = encodeURIComponent(`vacante ${q}`);
  return [
    {
      name: "LinkedIn · Publicaciones",
      desc: "Busca en posts del feed (requiere sesión iniciada) · ordenado por fecha",
      url: `https://www.linkedin.com/search/results/content/?keywords=${encVacante}&sortBy=%22date_posted%22&datePosted=%22past-week%22`,
      tag: "Posts · última semana",
    },
    {
      name: "LinkedIn · Posts «buscamos»",
      desc: "Posts de reclutadores · enfoca UX, UI o product designer sin la palabra diseñador",
      url: `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(`("buscamos" OR "estamos buscando") (UX OR UI OR "product designer")`)}&sortBy=%22date_posted%22`,
      tag: "Posts",
    },
    {
      name: "Google X-ray · posts de LinkedIn",
      desc: "Rastrea linkedin.com/posts sin iniciar sesión · última semana",
      url: `https://www.google.com/search?q=site%3Alinkedin.com%2Fposts+(%22buscamos%22+OR+%22vacante%22+OR+%22estamos+buscando%22)+(${enc}+OR+%22UX+Research%22+OR+%22UX+Engineer%22+OR+%22Ingeniero+UX%22)+Colombia+LATAM+remoto&tbs=qdr%3Am2`,
      tag: "Sin sesión",
    },
    {
      name: "Google X-ray · empleo UX",
      desc: "Cruza LinkedIn, Computrabajo, Magneto, elempleo y Get on Board desde Google",
      url: `https://www.google.com/search?q=(site%3Alinkedin.com%2Fposts+OR+site%3Alinkedin.com%2Fjobs+OR+site%3Acomputrabajo.com+OR+site%3Amagneto365.com+OR+site%3Aelempleo.com+OR+site%3Agetonbrd.com)+(%22vacante%22+OR+%22buscamos%22+OR+%22estamos+buscando%22)+(${enc}+OR+%22UX+Research%22+OR+%22UX+Engineer%22+OR+%22Ingeniero+UX%22)+Colombia+LATAM+remoto&tbs=qdr%3Am2`,
      tag: "Google · 2 meses",
    },
    {
      name: "Google X-ray · «se busca» UX",
      desc: "Posts y páginas con lenguaje de vacante en español",
      url: `https://www.google.com/search?q=(site%3Alinkedin.com%2Fposts+OR+site%3Alinkedin.com%2Ffeed)+(%22buscamos%22+OR+%22se+busca%22+OR+%22estamos+contratando%22)+${enc}&tbs=qdr%3Aw`,
      tag: "Sin sesión",
    },
  ];
}

const QUICK_QUERIES = [
  "UX UI product designer remoto",
  "UX designer remoto español",
  "UX Research remoto Colombia",
  "UX Researcher LATAM español",
  "UX Engineer remoto LATAM",
  "Ingeniero UX Colombia",
  "UI designer Colombia",
  "product designer LATAM",
  "product manager IA Colombia",
  "AI UX engineer LATAM",
];

const SCAN_SCOPE = [
  "UX designer",
  "UI designer",
  "UX/UI designer",
  "product designer",
  "diseñador de producto",
  "product manager",
  "UX researcher",
  "UX research",
  "investigador UX",
  "UX engineer",
  "ingeniero UX",
  "AI product designer",
  "AI UX engineer",
].join(", ");

// Repara JSON cortado a mitad de respuesta (causa común de fallo)
function parseJobsJson(text) {
  const start = text.indexOf("[");
  if (start === -1) throw new Error("sin JSON");
  let raw = text.slice(start);
  // Intento directo
  try {
    return JSON.parse(raw.slice(0, raw.lastIndexOf("]") + 1));
  } catch (e) {
    // Truncado: recortar hasta el último objeto completo y cerrar el arreglo
    const lastBrace = raw.lastIndexOf("}");
    if (lastBrace === -1) throw new Error("JSON irrecuperable");
    return JSON.parse(raw.slice(0, lastBrace + 1) + "]");
  }
}

// ─── Puntaje de afinidad (respaldo local) ──────────────────────────────────
function localScore(job) {
  let s = 30;
  if (job.remoto === "remoto") s += 25;
  else if (job.remoto === "híbrido") s += 10;
  if (job.idioma === "español") s += 20;
  if ((job.señalesIA || []).length > 0) s += Math.min(15, job.señalesIA.length * 5);
  if (/ux|ui|experiencia|product design/i.test(job.titulo || "")) s += 10;
  return Math.min(100, s);
}

// ─── Anillo de puntaje (firma visual) ──────────────────────────────────────
function ScoreRing({ score }) {
  const r = 22, c = 2 * Math.PI * r;
  const color = score >= 75 ? C.green : score >= 50 ? C.amber : C.coral;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 56, height: 56 }}>
      <svg width="56" height="56" viewBox="0 0 56 56">
        <circle cx="28" cy="28" r={r} fill="none" stroke={C.border} strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth="4"
          strokeLinecap="round" strokeDasharray={c}
          strokeDashoffset={c - (c * score) / 100}
          transform="rotate(-90 28 28)"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <span className="absolute text-sm font-bold" style={{ color, fontFamily: FONT.display }}>
        {score}
      </span>
    </div>
  );
}

function ContactLine({ contacto }) {
  if (!contacto || contacto === "No especificado") return null;
  const emailMatch = contacto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  return (
    <div className="mt-2 px-2.5 py-1.5 rounded-md flex items-start gap-1.5" style={{ backgroundColor: "#EAF4F2", border: "1px solid #B7D8D4" }}>
      <span className="text-xs" style={{ color: "#17727A", flexShrink: 0 }}>✉</span>
      {emailMatch ? (
        <a href={`mailto:${emailMatch[0]}`} className="text-xs break-all" style={{ color: "#17727A", textDecoration: "none" }}>
          {contacto}
        </a>
      ) : (
        <span className="text-xs break-words" style={{ color: "#667085" }}>{contacto}</span>
      )}
    </div>
  );
}

function Badge({ children, color, bg, title }) {
  return (
    <span
      title={title}
      className="text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap"
      style={{ color, backgroundColor: bg, border: `1px solid ${color}33` }}
    >
      {children}
    </span>
  );
}

function hasDirectContact(contacto) {
  if (!contacto || contacto === "No especificado") return false;
  return /@|mailto|correo|email|cv|dm|mensaje|linkedin/i.test(contacto);
}

function recommendedChannel(item) {
  const contacto = item.contacto || "";
  if (/[\w.+-]+@[\w-]+\.[\w.-]+/.test(contacto)) return "Correo";
  if (/dm|mensaje|linkedin|conectar/i.test(contacto)) return "LinkedIn";
  return "Conexión";
}

function fallbackOutreach(item, mode = "job") {
  const company = item.empresa || "tu equipo";
  const pain = item.dolor || item.resumen || item.encaje || "el reto que están trabajando";
  if (mode === "lead") {
    return `Hola, vi lo que compartieron sobre ${pain}. Desde MediaLab ayudamos a equipos a mejorar UX, conversión y producto digital con investigación y diseño práctico. ¿Te parece si conectamos y te comparto una idea concreta para ${company}?`;
  }
  return `Hola, vi la oportunidad de ${item.titulo || "producto/UX"} en ${company}. Mi enfoque combina UX/UI, producto digital e IA aplicada cuando aporta valor. Me gustaría postularme y compartir portafolio y hoja de vida.`;
}

function parsePostLocally(text) {
  const clean = text.trim();
  const url = clean.match(/https?:\/\/(?:www\.)?linkedin\.com\/posts\/[^\s,]+/i)?.[0] || "";
  const email = clean.match(/[\w.+-]+@[\w-]+\.[\w.-]+/)?.[0] || "";
  const title =
    clean.match(/\b(UX\/UI|UX UI|UX|UI|Product Designer|Product Manager|Diseñador(?:a)? de producto|UX Researcher|AI UX Engineer)[^.,;\n]{0,70}/i)?.[0] ||
    "Post de LinkedIn analizado";
  const remoto = /remoto|remote|teletrabajo|desde casa/i.test(clean) ? "remoto" : /híbrido|hybrid/i.test(clean) ? "híbrido" : "no especificado";
  const categoria = /consultor[ií]a|agencia|partner|aliado|rediseñ|mejorar la ux|curso|aprender/i.test(clean) ? "lead comercial" : "empleo";
  return {
    titulo: title,
    empresa: "LinkedIn",
    fuente: "LinkedIn Posts",
    fuentePrioridad: "primaria",
    regionPrioridad: /colombia|bogot[aá]|medell[ií]n|cali|latam|remoto/i.test(clean) ? "Colombia/LATAM" : "secundaria",
    url,
    ubicacion: /colombia|bogot[aá]|medell[ií]n|cali/i.test(clean) ? "Colombia" : /latam/i.test(clean) ? "LATAM" : "No especificada",
    remoto,
    idioma: "español",
    salario: clean.match(/(?:COP|USD|\$)\s?[\d.,]{4,}(?:\s?(?:-|a|hasta)\s?(?:COP|USD|\$)?\s?[\d.,]{4,})?/i)?.[0] || "No especificado",
    contacto: email || (/dm|mensaje|inbox/i.test(clean) ? "DM o mensaje directo" : "No especificado"),
    canal: email ? "correo" : "LinkedIn",
    categoria,
    prioridad: "alta",
    mensaje: "",
    señalesIA: /ia|inteligencia artificial|ai|machine learning/i.test(clean) ? ["IA"] : [],
    score: 85,
    resumen: clean.slice(0, 160),
  };
}

function OutreachBox({ item, mode, message, loading, copied, onGenerate, onCopy }) {
  const text = message || item.mensaje || fallbackOutreach(item, mode);
  const channel = item.canal || recommendedChannel(item);
  return (
    <div className="mt-3 rounded-md p-3" style={{ backgroundColor: C.panelHi, border: `1px solid ${C.border}` }}>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div className="flex flex-wrap gap-1.5">
          <Badge color={C.cyan} bg={`${C.cyan}14`}>Canal: {channel}</Badge>
          {item.fuentePrioridad && <Badge color={C.green} bg={`${C.green}14`}>Fuente {item.fuentePrioridad}</Badge>}
          {item.regionPrioridad && <Badge color={C.amber} bg={`${C.amber}14`}>{item.regionPrioridad}</Badge>}
          {item.prioridad && <Badge color={C.amber} bg={`${C.amber}14`}>{item.prioridad}</Badge>}
          {item.categoria && <Badge color={C.coral} bg={`${C.coral}14`}>{item.categoria}</Badge>}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onGenerate}
            disabled={loading}
            className="text-xs px-2.5 py-1 rounded-md font-medium"
            style={{ color: C.cyan, border: `1px solid ${C.cyan}44`, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? "Optimizando..." : "Mejorar mensaje"}
          </button>
          <button
            onClick={() => onCopy(text)}
            className="text-xs px-2.5 py-1 rounded-md font-medium"
            style={{ color: copied ? C.green : C.dim, border: `1px solid ${copied ? C.green : C.border}` }}
          >
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>
      <p className="text-xs leading-relaxed whitespace-pre-line" style={{ color: C.dim }}>
        {text}
      </p>
    </div>
  );
}

// ─── App ───────────────────────────────────────────────────────────────────
export default function RadarUXIA({ token = "", theme = "light" } = {}) {
  _radarTheme = theme === "dark" ? "dark" : "light";
  const [tab, setTab] = useState("oportunidades");
  const [showNotif, setShowNotif] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [expandedSearch, setExpandedSearch] = useState(false);
  const [scanError, setScanError] = useState("");
  const [scanResults, setScanResults] = useState([]);
  const [savedIds, setSavedIds] = useState([]);
  const [oppScanning, setOppScanning] = useState(false);
  const [oppError, setOppError] = useState("");
  const [oppResults, setOppResults] = useState([]);
  const [oppQuery, setOppQuery] = useState("");
  const [jobQuery, setJobQuery] = useState("");
  const [periodo, setPeriodo] = useState("todas");
  const [panelItem, setPanelItem] = useState(null); // { item, kind } abierto en el panel lateral (solo web)
  const [iframeLoaded, setIframeLoaded] = useState(false); // el iframe del panel logró cargar
  const [radarInsumos, setRadarInsumos] = useState([]);
  const [uploadingInsumo, setUploadingInsumo] = useState(false);
  const [query, setQuery] = useState("UX UI product designer remoto");
  const [remoteOnly, setRemoteOnly] = useState(true);
  const [pasted, setPasted] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [jobs, setJobs] = useState([]);
  const [filter, setFilter] = useState("todas");
  const [loaded, setLoaded] = useState(false);
  const [outreachMessages, setOutreachMessages] = useState({});
  const [outreachLoading, setOutreachLoading] = useState("");
  const [interesList, setInteresList] = useState([]);
  const [confirmDelId, setConfirmDelId] = useState(null);
  const [radarNotice, setRadarNotice] = useState("");

  // Cargar vacantes: primero de Supabase (las llena Claude Code); si no hay, respaldo local.
  useEffect(() => {
    (async () => {
      try {
        let cargadas = null;
        if (opsData.opsDataReady()) {
          try { cargadas = await opsData.listVacantes(token); } catch { cargadas = null; }
        }
        if (cargadas && cargadas.length) {
          setJobs(cargadas);
        } else {
          const res = await storage.get("radar-jobs");
          if (res && res.value) setJobs(JSON.parse(res.value));
        }
        const resInteres = await storage.get("radar-interes");
        if (resInteres && resInteres.value) setInteresList(JSON.parse(resInteres.value));
      } catch (e) {
        // sin datos previos: primera vez
      } finally {
        setLoaded(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (next) => {
    setJobs(next);
    try {
      await storage.set("radar-jobs", JSON.stringify(next));
    } catch (e) {
      console.error("No se pudo guardar", e);
    }
  };

  const persistInteres = async (next) => {
    setInteresList(next);
    try {
      await storage.set("radar-interes", JSON.stringify(next));
    } catch (e) {
      console.error("No se pudo guardar la lista Me interesa", e);
    }
  };

  // Identidad estable de un resultado (los ids de escaneo cambian en cada búsqueda).
  const interesOf = (job) => interesList.find((x) => x.key === interesKey(job));

  const markInteres = async (job, value) => {
    const key = interesKey(job);
    const current = interesList.find((x) => x.key === key);
    const rest = interesList.filter((x) => x.key !== key);
    if (current && current.interes === value) {
      await persistInteres(rest); // volver a tocar el mismo botón = quitar
      return;
    }
    const entry = {
      ...job,
      key,
      interes: value,
      id: `int-${Date.now()}`,
      fecha: new Date().toLocaleDateString("es-CO"),
      capturedAt: Date.now(),
    };
    await persistInteres([entry, ...rest]);
  };

  const removeInteres = (key) => persistInteres(interesList.filter((x) => x.key !== key));

  const generateOutreach = async (item, mode = "job") => {
    setOutreachLoading(item.id);
    try {
      const data = await callClaude({
        model: "claude-sonnet-4-6",
        max_tokens: 450,
        messages: [
          {
            role: "user",
            content: `Escribe un mensaje breve y personalizado en español para ${mode === "lead" ? "prospectar un cliente de MediaLab" : "postular a una oportunidad laboral"}.

Contexto:
${JSON.stringify(item)}

Reglas:
- Máximo 85 palabras.
- Tono humano, directo y profesional.
- Si hay correo, asume email; si no, asume LinkedIn/conexión.
- Menciona el dolor, vacante o necesidad concreta.
- Para MediaLab, ofrece una conversación y una idea concreta, no vendas agresivamente.
- Para empleo, menciona portafolio y hoja de vida sin sonar genérico.
- No inventes datos, teléfonos ni nombres.

Responde solo el mensaje final.`,
          },
        ],
      });
      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      setOutreachMessages((prev) => ({ ...prev, [item.id]: text }));
    } catch (e) {
      setOutreachMessages((prev) => ({ ...prev, [item.id]: fallbackOutreach(item, mode) }));
    } finally {
      setOutreachLoading("");
    }
  };

  // ── Importar con IA ──
  const parseWithAI = async () => {
    if (!pasted.trim()) return;
    setParsing(true);
    setParseError("");
    try {
      if (!API_KEY) {
        const parsed = parsePostLocally(pasted);
        const stamped = {
          ...parsed,
          id: `job-${Date.now()}`,
          estado: "nueva",
          fecha: new Date().toLocaleDateString("es-CO"),
          capturedAt: Date.now(),
          score: typeof parsed.score === "number" ? parsed.score : localScore(parsed),
          mensaje: parsed.mensaje || fallbackOutreach(parsed, parsed.categoria === "lead comercial" ? "lead" : "job"),
        };
        await persist([stamped, ...jobs]);
        setPasted("");
        setTab("tablero");
        return;
      }
      const data = await callClaude({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            {
              role: "user",
              content: `Eres un analizador de vacantes y oportunidades para un diseñador senior UX/UI que busca trabajo remoto en español. El rol puede titularse UX, UI, product designer o diseñador de producto. La IA es un bono, no un requisito.

Extrae TODAS las vacantes u oportunidades del texto pegado abajo. Responde ÚNICAMENTE con un arreglo JSON válido, sin markdown, sin backticks, sin texto adicional. Cada objeto debe tener:
{
  "titulo": string,
  "empresa": string (o "No especificada"),
  "fuente": string (LinkedIn, Magneto, Computrabajo, etc. Infiere o usa "Otra"),
  "fuentePrioridad": "primaria" | "secundaria",
  "regionPrioridad": "Colombia/LATAM" | "secundaria",
  "ubicacion": string,
  "remoto": "remoto" | "híbrido" | "presencial" | "no especificado",
  "idioma": "español" | "inglés" | "bilingüe",
  "salario": string (o "No especificado"),
  "contacto": string (EXTRAE el dato de contacto publicado en la convocatoria/post: email, "enviar CV a X", "DM a [nombre]", nombre y cargo de quien publica, o usuario de LinkedIn. Si no hay, "No especificado"),
  "canal": "correo" | "LinkedIn" | "plataforma" | "conexión",
  "categoria": "empleo" | "freelance" | "partner MediaLab" | "curso" | "lead comercial",
  "prioridad": "alta" | "media" | "baja",
  "mensaje": string breve y personalizado para contactar,
  "señalesIA": array de strings (menciones de IA, ML, GenAI, prompts, etc. Vacío si no hay),
  "score": número 0-100 priorizando: remoto (+25), español (+20), señales de IA (+10 bono), rol UX/UI/product (+15), contacto visible (+10), base 20. PENALIZA -30 si exige inglés avanzado/fluido,
  "resumen": string de una frase en español
}

IMPORTANTE sobre el contacto: usa SOLO datos que la persona publicó voluntariamente en la convocatoria o post (correos, "mándame un DM", nombre del reclutador que publica). No inventes correos ni teléfonos.

Texto pegado:
${pasted}`,
            },
          ],
        });
      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");
      const clean = text.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const stamped = arr.map((j, i) => ({
        ...j,
        id: `job-${Date.now()}-${i}`,
        estado: "nueva",
        fecha: new Date().toLocaleDateString("es-CO"),
        capturedAt: Date.now(),
        score: typeof j.score === "number" ? j.score : localScore(j),
      }));
      await persist([...stamped, ...jobs]);
      setPasted("");
      setTab("tablero");
    } catch (e) {
      setParseError("No se pudo analizar el texto. Verifica que pegaste contenido de vacantes e intenta de nuevo.");
    } finally {
      setParsing(false);
    }
  };

  // ── Radar en vivo: búsqueda web con IA ──
  const runLocalScraper = async () => {
    const params = new URLSearchParams({
      q: query,
      remote: String(remoteOnly),
      limit: "18",
      expand: String(expandedSearch),
    });
    const response = await fetch(`${SCRAPER_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error("scraper local no disponible");
    const data = await response.json();
    if (!Array.isArray(data.jobs)) return [];
    return data.jobs;
  };

  const runScan = async () => {
    const data = await callClaude({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Busca en la web vacantes de empleo REALES, ACTIVAS y RECIENTES (publicadas en los últimos 30 días) para: "${query}".

Perfil del rol (cualquiera de estas variantes cuenta): diseñador UX, diseñador UI, diseñador UX/UI, product designer, diseñador de producto, diseñador de experiencia, UX/UI designer, UX Research, UX Researcher, investigador UX, UX Engineer, ingeniero UX. La experiencia en IA es un BONO, no un requisito: incluye vacantes UX/UI generales.
También incluye oportunidades cercanas para MediaLab o carrera si encajan con este mapa: ${SCAN_SCOPE}.

ORDEN DE PRIORIDAD:
1. Primero LinkedIn Jobs y posts públicos de LinkedIn.
2. Luego Colombia y LATAM: Colombia, Bogotá, Medellín, Cali, remoto Colombia, remoto LATAM o América Latina.
3. Después fuentes secundarias: Magneto, elempleo, Computrabajo, Get on Board, Torre u otras.
4. Finalmente oportunidades fuera de LATAM solo si son claramente remotas y relevantes.

REGLA DE FRESCURA: DESCARTA cualquier post/oferta de más de 60 días. Si dice hace 3 meses, hace 4 meses, hace un año o no parece reciente, descártalo.

REGLA DE IDIOMA (obligatoria): la vacante debe estar redactada EN ESPAÑOL. El título del rol puede estar en inglés (ej. "Product Designer", "UX/UI Designer", "UX Researcher", "UX Engineer"), pero la descripción, requisitos y aviso deben estar en español. DESCARTA cualquier vacante cuyo contenido esté en inglés, aunque el cargo coincida. Prioriza además ofertas REMOTAS (Colombia/LATAM).

Haz UNA SOLA búsqueda web amplia centrada primero en LinkedIn y Google X-ray, luego en los demás portales. Usa términos UX, UI, product designer, UX Research, UX Researcher, UX Engineer e Ingeniero UX. Combina portales y frases de contratación, por ejemplo: site:linkedin.com/jobs OR site:linkedin.com/posts ("UX designer" OR "UI designer" OR "product designer" OR "UX Research" OR "UX Engineer" OR "Ingeniero UX") remoto español Colombia LATAM, y después computrabajo OR magneto OR elempleo OR getonbrd OR torre.

REGLA CRÍTICA: NO incluyas vacantes cerradas, vencidas, expiradas, archivadas, ni que digan "ya no acepta postulaciones", "oferta finalizada" o tengan fecha de cierre pasada. Solo vacantes que sigan ABIERTAS y recibiendo postulaciones. Si dudas de si una está activa, descártala.

Luego responde SOLO con un arreglo JSON compacto (una sola línea, sin markdown, sin texto adicional). MÁXIMO 5 vacantes activas. Sé MUY breve. Formato por objeto:
{"titulo":"...","empresa":"...","fuente":"...","fuentePrioridad":"primaria|secundaria","regionPrioridad":"Colombia/LATAM|secundaria","url":"...","ubicacion":"...","remoto":"remoto|híbrido|presencial|no especificado","idioma":"español|inglés|bilingüe","salario":"... o No especificado","contacto":"email del post/convocatoria o forma de contacto si aparece, si no No especificado","canal":"correo|LinkedIn|plataforma|conexión","categoria":"empleo|freelance|partner MediaLab|curso|lead comercial","prioridad":"alta|media|baja","mensaje":"mensaje corto y personalizado para aplicar o conectar","señalesIA":["máx 2 o vacío"],"score":0-100,"resumen":"máx 12 palabras"}

Score: base 25, LinkedIn o Google X-ray +10, Colombia/LATAM +25, español +30, remoto +25, rol UX/UI/product/PM/UX Research/UX Engineer +15, señales IA +10 (bono), contacto directo publicado en el post +10. PENALIZA -40 si no es Colombia/LATAM/remoto, -40 si no está en español, -50 si tiene más de 60 días. Solo vacantes ACTIVAS con URL real encontrada en la búsqueda. Si no hay nada activo: []`,
          },
        ],
        tools: [{ type: "web_search_20250305", name: "web_search" }],
      });
    if (data.error) throw new Error(data.error.message || "error de API");
    const text = data.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n");
    return parseJobsJson(text);
  };

  const scanWithAI = async () => {
    setExpandedSearch(false);
    setScanning(true);
    setScanError("");
    setScanResults([]);
    let parsed = null;
    try {
      parsed = await runLocalScraper();
      if (!Array.isArray(parsed) || parsed.length === 0) {
        parsed = await runScan();
      }
    } catch (localError) {
      // Reintento automático una vez
      try {
        parsed = await runScan();
      } catch (aiError) {
        setScanError("No se pudo escanear. Inicia el backend con npm run scraper o configura VITE_ANTHROPIC_API_KEY para usar el fallback con IA.");
        setScanning(false);
        return;
      }
    }
    if (!Array.isArray(parsed) || parsed.length === 0) {
      setScanError("El radar no encontró vacantes indexadas con ese término. Prueba una variante (los chips de abajo ayudan).");
    } else {
      setScanResults(
        parsed.map((j, i) => ({
          ...j,
          id: `scan-${Date.now()}-${i}`,
          score: typeof j.score === "number" ? j.score : localScore(j),
        }))
      );
    }
    setScanning(false);
  };

  const scanExpanded = async () => {
    setExpandedSearch(true);
    setScanning(true);
    setScanError("");
    setScanResults([]);
    try {
      const params = new URLSearchParams({
        q: query,
        remote: String(remoteOnly),
        limit: "24",
        expand: "true",
      });
      const response = await fetch(`${SCRAPER_ENDPOINT}?${params.toString()}`);
      if (!response.ok) throw new Error("scraper local no disponible");
      const data = await response.json();
      const parsed = Array.isArray(data.jobs) ? data.jobs : [];
      if (parsed.length === 0) {
        setScanError("No aparecieron resultados con las combinaciones. Prueba una búsqueda más corta.");
      } else {
        setScanResults(parsed.map((j, i) => ({
          ...j,
          id: `scan-${Date.now()}-${i}`,
          score: typeof j.score === "number" ? j.score : localScore(j),
        })));
      }
    } catch (e) {
      setScanError("No se pudo correr la búsqueda combinada. Verifica que npm run scraper esté activo.");
    } finally {
      setScanning(false);
      setExpandedSearch(false);
    }
  };

  // ── Escaneo de oportunidades (prospección de clientes) ──
  const runOppScraper = async () => {
    const params = new URLSearchParams({ q: query, limit: "14" });
    const response = await fetch(`${OPP_ENDPOINT}?${params.toString()}`);
    if (!response.ok) throw new Error("scraper de oportunidades no disponible");
    const data = await response.json();
    return Array.isArray(data.opportunities) ? data.opportunities : [];
  };

  // El escaneo YA NO se hace en la interfaz: lo corre Claude Code por dentro
  // (npm run radar:fetch, reutiliza el scraper) y guarda en Supabase. Aquí solo
  // se leen las oportunidades para buscarlas y darles seguimiento.
  const scanOpportunities = async () => {
    setOppScanning(true);
    setOppError("");
    try {
      if (!opsData.opsDataReady()) {
        setOppError("Configura Supabase para ver las oportunidades.");
        return;
      }
      const list = await opsData.listOportunidades(token);
      setOppResults(list);
      if (!list.length) {
        setOppError('Aún no hay oportunidades. El escaneo lo corre Claude Code por dentro ("npm run radar:fetch") y quedan aquí para tu seguimiento.');
      }
    } catch (e) {
      setOppError(`No pude leer las oportunidades. ${e.message || ""}`);
    } finally {
      setOppScanning(false);
    }
  };

  useEffect(() => {
    scanOpportunities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveScanned = async (job) => {
    const stamped = {
      ...job,
      id: `job-${Date.now()}`,
      estado: "nueva",
      fecha: new Date().toLocaleDateString("es-CO"),
      capturedAt: Date.now(),
    };
    await persist([stamped, ...jobs]);
    setSavedIds((prev) => [...prev, job.id]);
  };

  const saveAllScanned = async () => {
    const nuevos = scanResults
      .filter((j) => !savedIds.includes(j.id))
      .map((j, i) => ({
        ...j,
        id: `job-${Date.now()}-${i}`,
        estado: "nueva",
        fecha: new Date().toLocaleDateString("es-CO"),
        capturedAt: Date.now(),
      }));
    await persist([...nuevos, ...jobs]);
    setSavedIds(scanResults.map((j) => j.id));
  };

  const updateEstado = (id, estado) => {
    persist(jobs.map((j) => (j.id === id ? { ...j, estado } : j)));
    if (opsData.opsDataReady()) opsData.updateVacante(token, id, { estado }).catch(() => {});
  };

  // "Postulado": tag dentro de Me gusta (no cambia el estado). Marca que ya te postulaste.
  const updateJobPostulado = (id, postulado) => {
    persist(jobs.map((j) => (j.id === id ? { ...j, postulado } : j)));
    if (opsData.opsDataReady()) opsData.updateVacante(token, id, { postulado }).catch(() => {});
  };
  const updateOppPostulado = (id, postulado) => {
    setOppResults((current) => current.map((o) => (o.id === id ? { ...o, postulado } : o)));
    if (opsData.opsDataReady()) opsData.updateOportunidad(token, id, { postulado }).catch(() => {});
  };

  const removeJob = async (id) => {
    const prev = jobs;
    persist(jobs.filter((j) => j.id !== id)); // optimista
    if (opsData.opsDataReady()) {
      try {
        await opsData.deleteVacante(token, id);
        setRadarNotice("Empleo eliminado.");
      } catch (e) {
        persist(prev); // revertir: la BD no lo borró
        setRadarNotice(`No se pudo eliminar en la base: ${e.message}. Verifica que corriste supabase/setup.sql (políticas RLS de 'vacantes').`);
      }
    } else {
      setRadarNotice("Empleo eliminado (solo en este navegador: falta configurar Supabase).");
    }
  };

  // Seguimiento de oportunidades (persistido en Supabase, compartido entre equipos).
  const updateOppEstado = (id, estado) => {
    setOppResults((current) => current.map((o) => (o.id === id ? { ...o, estado } : o)));
    if (opsData.opsDataReady()) opsData.updateOportunidad(token, id, { estado }).catch(() => {});
  };
  const removeOpp = async (id) => {
    const prev = oppResults;
    setOppResults((current) => current.filter((o) => o.id !== id)); // optimista
    if (opsData.opsDataReady()) {
      try {
        await opsData.deleteOportunidad(token, id);
        setRadarNotice("Propuesta eliminada.");
      } catch (e) {
        setOppResults(prev); // revertir: la BD no lo borró
        setRadarNotice(`No se pudo eliminar en la base: ${e.message}. Verifica que corriste supabase/setup.sql (políticas RLS de 'oportunidades').`);
      }
    } else {
      setRadarNotice("Propuesta eliminada (solo en este navegador: falta configurar Supabase).");
    }
  };

  // Control de borrar con confirmación inline (¿Borrar? Sí/No), sin popup del sistema.
  const renderDelete = (id, onDelete) => (
    confirmDelId === id ? (
      <span className="inline-flex items-center gap-1" onClick={(e) => e.preventDefault()}>
        <button
          onClick={(e) => { e.preventDefault(); setConfirmDelId(null); onDelete(id); }}
          className="inline-flex items-center rounded-md px-2 text-xs font-semibold"
          style={{ height: 34, background: C.coral, color: "#fff" }}
          title="Confirmar borrado"
        >
          Sí, borrar
        </button>
        <button
          onClick={(e) => { e.preventDefault(); setConfirmDelId(null); }}
          className="inline-flex items-center rounded-md px-2 text-xs font-semibold"
          style={{ height: 34, border: `1px solid ${C.border}`, color: C.text }}
          title="Cancelar"
        >
          No
        </button>
      </span>
    ) : (
      <button
        onClick={(e) => { e.preventDefault(); setConfirmDelId(id); }}
        title="Eliminar"
        className="inline-flex items-center justify-center rounded-md"
        style={{ width: 34, height: 34, color: C.coral, border: `1px solid ${C.coral}33` }}
      >
        <Trash2 size={16} />
      </button>
    )
  );

  // Subir propuesta desde imagen (reusa insumos_pendientes con companyId='radar').
  const loadRadarInsumos = async () => {
    if (!opsData.opsDataReady()) { setRadarInsumos([]); return; }
    try { setRadarInsumos(await opsData.listInsumos(token, "radar")); } catch { setRadarInsumos([]); }
  };
  const uploadRadarInsumo = async (file) => {
    if (!file || !opsData.opsDataReady()) { setParseError("Configura Supabase para subir imágenes."); return; }
    setUploadingInsumo(true);
    setParseError("");
    try {
      await opsData.saveInsumo(token, { companyId: "radar", client: "propuesta", file, kind: "imagen" });
      await loadRadarInsumos();
    } catch (e) {
      setParseError(`No pude subir la imagen. ${e.message || ""}`);
    } finally {
      setUploadingInsumo(false);
    }
  };
  const removeRadarInsumo = async (id) => {
    try { await opsData.deleteInsumo(token, id); } catch { /* se refresca igual */ }
    loadRadarInsumos();
  };
  const uploadRadarText = async () => {
    const text = pasted.trim();
    if (!text) return;
    if (!opsData.opsDataReady()) { setParseError("Configura Supabase para subir texto."); return; }
    setUploadingInsumo(true);
    setParseError("");
    try {
      const file = new File([text], `propuesta-${Date.now()}.txt`, { type: "text/plain" });
      await opsData.saveInsumo(token, { companyId: "radar", client: "propuesta", file, kind: "texto", rawText: text });
      setPasted("");
      await loadRadarInsumos();
    } catch (e) {
      setParseError(`No pude subir el texto. ${e.message || ""}`);
    } finally {
      setUploadingInsumo(false);
    }
  };

  useEffect(() => { loadRadarInsumos(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const visible = jobs
    // Los "listados" (enlaces de búsqueda de plataforma) NO son ofertas: se acceden por
    // los botones de plataforma (pestaña Radar), no en la lista de empleos.
    .filter((j) => !esListado(j))
    .filter((j) => {
      if (filter === "megusta") return j.estado === "me_interesa";
      if (filter === "postuladas") return j.postulado;
      // En las listas generales, las que ya están en "Me gusta" NO se muestran
      // (ya pasaron a esa lista); se ven en el filtro/segmento "Me gusta".
      if (j.estado === "me_interesa") return false;
      if (filter === "remotas") return j.remoto === "remoto";
      if (filter === "español") return j.idioma === "español";
      return true; // todas
    })
    .filter((j) => withinPeriod(j.createdAt, periodo))
    .filter((j) => {
      const t = jobQuery.trim().toLowerCase();
      return !t || `${j.titulo || ""} ${j.empresa || ""} ${j.ubicacion || ""} ${j.fuente || ""} ${j.resumen || ""}`.toLowerCase().includes(t);
    })
    .sort((a, b) => (jobRank(a) - jobRank(b)) || (b.score - a.score));

  const stats = {
    total: jobs.length,
    remotas: jobs.filter((j) => j.remoto === "remoto").length,
    colombia: jobs.filter((j) => j.esColombia).length,
    megusta: jobs.filter((j) => j.estado === "me_interesa").length,
  };

  // En WEB (pantalla ancha) la oferta/propuesta se abre en el panel lateral con su DETALLE
  // (los portales bloquean el iframe, así que mostramos lo que ya tenemos + botón "Abrir en el
  // sitio"). En móvil se deja que el enlace abra normalmente en otra pestaña.
  const openOffer = (e, item, kind) => {
    if (!item) return;
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      e.preventDefault();
      setIframeLoaded(false);
      setPanelItem({ item, kind });
    }
  };

  // Abre la url en una ventana emergente REUTILIZABLE (nombre fijo "radarSitio"): siempre es la
  // MISMA ventana y se recarga con la nueva URL en cada propuesta (no abre muchas). Cierra el panel.
  const abrirEnSitio = (url) => {
    if (!url) return;
    const w = 1100, h = 820;
    const left = typeof window !== "undefined" ? Math.max(0, Math.round((window.screen.width - w) / 2)) : 0;
    const top = typeof window !== "undefined" ? Math.max(0, Math.round((window.screen.height - h) / 2)) : 0;
    window.open(url, "radarSitio", `width=${w},height=${h},left=${left},top=${top}`);
    setPanelItem(null);
  };

  // Fallback: si el iframe no logra cargar en unos segundos (el sitio bloquea el embebido o no
  // responde), se abre la página en la ventana reutilizable y se cierra el panel. Los sitios que
  // SÍ permiten iframe (blogs, notas) disparan onLoad y cancelan este fallback.
  useEffect(() => {
    const url = panelItem?.item?.url;
    if (!url) return;
    const t = setTimeout(() => {
      setIframeLoaded((loaded) => {
        if (!loaded) abrirEnSitio(url);
        return loaded;
      });
    }, 4500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelItem]);

  // Listas alternas "Me interesa" / "No me interesa".
  const interesSi = interesList.filter((x) => x.interes === "si");
  const interesNo = interesList.filter((x) => x.interes === "no");

  // "Me gusta" reales (persistido en Supabase, estado === "me_interesa").
  const likedJobs = jobs.filter((j) => j.estado === "me_interesa");
  const likedOpps = oppResults.filter((o) => o.estado === "me_interesa");
  const likedCount = likedJobs.length + likedOpps.length;

  // Notificaciones: vacantes sin acción (ni aplicada ni descartada) por varios días.
  const staleJobs = jobs
    .filter((j) => j.estado !== "aplicada" && j.estado !== "descartada")
    .map((j) => ({ job: j, dias: daysSince(j) }))
    .filter((x) => x.dias != null && x.dias >= STALE_DAYS)
    .sort((a, b) => b.dias - a.dias);

  const sources = buildSources(query, remoteOnly);
  const postSources = buildPostSources(query);
  const [copied, setCopied] = useState("");

  const resultGroups = [
    {
      title: "Colombia",
      desc: "Ofertas ubicadas en Colombia (cualquier fuente). Prioridad máxima.",
      color: C.amber,
      items: scanResults.filter((j) => j.esColombia),
    },
    {
      title: "LinkedIn Posts",
      desc: "Convocatorias publicadas como posts de reclutadores o empresas.",
      color: C.amber,
      items: scanResults.filter((j) => !j.esColombia && j.fuente === "LinkedIn Posts"),
    },
    {
      title: "LinkedIn Jobs",
      desc: "Vacantes del buscador público de empleos de LinkedIn (resto de LATAM).",
      color: C.cyan,
      items: scanResults.filter((j) => !j.esColombia && j.fuente === "LinkedIn"),
    },
    {
      title: "Resto de LATAM",
      desc: "Ofertas remotas o de otros países de América Latina.",
      color: C.green,
      items: scanResults.filter((j) => !j.esColombia && j.fuente !== "LinkedIn Posts" && j.fuente !== "LinkedIn" && j.regionPrioridad === "Colombia/LATAM"),
    },
    {
      title: "Secundarias",
      desc: "Otras fuentes útiles cuando el encaje es bueno.",
      color: C.dim,
      items: scanResults.filter((j) => !j.esColombia && j.regionPrioridad !== "Colombia/LATAM" && j.fuente !== "LinkedIn Posts" && j.fuente !== "LinkedIn"),
    },
  ].filter((group) => group.items.length > 0);

  const copyLink = (url, name) => {
    const done = () => {
      setCopied(name);
      setTimeout(() => setCopied(""), 2000);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done).catch(() => fallbackCopy(url, done));
    } else {
      fallbackCopy(url, done);
    }
  };

  const fallbackCopy = (text, done) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { /* sin permiso */ }
    document.body.removeChild(ta);
  };

  return (
    <div style={{ backgroundColor: C.bg, minHeight: "100vh", fontFamily: FONT.body, color: C.text }}>
      <style>{`
        *:focus-visible { outline: 2px solid #E8751A; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        @keyframes radarSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Encabezado */}
        <header className="mb-4">
          <h1 className="text-2xl font-semibold leading-tight sm:text-3xl" style={{ color: C.text, fontFamily: FONT.display }}>
            Radar de oportunidades
          </h1>
          <p className="mt-1 text-sm" style={{ color: C.dim }}>
            Oportunidades y vacantes UX/UI · prioridad: Colombia + remoto + español
          </p>
        </header>

        {radarNotice && (
          <div role="status" aria-live="polite" className="mb-4 flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm" style={{ background: `${C.cyan}14`, border: `1px solid ${C.cyan}55`, color: C.text }}>
            <span>{radarNotice}</span>
            <button onClick={() => setRadarNotice("")} className="shrink-0 font-semibold" style={{ color: C.dim }} title="Cerrar">✕</button>
          </div>
        )}

        {/* Subir propuesta: full-width en móvil (antes del menú), automático en web. */}
        <button
          onClick={() => setTab("importar")}
          className="mb-4 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2.5 text-sm font-semibold transition-colors sm:w-auto"
          style={{
            backgroundColor: C.amber,
            border: `1px solid ${C.amber}`,
            color: "#fff",
            fontFamily: FONT.display,
            outline: tab === "importar" ? `2px solid ${C.amber}55` : "none",
            outlineOffset: 2,
          }}
        >
          <Upload size={16} /> Subir propuesta
        </button>

        {/* Menú estilo Centro (pestañas subrayadas) — 3 columnas iguales, sin scroll en responsive */}
        <nav className="mb-6 grid grid-cols-3" style={{ borderBottom: `1px solid ${C.border}` }}>
          {[
            ["oportunidades", "Oportunidades"],
            ["tablero", `Vacantes${jobs.length ? ` · ${jobs.length}` : ""}`],
            ["interes", `Me gusta${likedCount ? ` · ${likedCount}` : ""}`],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="whitespace-nowrap px-1 py-2 text-center text-xs font-semibold transition-colors sm:text-sm"
              style={{
                borderBottom: `2px solid ${tab === key ? C.amber : "transparent"}`,
                color: tab === key ? C.amber : C.dim,
                background: "transparent",
                fontFamily: FONT.display,
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── Indicadores del tablero (solo en Empleos) ── */}
        {tab === "tablero" && (
        <div className="mb-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              [Briefcase, "Empleos", stats.total, C.text],
              [Globe, "Remotos", stats.remotas, C.green],
              [MapPin, "Colombia", stats.colombia, C.amber],
              [Heart, "Me gusta", stats.megusta, stats.megusta ? C.coral : C.faint],
            ].map(([Icon, label, val, color]) => (
              <div
                key={label}
                className="rounded-md px-2 py-2.5 text-center"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}
              >
                <Icon size={15} style={{ color, margin: "0 auto 3px" }} />
                <div className="text-lg font-bold" style={{ color, fontFamily: FONT.display }}>{val}</div>
                <div className="text-[10px] leading-tight" style={{ color: C.faint }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Notificaciones: sin acción por varios días */}
          {staleJobs.length > 0 && (
            <div className="mt-2 rounded-md overflow-hidden" style={{ backgroundColor: `${C.coral}12`, border: `1px solid ${C.coral}44` }}>
              <button
                onClick={() => setShowNotif((v) => !v)}
                className="w-full flex items-center justify-between gap-2 px-3.5 py-2.5"
              >
                <span className="flex items-center gap-2 text-sm font-medium" style={{ color: C.coral, fontFamily: FONT.display }}>
                  <span className="inline-flex items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: C.coral, color: "#1A0805", width: 20, height: 20 }}>
                    {staleJobs.length}
                  </span>
                  {staleJobs.length === 1 ? "1 vacante sin acción" : `${staleJobs.length} vacantes sin acción`} · {STALE_DAYS}+ días
                </span>
                <span className="text-xs" style={{ color: C.coral }}>{showNotif ? "Ocultar" : "Ver"}</span>
              </button>
              {showNotif && (
                <div className="px-3.5 pb-3 space-y-1.5">
                  {staleJobs.slice(0, 6).map(({ job, dias }) => (
                    <div key={job.id} className="flex items-center justify-between gap-2 rounded-md px-3 py-2" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
                      <div className="min-w-0">
                        <div className="text-xs font-medium truncate" style={{ color: C.text }}>{job.titulo}</div>
                        <div className="text-[11px] truncate" style={{ color: C.faint }}>{job.empresa} · hace {dias} días</div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          onClick={() => updateEstado(job.id, "aplicada")}
                          className="text-[11px] px-2 py-1 rounded-md font-medium"
                          style={{ backgroundColor: `${C.cyan}1A`, color: C.cyan, border: `1px solid ${C.cyan}44` }}
                        >
                          Aplicada
                        </button>
                        <button
                          onClick={() => updateEstado(job.id, "descartada")}
                          className="text-[11px] px-2 py-1 rounded-md font-medium"
                          style={{ color: C.dim, border: `1px solid ${C.border}` }}
                        >
                          Descartar
                        </button>
                      </div>
                    </div>
                  ))}
                  {staleJobs.length > 6 && (
                    <button onClick={() => setTab("tablero")} className="text-[11px] mt-1" style={{ color: C.coral }}>
                      Ver las {staleJobs.length} en el tablero →
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        )}

        {/* ── RADAR EN VIVO ── */}
        {tab === "radar" && (
          <section>
            <div className="rounded-md p-5 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.amber}33` }}>
              <h2 className="font-semibold mb-1" style={{ fontFamily: FONT.display }}>
                Búsqueda única categorizada
              </h2>
              <p className="text-sm mb-3 leading-relaxed" style={{ color: C.dim }}>
                Escribe una sola búsqueda. El motor revisa LinkedIn Posts, LinkedIn Jobs y portales secundarios,
                y luego separa los resultados por categoría para decidir rápido a cuáles contactar.
              </p>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.faint }}>
                Término de búsqueda
              </label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md text-sm"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text }}
              />
              <div className="flex flex-wrap gap-2 mt-3">
                {QUICK_QUERIES.map((q) => (
                  <button
                    key={q}
                    onClick={() => setQuery(q)}
                    className="text-xs px-2.5 py-1 rounded-full transition-colors"
                    style={{
                      border: `1px solid ${query === q ? C.cyan : C.border}`,
                      color: query === q ? C.cyan : C.dim,
                      backgroundColor: query === q ? `${C.cyan}12` : "transparent",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer" style={{ color: C.dim }}>
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => setRemoteOnly(e.target.checked)}
                  style={{ accentColor: C.green }}
                />
                Priorizar remoto
              </label>
              <div className="mt-4 rounded-md p-3 text-xs leading-relaxed" style={{ backgroundColor: `${C.cyan}14`, border: `1px solid ${C.border}`, color: C.dim }}>
                La búsqueda ya no se hace desde aquí: <b style={{ color: C.text }}>la corre Claude Code por dentro</b> y las oportunidades se guardan en Supabase (pestaña Oportunidades). Esta sección queda para abrir búsquedas manuales en las plataformas.
              </div>
              {scanError && <p className="text-sm mt-2" style={{ color: C.coral }}>{scanError}</p>}
            </div>

            <div className="rounded-md p-4 mb-5" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
              <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: C.faint, fontFamily: FONT.display }}>
                Abrir búsqueda en plataformas
              </h3>
              <p className="text-xs mb-3" style={{ color: C.dim }}>
                Estos enlaces abren búsquedas en cada plataforma para revisar manualmente cuando quieras.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {[...postSources.slice(0, 2), ...sources.slice(0, 4)].map((s) => (
                  <div
                    key={s.name}
                    className="flex min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2"
                    style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate" style={{ color: C.text, fontFamily: FONT.display }}>
                        {s.name}
                      </div>
                      <div className="text-[11px] truncate" style={{ color: C.faint }}>{s.tag}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => copyLink(s.url, s.name)}
                        className="text-xs px-2 py-1 rounded-md"
                        style={{ color: copied === s.name ? C.green : C.dim, border: `1px solid ${C.border}` }}
                      >
                        {copied === s.name ? "Copiado" : "Copiar"}
                      </button>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs px-2 py-1 rounded-md"
                        style={{ color: s.name.includes("LinkedIn") ? C.amber : C.cyan, border: `1px solid ${C.border}`, textDecoration: "none" }}
                      >
                        Abrir
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {scanResults.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold" style={{ fontFamily: FONT.display }}>
                    {scanResults.length} resultados categorizados
                  </span>
                  <button
                    onClick={saveAllScanned}
                    className="text-xs px-3 py-1.5 rounded-md font-medium"
                    style={{ backgroundColor: `${C.cyan}1A`, color: C.cyan, border: `1px solid ${C.cyan}44` }}
                  >
                    Guardar todas
                  </button>
                </div>
                <div className="space-y-6">
                  {resultGroups.map((group) => (
                    <div key={group.title}>
                      <div className="mb-2">
                        <h3 className="text-sm font-semibold" style={{ color: group.color, fontFamily: FONT.display }}>
                          {group.title} · {group.items.length}
                        </h3>
                        <p className="text-xs" style={{ color: C.faint }}>{group.desc}</p>
                      </div>
                      <div className="space-y-3">
                        {group.items
                          .slice()
                          .sort((a, b) => (jobRank(a) - jobRank(b)) || (b.score - a.score))
                          .map((j) => (
                      <article key={j.id} className="rounded-md p-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
                        <div className="flex gap-3">
                          <ScoreRing score={j.score} />
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm leading-snug" style={{ fontFamily: FONT.display }}>
                              {j.titulo}
                            </h3>
                            <p className="text-xs mt-0.5" style={{ color: C.dim }}>
                              {j.empresa} · {j.fuente} · {j.ubicacion}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {j.esColombia && <Badge color={C.amber} bg={`${C.amber}14`}>Colombia</Badge>}
                              {j.remoto === "remoto" && <Badge color={C.green} bg={`${C.green}14`}>Remoto</Badge>}
                              {j.remoto === "híbrido" && <Badge color={C.amber} bg={`${C.amber}14`}>Híbrido</Badge>}
                              {j.idioma === "español" && <Badge color={C.cyan} bg={`${C.cyan}14`}>Español</Badge>}
                              {(j.señalesIA || []).slice(0, 3).map((s) => (
                                <Badge key={s} color={C.coral} bg={`${C.coral}14`}>{s}</Badge>
                              ))}
                              {j.salario && j.salario !== "No especificado" && (
                                <Badge color={C.dim} bg={`${C.dim}14`}>{j.salario}</Badge>
                              )}
                              {j.fechaPublicacion && (
                                <Badge color={C.faint} bg={`${C.faint}14`}>Publicada: {j.fechaPublicacion}</Badge>
                              )}
                            </div>
                            {j.resumen && (
                              <p className="text-xs mt-2 leading-relaxed" style={{ color: C.dim }}>{j.resumen}</p>
                            )}
                            <ContactLine contacto={j.contacto} />
                            <div className="flex gap-2 mt-3 items-center flex-wrap">
                              {(() => {
                                const estado = interesOf(j)?.interes;
                                return (
                                  <>
                                    <button
                                      onClick={() => markInteres(j, "si")}
                                      className="text-xs px-3 py-1 rounded-md font-medium"
                                      style={{
                                        backgroundColor: estado === "si" ? C.green : `${C.green}14`,
                                        color: estado === "si" ? "#ffffff" : C.green,
                                        border: `1px solid ${C.green}55`,
                                      }}
                                    >
                                      {estado === "si" ? "★ Me interesa" : "Me interesa"}
                                    </button>
                                    <button
                                      onClick={() => markInteres(j, "no")}
                                      className="text-xs px-3 py-1 rounded-md font-medium"
                                      style={{
                                        backgroundColor: estado === "no" ? C.coral : "transparent",
                                        color: estado === "no" ? "#1A0805" : C.dim,
                                        border: `1px solid ${estado === "no" ? C.coral : C.border}`,
                                      }}
                                    >
                                      No me interesa
                                    </button>
                                  </>
                                );
                              })()}
                              <button
                                onClick={() => saveScanned(j)}
                                disabled={savedIds.includes(j.id)}
                                className="text-xs px-3 py-1 rounded-md font-medium"
                                style={{
                                  backgroundColor: savedIds.includes(j.id) ? "transparent" : `${C.cyan}1A`,
                                  color: savedIds.includes(j.id) ? C.green : C.cyan,
                                  border: `1px solid ${savedIds.includes(j.id) ? C.green : C.cyan}44`,
                                }}
                              >
                                {savedIds.includes(j.id) ? "Guardada ✓" : "Guardar en tablero"}
                              </button>
                              <button
                                onClick={() => copyLink(outreachMessages[j.id] || j.mensaje || fallbackOutreach(j, "job"), `msg-${j.id}`)}
                                className="text-xs px-3 py-1 rounded-md font-medium"
                                style={{ color: copied === `msg-${j.id}` ? C.green : C.dim, border: `1px solid ${copied === `msg-${j.id}` ? C.green : C.border}` }}
                              >
                                {copied === `msg-${j.id}` ? "Mensaje copiado" : "Copiar mensaje"}
                              </button>
                              {j.url && (
                                <a
                                  href={j.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs"
                                  style={{ color: C.amber, textDecoration: "none" }}
                                >
                                  Ver oferta →
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </article>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        {/* ── OPORTUNIDADES (prospección) ── */}
        {tab === "oportunidades" && (
          <section>
            <div className="mb-4">
              <h2 className="text-base font-semibold" style={{ fontFamily: FONT.display, color: C.text }}>Oportunidades de negocio</h2>
              <p className="text-xs mt-0.5" style={{ color: C.dim }}>Empresas o personas que buscan agencia/aliado o expresan retos de UX. Revisa, filtra y da seguimiento.</p>
              {oppError && <p className="text-sm mt-2" style={{ color: C.coral }}>{oppError}</p>}
            </div>

            {/* Búsquedas manuales de prospección (desplegable, igual que en Empleos) */}
            <details className="rounded-md mb-6" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
                <span className="text-sm font-semibold" style={{ fontFamily: FONT.display, color: C.text }}>Búsquedas manuales de prospección</span>
                <span className="text-xs" style={{ color: C.faint }}>▾</span>
              </summary>
              <div className="px-4 pb-4 space-y-2">
                {buildOpportunitySources(query).map((s) => (
                  <div key={s.name} className="rounded-md px-4 py-3" style={{ backgroundColor: C.bg, border: `1px solid ${C.coral}22` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm" style={{ color: C.text, fontFamily: FONT.display }}>{s.name}</span>
                        <Badge color={C.coral} bg={`${C.coral}14`}>{s.tag}</Badge>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button onClick={() => copyLink(s.url, s.name)} className="text-xs px-2 py-1 rounded-md font-medium" style={{ color: copied === s.name ? C.green : C.dim, border: `1px solid ${C.border}` }}>
                          {copied === s.name ? "Copiado ✓" : "Copiar"}
                        </button>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-md font-medium" style={{ color: C.coral, border: `1px solid ${C.coral}44`, textDecoration: "none" }}>Abrir →</a>
                      </div>
                    </div>
                    {/* Descripción a lo ancho de toda la tarjeta */}
                    <p className="text-xs mt-1.5" style={{ color: C.dim }}>{s.desc}</p>
                  </div>
                ))}
              </div>
            </details>

            {/* Resultados de oportunidades */}
            {oppResults.length > 0 && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    value={oppQuery}
                    onChange={(e) => setOppQuery(e.target.value)}
                    placeholder="Filtrar propuestas por texto…"
                    className="flex-1 min-w-[160px] rounded-md px-3 py-2 text-sm outline-none"
                    style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text }}
                  />
                  <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="rounded-md px-2 py-2 text-sm outline-none" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
                    <option value="todas">Todas las fechas</option>
                    <option value="hoy">Capturadas hoy</option>
                    <option value="semana">Última semana</option>
                    <option value="quincena">Últimos 15 días</option>
                  </select>
                </div>
                {(() => {
                  const t = oppQuery.trim().toLowerCase();
                  const filtered = oppResults
                    .filter((o) => o.estado !== "archivada")
                    .filter((o) => withinPeriod(o.createdAt, periodo))
                    .filter((o) => !t || `${o.empresa || ""} ${o.dolor || ""} ${o.encaje || ""} ${o.ubicacion || ""} ${o.tipo || ""}`.toLowerCase().includes(t))
                    .slice()
                    .sort((a, b) => b.score - a.score);
                  return (
                    <>
                      <span className="text-sm font-semibold" style={{ fontFamily: FONT.display }}>
                        {filtered.length} de {oppResults.length} propuestas
                      </span>
                      {filtered.map((o) => (
                    <details key={o.id} className="rounded-md" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, opacity: o.estado === "descartada" ? 0.55 : 1 }}>
                      <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                        <ScoreRing score={o.score} />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm leading-snug truncate" style={{ fontFamily: FONT.display }}>
                            {o.empresa}
                          </h3>
                          <p className="text-xs mt-0.5 truncate" style={{ color: C.dim }}>
                            {o.persona} · {o.fuente}
                          </p>
                          <div className="flex flex-wrap items-center gap-1 mt-1">
                            {(() => { const f = frescura(o.createdAt); if (!f) return null; const col = f.tone === "green" ? C.green : f.tone === "amber" ? C.amber : C.coral; return <Badge color={col} bg={`${col}14`} title={`Frescura: ${f.detail}`}>{f.label}</Badge>; })()}
                            {o.postulado && <Badge color={C.green} bg={`${C.green}14`}>✓ Postulado</Badge>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {o.estado === "me_interesa" && (
                            <button
                              onClick={(e) => { e.preventDefault(); updateOppPostulado(o.id, !o.postulado); }}
                              title={o.postulado ? "Postulado — clic para quitar" : "Marcar que ya te postulaste"}
                              aria-label="Postulado"
                              className="inline-flex items-center justify-center rounded-md"
                              style={{ width: 34, height: 34, backgroundColor: o.postulado ? C.green : `${C.green}14`, color: o.postulado ? "#fff" : C.green, border: `1px solid ${C.green}44` }}
                            >
                              <Check size={16} />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.preventDefault(); updateOppEstado(o.id, o.estado === "me_interesa" ? "nueva" : "me_interesa"); }}
                            title={o.estado === "me_interesa" ? "Quitar me gusta" : "Me gusta"}
                            className="inline-flex items-center justify-center rounded-md"
                            style={{ width: 34, height: 34, backgroundColor: o.estado === "me_interesa" ? C.coral : `${C.coral}14`, color: o.estado === "me_interesa" ? "#fff" : C.coral, border: `1px solid ${C.coral}44` }}
                          >
                            <Heart size={16} fill={o.estado === "me_interesa" ? "#fff" : "none"} />
                          </button>
                          {renderDelete(o.id, removeOpp)}
                          <span className="text-xs" style={{ color: C.faint }}>▾</span>
                        </div>
                      </summary>
                      <div className="px-4 pb-4">
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {o.tipo && <Badge color={C.coral} bg={`${C.coral}14`}>{o.tipo}</Badge>}
                          {o.ubicacion && <Badge color={C.dim} bg={`${C.faint}14`}>{o.ubicacion}</Badge>}
                        </div>
                        {o.dolor && (
                          <p className="text-sm leading-relaxed" style={{ color: C.text }}>«{o.dolor}»</p>
                        )}
                        {o.encaje && (
                          <p className="text-xs mt-1 leading-relaxed" style={{ color: C.dim }}>Encaje: {o.encaje}</p>
                        )}
                        <ContactLine contacto={o.contacto} />
                        {o.url && (
                          <a href={o.url} target="_blank" rel="noopener noreferrer" onClick={(e) => openOffer(e, o, "propuesta")} className="inline-flex items-center gap-1 text-xs mt-3 px-3 py-1.5 rounded-md font-medium" style={{ color: C.cyan, border: `1px solid ${C.cyan}44`, textDecoration: "none" }}>
                            <ExternalLink size={14} /> Ver publicación
                          </a>
                        )}
                      </div>
                    </details>
                      ))}
                    </>
                  );
                })()}
              </div>
            )}
          </section>
        )}

        {/* ── ME INTERESA (lista alterna) ── */}
        {tab === "interes" && (
          <section>
            <div className="mb-4">
              <h2 className="text-base font-semibold" style={{ fontFamily: FONT.display, color: C.text }}>Me gusta</h2>
              <p className="text-xs mt-0.5" style={{ color: C.dim }}>Propuestas y empleos marcados con ♥ (guardado en Supabase, compartido). ♥ para quitar · 🗑 para eliminar.</p>
            </div>

            {likedCount === 0 ? (
              <div className="rounded-md p-8 text-center" style={{ backgroundColor: C.panel, border: `1px dashed ${C.border}` }}>
                <p className="text-sm mb-1" style={{ color: C.dim }}>Aún no marcaste nada con ♥.</p>
                <p className="text-xs" style={{ color: C.faint }}>En Propuestas o Empleos, toca el corazón de una tarjeta.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  ...likedOpps.map((o) => ({ id: o.id, kind: "Propuesta", score: o.score, titulo: o.empresa, sub: `${o.persona || ""} · ${o.fuente || ""}`, url: o.url, postulado: o.postulado, togglePost: () => updateOppPostulado(o.id, !o.postulado), unlike: () => updateOppEstado(o.id, "nueva"), del: () => removeOpp(o.id) })),
                  ...likedJobs.map((j) => ({ id: j.id, kind: "Empleo", score: j.score, titulo: j.titulo, sub: `${j.empresa || ""} · ${j.ubicacion || ""}`, url: j.url, postulado: j.postulado, togglePost: () => updateJobPostulado(j.id, !j.postulado), unlike: () => updateEstado(j.id, "nueva"), del: () => removeJob(j.id) })),
                ].map((item) => (
                  <article key={item.id} className="rounded-md p-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
                    <div className="flex gap-3 items-center">
                      <ScoreRing score={item.score} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug truncate" style={{ fontFamily: FONT.display }}>{item.titulo}</h3>
                        <p className="text-xs mt-0.5 truncate" style={{ color: C.dim }}>{item.sub} · {item.kind}</p>
                        <span className="mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold" style={item.postulado ? { backgroundColor: `${C.green}18`, color: C.green } : { backgroundColor: `${C.amber}18`, color: C.amber }}>
                          {item.postulado ? "✓ Postulado" : "Sin postular"}
                        </span>
                      </div>
                      {/* Botonera 2x2 a la derecha para no comerse la tarjeta. */}
                      <div className="grid shrink-0 grid-cols-2 gap-1.5">
                        <button onClick={item.togglePost} title={item.postulado ? "Postulado — clic para quitar" : "Marcar postulado"} className="inline-flex items-center justify-center rounded-md" style={{ width: 34, height: 34, backgroundColor: item.postulado ? C.green : `${C.green}14`, color: item.postulado ? "#fff" : C.green, border: `1px solid ${C.green}44` }}><Check size={15} /></button>
                        <button onClick={item.unlike} title="Quitar me gusta" className="inline-flex items-center justify-center rounded-md" style={{ width: 34, height: 34, backgroundColor: C.coral, color: "#fff", border: `1px solid ${C.coral}` }}><Heart size={15} fill="#fff" /></button>
                        {item.url
                          ? <a href={item.url} target="_blank" rel="noopener noreferrer" title="Ver" className="inline-flex items-center justify-center rounded-md" style={{ width: 34, height: 34, color: C.cyan, border: `1px solid ${C.cyan}44` }}><ExternalLink size={15} /></a>
                          : <span />}
                        {renderDelete(item.id, () => item.del())}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── IMPORTAR ── */}
        {tab === "importar" && (
          <section>
            <div className="rounded-md p-5" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
              <h2 className="font-semibold mb-1" style={{ fontFamily: FONT.display }}>
                Subir propuesta desde imagen
              </h2>
              <p className="text-sm mb-3" style={{ color: C.dim }}>
                ¿Te encontraste una oferta o un post? Captúralo desde el celular y súbelo aquí.
                El MD (Claude Code) lee las imágenes y agrega las nuevas a Propuestas / Empleos.
              </p>
              <label
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-semibold cursor-pointer"
                style={{ backgroundColor: C.amber, color: "#1A1205", opacity: uploadingInsumo ? 0.6 : 1, fontFamily: FONT.display }}
              >
                {uploadingInsumo ? "Subiendo…" : "Subir imagen"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadRadarInsumo(f); e.target.value = ""; }}
                />
              </label>

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: C.faint, fontFamily: FONT.display }}>…o pega el texto</p>
                <textarea
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-md text-sm resize-y outline-none"
                  style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                  placeholder={"Pega aquí la oferta, un post o una URL. Ej:\nBuscamos UX/UI remoto para Colombia. Enviar a talento@empresa.com…"}
                />
                <button
                  onClick={uploadRadarText}
                  disabled={uploadingInsumo || !pasted.trim()}
                  className="mt-2 px-5 py-2.5 rounded-md text-sm font-semibold"
                  style={{ backgroundColor: C.cyan, color: "#04201F", opacity: uploadingInsumo || !pasted.trim() ? 0.5 : 1, fontFamily: FONT.display }}
                >
                  Subir texto
                </button>
              </div>
              {parseError && <p className="text-sm mt-2" style={{ color: C.coral }}>{parseError}</p>}

              {radarInsumos.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.faint, fontFamily: FONT.display }}>
                    Pendientes de procesar ({radarInsumos.length})
                  </p>
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {radarInsumos.map((ins) => (
                      <li key={ins.id} className="flex items-center gap-3 rounded-md p-2" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
                        {ins.url && <img src={ins.url} alt={ins.fileName} className="h-12 w-12 rounded object-cover shrink-0" />}
                        <span className="min-w-0 flex-1 text-xs truncate" style={{ color: C.dim }}>{ins.fileName}</span>
                        {ins.url && <a href={ins.url} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: C.cyan, textDecoration: "none" }}>Ver</a>}
                        <button onClick={() => removeRadarInsumo(ins.id)} className="text-xs" style={{ color: C.coral }}>Borrar</button>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2" style={{ color: C.faint }}>
                    Se procesan cuando corro el MD (Claude Code lee las imágenes y llena Propuestas/Empleos).
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── TABLERO ── */}
        {tab === "tablero" && (
          <section>
            {/* Buscador y filtro de fecha: al lado en web; en responsive la fecha baja a otra línea. */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                value={jobQuery}
                onChange={(e) => setJobQuery(e.target.value)}
                placeholder="Buscar empleo por texto…"
                className="flex-1 min-w-[200px] rounded-md px-3 py-2 text-sm outline-none"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text }}
              />
              <select value={periodo} onChange={(e) => setPeriodo(e.target.value)} className="w-full sm:w-auto rounded-md px-2 py-2 text-sm outline-none" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, color: C.text }}>
                <option value="todas">Todas las fechas</option>
                <option value="hoy">Capturadas hoy</option>
                <option value="semana">Última semana</option>
                <option value="quincena">Últimos 15 días</option>
              </select>
            </div>
            {/* Filtros: carrusel horizontal (scroll con el dedo) en responsive. */}
            <div className="mb-4 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
              {[
                ["todas", "Todas"],
                ["remotas", "Solo remotas"],
                ["español", "En español"],
                ["megusta", "Me gusta"],
                ["postuladas", "Postuladas"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className="shrink-0 whitespace-nowrap text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
                  style={{
                    border: `1px solid ${filter === key ? C.amber : C.border}`,
                    color: filter === key ? C.amber : C.dim,
                    backgroundColor: filter === key ? `${C.amber}12` : "transparent",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Buscar en las plataformas (filtros especializados) — enlaces a LinkedIn, Computrabajo, etc. */}
            <details className="rounded-md mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
                <span className="text-sm font-semibold" style={{ fontFamily: FONT.display, color: C.text }}>Buscar en las plataformas · filtros especializados</span>
                <span className="text-xs" style={{ color: C.faint }}>▾</span>
              </summary>
              <div className="px-4 pb-4">
                <label className="flex items-center gap-2 mb-3 text-sm cursor-pointer" style={{ color: C.dim }}>
                  <input type="checkbox" checked={remoteOnly} onChange={(e) => setRemoteOnly(e.target.checked)} style={{ accentColor: C.green }} />
                  Priorizar remoto
                </label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {[...postSources, ...sources].map((s) => (
                    <div key={s.name} className="flex min-w-0 items-center justify-between gap-2 rounded-md px-3 py-2" style={{ backgroundColor: C.bg, border: `1px solid ${C.border}` }}>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-semibold truncate" style={{ color: C.text, fontFamily: FONT.display }}>{s.name}</div>
                        <div className="text-[11px] truncate" style={{ color: C.faint }}>{s.tag}</div>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => copyLink(s.url, s.name)} className="text-xs px-2 py-1 rounded-md" style={{ color: copied === s.name ? C.green : C.dim, border: `1px solid ${C.border}` }}>
                          {copied === s.name ? "Copiado" : "Copiar"}
                        </button>
                        <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs px-2 py-1 rounded-md" style={{ color: s.name.includes("LinkedIn") ? C.amber : C.cyan, border: `1px solid ${C.border}`, textDecoration: "none" }}>Abrir</a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </details>

            {/* Lista */}
            {!loaded ? (
              <p className="text-sm text-center py-10" style={{ color: C.faint }}>Cargando tu radar…</p>
            ) : visible.length === 0 ? (
              <div className="rounded-md p-8 text-center" style={{ backgroundColor: C.panel, border: `1px dashed ${C.border}` }}>
                <p className="text-sm mb-1" style={{ color: C.dim }}>Aún no hay vacantes aquí.</p>
                <p className="text-xs" style={{ color: C.faint }}>
                  Busca en las fuentes y trae los listados a «Importar con IA».
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visible.map((j) => (
                  <details
                    key={j.id}
                    className="rounded-md"
                    style={{
                      backgroundColor: C.panel,
                      border: `1px solid ${C.border}`,
                      opacity: j.estado === "descartada" ? 0.55 : 1,
                    }}
                  >
                    <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                      <ScoreRing score={j.score} />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug truncate" style={{ fontFamily: FONT.display }}>
                          {j.titulo}
                        </h3>
                        <p className="text-xs mt-0.5 truncate" style={{ color: C.dim }}>
                          {j.empresa} · {j.fuente}{j.ubicacion ? ` · ${j.ubicacion}` : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {(() => { const f = frescura(j.createdAt); if (!f) return null; const col = f.tone === "green" ? C.green : f.tone === "amber" ? C.amber : C.coral; return <Badge color={col} bg={`${col}14`} title={`Frescura: ${f.detail}`}>{f.label}</Badge>; })()}
                          {j.postulado && <Badge color={C.green} bg={`${C.green}14`}>✓ Postulado</Badge>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        {j.estado === "me_interesa" && (
                          <button
                            onClick={(e) => { e.preventDefault(); updateJobPostulado(j.id, !j.postulado); }}
                            title={j.postulado ? "Postulado — clic para quitar" : "Marcar que ya te postulaste"}
                            aria-label="Postulado"
                            className="inline-flex items-center justify-center rounded-md"
                            style={{ width: 34, height: 34, backgroundColor: j.postulado ? C.green : `${C.green}14`, color: j.postulado ? "#fff" : C.green, border: `1px solid ${C.green}44` }}
                          >
                            <Check size={16} />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.preventDefault(); updateEstado(j.id, j.estado === "me_interesa" ? "nueva" : "me_interesa"); }}
                          title={j.estado === "me_interesa" ? "Quitar me gusta" : "Me gusta"}
                          className="inline-flex items-center justify-center rounded-md"
                          style={{ width: 34, height: 34, backgroundColor: j.estado === "me_interesa" ? C.coral : `${C.coral}14`, color: j.estado === "me_interesa" ? "#fff" : C.coral, border: `1px solid ${C.coral}44` }}
                        >
                          <Heart size={16} fill={j.estado === "me_interesa" ? "#fff" : "none"} />
                        </button>
                        {renderDelete(j.id, removeJob)}
                        <span className="text-xs" style={{ color: C.faint }}>▾</span>
                      </div>
                    </summary>
                    <div className="px-4 pb-4">
                        <div className="flex flex-wrap gap-1.5">
                          {j.esColombia && <Badge color={C.amber} bg={`${C.amber}14`}>Colombia</Badge>}
                          {j.remoto === "remoto" && <Badge color={C.green} bg={`${C.green}14`}>Remoto</Badge>}
                          {j.remoto === "híbrido" && <Badge color={C.amber} bg={`${C.amber}14`}>Híbrido</Badge>}
                          {j.idioma === "español" && <Badge color={C.cyan} bg={`${C.cyan}14`}>Español</Badge>}
                          {(j.señalesIA || []).slice(0, 3).map((s) => (
                            <Badge key={s} color={C.coral} bg={`${C.coral}14`}>{s}</Badge>
                          ))}
                          {j.salario && j.salario !== "No especificado" && (
                            <Badge color={C.dim} bg={`${C.dim}14`}>{j.salario}</Badge>
                          )}
                          {j.fechaPublicacion && (
                            <Badge color={C.faint} bg={`${C.faint}14`}>Publicada: {j.fechaPublicacion}</Badge>
                          )}
                          {(() => {
                            const d = diasDesde(j.createdAt);
                            if (d == null) return null;
                            const vieja = d > 15;
                            return (
                              <Badge color={vieja ? C.coral : C.faint} bg={`${vieja ? C.coral : C.faint}14`}>
                                {d <= 0 ? "Capturada hoy" : `Capturada hace ${d}d`}{vieja ? " · puede estar vencida" : ""}
                              </Badge>
                            );
                          })()}
                        </div>
                        {j.resumen && (
                          <p className="text-xs mt-2 leading-relaxed" style={{ color: C.dim }}>{j.resumen}</p>
                        )}
                        <ContactLine contacto={j.contacto} />
                        {j.url && (
                          <a href={j.url} target="_blank" rel="noopener noreferrer" onClick={(e) => openOffer(e, j, "empleo")} className="inline-flex items-center gap-1 text-xs mt-3 px-3 py-1.5 rounded-md font-medium" style={{ color: C.cyan, border: `1px solid ${C.cyan}44`, textDecoration: "none" }}>
                            <ExternalLink size={14} /> Ver oferta
                          </a>
                        )}
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Panel lateral (web): intenta mostrar la página real en un iframe (funciona con blogs/notas
          de propuestas). Si el sitio bloquea el embebido o no responde en ~4.5s, se abre en otra
          pestaña y se cierra el panel (ver el useEffect de fallback). En móvil el enlace abre solo. */}
      {panelItem && panelItem.item.url && (
        <div className="fixed inset-0 z-50 flex">
          <button aria-label="Cerrar" onClick={() => setPanelItem(null)} className="flex-1" style={{ backgroundColor: "rgba(0,0,0,0.45)", border: "none", cursor: "pointer" }} />
          <div className="h-full flex flex-col shadow-2xl" style={{ width: "min(680px, 96vw)", backgroundColor: C.bg, borderLeft: `1px solid ${C.border}`, animation: "radarSlideIn .25s ease-out" }}>
            <div className="flex items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${C.border}` }}>
              <span className="text-xs truncate" title={panelItem.item.url} style={{ color: C.dim }}>
                {panelItem.item.titulo || panelItem.item.empresa || panelItem.item.url}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => abrirEnSitio(panelItem.item.url)} className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md font-medium" style={{ color: C.cyan, border: `1px solid ${C.cyan}44`, backgroundColor: "transparent", cursor: "pointer" }}>
                  <ExternalLink size={13} /> Abrir en el sitio
                </button>
                <button onClick={() => setPanelItem(null)} aria-label="Cerrar panel" className="inline-flex items-center justify-center rounded-md" style={{ width: 30, height: 30, color: C.dim, border: `1px solid ${C.border}`, backgroundColor: "transparent" }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <iframe
              key={panelItem.item.url}
              src={panelItem.item.url}
              title="Vista de la página"
              onLoad={() => setIframeLoaded(true)}
              className="flex-1 w-full"
              style={{ border: "none", backgroundColor: "#fff" }}
            />
            <div className="px-3 py-1.5 text-[10px]" style={{ color: C.faint, borderTop: `1px solid ${C.border}` }}>
              Los portales de empleo (LinkedIn, Indeed…) no permiten verse aquí; si no carga se abre en otra pestaña, o usa «Abrir en el sitio».
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
