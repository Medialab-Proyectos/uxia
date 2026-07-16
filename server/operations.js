import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { execFile } from "node:child_process";
import { basename, dirname, extname, join, relative, resolve } from "node:path";
import { platform, tmpdir } from "node:os";

const OPERATIONS_DIR = resolve(process.env.UXIA_OPERATIONS_DIR || (process.env.VERCEL ? join(tmpdir(), "uxia-operations") : join(process.cwd(), "operations")));
const INBOX_DIR = resolve(OPERATIONS_DIR, "inbox");
const STATE_FILE = resolve(OPERATIONS_DIR, "state.json");
const SUPABASE_BUCKET = process.env.SUPABASE_BUCKET || "operations-documents";
const MAX_TASK_UPLOAD_BYTES = 1024 * 1024;

export const companies = [
  {
    id: "metrics-lab",
    name: "Metrics Lab",
    status: "activa",
    owner: "MediaLab",
    workspaces: ["Documentacion"],
    clients: [],
    archivedClients: {},
    projectLinks: {},
    projectDescriptions: {},
    contextDocuments: {},
    logo: null,
    connectors: [],
  },
];

function hasSupabase() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function supabaseBaseUrl() {
  return String(process.env.SUPABASE_URL || "").replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

async function supabaseRequest(path, { method = "GET", body, query = "", prefer = "" } = {}) {
  const url = `${supabaseBaseUrl()}/rest/v1/${path}${query}`;
  const response = await fetch(url, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || `Supabase error ${response.status}`);
    error.detail = data;
    throw error;
  }
  return data;
}

function guessContentType(name) {
  const ext = extname(String(name || "")).toLowerCase();
  return ({
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
  })[ext] || "application/octet-stream";
}

// Sube un archivo a Supabase Storage (bucket SUPABASE_BUCKET). Funciona igual en
// local y en Vercel; el filesystem deja de ser necesario para servir archivos.
async function uploadToBucket(objectPath, buffer, contentType) {
  const clean = String(objectPath).replace(/^\/+/, "");
  const url = `${supabaseBaseUrl()}/storage/v1/object/${SUPABASE_BUCKET}/${clean}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      "Content-Type": contentType || "application/octet-stream",
      "x-upsert": "true",
    },
    body: buffer,
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Supabase Storage ${response.status}: ${text || "no se pudo subir el archivo"}`);
  }
  return clean;
}

function bucketPublicUrl(objectPath) {
  const clean = String(objectPath).replace(/^\/+/, "");
  return `${supabaseBaseUrl()}/storage/v1/object/public/${SUPABASE_BUCKET}/${clean}`;
}

function localFileUrl(absoluteTarget) {
  const path = absoluteTarget.replace(process.cwd(), "").replace(/^[/\\]/, "");
  return {
    path,
    url: `/operations-files/${path.replace(/\\/g, "/").replace(/^operations\//, "")}`,
  };
}

async function deleteFromBucket(objectPath) {
  const clean = String(objectPath || "").replace(/^\/+/, "");
  if (!clean) return;
  const url = `${supabaseBaseUrl()}/storage/v1/object/${SUPABASE_BUCKET}/${clean}`;
  await fetch(url, {
    method: "DELETE",
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
    },
  }).catch(() => {});
}

// ---- Insumos pendientes (tabla dedicada insumos_pendientes) ----
function mapInsumoRow(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    client: row.client || "",
    fileName: row.file_name,
    storagePath: row.storage_path,
    url: bucketPublicUrl(row.storage_path),
    contentType: row.content_type || "",
    kind: row.kind || "imagen",
    rawText: row.raw_text || "",
    status: row.status || "pendiente",
    createdAt: row.created_at || "",
  };
}

export async function saveInsumoPendiente({ companyId, client, fileName, contentType, buffer, kind = "imagen", rawText = "" }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  const safeClient = slugify(client || "proyecto-general");
  const safeFile = sanitizeFileName(fileName || `insumo-${Date.now()}`);
  const type = contentType || guessContentType(safeFile);
  const objectPath = `insumos/${safeCompany}/${safeClient}/${Date.now()}-${safeFile}`;
  await uploadToBucket(objectPath, buffer, type);
  const inserted = await supabaseRequest("insumos_pendientes", {
    method: "POST",
    body: [{
      company_id: companyId || "sin-empresa",
      client: client || null,
      file_name: safeFile,
      storage_path: objectPath,
      content_type: type,
      kind,
      raw_text: rawText || null,
      status: "pendiente",
    }],
    prefer: "return=representation",
  });
  return mapInsumoRow(inserted?.[0] || { company_id: companyId, client, file_name: safeFile, storage_path: objectPath, content_type: type, kind });
}

export async function listInsumosPendientes({ companyId } = {}) {
  if (!hasSupabase()) return [];
  const filter = companyId ? `&company_id=eq.${encodeURIComponent(companyId)}` : "";
  const rows = await supabaseRequest("insumos_pendientes", {
    query: `?status=eq.pendiente${filter}&select=*&order=created_at.desc`,
  });
  return (rows || []).map(mapInsumoRow);
}

export async function deleteInsumoPendiente(id, { keepFile = false } = {}) {
  if (!hasSupabase() || !id) return { ok: false };
  // keepFile: cuando el insumo se convierte en tarea, la tarea se queda con el
  // archivo en Storage, así que se borra solo la fila pendiente (no el archivo).
  if (!keepFile) {
    const rows = await supabaseRequest("insumos_pendientes", {
      query: `?id=eq.${encodeURIComponent(id)}&select=storage_path`,
    });
    if (rows?.[0]?.storage_path) await deleteFromBucket(rows[0].storage_path);
  }
  await supabaseRequest("insumos_pendientes", {
    method: "DELETE",
    query: `?id=eq.${encodeURIComponent(id)}`,
    prefer: "return=minimal",
  });
  return { ok: true };
}

// Inserta/actualiza tareas en Supabase (usado por el run diario que corre Claude Code local).
export async function insertTasks(tasks = []) {
  if (!hasSupabase()) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  const rows = tasks.filter((task) => task.id).map(taskToRow);
  if (!rows.length) return { inserted: 0 };
  await supabaseRequest("tasks?on_conflict=id", {
    method: "POST",
    body: rows,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  return { inserted: rows.length };
}

function productSignalToRow(signal) {
  const now = new Date().toISOString();
  return {
    id: signal.id,
    company_id: signal.companyId || signal.company_id,
    client: signal.client || null,
    force: signal.force,
    intensity: signal.intensity != null ? Number(signal.intensity) : 0.4,
    weight: signal.weight != null ? Number(signal.weight) : null,
    title: signal.title || signal.force,
    evidence: signal.evidence || null,
    source: signal.source || "Run diario",
    status: signal.status || "activa",
    updated_at: now,
  };
}

// Señales de producto (mediciones que alimentan el modelo MDSSP). Upsert por id.
export async function insertProductSignals(signals = []) {
  if (!hasSupabase()) throw new Error("Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
  const rows = signals.filter((s) => s.force && (s.companyId || s.company_id)).map(productSignalToRow);
  if (!rows.length) return { inserted: 0 };
  await supabaseRequest("product_signals?on_conflict=id", {
    method: "POST",
    body: rows,
    prefer: "resolution=merge-duplicates,return=minimal",
  });
  return { inserted: rows.length };
}

async function deleteSupabaseRowsByIds(table, ids) {
  const cleanIds = [...new Set(ids.filter(Boolean).map(String))];
  const batchSize = 50;
  for (let index = 0; index < cleanIds.length; index += batchSize) {
    const batch = cleanIds.slice(index, index + batchSize);
    const filter = batch.map((id) => `"${id.replace(/"/g, "")}"`).join(",");
    await supabaseRequest(`${table}?id=in.(${filter})`, {
      method: "DELETE",
      prefer: "return=minimal",
    });
  }
}

async function deleteSupabaseRowsMissingFromState(table, nextIds) {
  const existingRows = await supabaseRequest(table, { query: "?select=id" });
  const staleIds = asArray(existingRows)
    .map((row) => row.id)
    .filter((id) => id && !nextIds.has(String(id)));
  await deleteSupabaseRowsByIds(table, staleIds);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function normalizeBoardConfig(value) {
  if (!value) return { tool: "No aplica", url: "" };
  if (typeof value === "object") {
    return { tool: value.tool || "No aplica", url: value.url || "" };
  }
  const text = String(value);
  const url = text.match(/https?:\/\/\S+/i)?.[0] || "";
  const toolMatch = text.match(/^\s*([^:\n]+):/);
  return { tool: toolMatch?.[1]?.trim() || (url ? "Otro" : "No aplica"), url };
}

function rowToTask(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    client: row.client || "",
    title: row.title,
    status: row.status,
    priority: row.priority,
    role: row.role || "",
    owner: row.owner || "",
    assigneeId: row.assignee_id || "",
    dueDate: row.due_date || "",
    deliveryDate: row.delivery_date || "",
    source: row.source || "",
    audience: row.audience || "Interno MediaLab",
    syncMode: row.sync_mode || "Manual",
    evidence: row.evidence || "",
    description: row.description || "",
    userStory: row.user_story || "",
    acceptanceCriteria: asArray(row.acceptance_criteria),
    attachments: asArray(row.attachments),
    emailTo: row.email_to || "",
    emailSubject: row.email_subject || "",
    createdAt: row.created_at || "",
  };
}

function taskToRow(task) {
  return {
    id: task.id,
    company_id: task.companyId || "metrics-lab",
    client: task.client || "",
    title: task.title || "Tarea sin titulo",
    status: task.status || "ready",
    priority: task.priority || "media",
    role: task.role || "",
    owner: task.owner || "",
    assignee_id: task.assigneeId || null,
    due_date: task.dueDate || null,
    delivery_date: task.deliveryDate || null,
    source: task.source || "",
    audience: task.audience || "Interno MediaLab",
    sync_mode: task.syncMode || "Manual",
    evidence: task.evidence || "",
    description: task.description || "",
    user_story: task.userStory || "",
    acceptance_criteria: asArray(task.acceptanceCriteria),
    attachments: asArray(task.attachments),
    email_to: task.emailTo || "",
    email_subject: task.emailSubject || "",
    category: task.category || null,
    created_at: task.createdAt || new Date().toISOString(),
  };
}

function rowToPerson(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email || "",
    phone: row.phone || "",
    type: row.type || "Empleado MediaLab",
    chatUrl: row.chat_url || "",
  };
}

function personToRow(person) {
  return {
    id: person.id,
    name: person.name || "Persona sin nombre",
    email: person.email || "",
    phone: person.phone || "",
    type: person.type || "Empleado MediaLab",
    chat_url: person.chatUrl || "",
  };
}

function rowToSourceRecord(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    client: row.client || "",
    source: row.source || "",
    fileName: row.file_name || "",
    processedAt: row.processed_at || row.created_at || "",
    summary: row.summary || "",
    taskIds: asArray(row.task_ids),
    taskCount: row.task_count || 0,
    attachments: asArray(row.attachments),
    rawText: row.raw_text || "",
    deletedSource: Boolean(row.deleted_source),
  };
}

function sourceRecordToRow(record) {
  return {
    id: isUuid(record.id) ? record.id : undefined,
    company_id: record.companyId || "metrics-lab",
    client: record.client || "",
    source: record.source || "",
    file_name: record.fileName || record.source || "fuente",
    storage_path: record.storagePath || record.path || "",
    status: record.processedAt ? "processed" : "uploaded",
    task_ids: asArray(record.taskIds),
    task_count: record.taskCount || 0,
    attachments: asArray(record.attachments),
    summary: record.summary || "",
    raw_text: record.rawText || "",
    deleted_source: Boolean(record.deletedSource),
    processed_at: record.processedAt || null,
  };
}

async function readSupabaseState() {
  const [companyRows, projectRows, taskRows, peopleRows, sourceRows, appRows] = await Promise.all([
    supabaseRequest("companies", { query: "?select=*&order=name.asc" }),
    supabaseRequest("projects", { query: "?select=*&order=created_at.asc" }),
    supabaseRequest("tasks", { query: "?select=*&order=created_at.desc" }),
    supabaseRequest("people", { query: "?select=*&order=created_at.asc" }),
    supabaseRequest("source_documents", { query: "?select=*&order=created_at.desc" }),
    supabaseRequest("app_state", { query: "?select=*&id=eq.operations&limit=1" }),
  ]);

  const projectsByCompany = new Map();
  for (const project of projectRows || []) {
    const list = projectsByCompany.get(project.company_id) || [];
    list.push(project);
    projectsByCompany.set(project.company_id, list);
  }

  const normalizedCompanies = (companyRows?.length ? companyRows : []).map((company) => {
    const projects = projectsByCompany.get(company.id) || [];
    const clients = projects.map((project) => project.name);
    const archivedClients = {};
    const projectLinks = {};
    const projectDescriptions = {};
    for (const project of projects) {
      archivedClients[project.name] = project.status === "archived";
      projectLinks[project.name] = { tool: project.board_tool || "No aplica", url: project.board_url || "" };
      projectDescriptions[project.name] = project.description || "";
    }
    return {
      id: company.id,
      name: company.name,
      status: company.status || "activa",
      owner: company.owner || "MediaLab",
      workspaces: asArray(company.workspaces),
      clients,
      archivedClients: { ...asObject(company.archived_clients), ...archivedClients },
      projectLinks: { ...asObject(company.project_links), ...projectLinks },
      projectDescriptions: { ...asObject(company.project_descriptions), ...projectDescriptions },
      contextDocuments: asObject(company.context_documents),
      logo: company.logo || null,
      connectors: asArray(company.connectors),
    };
  });

  return {
    companies: normalizedCompanies.length ? normalizedCompanies : companies,
    tasks: (taskRows || []).map(rowToTask),
    sourceRecords: (sourceRows || []).map(rowToSourceRecord),
    people: (peopleRows || []).map(rowToPerson),
    activeCompany: appRows?.[0]?.active_company || normalizedCompanies[0]?.id || companies[0]?.id || "metrics-lab",
    updatedAt: appRows?.[0]?.updated_at || new Date().toISOString(),
  };
}

async function writeSupabaseState(state) {
  const nextState = normalizeState(state);
  const companyRows = nextState.companies.map((company) => ({
    id: company.id,
    name: company.name,
    status: company.status || "activa",
    owner: company.owner || "MediaLab",
    workspaces: asArray(company.workspaces),
    archived_clients: asObject(company.archivedClients),
    project_links: asObject(company.projectLinks),
    project_descriptions: asObject(company.projectDescriptions),
    context_documents: asObject(company.contextDocuments),
    logo: company.logo || null,
    connectors: asArray(company.connectors),
    updated_at: nextState.updatedAt,
  }));

  if (companyRows.length) {
    await supabaseRequest("companies?on_conflict=id", {
      method: "POST",
      body: companyRows,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  const projectRows = nextState.companies.flatMap((company) => (
    asArray(company.clients).map((client) => ({
      company_id: company.id,
      name: client,
      status: company.archivedClients?.[client] ? "archived" : "activo",
      board_tool: normalizeBoardConfig(company.projectLinks?.[client]).tool,
      board_url: normalizeBoardConfig(company.projectLinks?.[client]).url,
      description: company.projectDescriptions?.[client] || "",
    }))
  ));
  if (projectRows.length) {
    await supabaseRequest("projects?on_conflict=company_id,name", {
      method: "POST",
      body: projectRows,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  const peopleRows = nextState.people.filter((person) => person.id).map(personToRow);
  if (peopleRows.length) {
    await supabaseRequest("people?on_conflict=id", {
      method: "POST",
      body: peopleRows,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }

  const taskRows = nextState.tasks.filter((task) => task.id).map(taskToRow);
  if (taskRows.length) {
    await supabaseRequest("tasks?on_conflict=id", {
      method: "POST",
      body: taskRows,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
  await deleteSupabaseRowsMissingFromState("tasks", new Set(taskRows.map((row) => String(row.id))));

  const sourceRows = nextState.sourceRecords.map(sourceRecordToRow);
  const sourceRowsWithId = sourceRows.filter((row) => row.id);
  const sourceRowsWithoutId = sourceRows.map(({ id, ...rest }) => rest).filter((_, index) => !sourceRows[index].id);
  if (sourceRowsWithId.length) {
    await supabaseRequest("source_documents?on_conflict=id", {
      method: "POST",
      body: sourceRowsWithId,
      prefer: "resolution=merge-duplicates,return=minimal",
    });
  }
  if (sourceRowsWithoutId.length) {
    await supabaseRequest("source_documents", {
      method: "POST",
      body: sourceRowsWithoutId,
      prefer: "return=minimal",
    });
  }
  await supabaseRequest("source_documents?task_count=eq.0", {
    method: "DELETE",
    prefer: "return=minimal",
  });

  await supabaseRequest("app_state?on_conflict=id", {
    method: "POST",
    body: [{ id: "operations", active_company: nextState.activeCompany, updated_at: nextState.updatedAt }],
    prefer: "resolution=merge-duplicates,return=minimal",
  });

  return nextState;
}

function normalizeState(state) {
  return {
    companies: Array.isArray(state.companies) && state.companies.length ? state.companies : companies,
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    sourceRecords: Array.isArray(state.sourceRecords) ? state.sourceRecords : [],
    people: Array.isArray(state.people) ? state.people : [],
    activeCompany: state.activeCompany || companies[0]?.id || "metrics-lab",
    updatedAt: new Date().toISOString(),
  };
}

export function readOperationsInbox() {
  if (!existsSync(INBOX_DIR)) return [];
  const files = walk(INBOX_DIR).filter((file) => [".md", ".txt"].includes(extname(file).toLowerCase()));
  return files.flatMap((file) => {
    const text = readFileSync(file, "utf8");
    const folderContext = inferFromPath(file);
    const attachments = extractAttachments(text, file);
    return analyzeOperationsText({
      text,
      companyId: folderContext.companyId || inferCompanyId(text),
      fallbackClient: folderContext.client,
      source: file.replace(process.cwd(), "").replace(/^[/\\]/, ""),
      attachments,
    });
  });
}

async function processPendingInsumosSupabase() {
  const pending = await listInsumosPendientes({});
  const tasks = [];
  const records = [];
  const deleted = [];
  const errors = [];
  let pendingImages = 0;

  for (const insumo of pending) {
    if (insumo.kind === "texto" && insumo.rawText) {
      try {
        const source = `Insumo: ${insumo.fileName}`;
        const fileTasks = analyzeOperationsText({
          text: insumo.rawText,
          companyId: insumo.companyId,
          fallbackClient: insumo.client,
          source,
          attachments: [],
        });
        if (fileTasks.length) {
          tasks.push(...fileTasks);
          records.push(buildSourceRecordFromText({
            source,
            fileName: insumo.fileName,
            text: insumo.rawText,
            companyId: insumo.companyId,
            client: insumo.client,
            tasks: fileTasks,
            attachments: [],
            deletedSource: true,
          }));
        }
        await deleteInsumoPendiente(insumo.id);
        deleted.push(insumo.fileName);
      } catch (error) {
        errors.push({ source: insumo.fileName, error: error.message });
      }
    } else {
      // Imágenes: el análisis automático necesita visión/IA; se dejan pendientes
      // para revisión manual (o para un procesador de imagen a futuro).
      pendingImages += 1;
    }
  }

  return { tasks, records, deleted, errors, pendingImages, pending: pending.length };
}

export async function processOperationsInbox() {
  if (hasSupabase()) {
    try {
      return await processPendingInsumosSupabase();
    } catch (error) {
      console.warn("Run diario Supabase fallo, usando inbox local:", error.message);
    }
  }

  if (!existsSync(INBOX_DIR)) return { tasks: [], records: [], deleted: [], errors: [] };

  const files = walk(INBOX_DIR).filter((file) => [".md", ".txt"].includes(extname(file).toLowerCase()));
  const tasks = [];
  const records = [];
  const deleted = [];
  const errors = [];

  for (const file of files) {
    const source = file.replace(process.cwd(), "").replace(/^[/\\]/, "");
    try {
      const text = readFileSync(file, "utf8");
      const folderContext = inferFromPath(file);
      const companyId = folderContext.companyId || inferCompanyId(text);
      const client = folderContext.client || inferClient(companyId, text);
      const attachments = extractAttachments(text, file);
      const contextDocs = readContextDocuments({ companyId, client });
      const contextNote = summarizeContextDocuments(contextDocs);
      const fileTasks = analyzeOperationsText({ text, companyId, fallbackClient: client, source, attachments })
        .map((task) => enrichTaskWithContext(task, contextNote));
      tasks.push(...fileTasks);
      if (fileTasks.length) {
        records.push(buildSourceRecord({ file, source, text, companyId, client, tasks: fileTasks, attachments }));
      } else {
        errors.push({ source, error: "Insumo descartado: no genero requerimientos utiles." });
      }
      unlinkSync(file);
      pruneEmptyFolders(dirname(file), INBOX_DIR);
      deleted.push(source);
    } catch (error) {
      errors.push({
        source,
        error: error.code === "EACCES" ? "Sin permisos para procesar o eliminar esta fuente" : error.message,
      });
    }
  }

  return { tasks, records, deleted, errors };
}

function pruneEmptyFolders(startDir, stopDir) {
  let current = resolve(startDir);
  const stop = resolve(stopDir);
  while (current.startsWith(stop) && current !== stop) {
    try {
      if (readdirSync(current).length > 0) return;
      rmdirSync(current);
      current = dirname(current);
    } catch {
      return;
    }
  }
}

export async function readOperationsState() {
  if (hasSupabase()) {
    try {
      return await readSupabaseState();
    } catch (error) {
      console.warn("Supabase state read failed, using file fallback:", error.message);
    }
  }

  if (!existsSync(STATE_FILE)) {
    return {
      companies,
      tasks: [],
      sourceRecords: [],
      people: [],
      activeCompany: companies[0]?.id || "metrics-lab",
      updatedAt: new Date().toISOString(),
    };
  }

  const state = JSON.parse(readFileSync(STATE_FILE, "utf8"));
  return {
    companies: Array.isArray(state.companies) && state.companies.length ? state.companies : companies,
    tasks: Array.isArray(state.tasks) ? state.tasks : [],
    sourceRecords: Array.isArray(state.sourceRecords) ? state.sourceRecords : [],
    people: Array.isArray(state.people) ? state.people : [],
    activeCompany: state.activeCompany || companies[0]?.id || "metrics-lab",
    updatedAt: state.updatedAt || new Date().toISOString(),
  };
}

export async function writeOperationsState(state) {
  if (hasSupabase()) {
    try {
      return await writeSupabaseState(state);
    } catch (error) {
      console.warn("Supabase state write failed, using file fallback:", error.message);
    }
  }

  mkdirSync(OPERATIONS_DIR, { recursive: true });
  const nextState = normalizeState(state);
  writeFileSync(STATE_FILE, JSON.stringify(nextState, null, 2), "utf8");
  return nextState;
}

export function ensureOperationsFolder({ companyId, client }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  const safeClient = slugify(client || "proyecto-general");
  const folder = resolve(INBOX_DIR, safeCompany, safeClient);
  const existed = existsSync(folder);
  mkdirSync(folder, { recursive: true });
  return {
    path: folder.replace(process.cwd(), "").replace(/^[/\\]/, ""),
    exists: true,
    created: !existed,
  };
}

export function getOperationsFolderStatus({ companyId, clients = [] }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  return clients.map((client) => {
    const safeClient = slugify(client || "proyecto-general");
    const folder = resolve(INBOX_DIR, safeCompany, safeClient);
    const path = folder.replace(process.cwd(), "").replace(/^[/\\]/, "");
    try {
      if (!existsSync(folder)) {
        return { client, path, exists: false, error: "" };
      }
      const stat = statSync(folder);
      return { client, path, exists: stat.isDirectory(), error: stat.isDirectory() ? "" : "La ruta existe, pero no es una carpeta" };
    } catch (error) {
      return { client, path, exists: false, error: error.code === "EACCES" ? "Sin permisos para verificar esta carpeta" : error.message };
    }
  });
}

export function openOperationsFolder({ companyId, client }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  const safeClient = slugify(client || "proyecto-general");
  const folder = resolve(INBOX_DIR, safeCompany, safeClient);

  if (!existsSync(folder)) {
    const error = new Error("La carpeta no existe");
    error.code = "ENOENT";
    throw error;
  }
  if (!statSync(folder).isDirectory()) {
    const error = new Error("La ruta existe, pero no es una carpeta");
    error.code = "ENOTDIR";
    throw error;
  }

  const system = platform();
  const command = system === "win32" ? "explorer.exe" : system === "darwin" ? "open" : "xdg-open";
  execFile(command, [folder], { windowsHide: true });
  return folder.replace(process.cwd(), "").replace(/^[/\\]/, "");
}

export async function saveTaskAttachment({ companyId, client, fileName, buffer, contentType }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  const safeClient = slugify(client || "proyecto-general");
  const safeFile = sanitizeFileName(fileName || `adjunto-${Date.now()}`);
  const stamped = `${Date.now()}-${safeFile}`;
  if (hasSupabase()) {
    const objectPath = `task-docs/${safeCompany}/${safeClient}/${stamped}`;
    await uploadToBucket(objectPath, buffer, contentType || guessContentType(safeFile));
    return { type: "file", label: safeFile, path: objectPath, url: bucketPublicUrl(objectPath), storage: "supabase", uploadedAt: new Date().toISOString() };
  }
  const folder = resolve(INBOX_DIR, safeCompany, safeClient, "_task-docs");
  mkdirSync(folder, { recursive: true });
  const target = resolve(folder, stamped);
  writeFileSync(target, buffer);
  const { path, url } = localFileUrl(target);
  return { type: "file", label: safeFile, path, url, storage: "local", uploadedAt: new Date().toISOString() };
}

export function saveInboxDocument({ companyId, client, fileName, buffer }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  const safeClient = slugify(client || "proyecto-general");
  const safeFile = sanitizeFileName(fileName || `documento-${Date.now()}`);
  const folder = resolve(INBOX_DIR, safeCompany, safeClient);
  mkdirSync(folder, { recursive: true });
  const target = resolve(folder, `${Date.now()}-${safeFile}`);
  writeFileSync(target, buffer);
  return {
    type: "source",
    label: safeFile,
    path: target.replace(process.cwd(), "").replace(/^[/\\]/, ""),
    processable: [".md", ".txt"].includes(extname(safeFile).toLowerCase()),
    uploadedAt: new Date().toISOString(),
  };
}

export async function processUploadedTaskSource({ companyId, client, fileName, contentType = "", buffer }) {
  const safeFile = sanitizeFileName(fileName || `tareas-${Date.now()}.md`);
  const extension = extname(safeFile).toLowerCase();
  const isTextSource = [".md", ".txt"].includes(extension);
  const isImageSource = /^image\//i.test(contentType) || [".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".heic", ".heif"].includes(extension);

  if (buffer.length > MAX_TASK_UPLOAD_BYTES) {
    return {
      document: {
        type: "source",
        label: safeFile,
        processable: false,
        uploadedAt: new Date().toISOString(),
      },
      tasks: [],
      records: [],
      deleted: [],
      errors: [{ source: safeFile, error: "El archivo debe pesar menos de 1 MB." }],
    };
  }

  if (isImageSource) {
    // La imagen ya NO se descarta: se guarda como insumo pendiente en Supabase
    // (Storage + tabla insumos_pendientes) para que el run diario / revisión la usen.
    if (hasSupabase()) {
      try {
        const insumo = await saveInsumoPendiente({ companyId, client, fileName: safeFile, contentType, buffer, kind: "imagen" });
        return {
          document: { type: "source", label: safeFile, processable: true, pendingAnalysis: true, insumo, uploadedAt: new Date().toISOString() },
          tasks: [],
          records: [],
          deleted: [],
          errors: [],
        };
      } catch (error) {
        return {
          document: { type: "source", label: safeFile, processable: false, uploadedAt: new Date().toISOString() },
          tasks: [],
          records: [],
          deleted: [],
          errors: [{ source: safeFile, error: `No se pudo guardar el insumo de imagen: ${error.message}` }],
        };
      }
    }
    return {
      document: { type: "source", label: safeFile, processable: true, discarded: true, uploadedAt: new Date().toISOString() },
      tasks: [],
      records: [],
      deleted: [safeFile],
      errors: [{ source: safeFile, error: "Insumo de imagen recibido; para guardarlo y analizarlo configura Supabase (Storage + insumos_pendientes)." }],
    };
  }

  if (!isTextSource) {
    return {
      document: {
        type: "source",
        label: safeFile,
        processable: false,
        uploadedAt: new Date().toISOString(),
      },
      tasks: [],
      records: [],
      deleted: [],
      errors: [{ source: safeFile, error: "Para crear tareas sube un .md, .txt o una imagen menor a 1 MB." }],
    };
  }

  const text = buffer.toString("utf8");
  const source = `Documentacion subida: ${safeFile}`;
  const contextDocs = readContextDocuments({ companyId, client });
  const contextNote = summarizeContextDocuments(contextDocs);
  const tasks = analyzeOperationsText({
    text,
    companyId,
    fallbackClient: client,
    source,
    attachments: [],
  }).map((task) => enrichTaskWithContext(task, contextNote));

  if (!tasks.length) {
    return {
      document: {
        type: "source",
        label: safeFile,
        processable: true,
        discarded: true,
        uploadedAt: new Date().toISOString(),
      },
      tasks: [],
      records: [],
      deleted: [safeFile],
      errors: [{ source: safeFile, error: "Insumo descartado: no genero requerimientos utiles." }],
    };
  }

  const record = buildSourceRecordFromText({
    source,
    fileName: safeFile,
    text,
    companyId,
    client,
    tasks,
    attachments: [],
    deletedSource: true,
  });

  return {
    document: {
      type: "source",
      label: safeFile,
      processable: true,
      uploadedAt: new Date().toISOString(),
    },
    tasks,
    records: [record],
    deleted: [safeFile],
    errors: [],
  };
}

export async function saveCompanyLogo({ companyId, fileName, buffer, contentType }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  const safeFile = sanitizeFileName(fileName || `logo-${Date.now()}`);
  const stamped = `${Date.now()}-${safeFile}`;
  if (hasSupabase()) {
    const objectPath = `logos/${safeCompany}/${stamped}`;
    await uploadToBucket(objectPath, buffer, contentType || guessContentType(safeFile));
    return { label: safeFile, path: objectPath, url: bucketPublicUrl(objectPath), storage: "supabase", uploadedAt: new Date().toISOString() };
  }
  const folder = resolve(OPERATIONS_DIR, "logos", safeCompany);
  mkdirSync(folder, { recursive: true });
  const target = resolve(folder, stamped);
  writeFileSync(target, buffer);
  const { path, url } = localFileUrl(target);
  return { label: safeFile, path, url, storage: "local", uploadedAt: new Date().toISOString() };
}

export async function saveContextDocument({ companyId, client = "", fileName, buffer, contentType }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  const safeClient = client ? slugify(client) : "_empresa";
  const safeFile = sanitizeFileName(fileName || `contexto-${Date.now()}`);
  const readable = [".md", ".txt"].includes(extname(safeFile).toLowerCase());
  const stamped = `${Date.now()}-${safeFile}`;
  if (hasSupabase()) {
    const objectPath = `context/${safeCompany}/${safeClient}/${stamped}`;
    await uploadToBucket(objectPath, buffer, contentType || guessContentType(safeFile));
    return { type: "context", label: safeFile, companyId, client, path: objectPath, url: bucketPublicUrl(objectPath), readable, storage: "supabase", uploadedAt: new Date().toISOString() };
  }
  const folder = resolve(OPERATIONS_DIR, "context", safeCompany, safeClient);
  mkdirSync(folder, { recursive: true });
  const target = resolve(folder, stamped);
  writeFileSync(target, buffer);
  const { path, url } = localFileUrl(target);
  return { type: "context", label: safeFile, companyId, client, path, url, readable, storage: "local", uploadedAt: new Date().toISOString() };
}

export function readContextDocuments({ companyId, client = "" }) {
  const safeCompany = slugify(companyId || "sin-empresa");
  const folders = [
    resolve(OPERATIONS_DIR, "context", safeCompany, "_empresa"),
  ];
  if (client) folders.push(resolve(OPERATIONS_DIR, "context", safeCompany, slugify(client)));

  const docs = [];
  for (const folder of folders) {
    if (!existsSync(folder)) continue;
    for (const file of walk(folder).filter((item) => [".md", ".txt"].includes(extname(item).toLowerCase()))) {
      try {
        docs.push({
          label: basename(file),
          path: file.replace(process.cwd(), "").replace(/^[/\\]/, ""),
          text: readFileSync(file, "utf8"),
          scope: folder.endsWith("_empresa") ? "empresa" : "subproyecto",
        });
      } catch {
        // Ignore unreadable context documents; upload still remains referenced.
      }
    }
  }
  return docs;
}

function summarizeContextDocuments(documents = []) {
  return documents
    .filter((doc) => doc.text)
    .map((doc) => `${doc.scope}: ${doc.label}\n${doc.text.replace(/\s+/g, " ").trim().slice(0, 700)}`)
    .join("\n\n")
    .slice(0, 1800);
}

function enrichTaskWithContext(task, contextNote) {
  if (!contextNote) return task;
  const currentDescription = task.description || task.evidence || "";
  return {
    ...task,
    projectContext: contextNote,
    description: `${currentDescription}\n\nContexto del proyecto:\n${contextNote}`.trim(),
  };
}

export function analyzeOperationsText({ text, companyId = "metrics-lab", fallbackClient = "", source = "Inbox MD", attachments = [] }) {
  const lines = text
    .split(/\r?\n|(?<=\.)\s+/)
    .map((line) => line.replace(/^[-*]\s*(\[ \])?\s*/, "").trim())
    .filter(Boolean);

  let currentClient = "";
  const tasks = [];

  for (const line of lines) {
    const clientMatch = line.match(/cliente\s*:\s*(.+)$/i);
    if (clientMatch) {
      currentClient = clientMatch[1].trim();
      continue;
    }

    const actionable = /(revisar|preparar|crear|ajustar|cambiar|cmabair|cambair|corregir|arreglar|enviar|validar|verificar|diseñar|disenar|entregar|confirmar|actualizar|documentar|publicar|investigar|bloqueo|falta|pendiente|definir|montar|conectar|asignar|no se sabe|donde van|formularios)/i.test(line);
    if (!actionable) continue;

    const blocked = /bloqueo|bloqueada|falta|pendiente de acceso|sin acceso/i.test(line);
    const due = (
      line.match(/(?:fecha limite|fecha límite|vencimiento|due|antes del)\s*:?\s*(\d{4}-\d{2}-\d{2}|hoy|manana|mañana|lunes|martes|miercoles|miércoles|jueves|viernes)/i)
      || line.match(/\b(hoy|manana|mañana|lunes|martes|miercoles|miércoles|jueves|viernes)\b/i)
    )?.[1];
    const title = interpretRequirementTitle(line);
    tasks.push({
      id: stableTaskId(companyId, line),
      title,
      companyId,
      client: currentClient || fallbackClient || inferClient(companyId, line),
      role: inferRole(line),
      owner: "",
      priority: blocked ? "alta" : /hoy|urgente|viernes|entregar/i.test(line) ? "alta" : "media",
      status: blocked ? "blocked" : "ready",
      dueDate: normalizeDue(due),
      deliveryDate: "",
      source,
      userStory: buildUserStory(line, currentClient || fallbackClient || inferClient(companyId, line)),
      description: buildTaskDescription(line),
      acceptanceCriteria: buildAcceptanceCriteria(line, []),
      attachments: [],
      emailTo: "",
      emailSubject: `Revision tarea: ${title.slice(0, 70)}`,
      audience: /cliente|externo|presentar|enviar/i.test(line) ? "Externo cliente" : "Interno MediaLab",
      syncMode: /google chat/i.test(line) ? "Enviar por Google Chat" : /trello|notion|jira/i.test(line) ? "Actualizar plataforma" : "Manual",
      evidence: line,
      createdAt: new Date().toISOString(),
    });
  }

  return tasks;
}

function buildSourceRecord({ file, source, text, companyId, client, tasks, attachments }) {
  return buildSourceRecordFromText({
    source,
    fileName: basename(file),
    text,
    companyId,
    client,
    tasks,
    attachments,
    deletedSource: true,
  });
}

function buildSourceRecordFromText({ source, fileName, text, companyId, client, tasks, attachments, deletedSource }) {
  const cleanLines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return {
    id: stableTaskId(companyId, `${source}|${text.slice(0, 120)}`),
    companyId,
    client,
    source,
    fileName,
    processedAt: new Date().toISOString(),
    summary: cleanLines.slice(0, 4).join(" ").slice(0, 360) || "Fuente procesada sin resumen disponible.",
    taskIds: tasks.map((task) => task.id),
    taskCount: tasks.length,
    attachments,
    rawText: text,
    deletedSource,
  };
}

function buildUserStory(text, client) {
  const cleaned = interpretRequirementTitle(text).toLowerCase();
  return `Como equipo de MediaLab, necesito ${cleaned} para avanzar el trabajo de ${client || "este subproyecto"} con claridad de alcance, responsable y entrega.`;
}

function interpretRequirementTitle(text) {
  const cleaned = String(text || "")
    .replace(/\s*responsable sugerido:.+$/i, "")
    .replace(/\bcmabair\b|\bcambair\b/gi, "cambiar")
    .replace(/\binfromacion\b/gi, "informacion")
    .trim();
  const url = cleaned.match(/https?:\/\/[^\s)]+/i)?.[0] || "";
  if (/logo/i.test(cleaned) && /pagina|web|sitio|landing/i.test(cleaned)) {
    return `Cambiar logo de la pagina${url ? ` ${url}` : ""}`.slice(0, 140);
  }
  if (/formularios/i.test(cleaned) && /(no se sabe|donde van|informacion|datos)/i.test(cleaned)) {
    return "Verificar destino de la informacion enviada por los formularios";
  }
  if (/no se sabe/i.test(cleaned)) {
    return `Verificar ${cleaned.replace(/^no se sabe\s*/i, "").trim()}`.slice(0, 140);
  }
  return cleaned.slice(0, 140);
}

function buildTaskDescription(text) {
  const title = interpretRequirementTitle(text);
  if (/logo/i.test(title)) return "Actualizar el logo visible en la pagina indicada y validar que el cambio quede publicado correctamente.";
  if (/formularios/i.test(title)) return "Confirmar a donde llega la informacion enviada por los formularios y documentar el destino correcto.";
  return `Definir alcance, responsable y resultado esperado para: ${title}`;
}

function buildAcceptanceCriteria(text, attachments) {
  const criteria = [
    "La tarea tiene responsable asignado o una persona pendiente de asignacion.",
    "La fecha de entrega esta definida o marcada para confirmacion.",
    "El entregable solicitado queda claro para quien lo va a ejecutar.",
  ];
  if (/revisar|validar|aprobar/i.test(text)) criteria.push("La revision deja observaciones, aprobacion o ajustes requeridos.");
  if (/enviar|correo|google chat/i.test(text)) criteria.push("El envio queda confirmado por el canal indicado y con destinatario definido.");
  if (attachments.length) criteria.push("Los adjuntos detectados se revisan y quedan referenciados en la tarea.");
  return criteria;
}

function extractAttachments(text, file) {
  const urls = Array.from(text.matchAll(/https?:\/\/[^\s)]+/gi)).map((match) => ({
    type: "url",
    label: "Link",
    path: match[0],
  }));

  let siblings = [];
  try {
    siblings = readdirSync(dirname(file), { withFileTypes: true })
      .filter((entry) => entry.isFile() && ![".md", ".txt"].includes(extname(entry.name).toLowerCase()))
      .map((entry) => ({
        type: "file",
        label: entry.name,
        path: join(dirname(file), entry.name).replace(process.cwd(), "").replace(/^[/\\]/, ""),
      }));
  } catch {
    siblings = [];
  }

  return [...urls, ...siblings];
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : fullPath;
  });
}

function inferFromPath(file) {
  const parts = relative(INBOX_DIR, file).split(/[\\/]/);
  const [companyId, clientSlug] = parts;
  if (!companyId || parts.length < 3) return { companyId: "", client: "" };
  const company = companies.find((item) => item.id === companyId);
  const client = company?.clients.find((item) => slugify(item) === clientSlug) || unslug(clientSlug);
  return { companyId, client };
}

function inferCompanyId(text) {
  if (/metrics lab/i.test(text)) return "metrics-lab";
  if (/jira/i.test(text)) return "jira-client";
  if (/notion/i.test(text)) return "notion-client";
  return "metrics-lab";
}

function slugify(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-nombre";
}

function unslug(value) {
  return String(value || "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Sin cliente interno";
}

function sanitizeFileName(value) {
  return String(value)
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160) || "adjunto";
}

function inferClient(companyId, text) {
  const company = companies.find((item) => item.id === companyId);
  const match = company?.clients.find((client) => new RegExp(client, "i").test(text));
  return match || company?.clients?.[0] || "Sin cliente interno";
}

function inferRole(text) {
  if (/pantalla|flujo|figma|wireframe|prototipo|dashboard|onboarding|mobile/i.test(text)) return "Product Designer";
  if (/research|entrevista|usuario|hallazgo|validaci/i.test(text)) return "UX Research";
  if (/visual|ui|component|landing|pieza|grafica|gráfica/i.test(text)) return "UI Designer";
  if (/api|automat|integraci|deploy|datos|script/i.test(text)) return "Desarrollo";
  if (/copy|texto|contenido|post|resumen/i.test(text)) return "Contenido";
  if (/aprobar|presupuesto|alcance|prioridad|cliente/i.test(text)) return "Project Manager";
  return "Project Manager";
}

function normalizeDue(value) {
  if (!value) return addDays(2);
  const clean = value.toLowerCase();
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  if (clean === "hoy") return todayIso();
  if (clean === "manana" || clean === "mañana") return addDays(1);
  const weekdays = { domingo: 0, lunes: 1, martes: 2, miercoles: 3, miércoles: 3, jueves: 4, viernes: 5, sabado: 6, sábado: 6 };
  if (clean in weekdays) return nextWeekday(weekdays[clean]);
  return addDays(3);
}

function nextWeekday(targetDay) {
  const date = new Date();
  const diff = (targetDay - date.getDay() + 7) % 7 || 7;
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function stableTaskId(companyId, text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(index);
    hash |= 0;
  }
  return `inbox-${companyId}-${Math.abs(hash)}`;
}
