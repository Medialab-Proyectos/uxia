import React from "react";
import { Bell, Clock, CheckCircle2, LoaderCircle, MessageCircle, Send, ListChecks, AlertTriangle, KeyRound, Paperclip, Trash2, UserRound } from "lucide-react";
import { notifyEvent } from "./notify.js";
import * as opsData from "./opsData.js";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Estados que puede poner un LÍDER a sus tareas. NO puede cerrar/finalizar (eso lo da el admin):
// "Finalizada" para el líder = pasa a REVISIÓN del admin (status "review"), por consistencia.
const LEAD_STATUSES = [["ready", "Sin iniciar"], ["doing", "En progreso"], ["blocked", "Bloqueada"]];

const STATUS_LABEL = {
  backlog: "Pendiente", ready: "Pendiente", doing: "En progreso",
  review: "En revisión", verificacion: "Verificación", blocked: "Bloqueada", actualizada: "Actualizada", done: "Finalizada",
};
const PRIORITY_COLOR = { alta: "#B42318", media: "#B76E00", baja: "#1570EF" };

function todayIso() { return new Date().toISOString().slice(0, 10); }

// Puntaje simple de prioridad (mismo criterio que el admin: importancia + urgencia + bloqueo).
function scoreTask(t) {
  let s = t.priority === "alta" ? 40 : t.priority === "baja" ? 8 : 20;
  const today = todayIso();
  if (t.dueDate) {
    if (t.status !== "review" && t.status !== "verificacion" && t.dueDate < today) s += 35;
    else {
      const d = Math.round((new Date(t.dueDate) - new Date(today)) / 86400000);
      s += d <= 2 ? 25 : d <= 7 ? 15 : 5;
    }
  } else s += 6;
  if (t.status === "blocked") s += 25;
  return Math.min(100, s);
}

export default function EmployeePortal({ token, user, theme = "light", onAlerts, focus = null, onFocusHandled, companyId = "", companyName = "" }) {
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
  const [novFilter, setNovFilter] = React.useState("all"); // sub-filtro de novedad dentro de Activas
  const [mineOnly, setMineOnly] = React.useState(false);    // líder: ver solo las que YO creé
  const [q, setQ] = React.useState("");
  const [crResolve, setCrResolve] = React.useState(null); // { task, cr } al resolver un cambio
  const [crComment, setCrComment] = React.useState("");
  const [lastLoadedAt, setLastLoadedAt] = React.useState(null); // momento de la última carga de la BD
  const [staleWarn, setStaleWarn] = React.useState(false);      // aviso de refrescar tras horas
  const [pwdOpen, setPwdOpen] = React.useState(false);          // panel para cambiar la contraseña
  const [newPwd, setNewPwd] = React.useState("");
  const [pwdMsg, setPwdMsg] = React.useState("");
  const [pwdSaving, setPwdSaving] = React.useState(false);
  const [myLeads, setMyLeads] = React.useState([]);             // subproyectos que lidera (si aplica)
  const [allPeople, setAllPeople] = React.useState([]);         // personas (para asignar; líder puede leerlas)
  const [leadCompany, setLeadCompany] = React.useState("");     // empresa seleccionada (para crear/subir)
  const [leadClient, setLeadClient] = React.useState("");       // subproyecto seleccionado ("" = todos los que lidera)
  const [createOpen, setCreateOpen] = React.useState(false);    // modal "crear actividad" abierto
  const [lf, setLf] = React.useState({ key: "", title: "", description: "", dueDate: "", assigneeId: "", status: "ready" }); // form nueva actividad
  const [leadBusy, setLeadBusy] = React.useState(false);
  const [leadMsg, setLeadMsg] = React.useState("");
  const [crFor, setCrFor] = React.useState("");                 // id de tarea propia para pedir cambios
  const [crDraft, setCrDraft] = React.useState("");
  const [leadEdit, setLeadEdit] = React.useState({ title: "", description: "", dueDate: "", assigneeId: "" }); // edición de la actividad propia abierta
  const [leadDueReason, setLeadDueReason] = React.useState("");  // motivo del cambio de fecha
  const [leadSaved, setLeadSaved] = React.useState("");          // id con "guardado ✓"
  const [leadPanelOpen, setLeadPanelOpen] = React.useState(false); // acordeón de "gestión de líder"
  const [noveltyReady, setNoveltyReady] = React.useState(true); // false si la base aún no tiene las columnas

  const headers = React.useMemo(() => ({ apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` }), [token]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [peopleRes, compRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name,email,type,company_id`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/companies?select=id,name`, { headers }),
      ]);
      const people = peopleRes.ok ? await peopleRes.json() : [];
      const person = people.find((p) => String(p.email || "").toLowerCase() === email) || null;
      setMe(person);
      setCompanies(compRes.ok ? await compRes.json() : []);
      if (person) {
        const base = "id,title,description,client,company_id,status,priority,due_date,role,comments,task_ref,design_points,created_by,assignee_id,prev_due_date";
        // Acota la vista SOLO si la persona pertenece a una empresa fija (externo). Los de MediaLab
        // (sin empresa) ven TODAS sus tareas asignadas, aunque estén repartidas entre clientes.
        const myCompany = person.company_id || "";
        const compFilter = myCompany ? `&company_id=eq.${encodeURIComponent(myCompany)}` : "";
        // Intenta con las columnas de novedad; si la base aún no está migrada, carga sin ellas.
        let tRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?assignee_id=eq.${person.id}${compFilter}&select=${base},assignee_seen_at,admin_touched_at,change_requests&order=due_date.asc`, { headers });
        if (!tRes.ok) {
          setNoveltyReady(false);
          tRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?assignee_id=eq.${person.id}${compFilter}&select=${base}&order=due_date.asc`, { headers });
        } else {
          setNoveltyReady(true);
        }
        const assigned = tRes.ok ? await tRes.json() : [];

        // ¿Lidera subproyectos? (RLS devuelve solo SUS liderazgos).
        const leadRes = await fetch(`${SUPABASE_URL}/rest/v1/subproject_leads?select=id,company_id,client`, { headers });
        const leadRows = leadRes.ok ? await leadRes.json() : [];
        setMyLeads(leadRows);
        if (leadRows.length) {
          const pplRes = await fetch(`${SUPABASE_URL}/rest/v1/people?select=id,name,email,type`, { headers });
          setAllPeople(pplRes.ok ? await pplRes.json() : []);
          setLeadCompany((cur) => cur || leadRows[0].company_id); // empresa por defecto
          // El líder ve TODAS las tareas de sus subproyectos (RLS lead_read_tasks) + sus asignadas.
          const scopeRes = await fetch(`${SUPABASE_URL}/rest/v1/tasks?select=${base},assignee_seen_at,admin_touched_at,change_requests&order=due_date.asc`, { headers });
          const scope = scopeRes.ok ? await scopeRes.json() : [];
          const byId = new Map(assigned.map((t) => [t.id, t]));
          for (const t of scope) if (!byId.has(t.id)) byId.set(t.id, t);
          setTasks([...byId.values()]);
        } else {
          setAllPeople([]);
          setTasks(assigned);
        }
      } else {
        setTasks([]);
      }
      setLastLoadedAt(Date.now());
      setStaleWarn(false);
    } catch (e) {
      setError("No se pudieron cargar tus tareas.");
    } finally {
      setLoading(false);
    }
  }, [headers, email, companyId]);

  React.useEffect(() => { load(); }, [load]);

  // Recarga al VOLVER a la pestaña/ventana: así los cambios del admin (p. ej. un request review
  // recién enviado) aparecen sin tener que refrescar a mano. Se limita a 1 recarga cada 20s.

  // Para el líder, el filtro de empresa de la lista sigue a su desplegable de empresa.
  React.useEffect(() => {
    if (myLeads.length && leadCompany) setCompanyFilter(leadCompany);
  }, [myLeads.length, leadCompany]);

  // Auto-refresco cada 10 minutos (solo con la pestaña visible; no refresca si hay algo abierto
  // para no perder lo que estás escribiendo/creando).
  React.useEffect(() => {
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return;
      if (createOpen || openId || crResolve) return; // no interrumpir edición/creación
      load();
    }, 10 * 60 * 1000);
    return () => clearInterval(timer);
  }, [load, createOpen, openId, crResolve]);

  const nameOf = (id) => companies.find((c) => c.id === id)?.name || id || "";
  const whoName = (id) => (allPeople.find((p) => p.id === id)?.name) || (id && id === me?.id ? (me?.name || "") : "");
  // Al abrir una actividad que YO creé, carga sus valores en el formulario de edición.
  React.useEffect(() => {
    const t = tasks.find((x) => x.id === openId);
    if (t && String(t.created_by || "").toLowerCase() === email) {
      setLeadEdit({ title: t.title || "", description: t.description || "", dueDate: t.due_date || "", assigneeId: t.assignee_id || "" });
      setLeadDueReason(""); setLeadSaved(""); setLeadPanelOpen(false);
    }
  }, [openId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Guarda los cambios de la actividad propia. Si cambió la fecha y ya había una, exige el motivo.
  async function saveLeadEdit(t) {
    const patch = { title: leadEdit.title.trim() || t.title, description: leadEdit.description.trim() || null, assignee_id: leadEdit.assigneeId || null };
    const dateChanged = (leadEdit.dueDate || "") !== (t.due_date || "");
    if (dateChanged) {
      if (t.due_date && !leadDueReason.trim()) { setLeadMsg("Di el motivo del cambio de fecha."); return; }
      patch.due_date = leadEdit.dueDate || null;
      if (t.due_date) { patch.prev_due_date = t.due_date; patch.due_change_reason = leadDueReason.trim(); }
    }
    if (leadEdit.assigneeId && leadEdit.assigneeId !== t.assignee_id) notifyEvent(token, { type: "assigned", taskId: t.id });
    await patchLeadTask(t.id, patch);
    // Relee la tarea de la BD para reflejar lo realmente guardado (por si el guard/RLS revierte algo).
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${t.id}&select=id,title,description,client,company_id,status,priority,due_date,prev_due_date,assignee_id,created_by,comments,change_requests,assignee_seen_at,admin_touched_at`, { headers });
      if (r.ok) {
        const rows = await r.json();
        if (rows[0]) {
          setTasks((cur) => cur.map((x) => (x.id === t.id ? { ...x, ...rows[0] } : x)));
          if ((rows[0].assignee_id || "") !== (leadEdit.assigneeId || "")) {
            setLeadMsg("La base no guardó el responsable (revisa que corriste migration-subproject-leads.sql).");
          }
        }
      }
    } catch { /* ignore */ }
    setLeadDueReason(""); // motivo se pide UNA vez por ciclo de guardado: se limpia tras guardar
    setLeadSaved(t.id); setLeadMsg((m) => m || ""); setTimeout(() => setLeadSaved(""), 2000);
  }

  // Novedades por persona: "Nueva" = nunca vista; "Actualizada" = el admin la cambió
  // después de la última vez que la vi. Al abrirla se marca vista y el tag desaparece.
  // Prioridad de novedad: cambio solicitado > nueva > actualizada (excluyentes). Si hay un CR
  // abierto la tarea es "cambio solicitado", NO "nueva" ni "actualizada".
  const openCRs = (t) => (Array.isArray(t.change_requests) ? t.change_requests : []).filter((c) => !c.resolved);
  const hasChangeRequest = (t) => noveltyReady && openCRs(t).length > 0;
  const isNew = (t) => noveltyReady && !t.assignee_seen_at && !hasChangeRequest(t);
  const isUpdatedByAdmin = (t) => Boolean(
    noveltyReady && !hasChangeRequest(t) && t.assignee_seen_at && t.admin_touched_at && new Date(t.admin_touched_at) > new Date(t.assignee_seen_at)
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
  const overdue = active.filter((t) => t.due_date && t.due_date < todayIso() && t.status !== "review" && t.status !== "verificacion").length;

  // Reporta las alertas al shell (la campana vive en el header del shell, junto al tema).
  // Cada alerta lleva una FIRMA (ids de las tareas que la componen): así reaparece si cambia el
  // conjunto, no solo el conteo (p. ej. llega un cambio solicitado nuevo aunque el total coincida).
  const sigOf = (arr) => arr.map((t) => t.id).sort().join(",");
  const crTasks = tasks.filter((t) => t.status !== "done" && hasChangeRequest(t));
  const newTasks = tasks.filter((t) => t.status !== "done" && isNew(t));
  const updTasks = tasks.filter((t) => t.status !== "done" && isUpdatedByAdmin(t));
  const overdueTasks = active.filter((t) => t.due_date && t.due_date < todayIso() && t.status !== "review" && t.status !== "verificacion");
  const nNew = newTasks.length;
  const nCR = crTasks.length;
  const nUpd = updTasks.length;
  const alertSig = `${sigOf(crTasks)}|${sigOf(newTasks)}|${sigOf(updTasks)}|${sigOf(overdueTasks)}`;
  React.useEffect(() => {
    if (!onAlerts) return;
    const items = [
      { key: "emp-cr", label: "Cambios solicitados", count: nCR, sig: sigOf(crTasks), color: "#B54708", focus: "cr" },
      { key: "emp-new", label: "Tareas nuevas", count: nNew, sig: sigOf(newTasks), color: "#0D7A4F", focus: "new" },
      { key: "emp-upd", label: "Actualizadas por el admin", count: nUpd, sig: sigOf(updTasks), color: "#6D28D9", focus: "updated" },
      { key: "emp-overdue", label: "Vencidas", count: overdue, sig: sigOf(overdueTasks), color: "#B42318", focus: "vencidas" },
    ].filter((it) => it.count > 0);
    onAlerts(items);
  }, [alertSig]);
  // Foco desde la campana del shell → aplica el filtro (o sub-filtro de novedad) correspondiente.
  React.useEffect(() => {
    if (!focus) return;
    if (focus === "vencidas") setStatusFilter("vencidas");
    else if (["any", "new", "cr", "updated"].includes(focus)) { setStatusFilter("active"); setNovFilter(focus); }
    else setStatusFilter(focus);
    onFocusHandled?.();
  }, [focus]);

  // Empresas presentes en MIS tareas (para el filtro).
  const myCompanies = [...new Set(tasks.map((t) => t.company_id))].map((id) => ({ id, name: nameOf(id) }));

  // Filtros por empresa y estado → lista ordenada por prioridad.
  const qLow = q.trim().toLowerCase();
  const filtered = tasks.filter((t) => {
    if (companyFilter !== "all" && t.company_id !== companyFilter) return false;
    // Para el líder, el desplegable de subproyecto también acota la lista.
    if (myLeads.length && leadClient && t.client !== leadClient) return false;
    if (mineOnly && String(t.created_by || "").toLowerCase() !== email) return false; // filtro "creadas por mí"
    // Buscador por palabras (ignora el filtro de estado para encontrar también finalizadas).
    if (qLow) return `${t.title || ""} ${t.client || ""} ${nameOf(t.company_id)} ${t.task_ref || ""} ${t.role || ""}`.toLowerCase().includes(qLow);
    // La tarea ABIERTA no desaparece del filtro aunque al abrirla deje de ser novedad.
    if (statusFilter === "new") return (hasNovelty(t) || t.id === openId) && t.status !== "done";
    if (statusFilter === "vencidas") return t.status !== "done" && t.due_date && t.due_date < todayIso() && t.status !== "review" && t.status !== "verificacion";
    if (statusFilter === "active") {
      if (t.status === "done") return false;
      // Sub-filtro de novedades (solo dentro de Activas). La tarea abierta se mantiene visible.
      if (novFilter === "any") return hasNovelty(t) || t.id === openId;
      if (novFilter === "new") return isNew(t) || t.id === openId;
      if (novFilter === "cr") return hasChangeRequest(t) || t.id === openId;
      if (novFilter === "updated") return isUpdatedByAdmin(t) || t.id === openId;
      return true;
    }
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
      // Si el empleado pasa la tarea a REVISIÓN, avisa al admin al instante.
      if (body.status === "review") notifyEvent(token, { type: "review", taskId: task.id });
      setSaveState((s) => ({ ...s, [task.id]: { kind: "saved", at: Date.now() } }));
      setPending((p2) => { const n = { ...p2 }; delete n[task.id]; return n; });
      setDraft("");
      await load();
    } catch (e) {
      setSaveState((s) => ({ ...s, [task.id]: { kind: "error", msg: String(e?.message || "Error") } }));
    }
  }

  // Resolver un Change Request: lo marca resuelto, envía la tarea a REVISIÓN (para que el
  // admin verifique) y agrega un comentario opcional. El admin ve el CR como resuelto.
  async function confirmResolveCR() {
    if (!crResolve) return;
    const { task, cr } = crResolve;
    const text = crComment.trim();
    // El comentario al resolver un CR se guarda DENTRO del propio request review (resolved_comment),
    // NO en los comentarios generales de la tarea: es seguimiento del cambio, no una conversación.
    const crs = (Array.isArray(task.change_requests) ? task.change_requests : [])
      .map((c) => (c.id === cr.id ? { ...c, resolved: true, resolved_at: new Date().toISOString(), resolved_comment: text || c.resolved_comment || "" } : c));
    const body = { change_requests: crs, status: "review", employee_touched_at: new Date().toISOString() };
    setError("");
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${task.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`No se pudo guardar (código ${res.status}).`);
      notifyEvent(token, { type: "cr-resolved", taskId: task.id }); // avisa al admin
      setCrResolve(null); setCrComment("");
      await load();
    } catch (e) {
      setError(String(e?.message || "No se pudo resolver el cambio."));
    }
  }

  // El empleado cambia su propia contraseña (Supabase Auth: PUT /auth/v1/user con su token).
  async function changePassword() {
    const p = newPwd.trim();
    if (p.length < 6) { setPwdMsg("La contraseña debe tener al menos 6 caracteres."); return; }
    setPwdSaving(true); setPwdMsg("");
    try {
      const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
        method: "PUT",
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ password: p }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.msg || d.error_description || `Error ${res.status}`); }
      setPwdMsg("Contraseña actualizada ✓"); setNewPwd("");
      setTimeout(() => { setPwdOpen(false); setPwdMsg(""); }, 1600);
    } catch (e) {
      setPwdMsg(String(e?.message || "No se pudo cambiar la contraseña."));
    } finally { setPwdSaving(false); }
  }

  // ---- Coordinación de subproyectos (líder): navegar por empresa → subproyecto, crear actividad,
  //      subir insumos y editar SOLO las tareas que él crea. ----
  const leadKey = (l) => `${l.company_id}|||${l.client}`;
  const companyNameOf = (id) => (companies.find((c) => c.id === id)?.name || id);
  const ledCompanies = React.useMemo(() => {
    const ids = [...new Set(myLeads.map((l) => l.company_id))];
    return ids.map((id) => ({ id, name: companyNameOf(id) }));
  }, [myLeads, companies]);
  const ledClients = React.useMemo(() => myLeads.filter((l) => l.company_id === leadCompany).map((l) => l.client), [myLeads, leadCompany]);

  async function createLeadTask() {
    const key = lf.key || (leadClient ? `${leadCompany}|||${leadClient}` : (myLeads[0] && leadKey(myLeads[0])));
    const lead = myLeads.find((l) => leadKey(l) === key) || myLeads[0];
    if (!lead || !lf.title.trim()) { setLeadMsg("Elige subproyecto y escribe un título."); return; }
    setLeadBusy(true); setLeadMsg("");
    try {
      const row = {
        id: crypto.randomUUID(), company_id: lead.company_id, client: lead.client,
        title: lf.title.trim(), description: lf.description.trim() || null,
        status: lf.status || "ready", priority: "media", due_date: lf.dueDate || null,
        assignee_id: lf.assigneeId || null, created_by: email, created_at: new Date().toISOString(),
      };
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks`, {
        method: "POST", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(row),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.message || d.hint || `Error ${res.status}`); }
      if (row.assignee_id) notifyEvent(token, { type: "assigned", taskId: row.id });
      setLeadMsg("Actividad creada ✓");
      setLf((f) => ({ ...f, title: "", description: "", dueDate: "", assigneeId: "" }));
      setCreateOpen(false);
      load(); // la actividad creada se suma a la lista activa
    } catch (e) { setLeadMsg(String(e?.message || "No se pudo crear la actividad.")); }
    finally { setLeadBusy(false); }
  }
  async function uploadLeadInsumo(companyId, client, file) {
    if (!client || !file) { setLeadMsg("Elige un subproyecto para el insumo."); return; }
    setLeadBusy(true); setLeadMsg("");
    try {
      const kind = /^image\//.test(file.type || "") ? "imagen" : "texto";
      await opsData.saveInsumo(token, { companyId, client, file, kind });
      setLeadMsg(`Insumo subido a ${client} ✓`);
    } catch (e) { setLeadMsg(String(e?.message || "No se pudo subir el insumo.")); }
    finally { setLeadBusy(false); }
  }
  // ¿Yo (líder) creé esta actividad? Entonces puedo gestionar estado y pedir cambios sobre ella.
  const iCreated = (t) => String(t.created_by || "").toLowerCase() === email;
  async function patchLeadTask(id, patch) {
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, {
        method: "PATCH", headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`Error ${res.status}`);
      if (patch.status === "review") notifyEvent(token, { type: "review", taskId: id });
    } catch (e) { setError(String(e?.message || "No se pudo guardar el cambio.")); }
  }
  async function deleteLeadTask(id) {
    setTasks((cur) => cur.filter((t) => t.id !== id));
    setOpenId(null);
    try { await fetch(`${SUPABASE_URL}/rest/v1/tasks?id=eq.${id}`, { method: "DELETE", headers: { ...headers, Prefer: "return=minimal" } }); }
    catch { /* ignore */ }
  }
  async function addLeadCR(t) {
    const txt = crDraft.trim();
    if (!txt) return;
    const crs = Array.isArray(t.change_requests) ? t.change_requests : [];
    const cr = { id: `cr-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, at: new Date().toISOString(), by: "lead", text: txt, resolved: false };
    await patchLeadTask(t.id, { change_requests: [...crs, cr], change_request: true, status: "doing" });
    notifyEvent(token, { type: "cr-opened", taskId: t.id });
    setCrFor(""); setCrDraft("");
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
        {/* Saludo (la campana de alertas vive ahora en el header del shell). */}
        <div className="sticky top-0 z-20 -mx-4 mb-3 flex items-center justify-between gap-3 px-4 py-2 sm:-mx-6 sm:px-6" style={{ background: bg }}>
          <h1 className="truncate text-lg font-semibold">Hola, {me.name.split(" ")[0]}</h1>
          <button type="button" onClick={() => { setPwdOpen((v) => !v); setPwdMsg(""); }} title="Cambiar mi contraseña"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold" style={{ borderColor: border, color: dim }}>
            <KeyRound size={14} /> <span className="hidden sm:inline">Contraseña</span>
          </button>
        </div>
        {pwdOpen && (
          <div className="mb-4 rounded-md border p-3" style={{ borderColor: border, background: card }}>
            <p className="mb-2 text-sm font-semibold">Cambiar mi contraseña</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input value={newPwd} onChange={(e) => setNewPwd(e.target.value)} type="password" autoComplete="new-password"
                placeholder="Nueva contraseña (mín. 6)" onKeyDown={(e) => e.key === "Enter" && changePassword()}
                className="min-w-0 flex-1 rounded-md border px-3 py-2 text-sm" style={{ borderColor: border, background: bg, color: text }} />
              <button type="button" onClick={changePassword} disabled={pwdSaving || newPwd.trim().length < 6}
                className="rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#17727A" }}>
                {pwdSaving ? "Guardando…" : "Guardar"}
              </button>
            </div>
            {pwdMsg && <p className="mt-2 text-xs font-semibold" style={{ color: pwdMsg.includes("✓") ? "#0D7A4F" : "#B42318" }}>{pwdMsg}</p>}
          </div>
        )}

        <div className="-mt-2 mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm" style={{ color: dim }}>
          <span>Estas son tus tareas y su prioridad.</span>
          {lastLoadedAt && (
            <button type="button" onClick={() => load()} className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: "#17727A" }} title="Actualizar desde la base de datos">
              <LoaderCircle size={12} /> Actualizado {new Date(lastLoadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · Actualizar
            </button>
          )}
        </div>

        {/* Indicadores del empleado (2×2 en móvil, 4 en escritorio) con ícono — clicables → filtran */}
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { l: "Novedades", v: noveltyCount, col: "#6D28D9", Icon: Bell, on: statusFilter === "active" && novFilter === "any", go: () => { setStatusFilter("active"); setNovFilter("any"); } },
            { l: "Activas", v: active.length, col: "#17727A", Icon: ListChecks, on: statusFilter === "active" && novFilter === "all", go: () => { setStatusFilter("active"); setNovFilter("all"); } },
            { l: "Vencidas", v: overdue, col: "#B42318", Icon: AlertTriangle, on: statusFilter === "vencidas", go: () => setStatusFilter("vencidas") },
            { l: "Finalizadas", v: done.length, col: "#0D7A4F", Icon: CheckCircle2, on: statusFilter === "done", go: () => setStatusFilter("done") },
          ].map(({ l, v, col, Icon, on, go }) => (
            <button key={l} type="button" onClick={go} title={`Filtrar: ${l}`}
              className="rounded-md border p-3 text-left transition-colors"
              style={{ borderColor: on ? col : border, background: card }}>
              <p className="flex items-center gap-1.5 text-xs" style={{ color: dim }}><Icon size={13} style={{ color: col }} />{l}</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: col }}>{v}</p>
            </button>
          ))}
        </div>

        {/* COORDINACIÓN DE SUBPROYECTOS (líder): navega por empresa → subproyecto, crea actividad,
            sube insumos y edita SOLO las actividades que él crea. Va DEBAJO de los indicadores. */}
        {myLeads.length > 0 && (
          <div className="mb-4">
            {/* UNA sola línea: [Empresa ▾] [Subproyecto ▾] [Crear actividad] [Subir insumo] (scroll horizontal en móvil) */}
            <div className="mb-3 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
              {/* Este es EL filtro de empresa (también filtra la lista de abajo). */}
              <select value={leadCompany} onChange={(e) => { setLeadCompany(e.target.value); setLeadClient(""); setCompanyFilter(e.target.value); }}
                className="shrink-0 rounded-md border px-2 py-2 text-sm font-semibold" style={{ borderColor: border, background: card, color: text }} title="Empresa">
                {ledCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={leadClient} onChange={(e) => setLeadClient(e.target.value)}
                className="shrink-0 rounded-md border px-2 py-2 text-sm font-semibold" style={{ borderColor: border, background: card, color: text }} title="Subproyecto">
                <option value="">Todos los subproyectos</option>
                {ledClients.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              {/* Los botones SOLO aparecen cuando hay un subproyecto específico seleccionado. */}
              {leadClient && (
                <>
                  <button type="button"
                    onClick={() => { setCreateOpen(true); setLf({ key: `${leadCompany}|||${leadClient}`, title: "", description: "", dueDate: "", assigneeId: "", status: "ready" }); }}
                    className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "#17727A" }}>
                    <Send size={14} /> Crear actividad
                  </button>
                  <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-md border px-3 py-2 text-sm font-semibold" style={{ borderColor: "#17727A", color: "#17727A" }} title={`Subir insumo a ${leadClient}`}>
                    <Paperclip size={14} /> Subir insumo
                    <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLeadInsumo(leadCompany, leadClient, f); e.target.value = ""; }} />
                  </label>
                </>
              )}
            </div>
            <div>
              {leadMsg && <p className="mb-2 text-xs font-semibold" style={{ color: leadMsg.includes("✓") ? "#0D7A4F" : "#B42318" }}>{leadMsg}</p>}

              {/* Modal "Crear actividad" (estructura de tarea; el cierre lo da el admin) */}
              {createOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.55)" }} onClick={(e) => { if (e.target === e.currentTarget) setCreateOpen(false); }}>
                  <div className="w-full max-w-md space-y-2 rounded-md border p-4 shadow-2xl" style={{ borderColor: "#17727A", background: card, maxHeight: "92vh", overflowY: "auto" }}>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold" style={{ color: text }}>Crear actividad</p>
                    <button type="button" onClick={() => setCreateOpen(false)} className="text-xs font-semibold" style={{ color: dim }}>Cerrar</button>
                  </div>
                  <label className="block text-xs" style={{ color: dim }}>Subproyecto
                    <select value={lf.key} onChange={(e) => setLf((f) => ({ ...f, key: e.target.value }))}
                      className="mt-1 w-full rounded-md border px-2 py-2 text-sm font-normal" style={{ borderColor: border, background: bg, color: text }}>
                      {myLeads.filter((l) => l.company_id === leadCompany).map((l) => <option key={leadKey(l)} value={leadKey(l)}>{l.client}</option>)}
                    </select>
                  </label>
                  <input value={lf.title} onChange={(e) => setLf((f) => ({ ...f, title: e.target.value }))} placeholder="Título de la actividad"
                    className="w-full rounded-md border px-2 py-2 text-sm" style={{ borderColor: border, background: bg, color: text }} />
                  <textarea value={lf.description} onChange={(e) => setLf((f) => ({ ...f, description: e.target.value }))} rows={3} placeholder="Descripción / historia para el responsable"
                    className="w-full rounded-md border px-2 py-2 text-sm" style={{ borderColor: border, background: bg, color: text }} />
                  <div className="flex gap-2">
                    <label className="flex-1 text-xs" style={{ color: dim }}>Fecha de finalización
                      <input type="date" value={lf.dueDate} onChange={(e) => setLf((f) => ({ ...f, dueDate: e.target.value }))}
                        className="mt-1 w-full rounded-md border px-2 py-2 text-sm font-normal" style={{ borderColor: border, background: bg, color: text }} />
                    </label>
                    <label className="flex-1 text-xs" style={{ color: dim }}>Estado
                      <select value={lf.status} onChange={(e) => setLf((f) => ({ ...f, status: e.target.value }))}
                        className="mt-1 w-full rounded-md border px-2 py-2 text-sm font-normal" style={{ borderColor: border, background: bg, color: text }}>
                        {LEAD_STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="block text-xs" style={{ color: dim }}>Responsable (a quién le llega la historia)
                    <select value={lf.assigneeId} onChange={(e) => setLf((f) => ({ ...f, assigneeId: e.target.value }))}
                      className="mt-1 w-full rounded-md border px-2 py-2 text-sm font-normal" style={{ borderColor: border, background: bg, color: text }}>
                      <option value="">Sin responsable</option>
                      {allPeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </label>
                  <button type="button" onClick={createLeadTask} disabled={leadBusy || !lf.title.trim()}
                    className="w-full rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-40" style={{ background: "#17727A" }}>
                    {leadBusy ? "Guardando…" : "Crear actividad"}
                  </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {error && <p className="mb-3 rounded-md border border-[#F3B0A8] bg-[#FEF3F2] p-2 text-xs font-semibold text-[#B42318]">{error}</p>}

        {/* Filtro de empresa normal: SOLO para no-líderes. El líder usa el desplegable de arriba. */}
        {myCompanies.length > 1 && myLeads.length === 0 && (
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
        <div className={`mb-2 -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 ${qLow ? "opacity-40 pointer-events-none" : ""}`} style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
          {[["active", "Activas"], ["doing", "En progreso"], ["review", "En revisión"], ["done", "Finalizadas"], ["all", "Todas"]].map(([k, l]) => {
            const on = statusFilter === k;
            return (
            <button key={k} type="button" onClick={() => { setStatusFilter(k); if (k === "active") setNovFilter("all"); }}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold"
              style={on ? { borderColor: "#17727A", background: "#EAF4F2", color: "#17727A" } : { borderColor: border, color: dim }}>
              {l}
            </button>
            );
          })}
          {/* Filtro de líder: solo las actividades que YO creé. */}
          {myLeads.length > 0 && (
            <button type="button" onClick={() => setMineOnly((v) => !v)}
              className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold"
              style={mineOnly ? { borderColor: "#17727A", background: "#17727A", color: "#fff" } : { borderColor: border, color: dim }}>
              Creadas por mí
            </button>
          )}
        </div>
        {/* Sub-filtro de novedades: SOLO aparece dentro de "Activas" (no es un filtro hermano). */}
        {statusFilter === "active" && !qLow && (
          <div className="mb-3 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1" style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}>
            <span className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.06em]" style={{ color: dim }}>Novedad:</span>
            {[
              ["all", `Todas (${active.length})`, "#17727A"],
              ["any", `Con novedad${noveltyCount ? ` (${noveltyCount})` : ""}`, "#6D28D9"],
              ["new", `Nuevas${nNew ? ` (${nNew})` : ""}`, "#0D7A4F"],
              ["cr", `Cambios solicitados${nCR ? ` (${nCR})` : ""}`, "#B54708"],
              ["updated", `Actualizadas por el admin${nUpd ? ` (${nUpd})` : ""}`, "#6D28D9"],
            ].map(([k, l, col]) => {
              const on = novFilter === k;
              return (
                <button key={k} type="button" onClick={() => setNovFilter(k)}
                  className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-semibold"
                  style={on ? { borderColor: col, background: `${col}14`, color: col } : { borderColor: border, color: dim }}>
                  {l}
                </button>
              );
            })}
          </div>
        )}

        <div className="space-y-2">
          {ranked.length ? ranked.map((t) => {
            const isOpen = openId === t.id;
            return (
              <div key={t.id} className="relative rounded-md border" style={{ borderColor: border, background: card }}>
                {iCreated(t) && (
                  <button type="button" onClick={(e) => { e.stopPropagation(); deleteLeadTask(t.id); }} title="Eliminar actividad"
                    className="absolute right-2 top-2 z-10 inline-flex h-7 w-7 items-center justify-center rounded-md border" style={{ borderColor: "#F3B0A8", color: "#B42318", background: card }}>
                    <Trash2 size={14} />
                  </button>
                )}
                <button type="button" onClick={() => { const opening = !isOpen; setOpenId(isOpen ? null : t.id); setDraft(""); if (opening) markSeen(t); }} className="flex w-full items-start gap-3 p-3 pr-10 text-left">
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
                    <span className="mt-0.5 flex items-center gap-1 truncate text-xs" style={{ color: t.assignee_id ? "#17727A" : "#B76E00" }}>
                      <UserRound size={11} /> {t.assignee_id ? (whoName(t.assignee_id) || "Responsable") : "Sin responsable"}
                    </span>
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t px-3 py-3" style={{ borderColor: border }}>
                    {t.description && <p className="mb-3 whitespace-pre-line text-sm" style={{ color: dim }}>{t.description}</p>}

                    {/* GESTIÓN DE LÍDER: solo en las actividades que YO creé. Estado (limitado) + pedir cambios.
                        El cierre real (finalizar) lo da el admin; aquí "Finalizada" = pasa a revisión. */}
                    {iCreated(t) && (
                      <div className="mb-3 rounded-md border p-2" style={{ borderColor: "#17727A", background: dark ? "#12201F" : "#F0FAF8" }}>
                        <button type="button" onClick={() => setLeadPanelOpen((v) => !v)} className="flex w-full items-center justify-between text-left">
                          <span className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "#17727A" }}>Tú creaste esta actividad · gestión de líder</span>
                          <span className="text-[11px] font-semibold" style={{ color: "#17727A" }}>{leadPanelOpen ? "▲" : "▼"}</span>
                        </button>
                        {leadPanelOpen && (<div className="mt-2">
                        {["done"].includes(t.status) ? (
                          <div>
                            <p className="text-xs font-semibold" style={{ color: "#0D7A4F" }}>Actividad finalizada — solo lectura.</p>
                            {Array.isArray(t.comments) && t.comments.length > 0 && (
                              <ul className="mt-2 space-y-1">
                                {t.comments.map((c, i) => (
                                  <li key={i} className="rounded border px-2 py-1 text-[11px]" style={{ borderColor: border, background: bg }}>
                                    <span className="font-semibold" style={{ color: text }}>{c.author || (c.role === "admin" ? "Admin" : "Responsable")}: </span>
                                    <span style={{ color: dim }}>{c.text}</span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ) : (<>
                        {/* Edición de la actividad (con botón Guardar) */}
                        <input value={leadEdit.title} onChange={(e) => setLeadEdit((s) => ({ ...s, title: e.target.value }))} placeholder="Título"
                          className="mb-1.5 w-full rounded border px-2 py-1 text-sm font-semibold" style={{ borderColor: border, background: bg, color: text }} />
                        <textarea value={leadEdit.description} onChange={(e) => setLeadEdit((s) => ({ ...s, description: e.target.value }))} rows={2} placeholder="Descripción / historia"
                          className="mb-1.5 w-full rounded border px-2 py-1 text-xs" style={{ borderColor: border, background: bg, color: text }} />
                        <div className="mb-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                          <input type="date" value={leadEdit.dueDate} onChange={(e) => setLeadEdit((s) => ({ ...s, dueDate: e.target.value }))}
                            className="rounded border px-1.5 py-1" style={{ borderColor: border, background: bg, color: text }} title="Fecha de finalización" />
                          <select value={leadEdit.assigneeId} onChange={(e) => setLeadEdit((s) => ({ ...s, assigneeId: e.target.value }))}
                            className="rounded border px-1.5 py-1" style={{ borderColor: border, background: bg, color: text }} title="Responsable">
                            <option value="">Sin responsable</option>
                            {allPeople.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                          </select>
                        </div>
                        {/* Motivo del cambio de fecha: aparece si movió una fecha ya guardada. */}
                        {(leadEdit.dueDate || "") !== (t.due_date || "") && t.due_date && (
                          <input value={leadDueReason} onChange={(e) => setLeadDueReason(e.target.value)} placeholder="¿Por qué se mueve la fecha? (queda registrado)"
                            className="mb-1.5 w-full rounded border px-2 py-1 text-xs" style={{ borderColor: "#B76E00", background: bg, color: text }} />
                        )}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {LEAD_STATUSES.map(([v, l]) => {
                            const on = t.status === v;
                            return (
                              <button key={v} type="button" onClick={() => patchLeadTask(t.id, { status: v })}
                                className="rounded-md border px-2 py-1 text-xs font-semibold"
                                style={on ? { borderColor: "#17727A", background: "#17727A", color: "#fff" } : { borderColor: border, color: dim }}>
                                {l}
                              </button>
                            );
                          })}
                          {/* Finalizar (cerrar la actividad): el líder es quien la finaliza. */}
                          <button type="button" onClick={() => patchLeadTask(t.id, { status: "done" })}
                            className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-semibold"
                            style={t.status === "review" ? { borderColor: "#0D7A4F", background: "#0D7A4F", color: "#fff" } : { borderColor: "#0D7A4F", color: "#0D7A4F" }}>
                            <CheckCircle2 size={12} /> Finalizar
                          </button>
                        </div>
                        {t.status === "review" && (
                          <p className="mt-1.5 rounded border px-2 py-1 text-[11px] font-semibold" style={{ borderColor: "#17727A", background: dark ? "#12201F" : "#EAF4F2", color: "#17727A" }}>
                            El responsable lo envió a revisión — valida: <b>Finalizar</b> o <b>Pedir cambios</b> (vuelve a progreso).
                          </p>
                        )}
                        {/* Comentarios del responsable */}
                        {Array.isArray(t.comments) && t.comments.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {t.comments.map((c, i) => (
                              <li key={i} className="rounded border px-2 py-1 text-[11px]" style={{ borderColor: border, background: bg }}>
                                <span className="font-semibold" style={{ color: text }}>{c.author || (c.role === "admin" ? "Admin" : "Responsable")}: </span>
                                <span style={{ color: dim }}>{c.text}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {crFor === t.id ? (
                            <div className="flex flex-1 gap-1.5">
                              <input value={crDraft} onChange={(e) => setCrDraft(e.target.value)} placeholder="¿Qué cambio pides al responsable?" onKeyDown={(e) => e.key === "Enter" && addLeadCR(t)}
                                className="min-w-0 flex-1 rounded border px-2 py-1 text-xs" style={{ borderColor: border, background: bg, color: text }} />
                              <button type="button" onClick={() => addLeadCR(t)} disabled={!crDraft.trim()} className="rounded px-2 py-1 text-xs font-semibold text-white disabled:opacity-40" style={{ background: "#B54708" }}>Enviar</button>
                              <button type="button" onClick={() => setCrFor("")} className="text-xs font-semibold" style={{ color: dim }}>Cancelar</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => { setCrFor(t.id); setCrDraft(""); }} className="text-xs font-semibold" style={{ color: "#B54708" }}>+ Pedir cambios (request review)</button>
                          )}
                        </div>
                        {/* Guardar al FINAL de la caja */}
                        <button type="button" onClick={() => saveLeadEdit(t)}
                          className="mt-3 w-full rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: leadSaved === t.id ? "#0D7A4F" : "#17727A" }}>
                          {leadSaved === t.id ? "Guardado ✓" : "Guardar cambios"}
                        </button>
                        </>)}
                        </div>)}
                      </div>
                    )}

                    {/* Cambios solicitados (CR) abiertos: lo que hay que ajustar antes de re-enviar */}
                    {openCRs(t).length > 0 && (
                      <div className="mb-3 rounded-md border p-2" style={{ borderColor: "#F2C879", background: dark ? "#241E12" : "#FFFCF5" }}>
                        <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: "#B76E00" }}>⚠ Cambio(s) solicitado(s) — ajusta y vuelve a enviar a revisión</p>
                        <ul className="mt-1.5 space-y-1.5">
                          {openCRs(t).map((c) => (
                            <li key={c.id} className="rounded-md border p-2 text-xs" style={{ borderColor: border, background: card }}>
                              <div className="flex items-start justify-between gap-2">
                                <span className="min-w-0">
                                  <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={c.by === "cliente" ? { background: "#EAF2FB", color: "#1D5A99" } : { background: "#FFF7E6", color: "#B54708" }}>{c.by === "cliente" ? "Cliente" : "CEO"}</span>
                                  <span className="ml-1.5" style={{ color: dim }}>{String(c.at || "").slice(0, 10)}</span>
                                  <p className="mt-0.5" style={{ color: text }}>{c.text}</p>
                                </span>
                                <button type="button" onClick={() => { setCrResolve({ task: t, cr: c }); setCrComment(""); }}
                                  className="shrink-0 inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-white" style={{ background: "#0D7A4F" }}>
                                  <CheckCircle2 size={12} /> Resolver
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Comentarios visibles también en las que NO son mías ni asignadas a mí (solo lectura). */}
                    {!iCreated(t) && t.assignee_id !== me?.id && Array.isArray(t.comments) && t.comments.length > 0 && (
                      <ul className="mb-2 space-y-1.5">
                        {t.comments.map((c, i) => (
                          <li key={i} className="rounded-md border p-2 text-xs" style={{ borderColor: border }}>
                            <span className="font-semibold">{c.author}</span> <span style={{ color: dim }}>· {String(c.at || "").slice(0, 10)}</span>
                            <p className="mt-0.5" style={{ color: dim }}>{c.text}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!iCreated(t) && t.assignee_id !== me?.id && (
                      <p className="text-[11px]" style={{ color: dim }}>Solo lectura — esta actividad no la creaste tú.</p>
                    )}
                    {/* Controles de RESPONSABLE (estado + comentario + guardar): solo si la tarea es tuya. */}
                    {t.assignee_id === me?.id && (() => {
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

      {/* Aviso: la pantalla lleva horas abierta; conviene actualizar por si hubo cambios */}
      {staleWarn && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) setStaleWarn(false); }}>
          <div className="w-full max-w-sm rounded-md p-4 shadow-xl" style={{ background: card, color: text }}>
            <h3 className="text-sm font-semibold"><Bell size={14} className="mr-1 inline align-[-2px]" style={{ color: "#B76E00" }} /> Actualiza la base de datos</h3>
            <p className="mt-1 text-xs" style={{ color: dim }}>Llevas más de 2 horas con esta pantalla abierta. Puede haber tareas nuevas, cambios solicitados o actualizaciones. Refresca para verlas.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => load()} className="flex-1 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "#17727A" }}>Actualizar ahora</button>
              <button type="button" onClick={() => setStaleWarn(false)} className="rounded-md border px-3 py-2 text-sm font-semibold" style={{ borderColor: border, color: dim }}>Ahora no</button>
            </div>
          </div>
        </div>
      )}

      {/* Popup: resolver un cambio solicitado (marca resuelto + envía a revisión) */}
      {crResolve && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4" onClick={(e) => { if (e.target === e.currentTarget) setCrResolve(null); }}>
          <div className="w-full max-w-sm rounded-md p-4 shadow-xl" style={{ background: card, color: text }}>
            <h3 className="text-sm font-semibold">Marcar cambio como resuelto</h3>
            <p className="mt-0.5 text-xs" style={{ color: dim }}>Se enviará la tarea a revisión para que el administrador lo verifique.</p>
            <div className="mt-2 rounded-md border p-2 text-xs" style={{ borderColor: border }}>
              <span className="rounded px-1.5 py-0.5 text-[10px] font-bold" style={crResolve.cr.by === "cliente" ? { background: "#EAF2FB", color: "#1D5A99" } : { background: "#FFF7E6", color: "#B54708" }}>{crResolve.cr.by === "cliente" ? "Cliente" : "CEO"}</span>
              <p className="mt-0.5" style={{ color: text }}>{crResolve.cr.text}</p>
            </div>
            <textarea value={crComment} onChange={(e) => setCrComment(e.target.value)} rows={3} placeholder="Comentario (opcional): cómo lo resolviste…"
              className="mt-2 w-full rounded-md border px-2 py-1.5 text-sm outline-none" style={{ borderColor: border, background: dark ? "#1B232E" : "#fff", color: text }} />
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={confirmResolveCR} className="flex-1 rounded-md px-3 py-2 text-sm font-semibold text-white" style={{ background: "#0D7A4F" }}>Resuelto y enviar a revisión</button>
              <button type="button" onClick={() => setCrResolve(null)} className="rounded-md border px-3 py-2 text-sm font-semibold" style={{ borderColor: border, color: dim }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
