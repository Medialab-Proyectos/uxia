// Función serverless (Vercel): registra la suscripción push del dispositivo del EMPLEADO o del
// CEO (cualquier usuario autenticado). Guarda { endpoint, subscription, email, company_id } en
// push_subscriptions con service_role (que NUNCA llega al navegador). El cron api/notify-cron la
// usa para enviar avisos de vencimientos, novedades del MD y peticiones de revisión.
//
// POST /api/push-subscribe  { subscription, companyId }   (Authorization: Bearer <token del usuario>)

const URL = String(process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  if (!URL || !SERVICE) { res.status(500).json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }); return; }

  // 1) Identificar al usuario por su token (cualquier sesión válida sirve; el aviso es para él).
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Sin sesión" }); return; }
  const userRes = await fetch(`${URL}/auth/v1/user`, { headers: { apikey: ANON || SERVICE, Authorization: `Bearer ${token}` } });
  if (!userRes.ok) { res.status(401).json({ error: "Sesión inválida" }); return; }
  const user = await userRes.json();
  const email = String(user?.email || "").toLowerCase();

  // 2) Leer el cuerpo.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const subscription = body.subscription;
  const endpoint = subscription && subscription.endpoint;
  const companyId = String(body.companyId || user?.user_metadata?.company_id || "").trim() || null;
  if (!endpoint) { res.status(400).json({ error: "Falta la suscripción" }); return; }

  // 3) Upsert por endpoint (un registro por dispositivo).
  const up = await fetch(`${URL}/rest/v1/push_subscriptions?on_conflict=endpoint`, {
    method: "POST",
    headers: {
      apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({ endpoint, email, company_id: companyId, subscription }),
  });
  if (!up.ok) { const t = await up.text(); res.status(up.status).json({ error: t || "No se pudo registrar" }); return; }
  res.status(200).json({ ok: true });
}
