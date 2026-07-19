import React from "react";
import { Bell, Clock, CheckCircle2, LoaderCircle, MessageCircle, Send, ListChecks, AlertTriangle } from "lucide-react";

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
  const [pending, setPending] = React.useState({}); // { [taskId]: { status } } cambios locales sin guardar
  const [saveState, setSaveState] = React.useState({}); // { [taskId]: { kind, at, msg } }
  const [companyFilter, setCompanyFilter] = React.useState("all");
  const [statusFilter, setStatusFilter] = React.useState("active");
  const [q, setQ] = React.useState("");
  const [noveltyReady, setNoveltyReady] = React.useState(true); // false si la base aún no tiene las columnas

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
        const base = "id,title,description,client,company_id,status,priority,due_date,role,comments,task_ref";
        // Intenta con las columnas de novedad; si la base aún no está migrada, carga sin ellas.
        let tRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?assignee_id=eq.${person.id}&select=${base},assignee_seen_at,admin_touched_at,change_requests&order=due_date.asc`, { headers });
        if (!tRes.ok) {
          setNoveltyReady(false);
          tRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?assignee_id=eq.${person.id}&select=${base}&order=due_date.asc`, { headers });
        } else {
          setNoveltyReady(true);
        }
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

  // Novedades por persona: "Nueva" = nunca vista; "Actualizada" = el admin la cambió
  // después de la última vez que la vi. Al abrirla se marca vista y el tag desaparece.
  const openCRs = (t) => (Array.isArray(t.change_requests) ? t.change_requests : []).filter((c) => !c.resolved);
  const hasChangeRequest = (t) => noveltyReady && openCRs(t).length > 0;
  const isNew = (t) => noveltyReady && !t.assignee_seen_at;
  const isUpdatedByAdmin = (t) => Boolean(
    noveltyReady && t.assignee_seen_at && t.admin_touched_at && new Date(t.admin_touched_at) > new Date(t.assignee_seen_at)
  );
  // Una novedad puede ser: nueva, un cambio solicitado (CR) o una actualización del admin.
  const hasNovelty = (t) => isNew(t) || hasChangeRequest(t) || isUpdatedByAdmin(t);
  const noveltyCount = tasks.filter((t) => t.status !== "done" && hasNovelty(t)).length;

  // Marca la tarea como vista (solo assignee_seen_at; NO toca employee_touched_at, así que
  // NO la marca "actualizada" para el admin). Optimista + persistente.
  async function markSeen(task) {
    if (!hasNovelty(task)) return;
    const now = new Date().toISOString();
    setTasks((ts) => ts.map((t) => (t.id === task.id ? { ...t, assignee_seen_at: now } : t)));
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ assignee_seen_at: now }),
      });
    } catch { /* no crítico: si falla, se reintenta al volver a abrir */ }
  }

  const active = tasks.filter((t) => t.status !== "done");
  const done = tasks.filter((t) => t.status === "done");
  const overdue = active.filter((t) => t.due_date && t.due_date < todayIso() && t.status !== "review").length;

  // Empresas presentes en MIS tareas (para el filtro).
  const myCompanies = [...new Set(tasks.map((t) => t.company_id))].map((id) => ({ id, name: nameOf(id) }));

  // Filtros por empresa y estado → lista ordenada por prioridad.
  const qLow = q.trim().toLowerCase();
  const filtered = tasks.filter((t) => {
    if (companyFilter !== "all" && t.company_id !== companyFilter) return false;
    // Buscador por palabras (ignora el filtro de estado para encontrar también finalizadas).
    if (qLow) return `${t.title || ""} ${t.client || ""} ${nameOf(t.company_id)} ${t.task_ref || ""} ${t.role || ""}`.toLowerCase().includes(qLow);
    // La tarea ABIERTA no desaparece del filtro aunque al abrirla deje de ser novedad.
    if (statusFilter === "new") return (hasNovelty(t) || t.id === openId) && t.status !== "done";
    if (statusFilter === "vencidas") return t.status !== "done" && t.due_date && t.due_date < todayIso() && t.status !== "review";
    if (statusFilter === "active") return t.status !== "done";
    if (statusFilter === "all") return true;
    return t.status === statusFilter;
  });
  const ranked = [...filtered].map((t) => ({ ...t, dueDate: t.due_date, score: scoreTask({ ...t, dueDate: t.due_date }) }))
    .sort((a, b) => b.score - a.score);

  // El empleado ELIGE (estado y/o comentario) y luego GUARDA explícitamente. Nada se envía
  // a Supabase hasta pulsar "Guardar", y el resultado se confirma en la tarjeta (guardado ✓
  // / error). Así no vuelve a pasar el caso de "creí que guardé y nunca llegó".
  function setPendingStatus(task, status) {
    setPending((p) => ({ ...p, [task.id]: { ...(p[task.id] || {}), status } }));
    setSaveState((s) => { const n = { ...s }; delete n[task.id]; return n; }); // vuelve a "sin guardar"
  }

  // ¿La tarea tiene cambios locales sin guardar? (estado distinto o comentario escrito)
  function isDirty(task) {
    const pStatus = pending[task.id]?.status;
    const statusChanged = pStatus && pStatus !== task.status;
    const hasComment = openId === task.id && draft.trim().length > 0;
    return Boolean(statusChanged || hasComment);
  }

  async function save(task) {
    const p = pending[task.id] || {};
    const text = openId === task.id ? draft.trim() : "";
    const statusChanged = p.status && p.status !== task.status;
    if (!statusChanged && !text) return;
    const body = {};
    if (statusChanged) body.status = p.status;
    if (text) {
      const comments = Array.isArray(task.comments) ? task.comments : [];
      body.comments = [...comments, { author: me?.name || email, role: "employee", text, at: new Date().toISOString() }];
      // Comentar marca la tarea como "actualizada" para el admin, salvo que ya se haya
      // elegido explícitamente un estado (en progreso / en revisión) o esté finalizada.
      if (!statusChanged && task.status !== "done") body.status = "actualizada";
    }
    setSaveState((s) => ({ ...s, [task.id]: { kind: "saving" } }));
    setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ ...body, employee_touched_at: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error(`No se guardó (código ${res.status}).`);
      setSaveState((s) => ({ ...s, [task.id]: { kind: "saved", at: Date.now() } }));
      setPending((p2) => { const n = { ...p2 }; delete n[task.id]; return n; });
      setDraft("");
      await load();
    } catch (e) {
      setSaveState((s) => ({ ...s, [task.id]: { kind: "error", msg: String(e?.message || "Error") } }));
    }
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
        {/* Header fijo: la campana de novedades queda SIEMPRE visible al hacer scroll. */}
        <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center justify-between gap-3 px-4 py-2 sm:-mx-6 sm:px-6" style={{ background: bg }}>
          <h1 className="truncate text-lg font-semibold">Hola, {me.name.split(" ")[0]}</h1>
          {/* Campanita: cuántas tareas tienen novedades (nuevas o actualizadas por el admin) */}
          <button type="button" onClick={() => setStatusFilter("new")}
            className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border"
            style={{ borderColor: noveltyCount ? "#6D28D9" : border, background: noveltyCount ? "#F5F3FF" : card, color: noveltyCount ? "#6D28D9" : dim }}
            title={noveltyCount ? `${noveltyCount} tarea(s) con novedades` : "Sin novedades"}>
            <Bell size={18} />
            {noveltyCount > 0 && (
              <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white" style={{ background: "#6D28D9" }}>{noveltyCount}</span>
            )}
          </button>
        </div>
        <p className="-mt-2 mb-4 text-sm" style={{ color: dim }}>Estas son tus tareas y su prioridad.</p>

        {/* Indicadores del empleado (2×2 en móvil, 4 en escritorio) con ícono — clicables → filtran */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Novedades", noveltyCount, "#6D28D9", Bell, "new"], ["Activas", active.length, "#17727A", ListChecks, "active"], ["Vencidas", overdue, "#B42318", AlertTriangle, "vencidas"], ["Finalizadas", done.length, "#0D7A4F", CheckCircle2, "done"]].map(([l, v, col, Icon, f]) => (
            <button key={l} type="button" onClick={() => setStatusFilter(f)} title={`Filtrar: ${l}`}
              className="rounded-md border p-3 text-left transition-colors"
              style={{ borderColor: statusFilter === f ? col : border, background: card }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: dim }}><Icon size={13} style={{ color: col }} />{l}</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: col }}>{v}</p>
            </button>
          ))}
        </div>

        {error && <p className="mb-3 rounded-md border border-[#F3B0A8] bg-[#FEF3F2] p-2 text-xs font-semibold text-[#B42318]">{error}</p>}

        {/* Filtros: empresa (si hay varias) + estado como carrusel horizontal en móvil */}
        {myCompanies.length > 1 && (
          <div className="mb-2">
            <select value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full rounded-md border px-2 py-1.5 text-xs font-semibold sm:w-auto" style={{ borderColor: border, background: card, color: text }}>
              <option value="all">Todas las empresas</option>
              {myCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        )}
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar tu tarea por palabras…"
          className="mb-2 w-full rounded-md border px-3 py-2 text-sm outline-none" style={{ borderColor: border, background: dark ? "#1B232E" : "#fff", color: text }} />
        <div className={`mb-3 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 ${qLow ? "opacity-40 pointer-events-none" : ""}`} style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {[["active", "Activas"], ["new", "Novedades"], ["doing", "En progreso"], ["review", "En revisión"], ["done", "Finalizadas"], ["all", "Todas"]].map(([k, l]) => {
            const on = statusFilter === k;
            const isNov = k === "new";
            return (
            <button key={k} type="button" onClick={() => setStatusFilter(k)}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold"
              style={on
                ? (isNov ? { borderColor: "#6D28D9", background: "#F5F3FF", color: "#6D28D9" } : { borderColor: "#17727A", background: "#EAF4F2", color: "#17727A" })
                : { borderColor: border, color: dim }}>
              {l}{isNov && noveltyCount > 0 ? ` (${noveltyCount})` : ""}
            </button>
            );
          })}
        </div>

        <div className="space-y-2">
          {ranked.length ? ranked.map((t) => {
            const isOpen = openId === t.id;
            return (
              <div key={t.id} className="rounded-md border" style={{ borderColor: border, background: card }}>
                <button type="button" onClick={() => { const opening = !isOpen; setOpenId(isOpen ? null : t.id); setDraft(""); if (opening) markSeen(t); }} className="flex w-full items-start gap-3 p-3 text-left">
                  <span className="mt-0.5 inline-flex h-7 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white" style={{ background: t.score >= 70 ? "#B42318" : t.score >= 45 ? "#B76E00" : "#1570EF" }}>{t.score}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {t.task_ref && <span className="mr-2 rounded border px-1.5 py-0.5 font-mono text-[11px] font-bold" style={{ borderColor: border, color: dim }}>{t.task_ref}</span>}
                      {isNew(t) && <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white align-middle" style={{ background: "#0D7A4F" }}>NUEVA</span>}
                      {!isNew(t) && hasChangeRequest(t) && <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white align-middle" style={{ background: "#B54708" }}>CAMBIO SOLICITADO</span>}
                      {!isNew(t) && !hasChangeRequest(t) && isUpdatedByAdmin(t) && <span className="mr-2 rounded px-1.5 py-0.5 text-[10px] font-bold text-white align-middle" style={{ background: "#6D28D9" }}>ACTUALIZADA</span>}
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

                    {/* Cambios solicitados (CR) abiertos: lo que hay que ajustar antes de re-enviar */}
                    {openCRs(t).length > 0 && (
                      <div className="mb-3 rounded-md border p-2" style={{ borderColor: "#F2C879", background: dark ? "#241E12" : "#FFFCF5" }}>
                        <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "#B76E00" }}>⚠ Cambio(s) solicitado(s) — ajusta y vuelve a enviar a revisión</p>
                        <ul className="mt-1.5 space-y-1.5">
                          {openCRs(t).map((c) => (
                            <li key={c.id} className="rounded-md border p-2 text-xs" style={{ borderColor: border, background: card }}>
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={c.by === "cliente" ? { background: "#EAF2FB", color: "#1D5A99" } : { background: "#FFF7E6", color: "#B54708" }}>{c.by === "cliente" ? "Cliente" : "CEO"}</span>
                              <span className="ml-1.5" style={{ color: dim }}>{String(c.at || "").slice(0, 10)}</span>
                              <p className="mt-0.5" style={{ color: text }}>{c.text}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {(() => {
                      const st = saveState[t.id];
                      const pStatus = pending[t.id]?.status ?? t.status; // estado elegido (aún sin guardar)
                      const dirtyHere = isDirty(t);
                      const saving = st?.kind === "saving";
                      return (
                    <>
                    {/* Estado (solo en progreso / en revisión) — 2 columnas; marca la elección */}
                    <div className="mb-3 grid grid-cols-2 gap-2">
                      <button type="button" disabled={saving} onClick={() => setPendingStatus(t, "doing")}
                        className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold"
                        style={pStatus === "doing" ? { borderColor: "#1570EF", background: "#EAF2FB", color: "#1D5A99" } : { borderColor: border, color: text }}>
                        <Clock size={13} /> En progreso
                      </button>
                      <button type="button" disabled={saving} onClick={() => setPendingStatus(t, "review")}
                        className="inline-flex items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold"
                        style={pStatus === "review" ? { borderColor: "#17727A", background: "#EAF4F2", color: "#17727A" } : { borderColor: border, color: text }}>
                        <CheckCircle2 size={13} /> En revisión
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
                    <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Dejar un comentario (opcional)…"
                      className="w-full rounded-md border px-3 py-1.5 text-sm outline-none"
                      style={{ borderColor: border, background: dark ? "#1B232E" : "#fff", color: text }} />

                    {/* Guardar EXPLÍCITO a ancho completo + confirmación */}
                    <div className="mt-3">
                      <button type="button" disabled={saving || !dirtyHere} onClick={() => save(t)}
                        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md px-4 py-2.5 text-sm font-semibold text-white"
                        style={dirtyHere && !saving ? { background: "#17727A" } : (st?.kind === "saved" ? { background: "#0D7A4F" } : { background: "#C7CDD4", cursor: "default" })}>
                        {saving ? <LoaderCircle size={14} className="animate-spin" /> : (st?.kind === "saved" && !dirtyHere ? <CheckCircle2 size={14} /> : <Send size={14} />)}
                        {saving ? "Guardando…" : (st?.kind === "saved" && !dirtyHere ? `Guardado ${new Date(st.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Guardar cambios")}
                      </button>
                      {st?.kind === "error" && (
                        <p className="mt-1 text-center text-xs font-semibold" style={{ color: "#B42318" }}>⚠ {st.msg} Reintenta.</p>
                      )}
                      {dirtyHere && st?.kind !== "saving" && (
                        <p className="mt-1 text-center text-xs font-semibold" style={{ color: "#B54708" }}>● Cambios sin guardar</p>
                      )}
                    </div>
                    <p className="mt-2 text-[11px]" style={{ color: dim }}><MessageCircle size={11} className="mr-1 inline align-[-1px]" /> Elige el estado y/o escribe un comentario, luego pulsa <b>Guardar</b>. Solo puedes cambiar el estado y comentar; el resto lo gestiona el administrador.</p>
                    </>
                    ); })()}
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
