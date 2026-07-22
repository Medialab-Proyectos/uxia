// Función serverless (Vercel): envía una notificación push INSTANTÁNEA por un evento puntual.
// La disparan el propio navegador (con el token del usuario) o los scripts del MD (con CRON_SECRET).
//
// POST /api/notify-event  { type, taskId, message? }
//   Auth: Authorization: Bearer <token de usuario>  ó  Bearer <CRON_SECRET>
//
// Tipos y destinatario:
//   - "assigned" | "updated" | "cr-opened" | "md-touched"  → al RESPONSABLE de la tarea (assignee).
//   - "review" | "cr-resolved"                             → al CEO/admin.
// El cuerpo del mensaje se arma según el tipo con el título de la tarea.

import webpush from "web-push";

const URL = String(process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || process.env.VITE_VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:hello@medialab.design";
const CRON_SECRET = process.env.CRON_SECRET || "";
const CEO_EMAILS = String(process.env.CEO_EMAIL || process.env.VITE_CEO_EMAIL || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const rest = (path) => fetch(`${URL}/rest/v1/${path}`, { headers: H }).then((r) => (r.ok ? r.json() : []));

const MSG = {
  assigned:     (t) => ({ title: "Nueva tarea asignada", body: t }),
  updated:      (t) => ({ title: "Tarea actualizada", body: t }),
  "md-touched": (t) => ({ title: "El MD complementó tu tarea", body: t }),
  "cr-opened":  (t) => ({ title: "Cambios solicitados", body: t }),
  review:       (t) => ({ title: "Tarea en revisión", body: `${t} · pasó a tu revisión` }),
  "cr-resolved":(t) => ({ title: "Cambio resuelto", body: `${t} · el empleado resolvió el cambio` }),
};

async function sendToEmails(emails, payload) {
  const list = [...new Set(emails.map((e) => String(e || "").toLowerCase()).filter(Boolean))];
  if (list.length === 0) return { sent: 0, removed: 0 };
  const inList = list.map((e) => `"${e}"`).join(",");
  const subs = await rest(`push_subscriptions?email=in.(${encodeURIComponent(inList)})&select=endpoint,subscription`);
  let sent = 0, removed = 0;
  for (const s of (Array.isArray(subs) ? subs : [])) {
    try { await webpush.sendNotification(s.subscription, JSON.stringify(payload)); sent++; }
    catch (err) {
      if (err && (err.statusCode === 404 || err.statusCode === 410)) {
        await fetch(`${URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`, { method: "DELETE", headers: H });
        removed++;
      }
    }
  }
  return { sent, removed };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  if (!URL || !SERVICE) { res.status(500).json({ error: "Faltan SUPABASE_URL / SERVICE" }); return; }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) { res.status(200).json({ ok: true, skipped: "sin VAPID" }); return; }

  // Auth: token de usuario válido O el secreto del cron (para los scripts del MD).
  const auth = String(req.headers.authorization || "");
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  let authorized = false;
  if (CRON_SECRET && bearer === CRON_SECRET) authorized = true;
  if (!authorized && bearer) {
    const u = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON || SERVICE, Authorization: `Bearer ${bearer}` } });
    authorized = u.ok;
  }
  if (!authorized) { res.status(401).json({ error: "No autorizado" }); return; }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const type = String(body.type || "");
  const taskId = String(body.taskId || "");
  if (!MSG[type]) { res.status(400).json({ error: "Tipo inválido" }); return; }

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  // Resuelve la tarea (título + responsable) para armar el mensaje y el destinatario.
  let title = String(body.message || "una tarea");
  let recipients = [];
  if (taskId) {
    const rows = await rest(`tasks?id=eq.${encodeURIComponent(taskId)}&select=title,assignee_id`);
    const task = Array.isArray(rows) ? rows[0] : null;
    if (task) {
      title = task.title || title;
      const toAssignee = ["assigned", "updated", "cr-opened", "md-touched"].includes(type);
      if (toAssignee && task.assignee_id) {
        const p = await rest(`people?id=eq.${encodeURIComponent(task.assignee_id)}&select=email`);
        const email = Array.isArray(p) && p[0] ? p[0].email : "";
        if (email) recipients = [email];
      }
    }
  }
  if (["review", "cr-resolved"].includes(type)) recipients = CEO_EMAILS;

  const { title: ntitle, body: nbody } = MSG[type](title);
  const result = await sendToEmails(recipients, { title: ntitle, body: nbody, url: "/", tag: `uxia-${type}` });
  res.status(200).json({ ok: true, ...result });
}
