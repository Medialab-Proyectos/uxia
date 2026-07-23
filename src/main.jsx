import React from "react";
import ReactDOM from "react-dom/client";
import { Sun, Moon, Bell, BellRing, Menu, X, LayoutDashboard, Radar, LogOut, User, Eye, EyeOff, Lock, RotateCw } from "lucide-react";
import OperationsHub from "./OperationsHub.jsx";
import RadarUXIA from "./RadarUXIA.jsx";
import EmployeePortal from "./EmployeePortal.jsx";
import * as opsData from "./opsData.js";
import { companyFromUrl, encodeCompanyToken } from "./companyLink.js";
import { registerServiceWorker, requestNotificationPermission, subscribeToPush, notificationState, pushSupported } from "./pwa.js";
import logoMediaLab from "./logos/logo.svg";

const AUTH_STORE_KEY = "uxia.supabaseSession";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

function authHeaders(token = "") {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
  };
}

async function authRequest(path, { method = "GET", token = "", body } = {}) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Faltan las variables VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
  }
  const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/${path}`, {
    method,
    headers: authHeaders(token),
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || "No se pudo autenticar.";
    if (/invalid api key|invalid apikey/i.test(message)) {
      throw new Error("Supabase rechazo la API key. En Vercel usa la Publishable key en VITE_SUPABASE_ANON_KEY y vuelve a desplegar.");
    }
    throw new Error(message);
  }
  return data;
}

function saveSession(session) {
  const expiresAt = session.expires_at || Math.floor(Date.now() / 1000) + Number(session.expires_in || 3600);
  const normalized = { ...session, expires_at: expiresAt };
  localStorage.setItem(AUTH_STORE_KEY, JSON.stringify(normalized));
  return normalized;
}

function readStoredSession() {
  try {
    const raw = localStorage.getItem(AUTH_STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSession() {
  localStorage.removeItem(AUTH_STORE_KEY);
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  const refreshed = await authRequest("token?grant_type=refresh_token", {
    method: "POST",
    body: { refresh_token: session.refresh_token },
  });
  return saveSession(refreshed);
}

// Emails con acceso al Centro de Operaciones (solo el CEO). Coma-separado en VITE_CEO_EMAIL.
// Si no se define, no se restringe (compatibilidad). Configúralo en Vercel para limitar el acceso.
const CEO_EMAILS = String(import.meta.env.VITE_CEO_EMAIL || "")
  .toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);

function AppShell() {
  // Login por empresa: la empresa se toma SOLO del token de la URL (?c=<token>). Sin token, la base
  // es inaccesible (no se recuerda un token guardado a propósito: el link base no debe mostrar nada).
  const linkCompanyId = React.useMemo(() => companyFromUrl(), []);
  // Persiste el token cuando SÍ viene en la URL (para poder brandear y para la PWA instalada). Si NO
  // hay token en la URL pero es la PWA instalada (abre en "/") y hay uno guardado, redirige con él.
  React.useEffect(() => {
    if (linkCompanyId) { try { localStorage.setItem("uxia.company", linkCompanyId); } catch { /* ignore */ } return; }
    const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true;
    if (!standalone) return; // navegador normal: sin token = pantalla "Acceso no disponible".
    try {
      const stored = localStorage.getItem("uxia.company");
      if (stored) window.location.replace(`/?c=${encodeCompanyToken(stored)}`);
    } catch { /* ignore */ }
  }, [linkCompanyId]);
  const [brand, setBrand] = React.useState(null); // { id, name, logoUrl } de la empresa del link
  React.useEffect(() => {
    // MediaLab es la casa: NO se brandea (conserva el logo actual del Centro de Operaciones en el
    // login y en el portal de sus empleados). El branding por logo aplica solo a empresas externas.
    if (!linkCompanyId || linkCompanyId === "medialab" || !SUPABASE_URL || !SUPABASE_ANON_KEY) return;
    fetch(`${SUPABASE_URL.replace(/\/$/, "")}/rest/v1/rpc/company_branding`, {
      method: "POST",
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ cid: linkCompanyId }),
    }).then((r) => (r.ok ? r.json() : [])).then((rows) => {
      const c = Array.isArray(rows) ? rows[0] : rows;
      if (c) setBrand({ id: c.id, name: c.name, logoUrl: c.logo?.url || "" });
    }).catch(() => {});
  }, [linkCompanyId]);

  // PWA: registra el service worker una vez (instalación + push). El resto de la lógica de
  // notificaciones (que usa `session`) vive más abajo, tras declararse `session`.
  const [notifPerm, setNotifPerm] = React.useState(() => notificationState());
  React.useEffect(() => { registerServiceWorker(); }, []);
  // El login SIEMPRE abre el Centro de Operaciones (prioridad). El Radar es una página
  // independiente a la que se entra por el menú; no es la primera vista.
  const [module, setModule] = React.useState("operations");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [notifOpen, setNotifOpen] = React.useState(false);
  const [theme, setTheme] = React.useState(() => {
    try { return localStorage.getItem("radar-theme") || "light"; } catch { return "light"; }
  });
  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try { localStorage.setItem("radar-theme", next); } catch { /* ignore */ }
      return next;
    });
  };
  const [notifs, setNotifs] = React.useState([]);
  // Notificaciones vistas: mapa clave→conteo ya visto. Una alerta se oculta cuando el usuario la
  // abre (se marca vista con la FIRMA actual: qué tareas la componen). Reaparece si esa firma
  // cambia (entra/sale una tarea distinta), no solo si sube el conteo.
  const [notifSeen, setNotifSeen] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("uxia.notifSeen") || "{}") || {}; } catch { return {}; }
  });
  // Foco pendiente para el Centro de Operaciones (al pulsar una notificación lleva a su filtro).
  const [opsFocus, setOpsFocus] = React.useState(null);
  function dismissNotif(n) {
    setNotifSeen((prev) => {
      const next = { ...prev, [n.key]: n.sig };
      try { localStorage.setItem("uxia.notifSeen", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
    setNotifs((list) => list.filter((x) => x.key !== n.key));
  }
  const [session, setSession] = React.useState(() => readStoredSession());

  // Notificaciones que dependen de `session` (ya declarada arriba). Con sesión y permiso
  // concedido, re-suscribe este dispositivo al push (idempotente).
  React.useEffect(() => {
    if (session?.access_token && notifPerm === "granted") {
      subscribeToPush({ token: session.access_token, companyId: linkCompanyId });
    }
  }, [session, notifPerm, linkCompanyId]);

  async function enableNotifications() {
    const p = await requestNotificationPermission();
    setNotifPerm(p);
    if (p === "granted" && session?.access_token) {
      await subscribeToPush({ token: session.access_token, companyId: linkCompanyId });
    }
  }

  // Solo el CEO entra al Centro de Operaciones; el resto se queda en el Radar.
  const userEmail = String(session?.user?.email || session?.user?.user_metadata?.email || "").toLowerCase();
  const esCEO = CEO_EMAILS.length === 0 || CEO_EMAILS.includes(userEmail);
  React.useEffect(() => {
    if (!esCEO && module === "operations") {
      setModule("radar");
      try { localStorage.setItem("uxia.activeModule", "radar"); } catch { /* ignore */ }
    }
  }, [esCEO, module]);
  // Auto-refresco del ADMIN cada 10 min (el portal del empleado tiene el suyo, más suave). No
  // recarga si la pestaña está oculta o si estás escribiendo/editando, para no perder cambios.
  React.useEffect(() => {
    if (!esCEO) return undefined;
    const timer = setInterval(() => {
      if (typeof document === "undefined" || document.hidden) return;
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return;
      window.location.reload();
    }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [esCEO]);
  // Campana del empleado en el shell: alertas reportadas por el portal + vistas persistentes.
  const [empAlerts, setEmpAlerts] = React.useState([]);
  const [empBellOpen, setEmpBellOpen] = React.useState(false);
  const [empFocus, setEmpFocus] = React.useState(null);
  const [empSeen, setEmpSeen] = React.useState(() => {
    try { return JSON.parse(localStorage.getItem("uxia.empNotifSeen") || "{}") || {}; } catch { return {}; }
  });
  function empDismiss(a) {
    setEmpSeen((prev) => {
      const next = { ...prev, [a.key]: a.sig };
      try { localStorage.setItem("uxia.empNotifSeen", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }
  // Se muestra una alerta si su FIRMA (qué tareas la componen) cambió desde la última vez que se
  // marcó vista. Así reaparece al llegar una tarea distinta aunque el conteo coincida.
  const empVisible = empAlerts.filter((a) => empSeen[a.key] !== a.sig);
  const [authReady, setAuthReady] = React.useState(false);
  const [authNotice, setAuthNotice] = React.useState("");
  // Sesion con la base caida: null = ok; "refrescando" = intentando recuperar en silencio;
  // "expirada" = hay que volver a entrar (los cambios locales NO se han guardado).
  const [sessionState, setSessionState] = React.useState(null);
  const token = session?.access_token;

  // Cuando un guardado falla por sesion caida (401/JWT vencido): intenta refrescar el token
  // en silencio con el refresh_token; si funciona, el nuevo token baja como prop y el
  // guardado se reintenta solo. Si no, se avisa con un banner para no seguir trabajando al aire.
  const recoverSession = React.useCallback(async () => {
    setSessionState("refrescando");
    try {
      const stored = readStoredSession();
      const refreshed = stored?.refresh_token ? await refreshSession(stored) : null;
      if (refreshed?.access_token) {
        const user = await authRequest("user", { token: refreshed.access_token }).catch(() => session?.user);
        setSession({ ...refreshed, user: user || session?.user });
        setSessionState(null);
        return true;
      }
    } catch {
      // cae al estado expirada
    }
    setSessionState("expirada");
    return false;
  }, [session]);
  React.useEffect(() => {
    if (!token || !opsData.opsDataReady()) return;
    (async () => {
      try {
        const [state, vacantes] = await Promise.all([
          opsData.loadState(token).catch(() => null),
          opsData.listVacantes(token).catch(() => []),
        ]);
        const list = [];
        const today = new Date().toISOString().slice(0, 10);
        const tasks = state?.tasks || [];
        // Firma por IDENTIDAD (qué tareas, no cuántas): así una alerta reaparece si entra una
        // tarea distinta aunque el total coincida (p. ej. el empleado aprueba un request review y
        // otra tarea sale de revisión el mismo día). Antes, con dedupe por conteo, se perdía.
        const sig = (arr) => arr.map((t) => t.id).sort().join(",");
        const vencen = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate <= today);
        const bloq = tasks.filter((t) => t.status === "blocked");
        const enRevision = tasks.filter((t) => t.status === "review");
        const verificando = tasks.filter((t) => t.status === "verificacion");
        const actualizadas = tasks.filter((t) => t.employeeTouchedAt);
        if (enRevision.length) list.push({ kind: "operations", key: "ops-review", focus: "review", count: enRevision.length, sig: sig(enRevision), text: `${enRevision.length} tarea(s) por aprobar (en revisión)` });
        if (verificando.length) list.push({ kind: "operations", key: "ops-verif", focus: "verificacion", count: verificando.length, sig: sig(verificando), text: `${verificando.length} tarea(s) en verificación del cliente` });
        if (actualizadas.length) list.push({ kind: "operations", key: "ops-updated", focus: "updated", count: actualizadas.length, sig: sig(actualizadas), text: `${actualizadas.length} tarea(s) actualizada(s) por revisar` });
        if (vencen.length) list.push({ kind: "operations", key: "ops-today", focus: "today", count: vencen.length, sig: sig(vencen), text: `${vencen.length} tarea(s) vencen hoy o están vencidas` });
        if (bloq.length) list.push({ kind: "operations", key: "ops-blocked", focus: "blocked", count: bloq.length, sig: sig(bloq), text: `${bloq.length} tarea(s) bloqueadas` });
        const viejas = (vacantes || []).filter((v) => {
          if (!v.createdAt) return false;
          return Math.floor((Date.now() - new Date(v.createdAt).getTime()) / 86400000) > 15;
        });
        if (viejas.length) list.push({ kind: "radar", key: "radar-old", count: viejas.length, sig: sig(viejas), text: `${viejas.length} empleo(s) con +15 días (revisa o elimina)` });
        // Muestra una alerta si su FIRMA cambió desde la última vez que se marcó vista.
        setNotifs(list.filter((n) => notifSeen[n.key] !== n.sig));
      } catch {
        setNotifs([]);
      }
    })();
  }, [token, module]);

  React.useEffect(() => {
    async function bootstrapAuth() {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        setAuthNotice("Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.");
        setAuthReady(true);
        return;
      }

      const stored = readStoredSession();
      if (!stored?.access_token) {
        setSession(null);
        setAuthReady(true);
        return;
      }

      try {
        const expiresSoon = Number(stored.expires_at || 0) * 1000 < Date.now() + 60000;
        const active = expiresSoon ? await refreshSession(stored) : stored;
        const user = await authRequest("user", { token: active.access_token });
        setSession({ ...active, user });
      } catch {
        clearSession();
        setSession(null);
      } finally {
        setAuthReady(true);
      }
    }

    bootstrapAuth();
  }, []);

  function selectModule(nextModule) {
    setModule(nextModule);
    localStorage.setItem("uxia.activeModule", nextModule);
  }

  async function handleLogin(email, password) {
    const nextSession = await authRequest("token?grant_type=password", {
      method: "POST",
      body: { email, password },
    });
    const saved = saveSession(nextSession);
    // Cada inicio de sesión ARRANCA en el Centro de Operaciones (el Radar es secundario).
    // Se fuerza aquí porque el AppShell no se desmonta entre sesiones y el módulo podría
    // quedar en "radar" de la sesión anterior.
    setModule("operations");
    try { localStorage.setItem("uxia.activeModule", "operations"); } catch { /* ignore */ }
    setSession(saved);
  }

  async function handleLogout() {
    try {
      if (session?.access_token) {
        await authRequest("logout", { method: "POST", token: session.access_token });
      }
    } finally {
      clearSession();
      setModule("operations");
      try { localStorage.setItem("uxia.activeModule", "operations"); } catch { /* ignore */ }
      setSession(null);
    }
  }

  async function handleChangePassword(password) {
    if (!session?.access_token) throw new Error("La sesión no está activa.");
    await authRequest("user", {
      method: "PUT",
      token: session.access_token,
      body: { password },
    });
    setAuthNotice("Contraseña actualizada.");
    setTimeout(() => setAuthNotice(""), 3000);
  }

  // CANDADO POR EMPRESA: la base "en crudo" (sin token de empresa en ?c=) es inaccesible. Cada
  // quien entra por el link de SU empresa (medialab incluido usa su propio link). El token no es
  // seguridad real (eso lo dan Auth + RLS); es anti-enumeración y evita el acceso al link base.
  if (!linkCompanyId) {
    return <InaccessibleScreen theme={theme} onToggleTheme={toggleTheme} />;
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold" style={{ background: "#0E1116", color: "#8B97A6" }}>
        Cargando acceso…
      </div>
    );
  }

  if (!session?.access_token) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} theme={theme} onToggleTheme={toggleTheme} brand={brand} />;
  }

  // EMPLEADO (no CEO): portal restringido — solo SUS tareas e indicadores. Sin Radar,
  // sin Centro de Operaciones. Solo puede comentar y cambiar el estado de sus tareas.
  if (!esCEO) {
    const dk = theme === "dark";
    return (
      <div style={{ minHeight: "100vh", background: dk ? "#0E1116" : "#F7F4EF" }}>
        <nav className="sticky top-0 z-50 flex items-center justify-between border-b px-4 py-2" style={{ backgroundColor: dk ? "#151B23" : "#FFFCF7", borderColor: dk ? "#28313E" : "#E7E0D5" }}>
          {/* Header con el logo de la EMPRESA del link (branding); si no hay, el de MediaLab. */}
          {brand?.logoUrl
            ? <img src={brand.logoUrl} alt={brand.name || ""} className="h-7 w-auto" title={brand.name || ""} />
            : <img src={logoMediaLab} alt="MediaLab Ingeniería" className="h-6 w-auto" />}
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setEmpBellOpen((v) => !v)} aria-label={`Alertas${empVisible.length ? ` · ${empVisible.length}` : ""}`} aria-expanded={empBellOpen}
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: empVisible.length ? "#6D28D9" : (dk ? "#28313E" : "#E7E0D5"), background: empVisible.length ? (dk ? "#241C3A" : "#F5F3FF") : "transparent", color: empVisible.length ? "#8B5CF6" : (dk ? "#9FB0C3" : "#667085") }}>
                <Bell size={18} />
                {empVisible.length > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white" style={{ background: "#6D28D9" }}>{empVisible.length}</span>
                )}
              </button>
              {empBellOpen && (
                <div className="fixed left-3 right-3 top-16 z-40 max-h-[70vh] overflow-y-auto rounded-md border p-3 text-sm shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72" style={{ background: dk ? "#151B23" : "#FFFCF7", borderColor: dk ? "#28313E" : "#E7E0D5", color: dk ? "#E7EDF4" : "#1F2937" }}>
                  <p className="mb-2 font-semibold">Alertas</p>
                  {empVisible.length === 0 ? (
                    <p className="text-xs" style={{ color: dk ? "#7C8B9C" : "#98A2B3" }}>Sin alertas por ahora. 🎉</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {empVisible.map((a) => (
                        <li key={a.key}>
                          <button type="button" onClick={() => { setEmpFocus(a.focus); empDismiss(a); setEmpBellOpen(false); }} className="flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left text-xs" style={{ borderColor: dk ? "#28313E" : "#E7E0D5" }}>
                            <span className="inline-flex items-center gap-2"><span className="inline-block h-2 w-2 rounded-full" style={{ background: a.color }} />{a.label}</span>
                            <span className="font-bold" style={{ color: a.color }}>{a.count}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            {pushSupported() && notifPerm !== "granted" && (
              <button type="button" onClick={enableNotifications} title="Activar avisos en este dispositivo" aria-label="Activar avisos"
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: dk ? "#28313E" : "#E7E0D5", color: "#E8751A" }}>
                <BellRing size={18} />
              </button>
            )}
            <button type="button" onClick={() => window.location.reload()} title="Actualizar plataforma" aria-label="Actualizar plataforma" className="inline-flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: dk ? "#28313E" : "#E7E0D5", color: "#17727A" }}>
              <RotateCw size={17} />
            </button>
            <button type="button" onClick={toggleTheme} className="inline-flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: dk ? "#28313E" : "#E7E0D5", color: "#E8751A" }} aria-label="Tema">
              {dk ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" onClick={handleLogout} className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-semibold" style={{ color: "#C0362C" }}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </nav>
        <EmployeePortal token={session.access_token} user={session.user} theme={theme} onAlerts={setEmpAlerts} focus={empFocus} onFocusHandled={() => setEmpFocus(null)} companyId={linkCompanyId} companyName={brand?.name || ""} />
      </div>
    );
  }

  // Tema global: claro/oscuro se aplica a AMBOS módulos por igual (el Centro mapea sus
  // colores fijos vía data-ops-theme="dark" en index.html) para que la plataforma sea uniforme.
  const dark = theme === "dark";
  const navBg = dark ? "#151B23" : "#FFFCF7";
  const navBorder = dark ? "#28313E" : "#E7E0D5";
  const navDim = dark ? "#8B97A6" : "#667085";
  const navText = dark ? "#E8EDF3" : "#344054";
  const ctrlBg = dark ? "#1B232E" : "#FFFFFF";
  const iconBtn = "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border";

  function ModuleBtn({ id, label, Icon, activeColor }) {
    const active = module === id;
    return (
      <button
        type="button"
        onClick={() => { selectModule(id); setMenuOpen(false); }}
        className="flex min-h-[40px] w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold sm:w-auto"
        style={{ color: active ? activeColor : navText, background: "transparent" }}
      >
        <Icon size={16} style={{ color: active ? activeColor : navDim }} /> {label}
      </button>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: dark ? "#0E1116" : "#F7F4EF" }}>
      <nav className="sticky top-0 z-50 border-b px-3 py-2 sm:px-5" style={{ backgroundColor: navBg, borderColor: navBorder }}>
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <img src={logoMediaLab} alt="MediaLab Ingeniería" className="h-6 w-auto shrink-0 sm:h-7" />
              {authNotice && <p className="text-xs font-semibold text-[#17727A]">{authNotice}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative">
                <button type="button" onClick={() => setNotifOpen((v) => !v)} aria-label={`Notificaciones${notifs.length ? ` · ${notifs.length}` : ""}`} aria-expanded={notifOpen} className={`relative ${iconBtn}`} style={{ borderColor: navBorder, backgroundColor: ctrlBg, color: navText }}>
                  <Bell size={18} />
                  {notifs.length > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 inline-flex items-center justify-center rounded-full text-[10px] font-bold" style={{ minWidth: 18, height: 18, padding: "0 4px", backgroundColor: "#C0362C", color: "#fff" }}>
                      {notifs.length}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <div className="fixed left-3 right-3 top-16 z-50 max-h-[70vh] overflow-y-auto rounded-md border p-3 text-sm shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-72" style={{ backgroundColor: ctrlBg, borderColor: navBorder, color: navText }}>
                    <p className="font-semibold mb-2">Notificaciones</p>
                    {notifs.length === 0 ? (
                      <p className="text-xs" style={{ color: navDim }}>Sin alertas por ahora.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {notifs.map((n, i) => (
                          <li key={n.key || i}>
                            <button type="button" onClick={() => { selectModule(n.kind); if (n.kind === "operations" && n.focus) setOpsFocus(n.focus); dismissNotif(n); setNotifOpen(false); }} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs" style={{ border: `1px solid ${navBorder}`, color: navText }}>
                              <span className="mt-1 inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: n.kind === "radar" ? "#E8751A" : "#17727A" }} />
                              <span>{n.text} <span style={{ color: navDim }}>· {n.kind === "radar" ? "Radar" : "Centro"}</span></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              {pushSupported() && notifPerm !== "granted" && (
                <button type="button" onClick={enableNotifications} aria-label="Activar avisos" title="Activar avisos en este dispositivo" className={iconBtn} style={{ borderColor: navBorder, backgroundColor: ctrlBg, color: "#E8751A" }}>
                  <BellRing size={18} />
                </button>
              )}
              <button type="button" onClick={() => window.location.reload()} title="Actualizar plataforma" aria-label="Actualizar plataforma" className={iconBtn} style={{ borderColor: navBorder, backgroundColor: ctrlBg, color: "#17727A" }}>
                <RotateCw size={17} />
              </button>
              <button type="button" onClick={toggleTheme} aria-label={dark ? "Modo claro" : "Modo oscuro"} title={dark ? "Modo claro" : "Modo oscuro"} className={iconBtn} style={{ borderColor: navBorder, backgroundColor: ctrlBg, color: "#E8751A" }}>
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <button type="button" onClick={() => setMenuOpen((v) => !v)} aria-label="Menú" aria-expanded={menuOpen} className={`${iconBtn} sm:hidden`} style={{ borderColor: navBorder, backgroundColor: ctrlBg, color: navText }}>
                {menuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
          <div className={`${menuOpen ? "flex" : "hidden"} flex-col gap-0.5 sm:flex sm:flex-row sm:flex-wrap sm:items-center sm:gap-1`}>
            {esCEO && <ModuleBtn id="operations" label="Centro operativo" Icon={LayoutDashboard} activeColor="#17727A" />}
            <ModuleBtn id="radar" label="Radar oportunidades" Icon={Radar} activeColor="#E8751A" />
            <div className="my-1 h-px w-full sm:my-0 sm:mx-1 sm:h-5 sm:w-px" style={{ backgroundColor: navBorder }} />
            <UserMenu email={session.user?.email || session.user?.user_metadata?.email || ""} onChangePassword={handleChangePassword} navText={navText} navDim={navDim} ctrlBg={ctrlBg} navBorder={navBorder} />
            <button
              type="button"
              onClick={() => { handleLogout(); setMenuOpen(false); }}
              className="flex min-h-[40px] w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold sm:w-auto"
              style={{ background: "transparent", color: "#C0362C" }}
            >
              <LogOut size={16} /> Cerrar sesión
            </button>
          </div>
        </div>
      </nav>
      {/* Overlay que oscurece la interfaz al abrir el menú en responsive (evita confundir
          el color del menú con el de la app). El nav (z-50) queda por encima. */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 sm:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      {sessionState && (
        <div
          role="alert"
          className="sticky top-0 z-[60] flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-2 text-center text-sm font-semibold"
          style={{ background: sessionState === "expirada" ? "#B42318" : "#9A4B08", color: "#fff" }}
        >
          {sessionState === "refrescando" ? (
            <span>Reconectando con la base… no cierres la página.</span>
          ) : (
            <>
              <span>⚠ Tu sesión con la base expiró. Los últimos cambios NO se guardaron.</span>
              <button
                type="button"
                onClick={recoverSession}
                className="rounded-md px-3 py-1 text-xs font-bold"
                style={{ background: "#fff", color: "#B42318" }}
              >
                Reconectar
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md border px-3 py-1 text-xs font-bold"
                style={{ borderColor: "#fff", color: "#fff" }}
              >
                Volver a iniciar sesión
              </button>
            </>
          )}
        </div>
      )}
      {module === "operations" && esCEO ? <OperationsHub currentUser={session.user} token={session.access_token} theme={theme} onAuthError={recoverSession} focus={opsFocus} onFocusHandled={() => setOpsFocus(null)} /> : <RadarUXIA token={session.access_token} theme={theme} onAuthError={recoverSession} />}
    </div>
  );
}

// Pantalla que ve quien entra al link base (sin token de empresa). No revela nada del sistema.
function InaccessibleScreen({ theme = "dark", onToggleTheme }) {
  const dk = theme === "dark";
  const C = dk
    ? { bg: "#0E1116", panel: "#151B23", border: "#28313E", text: "#E8EDF3", dim: "#8B97A6" }
    : { bg: "#F7F4EF", panel: "#FFFCF7", border: "#E7E0D5", text: "#1F2937", dim: "#667085" };
  return (
    <main className="relative flex min-h-screen items-center justify-center px-5" style={{ background: C.bg, color: C.text }}>
      {onToggleTheme && (
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={dk ? "Modo claro" : "Modo oscuro"}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md border"
          style={{ borderColor: C.border, backgroundColor: C.panel, color: "#E8751A" }}
        >
          {dk ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      )}
      <div className="w-full max-w-sm rounded-md border p-8 text-center shadow-lg" style={{ background: C.panel, borderColor: C.border }}>
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full border" style={{ borderColor: C.border, color: "#E8751A" }}>
          <Lock size={22} />
        </div>
        <h1 className="text-lg font-semibold">Acceso no disponible</h1>
        <p className="mt-2 text-sm" style={{ color: C.dim }}>
          Este espacio se abre solo desde el enlace de tu empresa. Si crees que deberías tener acceso,
          escríbenos y te compartimos tu enlace.
        </p>
      </div>
    </main>
  );
}

function LoginScreen({ notice, onLogin, theme = "light", onToggleTheme, brand = null }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email.trim(), password);
    } catch (authError) {
      setError(authError.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  }

  // El login usa la MISMA paleta que la app (según el tema) para que no cambie de oscuro a claro
  // al entrar. Incluye el botón claro/oscuro, igual que el header.
  const dk = theme === "dark";
  const C = dk
    ? { bg: "#0E1116", panel: "#151B23", border: "#28313E", text: "#E8EDF3", dim: "#8B97A6", input: "#1B232E" }
    : { bg: "#F7F4EF", panel: "#FFFCF7", border: "#E7E0D5", text: "#1F2937", dim: "#667085", input: "#FFFFFF" };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-5" style={{ background: C.bg, color: C.text }}>
      {onToggleTheme && (
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={dk ? "Modo claro" : "Modo oscuro"}
          title={dk ? "Modo claro" : "Modo oscuro"}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-md border"
          style={{ borderColor: C.border, backgroundColor: C.panel, color: "#E8751A" }}
        >
          {dk ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      )}
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border p-6 shadow-lg" style={{ background: C.panel, borderColor: C.border }}>
        <div className="mb-5 flex flex-col items-center text-center">
          {/* Login branded con el logo de la EMPRESA del link; si no hay, el de MediaLab. */}
          {brand?.logoUrl
            ? <img src={brand.logoUrl} alt={brand.name || ""} className="h-11 w-auto" />
            : <img src={logoMediaLab} alt="MediaLab Ingeniería" className="h-10 w-auto" />}
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: C.dim }}>{brand?.name || "MediaLab Ingeniería"}</p>
          <h1 className="mt-1 text-2xl font-semibold">{brand ? "Portal del proyecto" : "Centro operativo"}</h1>
          {brand && <p className="mt-1 text-xs" style={{ color: C.dim }}>Entra para ver el estado de tus tareas.</p>}
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase" style={{ color: C.dim }}>Correo</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[#2AABB3]"
              style={{ background: C.input, borderColor: C.border, color: C.text }}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase" style={{ color: C.dim }}>Contraseña</span>
            <div className="relative">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                className="w-full rounded-md border px-3 py-2 pr-10 text-sm outline-none focus:border-[#2AABB3]"
                style={{ background: C.input, borderColor: C.border, color: C.text }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar contraseña" : "Ver contraseña"}
                title={showPwd ? "Ocultar contraseña" : "Ver contraseña"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center hover:opacity-80"
                style={{ color: C.dim }}
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        </div>
        {notice && <p className="mt-3 rounded-md border border-[#E8751A55] bg-[#E8751A22] p-2 text-xs font-semibold text-[#B76E00]">{notice}</p>}
        {error && <p className="mt-3 rounded-md border border-[#B4231855] bg-[#B4231822] p-2 text-xs font-semibold text-[#B42318]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center rounded-md bg-[#17727A] px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {loading ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </main>
  );
}

function UserMenu({ email, onChangePassword, navText = "#344054", navDim = "#667085", ctrlBg = "#FFFFFF", navBorder = "#E7E0D5" }) {
  const [open, setOpen] = React.useState(false);
  const [password, setPassword] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  async function changePassword(event) {
    event.preventDefault();
    setMessage("");
    setError("");
    if (password.length < 6) {
      setError("Usa mínimo 6 caracteres.");
      return;
    }
    try {
      await onChangePassword(password);
      setPassword("");
      setMessage("Contrasena cambiada.");
    } catch (changeError) {
      setError(changeError.message || "No se pudo cambiar la contraseña.");
    }
  }

  return (
    <div className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        title={email}
        className="flex min-h-[40px] w-full items-center gap-2 rounded-md px-2 text-left text-sm font-semibold sm:w-auto"
        style={{ color: navText, background: "transparent" }}
      >
        <User size={16} style={{ color: navDim }} /> Cuenta
      </button>
      {open && (
        <div className="fixed left-3 right-3 top-28 z-50 rounded-md border p-3 shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72" style={{ backgroundColor: ctrlBg, borderColor: navBorder, color: navText }}>
          <p className="text-xs" style={{ color: navDim }}>Sesión activa</p>
          <p className="mt-1 break-all text-sm font-semibold">{email}</p>
          <form onSubmit={changePassword} className="mt-3 border-t pt-3" style={{ borderColor: navBorder }}>
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase" style={{ color: navDim }}>Nueva contraseña</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[#17727A]"
                style={{ backgroundColor: ctrlBg, borderColor: navBorder, color: navText }}
              />
            </label>
            {message && <p className="mt-2 text-xs font-semibold text-[#17727A]">{message}</p>}
            {error && <p className="mt-2 text-xs font-semibold text-[#B42318]">{error}</p>}
            <button type="submit" className="mt-2 flex min-h-[44px] w-full items-center justify-center rounded-md border border-[#17727A] px-3 py-2 text-xs font-semibold text-[#17727A]">
              Cambiar contraseña
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Evita la pantalla en blanco: si algo revienta al renderizar (p. ej. al abrir una tarjeta),
// muestra el error en vez de tumbar toda la app, y deja recargar.
class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("UXIA crash:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0E1116", color: "#E8EDF3", padding: 24, fontFamily: "system-ui, sans-serif" }}>
          <div style={{ maxWidth: 560 }}>
            <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Algo falló al mostrar esta vista</h1>
            <p style={{ color: "#9FB0C3", fontSize: 13, marginTop: 8 }}>Se evitó la pantalla en blanco. Recarga; si sigue, comparte este mensaje:</p>
            <pre style={{ marginTop: 12, whiteSpace: "pre-wrap", background: "#2A1416", border: "1px solid #7A2A2A", borderRadius: 8, padding: 12, fontSize: 13, fontWeight: 700, color: "#ffb3ab" }}>{String(this.state.error?.message || this.state.error)}</pre>
            <pre style={{ marginTop: 8, whiteSpace: "pre-wrap", background: "#151B23", border: "1px solid #28313E", borderRadius: 8, padding: 12, fontSize: 11, color: "#f08a80", overflow: "auto", maxHeight: 240 }}>{String(this.state.error?.stack || "")}</pre>
            <button type="button" onClick={() => window.location.reload()} style={{ marginTop: 12, background: "#17727A", color: "#fff", border: "none", borderRadius: 6, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Recargar</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppShell />
    </ErrorBoundary>
  </React.StrictMode>
);
