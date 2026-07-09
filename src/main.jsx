import React from "react";
import ReactDOM from "react-dom/client";
import OperationsHub from "./OperationsHub.jsx";
import RadarUXIA from "./RadarUXIA.jsx";

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
    const message = data?.msg || data?.message || data?.error_description || "No se pudo autenticar";
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
    if (!session?.access_token) throw new Error("La sesion no esta activa.");
    await authRequest("user", {
      method: "PUT",
      token: session.access_token,
      body: { password },
    });
    setAuthNotice("Contrasena actualizada.");
    setTimeout(() => setAuthNotice(""), 3000);
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0E1116] text-sm font-semibold text-[#E8EDF3]">
        Cargando acceso...
      </div>
    );
  }

  if (!session?.access_token) {
    return <LoginScreen notice={authNotice} onLogin={handleLogin} />;
  }

  return (
    <div>
      <nav className="sticky top-0 z-50 border-b border-[#28313E] bg-[#0E1116] px-3 py-2 sm:px-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B97A6]">MediaLab Ingenieria</span>
            {authNotice && <p className="mt-1 text-xs font-semibold text-[#4FD1C5]">{authNotice}</p>}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
            <button
              type="button"
              onClick={() => selectModule("operations")}
              className="rounded-md border px-2 py-1.5 text-sm font-semibold sm:px-3"
              style={{
                borderColor: module === "operations" ? "#4FD1C5" : "#28313E",
                color: module === "operations" ? "#0E1116" : "#E8EDF3",
                background: module === "operations" ? "#4FD1C5" : "transparent",
              }}
            >
              Centro operativo
            </button>
            <button
              type="button"
              onClick={() => selectModule("radar")}
              className="rounded-md border px-2 py-1.5 text-sm font-semibold sm:px-3"
              style={{
                borderColor: module === "radar" ? "#F2A93B" : "#28313E",
                color: module === "radar" ? "#1A1205" : "#E8EDF3",
                background: module === "radar" ? "#F2A93B" : "transparent",
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
              onClick={handleLogout}
              className="col-span-2 rounded-md bg-[#F2A93B] px-3 py-1.5 text-sm font-semibold text-[#1A1205] sm:col-span-1"
            >
              Cerrar sesion
            </button>
          </div>
        </div>
      </nav>
      {module === "radar" ? <RadarUXIA /> : <OperationsHub currentUser={session.user} />}
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
      setError(authError.message || "No se pudo iniciar sesion.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0E1116] px-5 text-[#E8EDF3]">
      <form onSubmit={submit} className="w-full max-w-sm rounded-md border border-[#28313E] bg-[#151B23] p-5 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8B97A6]">MediaLab Ingenieria</p>
        <h1 className="mt-2 text-2xl font-semibold">Centro operativo</h1>
        <div className="mt-5 space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[#8B97A6]">Correo</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-[#28313E] bg-[#0E1116] px-3 py-2 text-sm outline-none focus:border-[#4FD1C5]"
              required
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase text-[#8B97A6]">Contrasena</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-[#28313E] bg-[#0E1116] px-3 py-2 text-sm outline-none focus:border-[#4FD1C5]"
              required
            />
          </label>
        </div>
        {notice && <p className="mt-3 rounded-md border border-[#F2A93B55] bg-[#F2A93B14] p-2 text-xs text-[#F2A93B]">{notice}</p>}
        {error && <p className="mt-3 rounded-md border border-[#FF6B5755] bg-[#FF6B5714] p-2 text-xs text-[#FFB4A8]">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="mt-4 w-full rounded-md bg-[#4FD1C5] px-3 py-2 text-sm font-semibold text-[#0E1116] disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
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
      setError("Usa minimo 6 caracteres.");
      return;
    }
    try {
      await onChangePassword(password);
      setPassword("");
      setMessage("Contrasena cambiada.");
    } catch (changeError) {
      setError(changeError.message || "No se pudo cambiar la contrasena.");
    }
  }

  return (
    <div className="relative col-span-2 sm:col-span-1">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="w-full rounded-md border border-[#28313E] px-3 py-1.5 text-sm font-semibold text-[#E8EDF3] sm:w-auto"
      >
        {email || "Usuario"}
      </button>
      {open && (
        <div className="fixed left-3 right-3 top-28 z-50 rounded-md border border-[#28313E] bg-[#151B23] p-3 text-[#E8EDF3] shadow-xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-72">
          <p className="text-xs text-[#8B97A6]">Sesion activa</p>
          <p className="mt-1 break-all text-sm font-semibold">{email}</p>
          <form onSubmit={changePassword} className="mt-3 border-t border-[#28313E] pt-3">
            <label className="block">
              <span className="mb-1 block text-xs font-semibold uppercase text-[#8B97A6]">Nueva contrasena</span>
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-[#28313E] bg-[#0E1116] px-3 py-2 text-sm outline-none focus:border-[#4FD1C5]"
              />
            </label>
            {message && <p className="mt-2 text-xs font-semibold text-[#4FD1C5]">{message}</p>}
            {error && <p className="mt-2 text-xs font-semibold text-[#FFB4A8]">{error}</p>}
            <button type="submit" className="mt-2 w-full rounded-md border border-[#4FD1C5] px-3 py-2 text-xs font-semibold text-[#4FD1C5]">
              Cambiar contrasena
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
