import React from "react";
import { Clock, CheckCircle2, LoaderCircle, MessageCircle, Send } from "lucide-react";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

const STATUS_LABEL = {
  backlog: "Pendiente", ready: "Pendiente", doing: "En progreso",
  review: "En revisión", blocked: "Bloqueada", actualizada: "Actualizada", done: "Finalizada",
};
const PRIORITY_COLOR = { alta: "#B42318", media: "#B76E00", baja: "#1570EF" };

function todayIso() { return new Date().toISOString().slice(0, 10); }

// Puntaje simple de prioridad (mismo criterio que el admin: importancia + urgencia + bloqueo).
function scoreTask(t) {
  let s = t.priority === "alta" ? 40 : t.priority === "baja" ? 8 : 20;
  const today = todayIso();
  if (t.dueDate) {
    if (t.status !== "review" && t.dueDate < today) s += 35;
    else {
      const d = Math.round((new Date(t.dueDate) - new Date(today)) / 86400000);
      s += d <= 2 ? 25 : d <= 7 ? 15 : 5;
    }
  } else s += 6;
  if (t.status === "blocked") s += 25;
  return Math.min(100, s);
}

export default function EmployeePortal({ token, user, theme = "light" }) {
  const email = String(user?.email || "").toLowerCase();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [me, setMe] = React.useState(null); // registro en people
  const [companies, setCompanies] = React.useState([]);
  const [tasks, setTasks] = React.useState([]);
  const [openId, setOpenId] = React.useState(null);
  const [draft, setDraft] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [companyFilter, setCompanyFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("active");

  const headers = React.useMemo(() => ({ apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` }), [token]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [peopleRes, compRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name,email,type`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,name`, { headers }),
      ]);
      const people = peopleRes.ok ? await peopleRes.json() : [];
      const person = people.find((p) => String(p.email || "").toLowerCase() === email) || null;
      setMe(person);
      setCompanies(compRes.ok ? await compRes.json() : []);
      if (person) {
        const tRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?assignee_id=eq.${person.id}&select=id,title,description,client,company_id,status,priority,due_date,role,comments,task_ref&order=due_date.asc`, { headers });
        setTasks(tRes.ok ? await tRes.json() : []);
      } else {
        setTasks([]);
      }
    } catch (e) {
      setError("No se pudieron cargar tus tareas.");
    } finally {
      setLoading(false);
    }
  }, [headers, email]);

  React.useEffect(() => { load(); }, [load]);

  const nameOf = (id) => companies.find((c) => c.id === id)?.name || id || "";

  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const overdue = active.filter((t) => t.due_date && t.due_date < todayIso() && t.status !== "review").length;

  // Empresas presentes en MIS tareas (para el filtro).
  const myCompanies = [...new Set(tasks.map((t) => t.company_id))].map((id) => ({ id, name: nameOf(id) }));

  // Filtros por empresa y estado → lista ordenada por prioridad.
  const filtered = tasks.filter((t) => {
    if (companyFilter !== "all" && t.company_id !== companyFilter) return false;
    if (statusFilter === "active") return t.status !== "done";
    if (statusFilter === "all") return true;
    return t.status === statusFilter;
  });
  const ranked = [...filtered].map((t) => ({ ...t, dueDate: t.due_date, score: scoreTask({ ...t, dueDate: t.due_date }) }))
    .sort((a, b) => b.score - a.score);

  async function patch(taskId, patch) {
    setBusy(true);
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${taskId}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ...patch, employee_touched_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      setError("No se pudo guardar. Intenta de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function changeStatus(task, status) { patch(task.id, { status }); }

  function addComment(task) {
    const text = draft.trim();
    if (!text) return;
    const comments = Array.isArray(task.comments) ? task.comments : [];
    patch(task.id, {
      comments: [...comments, { author: me?.name || email, role: "employee", text, at: new Date().toISOString() }],
      status: task.status === "done" ? task.status : "actualizada",
    });
    setDraft("");
  }

  const dark = theme === "dark";
  const bg = dark ? "#0E1116" : "#F7F4EF";
  const card = dark ? "#151B23" : "#FFFFFF";
  const border = dark ? "#28313E" : "#E4DED6";
  const text = dark ? "#E8EDF3" : "#1D2939";
  const dim = dark ? "#8B97A6" : "#667085";

  if (loading) {
    return <div className="flex min-h-[60vh] items-center justify-center text-sm" style={{ color: dim }}><LoaderCircle className="mr-2 animate-spin" size={18} /> Cargando tus tareas…</div>;
  }
  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-5 py-12 text-center" style={{ color: text }}>
        <h2 className="text-lg font-semibold">No encontramos tu perfil</h2>
        <p className="mt-2 text-sm" style={{ color: dim }}>Tu correo ({email}) no está vinculado a ninguna persona. Pídele al administrador que te registre.</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: bg, color: text }}>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-xl font-semibold">Hola, {me.name.split(" ")[0]}</h1>
          <p className="text-sm" style={{ color: dim }}>Estas son tus tareas y su prioridad.</p>
        </div>

        {/* Indicadores del empleado */}
        <div className="mb-5 grid grid-cols-3 gap-3">
          {[["Activas", active.length, "#17727A"], ["Vencidas", overdue, "#B42318"], ["Finalizadas", done.length, "#0D7A4F"]].map(([l, v, col]) => (
            <div key={l} className="rounded-md border p-3" style={{ borderColor: border, background: card }}>
              <p className="text-xs" style={{ color: dim }}>{l}</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: col }}>{v}</p>
            </div>
          ))}
        </div>

        {error && <p className="mb-3 rounded-md border border-[#F3B0A8] bg-[#FEF3F2] p-2 text-xs font-semibold text-[#B42318]">{error}</p>}

        {/* Filtros: empresa y estado */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {myCompanies.length > 1 && (
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}
              className="rounded-md border px-2 py-1.5 text-xs font-semibold" style={{ borderColor: border, background: card, color: text }}>
              <option value="all">Todas las empresas</option>
              {myCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}
          {[["active", "Activas"], ["doing", "En progreso"], ["review", "En revisión"], ["done", "Finalizadas"], ["all", "Todas"]].map(([k, l]) => (
            <button key={k} type="button" onClick={() => setStatusFilter(k)}
              className="rounded-full border px-3 py-1 text-xs font-semibold"
              style={statusFilter === k ? { borderColor: "#17727A", background: "#EAF4F2", color: "#17727A" } : { borderColor: border, color: dim }}>
              {l}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {ranked.length ? ranked.map((t) => {
            const isOpen = openId === t.id;
            return (
              <div key={t.id} className="rounded-md border" style={{ borderColor: border, background: card }}>
                <button type="button" onClick={() => { setOpenId(isOpen ? null : t.id); setDraft(""); }} className="flex w-full items-start gap-3 p-3 text-left">
                  <span className="mt-0.5 inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: t.score >= 70 ? "#B42318" : t.score >= 45 ? "#B76E00" : "#1570EF" }}>{t.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {t.task_ref && <span className="mr-2 rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold" style={{ borderColor: border, color: dim }}>{t.task_ref}</span>}
                      {t.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs" style={{ color: dim }}>
                      {nameOf(t.company_id)}{t.client ? ` · ${t.client}` : ""} · {STATUS_LABEL[t.status] || t.status}{t.due_date ? ` · vence ${t.due_date}` : ""}
                    </span>
                  </span>
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: PRIORITY_COLOR[t.priority] || "#98A2B3" }} title={`Prioridad ${t.priority || "media"}`} />
                </button>

                {isOpen && (
                  <div className="border-t px-3 py-3" style={{ borderColor: border }}>
                    {t.description && <p className="mb-3 whitespace-pre-line text-sm" style={{ color: dim }}>{t.description}</p>}

                    {/* Estado (solo en progreso / en revisión) */}
                    <div className="mb-3 flex flex-wrap gap-2">
                      <button type="button" disabled={busy} onClick={() => changeStatus(t, "doing")}
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold"
                        style={t.status === "doing" ? { borderColor: "#1570EF", background: "#EAF2FB", color: "#1D5A99" } : { borderColor: border, color: text }}>
                        <Clock size={13} /> En progreso
                      </button>
                      <button type="button" disabled={busy} onClick={() => changeStatus(t, "review")}
                        className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-xs font-semibold"
                        style={t.status === "review" ? { borderColor: "#17727A", background: "#EAF4F2", color: "#17727A" } : { borderColor: border, color: text }}>
                        <CheckCircle2 size={13} /> Finalizada (en revisión)
                      </button>
                    </div>

                    {/* Comentarios */}
                    {Array.isArray(t.comments) && t.comments.length > 0 && (
                      <ul className="mb-2 space-y-1.5">
                        {t.comments.map((c, i) => (
                          <li key={i} className="rounded-md border p-2 text-xs" style={{ borderColor: border }}>
                            <span className="font-semibold">{c.author}</span> <span style={{ color: dim }}>· {String(c.at || "").slice(0, 10)}</span>
                            <p className="mt-0.5" style={{ color: dim }}>{c.text}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex items-center gap-2">
                      <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Dejar un comentario…"
                        onKeyDown={(e) => { if (e.key === "Enter") addComment(t); }}
                        className="min-w-0 flex-1 rounded-md border px-3 py-1.5 text-sm outline-none"
                        style={{ borderColor: border, background: dark ? "#1B232E" : "#fff", color: text }} />
                      <button type="button" disabled={busy || !draft.trim()} onClick={() => addComment(t)}
                        className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40" style={{ background: "#17727A" }}>
                        <Send size={13} /> Enviar
                      </button>
                    </div>
                    <p className="mt-2 text-[11px]" style={{ color: dim }}><MessageCircle size={11} className="mr-1 inline align-[-1px]" /> Solo puedes cambiar el estado y comentar; el resto lo gestiona el administrador.</p>
                  </div>
                )}
              </div>
            );
          }) : <p className="text-sm" style={{ color: dim }}>No hay tareas con estos filtros.</p>}
        </div>
      </div>
    </div>
  );
}
