import React from "react";
import ReactDOM from "react-dom/client";
import OperationsHub from "./OperationsHub.jsx";
import RadarUXIA from "./RadarUXIA.jsx";
import logoMediaLab from "./logos/logo-medialab.png";

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

function AppShell() {
  const [module, setModule] = React.useState(() => localStorage.getItem("uxia.activeModule") || "operations");
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [session, setSession] = React.useState(() => readStoredSession());
  const [authReady, setAuthReady] = React.useState(false);
  const [authNotice, setAuthNotice] = React.useState("");

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
      <div className="flex min-h-screen items-center justify-center bg-[#F7F4EF] text-sm font-semibold text-[#344054]">
        Cargando acceso…
      </div>
    );
  }

  if (!session?.access_token) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  return (
    <div>
      <nav className="sticky top-0 z-50 border-b border-[#E7E0D5] bg-[#FFFCF7] px-3 py-2 sm:px-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <img src={logoMediaLab} alt="MediaLab Ingeniería" className="h-8 w-auto shrink-0" />
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#667085]">MediaLab Ingeniería</span>
                {authNotice && <p className="mt-1 text-xs font-semibold text-[#17727A]">{authNotice}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              aria-label="Menú"
              aria-expanded={menuOpen}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#D0D5DD] text-xl leading-none text-[#344054] sm:hidden"
            >
              {menuOpen ? "✕" : "☰"}
            </button>
          </div>
          <div className={`${menuOpen ? "grid" : "hidden"} grid-cols-1 gap-2 sm:flex sm:flex-wrap sm:items-center`}>
            <button
              type="button"
              onClick={() => { selectModule("operations"); setMenuOpen(false); }}
              className="flex min-h-[44px] items-center justify-center rounded-md border px-2 py-1.5 text-sm font-semibold sm:px-3"
              style={{
                borderColor: module === "operations" ? "#17727A" : "#D0D5DD",
                color: module === "operations" ? "#FFFFFF" : "#344054",
                background: module === "operations" ? "#17727A" : "transparent",
              }}
            >
              Centro operativo
            </button>
            <button
              type="button"
              onClick={() => { selectModule("radar"); setMenuOpen(false); }}
              className="flex min-h-[44px] items-center justify-center rounded-md border px-2 py-1.5 text-sm font-semibold sm:px-3"
              style={{
                borderColor: module === "radar" ? "#E8751A" : "#D0D5DD",
                color: module === "radar" ? "#1A1205" : "#344054",
                background: module === "radar" ? "#E8751A" : "transparent",
              }}
            >
              Radar oportunidades
            </button>
            <UserMenu
              email={session.user?.email || session.user?.user_metadata?.email || ""}
              onChangePassword={handleChangePassword}
            />
            <button
              type="button"
              onClick={() => { handleLogout(); setMenuOpen(false); }}
              className="flex min-h-[44px] items-center justify-center rounded-md bg-[#E8751A] px-3 py-1.5 text-sm font-semibold text-[#1A1205]"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </nav>
      {module === "radar" ? <RadarUXIA token={session.access_token} /> : <OperationsHub currentUser={session.user} token={session.access_token} />}
    </div>
  );
}

function LoginScreen({ notice, onLogin }) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
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
    <main className="flex min-h-screen items-center justify-center bg-[#F7F4EF] px-5 text-[#1D2939]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border border-[#E7E0D5] bg-[#FFFCF7] p-5 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#667085]">MediaLab Ingeniería</p>
        <h1 className="mt-2 text-2xl font-semibold">Centro operativo</h1>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[#667085]">Correo</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[#667085]">Contraseña</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
              required
            />
          </label>
        </div>
        {notice && <p className="mt-3 rounded-md border border-[#E8751A55] bg-[#E8751A14] p-2 text-xs font-semibold text-[#B76E00]">{notice}</p>}
        {error && <p className="mt-3 rounded-md border border-[#B4231855] bg-[#FEF3F2] p-2 text-xs font-semibold text-[#B42318]">{error}</p>}
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

function UserMenu({ email, onChangePassword }) {
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
    <div className="relative col-span-2 sm:col-span-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center justify-center rounded-md border border-[#D0D5DD] px-3 py-1.5 text-sm font-semibold text-[#344054] sm:w-auto"
      >
        {email || "Usuario"}
      </button>
      {open && (
        <div className="fixed left-3 right-3 top-28 z-50 rounded-md border border-[#E7E0D5] bg-[#FFFCF7] p-3 text-[#344054] shadow-lg sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72">
          <p className="text-xs text-[#667085]">Sesión activa</p>
          <p className="mt-1 break-all text-sm font-semibold">{email}</p>
          <form onSubmit={changePassword} className="mt-3 border-t border-[#E7E0D5] pt-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-[#667085]">Nueva contraseña</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-[#D0D5DD] bg-white px-3 py-2 text-sm text-[#344054] outline-none focus:border-[#17727A]"
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
