import React from "react";
import ReactDOM from "react-dom/client";
import { Sun, Moon, Bell, Menu, X, LayoutDashboard, Radar, LogOut, User, Eye, EyeOff } from "lucide-react";
import OperationsHub from "./OperationsHub.jsx";
import RadarUXIA from "./RadarUXIA.jsx";
import EmployeePortal from "./EmployeePortal.jsx";
import * as opsData from "./opsData.js";
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
  const [session, setSession] = React.useState(() => readStoredSession());

  // Solo el CEO entra al Centro de Operaciones; el resto se queda en el Radar.
  const userEmail = String(session?.user?.email || session?.user?.user_metadata?.email || "").toLowerCase();
  const esCEO = CEO_EMAILS.length === 0 || CEO_EMAILS.includes(userEmail);
  React.useEffect(() => {
    if (!esCEO && module === "operations") {
      setModule("radar");
      try { localStorage.setItem("uxia.activeModule", "radar"); } catch { /* ignore */ }
    }
  }, [esCEO, module]);
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
        const vencen = tasks.filter((t) => t.status !== "done" && t.dueDate && t.dueDate <= today).length;
        const bloq = tasks.filter((t) => t.status === "blocked").length;
        if (vencen) list.push({ kind: "operations", text: `${vencen} tarea(s) vencen hoy o están vencidas` });
        if (bloq) list.push({ kind: "operations", text: `${bloq} tarea(s) bloqueadas` });
        const viejas = (vacantes || []).filter((v) => {
          if (!v.createdAt) return false;
          return Math.floor((Date.now() - new Date(v.createdAt).getTime()) / 86400000) > 15;
        }).length;
        if (viejas) list.push({ kind: "radar", text: `${viejas} empleo(s) con +15 días (revisa o elimina)` });
        setNotifs(list);
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
    setSession(saved);
  }

  async function handleLogout() {
    try {
      if (session?.access_token) {
        await authRequest("logout", { method: "POST", token: session.access_token });
      }
    } finally {
      clearSession();
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

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm font-semibold" style={{ background: "#0E1116", color: "#8B97A6" }}>
        Cargando acceso…
      </div>
    );
  }

  if (!session?.access_token) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  // EMPLEADO (no CEO): portal restringido — solo SUS tareas e indicadores. Sin Radar,
  // sin Centro de Operaciones. Solo puede comentar y cambiar el estado de sus tareas.
  if (!esCEO) {
    const dk = theme === "dark";
    return (
      <div style={{ minHeight: "100vh", background: dk ? "#0E1116" : "#F7F4EF" }}>
        <nav className="sticky top-0 z-50 flex items-center justify-between border-b px-4 py-2" style={{ backgroundColor: dk ? "#151B23" : "#FFFCF7", borderColor: dk ? "#28313E" : "#E7E0D5" }}>
          <img src={logoMediaLab} alt="MediaLab Ingeniería" className="h-6 w-auto" />
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggleTheme} className="inline-flex h-9 w-9 items-center justify-center rounded-md border" style={{ borderColor: dk ? "#28313E" : "#E7E0D5", color: "#E8751A" }} aria-label="Tema">
              {dk ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button type="button" onClick={handleLogout} className="flex items-center gap-1.5 rounded-md px-2 py-2 text-sm font-semibold" style={{ color: "#C0362C" }}>
              <LogOut size={16} /> Salir
            </button>
          </div>
        </nav>
        <EmployeePortal token={session.access_token} user={session.user} theme={theme} />
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
                          <li key={i}>
                            <button type="button" onClick={() => { selectModule(n.kind); setNotifOpen(false); }} className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left text-xs" style={{ border: `1px solid ${navBorder}`, color: navText }}>
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
      {module === "operations" && esCEO ? <OperationsHub currentUser={session.user} token={session.access_token} theme={theme} onAuthError={recoverSession} /> : <RadarUXIA token={session.access_token} theme={theme} onAuthError={recoverSession} />}
    </div>
  );
}

function LoginScreen({ notice, onLogin }) {
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

  return (
    <main className="flex min-h-screen items-center justify-center px-5 text-[#E8EDF3]" style={{ background: "#0E1116" }}>
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border p-6 shadow-lg" style={{ background: "#151B23", borderColor: "#28313E" }}>
        <div className="mb-5 flex flex-col items-center text-center">
          <img src={logoMediaLab} alt="MediaLab Ingeniería" className="h-10 w-auto" />
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: "#8B97A6" }}>MediaLab Ingeniería</p>
          <h1 className="mt-1 text-2xl font-semibold">Centro operativo</h1>
        </div>
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase" style={{ color: "#8B97A6" }}>Correo</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:border-[#2AABB3]"
              style={{ background: "#1B232E", borderColor: "#28313E", color: "#E8EDF3" }}
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase" style={{ color: "#8B97A6" }}>Contraseña</span>
            <div className="relative">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPwd ? "text" : "password"}
                autoComplete="current-password"
                className="w-full rounded-md border px-3 py-2 pr-10 text-sm outline-none focus:border-[#2AABB3]"
                style={{ background: "#1B232E", borderColor: "#28313E", color: "#E8EDF3" }}
                required
              />
              <button
                type="button"
                onClick={() => setShowPwd((v) => !v)}
                aria-label={showPwd ? "Ocultar contraseña" : "Ver contraseña"}
                title={showPwd ? "Ocultar contraseña" : "Ver contraseña"}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-[#8B97A6] hover:text-[#E8EDF3]"
              >
                {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
        </div>
        {notice && <p className="mt-3 rounded-md border border-[#E8751A55] bg-[#E8751A22] p-2 text-xs font-semibold text-[#F0A968]">{notice}</p>}
        {error && <p className="mt-3 rounded-md border border-[#B4231855] bg-[#B4231822] p-2 text-xs font-semibold text-[#F08A80]">{error}</p>}
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

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppShell />
  </React.StrictMode>
);
