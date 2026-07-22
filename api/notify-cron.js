// Cron serverless (Vercel): envía el resumen de pendientes por push a cada dispositivo suscrito.
// Corre 1 vez al día (ver vercel.json → crons). Para cada persona con suscripción:
//   - Empleado: tareas vencidas, por vencer (≤2 días), nuevas y actualizadas por el MD, y
//     cambios solicitados (change_requests abiertos).
//   - CEO/admin: además, cuántas tareas esperan su revisión (status = "review").
// Requiere VAPID (VAPID_PRIVATE_KEY + VAPID_SUBJECT en el servidor; clave pública compartida) y la
// tabla push_subscriptions. Protegido por CRON_SECRET (Vercel lo manda como Authorization Bearer).

import webpush from "web-push";

const URL = String(process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@medialab.design";
const CRON_SECRET = process.env.CRON_SECRET || "";
const CEO_EMAILS = String(process.env.CEO_EMAIL || process.env.VITE_CEO_EMAIL || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const rest = (path) => fetch(`${URL}/rest/v1/${path}`, { headers: H }).then((r) => (r.ok ? r.json() : []));

const todayIso = () => new Date().toISOString().slice(0, 10);
const openCRs = (t) => (Array.isArray(t.change_requests) ? t.change_requests : []).filter((c) => !c.resolved);
const isNew = (t) => !t.assignee_seen_at && openCRs(t).length === 0;
const isUpdated = (t) => openCRs(t).length === 0 && t.assignee_seen_at && t.admin_touched_at && new Date(t.admin_touched_at) > new Date(t.assignee_seen_at);
const activeOverdue = (t) => t.due_date && t.due_date < todayIso() && t.status !== "review" && t.status !== "verificacion";
const dueSoon = (t) => { if (!t.due_date) return false; const d = Math.round((new Date(t.due_date) - new Date(todayIso())) / 86400000); return d >= 0 && d <= 2; };

export default async function handler(req, res) {
  // Protección: si hay CRON_SECRET, exigirlo (Vercel Cron lo envía como Bearer).
  if (CRON_SECRET) {
    const auth = String(req.headers.authorization || "");
    if (auth !== `Bearer ${CRON_SECRET}`) { res.status(401).json({ error: "No autorizado" }); return; }
  }
  if (!URL || !SERVICE) { res.status(500).json({ error: "Faltan SUPABASE_URL / SERVICE" }); return; }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) { res.status(500).json({ error: "Falta configurar VAPID (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)" }); return; }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  const subs = await rest("push_subscriptions?select=endpoint,email,subscription");
  if (!Array.isArray(subs) || subs.length === 0) { res.status(200).json({ ok: true, sent: 0, note: "sin suscripciones" }); return; }

  // Agrupa dispositivos por correo.
  const byEmail = new Map();
  for (const s of subs) { const e = String(s.email || "").toLowerCase(); if (!e) continue; if (!byEmail.has(e)) byEmail.set(e, []); byEmail.get(e).push(s); }

  const people = await rest("people?select=id,email");
  const personByEmail = new Map((people || []).map((p) => [String(p.email || "").toLowerCase(), p.id]));

  let sent = 0, removed = 0;
  for (const [email, devices] of byEmail) {
    const isCeo = CEO_EMAILS.includes(email);
    let title = "", body = "", parts = [];

    if (isCeo) {
      const review = await rest(`tasks?status=eq.review&select=id`);
      const overdue = await rest(`tasks?status=neq.done&due_date=lt.${todayIso()}&select=id`);
      if (Array.isArray(review) && review.length) parts.push(`${review.length} esperan tu revisión`);
      if (Array.isArray(overdue) && overdue.length) parts.push(`${overdue.length} vencidas`);
      title = "Centro de Operaciones";
    } else {
      const pid = personByEmail.get(email);
      if (!pid) continue;
      const tasks = await rest(`tasks?assignee_id=eq.${encodeURIComponent(pid)}&status=neq.done&select=id,status,due_date,assignee_seen_at,admin_touched_at,change_requests`);
      const list = Array.isArray(tasks) ? tasks : [];
      const overdue = list.filter(activeOverdue).length;
      const soon = list.filter((t) => !activeOverdue(t) && dueSoon(t)).length;
      const nuevas = list.filter(isNew).length;
      const actualizadas = list.filter(isUpdated).length;
      const cr = list.filter((t) => openCRs(t).length > 0).length;
      if (overdue) parts.push(`${overdue} vencida${overdue > 1 ? "s" : ""}`);
      if (soon) parts.push(`${soon} por vencer`);
      if (nuevas) parts.push(`${nuevas} nueva${nuevas > 1 ? "s" : ""}`);
      if (actualizadas) parts.push(`${actualizadas} actualizada${actualizadas > 1 ? "s" : ""}`);
      if (cr) parts.push(`${cr} con cambios solicitados`);
      title = "Tus tareas";
    }

    if (parts.length === 0) continue; // nada que avisar
    body = parts.join(" · ");

    for (const d of devices) {
      try {
        await webpush.sendNotification(d.subscription, JSON.stringify({ title, body, url: "/", tag: "uxia-digest" }));
        sent++;
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          await fetch(`${URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(d.endpoint)}`, { method: "DELETE", headers: H });
          removed++;
        }
      }
    }
    // Marca la última notificación (para futuras mejoras de dedup por novedad).
    await fetch(`${URL}/rest/v1/push_subscriptions?email=eq.${encodeURIComponent(email)}`, {
      method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify({ last_notified_at: new Date().toISOString() }),
    });
  }

  res.status(200).json({ ok: true, sent, removed });
}
