// Capa de datos DIRECTA a Supabase desde el navegador (sin servidor intermediario).
// Usa la llave pública (anon) + el access_token del usuario autenticado; el acceso
// lo autorizan las políticas RLS (ver supabase/rls-policies.sql).

const URL = (import.meta.env.VITE_SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const BUCKET = import.meta.env.VITE_SUPABASE_BUCKET || "operations-documents";

export function opsDataReady() {
  return Boolean(URL && ANON);
}

async function rest(token, path, { method = "GET", body, query = "", prefer = "" } = {}) {
  const response = await fetch(`${URL}/rest/v1/${path}${query}`, {
    method,
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token || ANON}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Supabase ${response.status}`);
    error.detail = data;
    throw error;
  }
  return data;
}

// ---------- helpers de forma ----------
const asArray = (v) => (Array.isArray(v) ? v : []);
const asObject = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});
const isUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(v || ""));

function normalizeBoardConfig(value) {
  if (!value) return { tool: "No aplica", url: "" };
  if (typeof value === "object") return { tool: value.tool || "No aplica", url: value.url || "" };
  const text = String(value);
  const url = text.match(/https?:\/\/\S+/i)?.[0] || "";
  const toolMatch = text.match(/^\s*([^:\n]+):/);
  return { tool: toolMatch?.[1]?.trim() || (url ? "Otro" : "No aplica"), url };
}

// ---------- mapeos fila <-> app ----------
const rowToTask = (row) => ({
  id: row.id, companyId: row.company_id, client: row.client || "", title: row.title,
  status: row.status, priority: row.priority, role: row.role || "", owner: row.owner || "",
  assigneeId: row.assignee_id || "", dueDate: row.due_date || "", deliveryDate: row.delivery_date || "",
  source: row.source || "", audience: row.audience || "Interno MediaLab", syncMode: row.sync_mode || "Manual",
  evidence: row.evidence || "", description: row.description || "", userStory: row.user_story || "",
  acceptanceCriteria: asArray(row.acceptance_criteria), attachments: asArray(row.attachments),
  emailTo: row.email_to || "", emailSubject: row.email_subject || "", createdAt: row.created_at || "",
  completedAt: row.completed_at || "", workedHours: row.worked_hours ?? null, category: row.category || "",
});

const taskToRow = (task) => ({
  id: task.id, company_id: task.companyId || "metrics-lab", client: task.client || "",
  title: task.title || "Tarea sin titulo", status: task.status || "ready", priority: task.priority || "media",
  role: task.role || "", owner: task.owner || "", assignee_id: task.assigneeId || null,
  due_date: task.dueDate || null, delivery_date: task.deliveryDate || null, source: task.source || "",
  audience: task.audience || "Interno MediaLab", sync_mode: task.syncMode || "Manual", evidence: task.evidence || "",
  description: task.description || "", user_story: task.userStory || "", acceptance_criteria: asArray(task.acceptanceCriteria),
  attachments: asArray(task.attachments), email_to: task.emailTo || "", email_subject: task.emailSubject || "",
  completed_at: task.completedAt || null, worked_hours: task.workedHours ?? null,
  category: task.category || null,
  created_at: task.createdAt || new Date().toISOString(),
});

const rowToPerson = (row) => ({
  id: row.id, name: row.name, email: row.email || "", phone: row.phone || "",
  type: row.type || "Empleado MediaLab", chatUrl: row.chat_url || "", contactMethod: row.contact_method || "auto",
});
const personToRow = (p) => ({
  id: p.id, name: p.name || "Persona sin nombre", email: p.email || "", phone: p.phone || "",
  type: p.type || "Empleado MediaLab", chat_url: p.chatUrl || "", contact_method: p.contactMethod || "auto",
});

const rowToSourceRecord = (row) => ({
  id: row.id, companyId: row.company_id, client: row.client || "", source: row.source || "",
  fileName: row.file_name || "", processedAt: row.processed_at || row.created_at || "", summary: row.summary || "",
  taskIds: asArray(row.task_ids), taskCount: row.task_count || 0, attachments: asArray(row.attachments),
  rawText: row.raw_text || "", deletedSource: Boolean(row.deleted_source),
});
const sourceRecordToRow = (r) => ({
  id: isUuid(r.id) ? r.id : undefined, company_id: r.companyId || "metrics-lab", client: r.client || "",
  source: r.source || "", file_name: r.fileName || r.source || "fuente", storage_path: r.storagePath || r.path || "",
  status: r.processedAt ? "processed" : "uploaded", task_ids: asArray(r.taskIds), task_count: r.taskCount || 0,
  attachments: asArray(r.attachments), summary: r.summary || "", raw_text: r.rawText || "",
  deleted_source: Boolean(r.deletedSource), processed_at: r.processedAt || null,
});

// ---------- estado completo ----------
export async function loadState(token) {
  const [companyRows, projectRows, taskRows, peopleRows, sourceRows, appRows] = await Promise.all([
    rest(token, "companies", { query: "?select=*&order=name.asc" }),
    rest(token, "projects", { query: "?select=*&order=created_at.asc" }),
    rest(token, "tasks", { query: "?select=*&order=created_at.desc" }),
    rest(token, "people", { query: "?select=*&order=created_at.asc" }),
    rest(token, "source_documents", { query: "?select=*&order=created_at.desc" }),
    rest(token, "app_state", { query: "?select=*&id=eq.operations&limit=1" }),
  ]);

  const projectsByCompany = new Map();
  for (const project of projectRows || []) {
    const list = projectsByCompany.get(project.company_id) || [];
    list.push(project);
    projectsByCompany.set(project.company_id, list);
  }

  const companies = (companyRows || []).map((company) => {
    const projects = projectsByCompany.get(company.id) || [];
    const archivedClients = {};
    const projectLinks = {};
    const projectDescriptions = {};
    for (const project of projects) {
      archivedClients[project.name] = project.status === "archived";
      projectLinks[project.name] = { tool: project.board_tool || "No aplica", url: project.board_url || "" };
      projectDescriptions[project.name] = project.description || "";
    }
    return {
      id: company.id, name: company.name, status: company.status || "activa", owner: company.owner || "MediaLab",
      workspaces: asArray(company.workspaces), clients: projects.map((p) => p.name),
      archivedClients: { ...asObject(company.archived_clients), ...archivedClients },
      projectLinks: { ...asObject(company.project_links), ...projectLinks },
      projectDescriptions: { ...asObject(company.project_descriptions), ...projectDescriptions },
      contextDocuments: asObject(company.context_documents), logo: company.logo || null,
      projectImages: asObject(company.project_images),
      scope: asArray(company.scope),
      connectors: asArray(company.connectors),
    };
  });

  return {
    companies,
    tasks: (taskRows || []).map(rowToTask),
    sourceRecords: (sourceRows || []).map(rowToSourceRecord),
    people: (peopleRows || []).map(rowToPerson),
    activeCompany: appRows?.[0]?.active_company || companies[0]?.id || "metrics-lab",
    updatedAt: appRows?.[0]?.updated_at || new Date().toISOString(),
  };
}

// Upsert que, si la base aún NO tiene una columna nueva, reintenta guardando lo esencial
// (quita solo las columnas opcionales que fallan) en vez de romper TODO el guardado.
// Devuelve un aviso si tuvo que degradar, para mostrarlo en la UI.
async function upsertResilient(token, path, rows, optionalCols = []) {
  const prefer = "resolution=merge-duplicates,return=minimal";
  try {
    await rest(token, path, { method: "POST", body: rows, prefer });
    return "";
  } catch (e) {
    const msg = String(e?.message || "") + " " + JSON.stringify(e?.detail || "");
    if (optionalCols.length && /column|does not exist|schema cache|PGRST204|Could not find/i.test(msg)) {
      const stripped = rows.map((r) => {
        const copy = { ...r };
        for (const col of optionalCols) delete copy[col];
        return copy;
      });
      await rest(token, path, { method: "POST", body: stripped, prefer });
      return `Faltan columnas nuevas en la base (${optionalCols.join(", ")}). Corre supabase/setup.sql para que se guarden.`;
    }
    throw e;
  }
}

export async function saveState(token, state) {
  const updatedAt = new Date().toISOString();
  const companies = asArray(state.companies);
  const people = asArray(state.people);
  const tasks = asArray(state.tasks);
  const sourceRecords = asArray(state.sourceRecords);
  const warnings = [];

  const companyRows = companies.map((c) => ({
    id: c.id, name: c.name, status: c.status || "activa", owner: c.owner || "MediaLab",
    workspaces: asArray(c.workspaces), archived_clients: asObject(c.archivedClients),
    project_links: asObject(c.projectLinks), project_descriptions: asObject(c.projectDescriptions),
    context_documents: asObject(c.contextDocuments), logo: c.logo || null, connectors: asArray(c.connectors),
    project_images: asObject(c.projectImages), scope: asArray(c.scope),
    updated_at: updatedAt,
  }));
  if (companyRows.length) {
    const w = await upsertResilient(token, "companies?on_conflict=id", companyRows, ["project_images", "scope"]);
    if (w) warnings.push(w);
  }

  const projectRows = companies.flatMap((c) => asArray(c.clients).map((client) => ({
    company_id: c.id, name: client, status: c.archivedClients?.[client] ? "archived" : "activo",
    board_tool: normalizeBoardConfig(c.projectLinks?.[client]).tool,
    board_url: normalizeBoardConfig(c.projectLinks?.[client]).url,
    description: c.projectDescriptions?.[client] || "",
  })));
  if (projectRows.length) {
    await rest(token, "projects?on_conflict=company_id,name", { method: "POST", body: projectRows, prefer: "resolution=merge-duplicates,return=minimal" });
  }

  const peopleRows = people.filter((p) => p.id).map(personToRow);
  if (peopleRows.length) {
    await rest(token, "people?on_conflict=id", { method: "POST", body: peopleRows, prefer: "resolution=merge-duplicates,return=minimal" });
  }
  await deleteMissing(token, "people", new Set(peopleRows.map((r) => String(r.id))));

  const taskRows = tasks.filter((t) => t.id).map(taskToRow);
  if (taskRows.length) {
    const w = await upsertResilient(token, "tasks?on_conflict=id", taskRows, ["category", "completed_at", "worked_hours"]);
    if (w) warnings.push(w);
  }
  await deleteMissing(token, "tasks", new Set(taskRows.map((r) => String(r.id))));

  const sourceRows = sourceRecords.map(sourceRecordToRow);
  const withId = sourceRows.filter((r) => r.id);
  const withoutId = sourceRows.map(({ id, ...rest }) => rest).filter((_, i) => !sourceRows[i].id);
  if (withId.length) {
    await rest(token, "source_documents?on_conflict=id", { method: "POST", body: withId, prefer: "resolution=merge-duplicates,return=minimal" });
  }
  if (withoutId.length) {
    await rest(token, "source_documents", { method: "POST", body: withoutId, prefer: "return=minimal" });
  }
  await rest(token, "source_documents?task_count=eq.0", { method: "DELETE", prefer: "return=minimal" });

  await rest(token, "app_state?on_conflict=id", {
    method: "POST",
    body: [{ id: "operations", active_company: state.activeCompany, updated_at: updatedAt }],
    prefer: "resolution=merge-duplicates,return=minimal",
  });

  return { updatedAt, warning: warnings.length ? [...new Set(warnings)].join(" ") : "" };
}

async function deleteMissing(token, table, keepIds) {
  const existing = await rest(token, table, { query: "?select=id" });
  const stale = asArray(existing).map((r) => r.id).filter((id) => id && !keepIds.has(String(id)));
  const clean = [...new Set(stale.map(String))];
  for (let i = 0; i < clean.length; i += 50) {
    const batch = clean.slice(i, i + 50).map((id) => `"${id.replace(/"/g, "")}"`).join(",");
    await rest(token, `${table}?id=in.(${batch})`, { method: "DELETE", prefer: "return=minimal" });
  }
}

// ---------- Storage ----------
function guessContentType(name) {
  const ext = (String(name).match(/\.[a-z0-9]+$/i)?.[0] || "").toLowerCase();
  return ({ ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp",
    ".gif": "image/gif", ".svg": "image/svg+xml", ".pdf": "application/pdf", ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8", ".csv": "text/csv; charset=utf-8" })[ext] || "application/octet-stream";
}

function slug(value) {
  return String(value || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "x";
}
function safeName(name) {
  return String(name || `archivo-${Date.now()}`).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.\-]+/g, "_");
}

async function uploadToBucket(token, objectPath, file, contentType) {
  const clean = String(objectPath).replace(/^\/+/, "");
  const response = await fetch(`${URL}/storage/v1/object/${BUCKET}/${clean}`, {
    method: "POST",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token || ANON}`,
      "Content-Type": contentType || file.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: file,
  });
  if (!response.ok) {
    const t = await response.text().catch(() => "");
    throw new Error(`Storage ${response.status}: ${t || "no se pudo subir"}`);
  }
  return clean;
}
function publicUrl(objectPath) {
  return `${URL}/storage/v1/object/public/${BUCKET}/${String(objectPath).replace(/^\/+/, "")}`;
}

export async function saveTaskAttachment(token, { companyId, client, file }) {
  const path = `task-docs/${slug(companyId)}/${slug(client)}/${Date.now()}-${safeName(file.name)}`;
  await uploadToBucket(token, path, file, file.type || guessContentType(file.name));
  return { type: "file", label: file.name, path, url: publicUrl(path), storage: "supabase", uploadedAt: new Date().toISOString() };
}
export async function saveCompanyLogo(token, { companyId, file }) {
  const path = `logos/${slug(companyId)}/${Date.now()}-${safeName(file.name)}`;
  await uploadToBucket(token, path, file, file.type || guessContentType(file.name));
  return { label: file.name, path, url: publicUrl(path), storage: "supabase", uploadedAt: new Date().toISOString() };
}
export async function saveProjectImage(token, { companyId, client, file }) {
  const path = `project-images/${slug(companyId)}/${client ? slug(client) : "_empresa"}/${Date.now()}-${safeName(file.name)}`;
  await uploadToBucket(token, path, file, file.type || guessContentType(file.name));
  return { label: file.name, path, url: publicUrl(path), storage: "supabase", uploadedAt: new Date().toISOString() };
}
export async function saveContextDocument(token, { companyId, client, file }) {
  const readable = /\.(md|txt)$/i.test(file.name);
  const path = `context/${slug(companyId)}/${client ? slug(client) : "_empresa"}/${Date.now()}-${safeName(file.name)}`;
  await uploadToBucket(token, path, file, file.type || guessContentType(file.name));
  return { type: "context", label: file.name, companyId, client, path, url: publicUrl(path), readable, storage: "supabase", uploadedAt: new Date().toISOString() };
}

// ---------- insumos pendientes ----------
const mapInsumo = (row) => ({
  id: row.id, companyId: row.company_id, client: row.client || "", fileName: row.file_name,
  storagePath: row.storage_path, url: publicUrl(row.storage_path), contentType: row.content_type || "",
  kind: row.kind || "imagen", rawText: row.raw_text || "", status: row.status || "pendiente", createdAt: row.created_at || "",
});

export async function listInsumos(token, companyId) {
  const filter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";
  const rows = await rest(token, "insumos_pendientes", { query: `?status=eq.pendiente${filter}&select=*&order=created_at.desc` });
  return (rows || []).map(mapInsumo);
}

export async function saveInsumo(token, { companyId, client, file, kind = "imagen", rawText = "" }) {
  const type = file.type || guessContentType(file.name);
  const path = `insumos/${slug(companyId)}/${slug(client)}/${Date.now()}-${safeName(file.name)}`;
  await uploadToBucket(token, path, file, type);
  const inserted = await rest(token, "insumos_pendientes", {
    method: "POST",
    body: [{ company_id: companyId || "sin-empresa", client: client || null, file_name: file.name,
      storage_path: path, content_type: type, kind, raw_text: rawText || null, status: "pendiente" }],
    prefer: "return=representation",
  });
  return mapInsumo(inserted?.[0] || { company_id: companyId, client, file_name: file.name, storage_path: path, content_type: type, kind });
}

export async function deleteInsumo(token, id, { keepFile = false } = {}) {
  if (!id) return;
  if (!keepFile) {
    const rows = await rest(token, "insumos_pendientes", { query: `?id=eq.${encodeURIComponent(id)}&select=storage_path` });
    const p = rows?.[0]?.storage_path;
    if (p) {
      await fetch(`${URL}/storage/v1/object/${BUCKET}/${p}`, {
        method: "DELETE",
        headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}` },
      }).catch(() => {});
    }
  }
  await rest(token, "insumos_pendientes", { method: "DELETE", query: `?id=eq.${encodeURIComponent(id)}`, prefer: "return=minimal" });
}

// ---------- oportunidades (Radar) — la app SOLO lee y da seguimiento ----------
const mapOportunidad = (row) => ({ ...(row.data || {}), id: row.id, score: row.score, estado: row.estado, createdAt: row.created_at });

export async function listOportunidades(token) {
  const rows = await rest(token, "oportunidades", { query: "?select=*&order=score.desc" });
  return (rows || []).map(mapOportunidad);
}

export async function updateOportunidad(token, id, patch) {
  await rest(token, `oportunidades?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...(patch.estado ? { estado: patch.estado } : {}), updated_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
}

// ---------- vacantes (Radar empleos) — la app SOLO lee y da seguimiento ----------
const mapVacante = (row) => ({ ...(row.data || {}), id: row.id, score: row.score, estado: row.estado, createdAt: row.created_at });

export async function listVacantes(token) {
  const rows = await rest(token, "vacantes", { query: "?select=*&order=score.desc" });
  return (rows || []).map(mapVacante);
}

export async function updateVacante(token, id, patch) {
  await rest(token, `vacantes?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: { ...(patch.estado ? { estado: patch.estado } : {}), updated_at: new Date().toISOString() },
    prefer: "return=minimal",
  });
}

export async function deleteVacante(token, id) {
  await rest(token, `vacantes?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
}
export async function deleteOportunidad(token, id) {
  await rest(token, `oportunidades?id=eq.${encodeURIComponent(id)}`, { method: "DELETE", prefer: "return=minimal" });
}
