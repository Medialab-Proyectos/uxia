// Función serverless (Vercel): crea o resetea la cuenta de acceso de un EMPLEADO en
// Supabase Auth (email + contraseña) usando el service_role — que NUNCA se expone al
// navegador. Solo la puede invocar el CEO (se verifica su token contra CEO_EMAIL).
//
// POST /api/employee  { email, password }   (Authorization: Bearer <token del CEO>)
//  → crea el usuario si no existe, o le fija la contraseña si ya existe.

const URL = String(process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const CEO_EMAILS = String(process.env.CEO_EMAIL || process.env.VITE_CEO_EMAIL || "")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

async function svc(path, { method = "GET", body } = {}) {
  const res = await fetch(`${URL}/auth/v1/${path}`, {
    method,
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

export default async function handler(req, res) {
  if (req.method !== "POST") { res.status(405).json({ error: "Método no permitido" }); return; }
  if (!URL || !SERVICE) { res.status(500).json({ error: "Faltan SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY" }); return; }

  // 1) Verificar que quien llama es el CEO (token válido + email en la lista).
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) { res.status(401).json({ error: "Sin sesión" }); return; }
  const userRes = await fetch(`${URL}/auth/v1/user`, {
    headers: { apikey: ANON || SERVICE, Authorization: `Bearer ${token}` },
  });
  if (!userRes.ok) { res.status(401).json({ error: "Sesión inválida" }); return; }
  const caller = await userRes.json();
  const callerEmail = String(caller?.email || "").toLowerCase();
  if (CEO_EMAILS.length && !CEO_EMAILS.includes(callerEmail)) {
    res.status(403).json({ error: "Solo el administrador puede gestionar accesos" }); return;
  }

  // 2) Leer el cuerpo.
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  // Empresa del empleado (login por empresa): el empleado externo solo accede a SU empresa.
  const companyId = String(body.companyId || "").trim();
  const personId = String(body.personId || "").trim();
  if (!email || !password) { res.status(400).json({ error: "Correo y contraseña son obligatorios" }); return; }
  if (password.length < 6) { res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" }); return; }

  // Deja registrada la empresa del empleado en people.company_id (si vino personId), vía REST + service_role.
  async function bindCompany() {
    if (!companyId || !personId) return;
    try {
      await fetch(`${URL}/rest/v1/people?id=eq.${encodeURIComponent(personId)}`, {
        method: "PATCH",
        headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ company_id: companyId }),
      });
    } catch { /* no crítico */ }
  }

  // 3) Buscar si el usuario ya existe (por email) y crear o actualizar la contraseña.
  const list = await svc(`admin/users?page=1&per_page=200`);
  const existing = (list.data?.users || list.data || []).find?.((u) => String(u.email || "").toLowerCase() === email);
  if (existing) {
    const upd = await svc(`admin/users/${existing.id}`, { method: "PUT", body: { password, email_confirm: true, user_metadata: { ...(existing.user_metadata || {}), role: "employee", company_id: companyId || existing.user_metadata?.company_id || null } } });
    if (!upd.ok) { res.status(upd.status).json({ error: upd.data?.msg || "No se pudo actualizar la contraseña" }); return; }
    await bindCompany();
    res.status(200).json({ ok: true, created: false, userId: existing.id });
    return;
  }
  const created = await svc(`admin/users`, { method: "POST", body: { email, password, email_confirm: true, user_metadata: { role: "employee", company_id: companyId || null } } });
  if (!created.ok) { res.status(created.status).json({ error: created.data?.msg || "No se pudo crear el acceso" }); return; }
  await bindCompany();
  res.status(200).json({ ok: true, created: true, userId: created.data?.id });
}
