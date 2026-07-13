import { useState, useEffect } from "react";
import logoUrl from "./logos/logouxiaoscuro.fw.png";
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
const C = {
  bg: "#F7F4EF",
  panel: "#FFFCF7",
  panelHi: "#F5F0E9",
  border: "#E7E0D5",
  text: "#1D2939",
  dim: "#667085",
  faint: "#8b8272",
  amber: "#E8751A",
  cyan: "#2AABB3",
  coral: "#C0362C",
  green: "#0D8F7D",
};

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

function Badge({ children, color, bg }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
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
export default function RadarUXIA({ token = "" } = {}) {
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

  const removeJob = (id) => {
    persist(jobs.filter((j) => j.id !== id));
    if (opsData.opsDataReady()) opsData.deleteVacante(token, id).catch(() => {});
  };

  // Seguimiento de oportunidades (persistido en Supabase, compartido entre equipos).
  const updateOppEstado = (id, estado) => {
    setOppResults((current) => current.map((o) => (o.id === id ? { ...o, estado } : o)));
    if (opsData.opsDataReady()) opsData.updateOportunidad(token, id, { estado }).catch(() => {});
  };
  const removeOpp = (id) => {
    setOppResults((current) => current.filter((o) => o.id !== id));
    if (opsData.opsDataReady()) opsData.deleteOportunidad(token, id).catch(() => {});
  };

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

  useEffect(() => { loadRadarInsumos(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const visible = jobs
    .filter((j) => {
      if (filter === "todas") return j.estado !== "descartada";
      if (filter === "remotas") return j.remoto === "remoto" && j.estado !== "descartada";
      if (filter === "español") return j.idioma === "español" && j.estado !== "descartada";
      return j.estado === filter;
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
    aplicadas: jobs.filter((j) => j.estado === "aplicada").length,
    pendientes: jobs.filter((j) => j.estado !== "aplicada" && j.estado !== "descartada").length,
  };

  // Listas alternas "Me interesa" / "No me interesa".
  const interesSi = interesList.filter((x) => x.interes === "si");
  const interesNo = interesList.filter((x) => x.interes === "no");

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
      `}</style>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Encabezado */}
        <header className="mb-8">
          <img
            src={logoUrl}
            alt="Radar UX·IA"
            className="mb-3"
            style={{ height: 48, width: "auto", display: "block" }}
          />
          <p className="text-sm" style={{ color: C.dim }}>
            Vacantes UX/UI · prioridad: español + remoto · IA como bono
          </p>
          <p className="text-xs mt-0.5" style={{ color: C.faint }}>
            Una idea de{" "}
            <a
              href="https://medialab.design/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: C.amber, textDecoration: "none" }}
            >
              MediaLab Ingeniería
            </a>
          </p>
        </header>

        <nav className="flex gap-1 mb-6 p-1 rounded-md overflow-x-auto" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
          {[
            ["oportunidades", "Propuestas · MediaLab"],
            ["tablero", `Empleos${jobs.length ? ` · ${jobs.length}` : ""}`],
            ["interes", `Me gusta${interesSi.length ? ` · ${interesSi.length}` : ""}`],
            ["importar", "Subir propuesta"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="flex-shrink-0 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                backgroundColor: tab === key ? C.panelHi : "transparent",
                color: tab === key ? C.text : C.dim,
                border: tab === key ? `1px solid ${C.border}` : "1px solid transparent",
                fontFamily: FONT.display,
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* ── Indicadores del tablero (siempre visibles) ── */}
        <div className="mb-4">
          <div className="grid grid-cols-4 gap-2">
            {[
              ["Capturadas", stats.total, C.text],
              ["Remotas", stats.remotas, C.green],
              ["Aplicadas", stats.aplicadas, C.cyan],
              ["Pendientes", stats.pendientes, stats.pendientes ? C.amber : C.faint],
            ].map(([label, val, color]) => (
              <button
                key={label}
                onClick={() => setTab("tablero")}
                className="rounded-md px-2 py-2.5 text-center"
                style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}
              >
                <div className="text-lg font-bold" style={{ color, fontFamily: FONT.display }}>{val}</div>
                <div className="text-[10px] leading-tight" style={{ color: C.faint }}>{label}</div>
              </button>
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
                    className="flex items-center justify-between gap-2 rounded-md px-3 py-2"
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
            <div className="rounded-md p-5 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.coral}33` }}>
              <h2 className="font-semibold mb-1" style={{ fontFamily: FONT.display }}>
                Radar comercial · señales de demanda
              </h2>
              <p className="text-sm mb-3 leading-relaxed" style={{ color: C.dim }}>
                Aquí no buscas empleo: buscas clientes. El radar rastrea <strong style={{ color: C.text }}>empresas y personas</strong>
                {" "}(no solo CEOs o líderes): fundadores, equipos, marcas o profesionales que expresan retos o
                dolores de UX, que buscan consultoría, agencia, aliado o partner de diseño, o que quieren aprender
                producto. Ideal para ofrecer los servicios de MediaLab Ingeniería. Cubre lo indexado públicamente en español.
              </p>
              <button
                onClick={scanOpportunities}
                disabled={oppScanning}
                className="px-5 py-2.5 rounded-md text-sm font-semibold w-full"
                style={{
                  backgroundColor: C.coral,
                  color: "#1A0805",
                  opacity: oppScanning ? 0.6 : 1,
                  fontFamily: FONT.display,
                }}
              >
                {oppScanning ? "Actualizando…" : "Actualizar oportunidades"}
              </button>
              {oppError && <p className="text-sm mt-2" style={{ color: C.coral }}>{oppError}</p>}
            </div>

            {/* Búsquedas manuales de prospección */}
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.faint, fontFamily: FONT.display }}>
              Búsquedas manuales de prospección
            </h3>
            <div className="space-y-2 mb-6">
              {buildOpportunitySources(query).map((s) => (
                <div key={s.name} className="flex items-center justify-between rounded-md px-4 py-3.5 gap-3" style={{ backgroundColor: C.panel, border: `1px solid ${C.coral}22` }}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: C.text, fontFamily: FONT.display }}>{s.name}</span>
                      <Badge color={C.coral} bg={`${C.coral}14`}>{s.tag}</Badge>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: C.dim }}>{s.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => copyLink(s.url, s.name)} className="text-xs px-2.5 py-1.5 rounded-md font-medium" style={{ color: copied === s.name ? C.green : C.dim, border: `1px solid ${C.border}` }}>
                      {copied === s.name ? "Copiado ✓" : "Copiar"}
                    </button>
                    <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-sm" style={{ color: C.coral, textDecoration: "none" }}>Abrir →</a>
                  </div>
                </div>
              ))}
            </div>

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
                        </div>
                        <span className="shrink-0 text-xs" style={{ color: C.faint }}>▾</span>
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
                        <OutreachBox
                          item={o}
                          mode="lead"
                          message={outreachMessages[o.id]}
                          loading={outreachLoading === o.id}
                          copied={copied === `msg-${o.id}`}
                          onGenerate={() => generateOutreach(o, "lead")}
                          onCopy={(text) => copyLink(text, `msg-${o.id}`)}
                        />
                        <div className="flex gap-2 mt-3 flex-wrap items-center">
                          {o.url && (
                            <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-xs px-3 py-1 rounded-md font-medium" style={{ color: C.coral, border: `1px solid ${C.coral}44`, textDecoration: "none" }}>
                              Ver publicación →
                            </a>
                          )}
                          <button
                            onClick={() => updateOppEstado(o.id, o.estado === "me_interesa" ? "nueva" : "me_interesa")}
                            className="text-xs px-3 py-1 rounded-md font-medium"
                            style={{ backgroundColor: o.estado === "me_interesa" ? C.green : `${C.green}14`, color: o.estado === "me_interesa" ? "#ffffff" : C.green, border: `1px solid ${C.green}55` }}
                          >
                            {o.estado === "me_interesa" ? "★ Me interesa" : "Me interesa"}
                          </button>
                          <button
                            onClick={() => updateOppEstado(o.id, "descartada")}
                            className="text-xs px-3 py-1 rounded-md font-medium"
                            style={{ color: C.dim, border: `1px solid ${C.border}` }}
                          >
                            Descartar
                          </button>
                          <button
                            onClick={() => removeOpp(o.id)}
                            className="text-xs px-3 py-1 rounded-md font-medium"
                            style={{ color: C.coral, border: `1px solid ${C.coral}33` }}
                          >
                            Eliminar
                          </button>
                        </div>
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
            <div className="rounded-md p-5 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.green}33` }}>
              <h2 className="font-semibold mb-1" style={{ fontFamily: FONT.display }}>
                Me interesa · lista alterna
              </h2>
              <p className="text-sm leading-relaxed" style={{ color: C.dim }}>
                Marca cada resultado de búsqueda como «Me interesa» o «No me interesa». Aquí quedan
                separados de tu tablero para revisarlos después. Puedes moverlos al tablero cuando decidas.
              </p>
            </div>

            {interesList.length === 0 ? (
              <div className="rounded-md p-8 text-center" style={{ backgroundColor: C.panel, border: `1px dashed ${C.border}` }}>
                <p className="text-sm mb-1" style={{ color: C.dim }}>Aún no has marcado resultados.</p>
                <p className="text-xs" style={{ color: C.faint }}>
                  En «Buscar», usa «Me interesa» / «No me interesa» en cada oferta.
                </p>
              </div>
            ) : (
              <>
                {[
                  { title: "Me interesan", color: C.green, items: interesSi },
                  { title: "No me interesan", color: C.coral, items: interesNo },
                ].filter((g) => g.items.length > 0).map((group) => (
                  <div key={group.title} className="mb-6">
                    <h3 className="text-sm font-semibold mb-2" style={{ color: group.color, fontFamily: FONT.display }}>
                      {group.title} · {group.items.length}
                    </h3>
                    <div className="space-y-3">
                      {group.items.map((j) => (
                        <article key={j.id} className="rounded-md p-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}`, opacity: j.interes === "no" ? 0.6 : 1 }}>
                          <div className="flex gap-3">
                            <ScoreRing score={j.score} />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm leading-snug" style={{ fontFamily: FONT.display }}>{j.titulo}</h3>
                              <p className="text-xs mt-0.5" style={{ color: C.dim }}>
                                {j.empresa} · {j.fuente} · {j.ubicacion}
                              </p>
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {j.esColombia && <Badge color={C.amber} bg={`${C.amber}14`}>Colombia</Badge>}
                                {j.remoto === "remoto" && <Badge color={C.green} bg={`${C.green}14`}>Remoto</Badge>}
                                {j.idioma === "español" && <Badge color={C.cyan} bg={`${C.cyan}14`}>Español</Badge>}
                                {j.fechaPublicacion && <Badge color={C.faint} bg={`${C.faint}14`}>Publicada: {j.fechaPublicacion}</Badge>}
                              </div>
                              <ContactLine contacto={j.contacto} />
                              <div className="flex gap-2 mt-3 items-center flex-wrap">
                                {j.interes === "no" ? (
                                  <button onClick={() => markInteres(j, "si")} className="text-xs px-3 py-1 rounded-md font-medium" style={{ backgroundColor: `${C.green}14`, color: C.green, border: `1px solid ${C.green}55` }}>
                                    Me interesa
                                  </button>
                                ) : (
                                  <button onClick={() => saveScanned(j)} className="text-xs px-3 py-1 rounded-md font-medium" style={{ backgroundColor: `${C.cyan}1A`, color: C.cyan, border: `1px solid ${C.cyan}44` }}>
                                    Guardar en tablero
                                  </button>
                                )}
                                {j.url && (
                                  <a href={j.url} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: C.amber, textDecoration: "none" }}>
                                    Ver oferta →
                                  </a>
                                )}
                                <button onClick={() => removeInteres(j.key)} className="text-xs px-3 py-1 rounded-md font-medium" style={{ color: C.coral, border: `1px solid ${C.coral}33` }}>
                                  Quitar
                                </button>
                              </div>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </section>
        )}

        {/* ── BUSCAR ── */}
        {tab === "buscar" && (
          <section>
            <div className="rounded-md p-5 mb-4" style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.faint }}>
                Término de búsqueda
              </label>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full px-3 py-2.5 rounded-md text-sm"
                style={{ backgroundColor: C.bg, border: `1px solid ${C.border}`, color: C.text }}
                placeholder="Ej: diseñador UX IA remoto"
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
                      backgroundColor: "transparent",
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 mt-4 text-sm cursor-pointer" style={{ color: C.dim }}>
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => setRemoteOnly(e.target.checked)}
                  style={{ accentColor: C.green }}
                />
                Solo remoto (donde el portal lo permite)
              </label>
            </div>

            <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.faint, fontFamily: FONT.display }}>
              Publicaciones y posts del feed
            </h2>
            <p className="text-xs mb-3 leading-relaxed" style={{ color: C.dim }}>
              Muchas vacantes UX nunca llegan a las bolsas de empleo: se publican como posts de reclutadores
              y agencias. Estas búsquedas rastrean directamente las publicaciones.
            </p>
            <div className="space-y-2 mb-6">
              {postSources.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-md px-4 py-3.5 gap-3"
                  style={{ backgroundColor: C.panel, border: `1px solid ${C.amber}33` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: C.text, fontFamily: FONT.display }}>
                        {s.name}
                      </span>
                      <Badge color={C.amber} bg={`${C.amber}14`}>{s.tag}</Badge>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: C.dim }}>{s.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(s.url, s.name)}
                      className="text-xs px-2.5 py-1.5 rounded-md font-medium"
                      style={{ color: copied === s.name ? C.green : C.dim, border: `1px solid ${C.border}` }}
                    >
                      {copied === s.name ? "Copiado ✓" : "Copiar"}
                    </button>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm"
                      style={{ color: C.amber, textDecoration: "none" }}
                    >
                      Abrir →
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <h2 className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: C.faint, fontFamily: FONT.display }}>
              Bolsas de empleo
            </h2>
            <div className="space-y-2">
              {sources.map((s) => (
                <div
                  key={s.name}
                  className="flex items-center justify-between rounded-md px-4 py-3.5 gap-3"
                  style={{ backgroundColor: C.panel, border: `1px solid ${C.border}` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm" style={{ color: C.text, fontFamily: FONT.display }}>
                        {s.name}
                      </span>
                      <Badge color={C.cyan} bg={`${C.cyan}14`}>{s.tag}</Badge>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: C.dim }}>{s.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copyLink(s.url, s.name)}
                      className="text-xs px-2.5 py-1.5 rounded-md font-medium"
                      style={{ color: copied === s.name ? C.green : C.dim, border: `1px solid ${C.border}` }}
                    >
                      {copied === s.name ? "Copiado ✓" : "Copiar"}
                    </button>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm"
                      style={{ color: C.amber, textDecoration: "none" }}
                    >
                      Abrir →
                    </a>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs mt-4 leading-relaxed" style={{ color: C.faint }}>
              Cuando encuentres vacantes interesantes, copia el texto de los listados y tráelo a la pestaña
              «Importar con IA» para estructurarlas y priorizarlas automáticamente.
            </p>
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
            {/* Buscador + periodicidad */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                value={jobQuery}
                onChange={(e) => setJobQuery(e.target.value)}
                placeholder="Buscar empleo por texto…"
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
            {/* Filtros */}
            <div className="flex flex-wrap gap-2 mb-4">
              {[
                ["todas", "Activas"],
                ["remotas", "Solo remotas"],
                ["español", "En español"],
                ["aplicada", "Aplicadas"],
                ["descartada", "Descartadas"],
              ].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors"
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
                      </div>
                      <span className="shrink-0 text-xs" style={{ color: C.faint }}>▾</span>
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
                          {j.estado !== "aplicada" && j.estado !== "descartada" && daysSince(j) != null && daysSince(j) >= STALE_DAYS && (
                            <Badge color={C.coral} bg={`${C.coral}14`}>Sin acción {daysSince(j)} días</Badge>
                          )}
                        </div>
                        {j.resumen && (
                          <p className="text-xs mt-2 leading-relaxed" style={{ color: C.dim }}>{j.resumen}</p>
                        )}
                        <ContactLine contacto={j.contacto} />
                        <OutreachBox
                          item={j}
                          mode={j.categoria === "lead comercial" || j.categoria === "partner MediaLab" ? "lead" : "job"}
                          message={outreachMessages[j.id]}
                          loading={outreachLoading === j.id}
                          copied={copied === `msg-${j.id}`}
                          onGenerate={() => generateOutreach(j, j.categoria === "lead comercial" || j.categoria === "partner MediaLab" ? "lead" : "job")}
                          onCopy={(text) => copyLink(text, `msg-${j.id}`)}
                        />
                        <div className="flex gap-2 mt-3 flex-wrap items-center">
                          {j.url && (
                            <a
                              href={j.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-1 rounded-md font-medium"
                              style={{ color: C.amber, border: `1px solid ${C.amber}44`, textDecoration: "none" }}
                            >
                              Ver oferta →
                            </a>
                          )}
                          {j.estado !== "aplicada" && (
                            <button
                              onClick={() => updateEstado(j.id, "aplicada")}
                              className="text-xs px-3 py-1 rounded-md font-medium"
                              style={{ backgroundColor: `${C.cyan}1A`, color: C.cyan, border: `1px solid ${C.cyan}44` }}
                            >
                              Marcar aplicada
                            </button>
                          )}
                          {j.estado !== "descartada" ? (
                            <button
                              onClick={() => updateEstado(j.id, "descartada")}
                              className="text-xs px-3 py-1 rounded-md font-medium"
                              style={{ color: C.dim, border: `1px solid ${C.border}` }}
                            >
                              Descartar
                            </button>
                          ) : (
                            <button
                              onClick={() => updateEstado(j.id, "nueva")}
                              className="text-xs px-3 py-1 rounded-md font-medium"
                              style={{ color: C.dim, border: `1px solid ${C.border}` }}
                            >
                              Restaurar
                            </button>
                          )}
                          <button
                            onClick={() => removeJob(j.id)}
                            className="text-xs px-3 py-1 rounded-md font-medium"
                            style={{ color: C.coral, border: `1px solid ${C.coral}33` }}
                          >
                            Eliminar
                          </button>
                        </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
