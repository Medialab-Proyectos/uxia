import express from "express";
import cors from "cors";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scrapeJobs, scrapeOpportunities } from "./scraper.js";
import { analyzeOperationsText, companies, ensureOperationsFolder, getOperationsFolderStatus, openOperationsFolder, processOperationsInbox, processUploadedTaskSource, readContextDocuments, readOperationsInbox, readOperationsState, saveCompanyLogo, saveContextDocument, saveTaskAttachment, writeOperationsState } from "./operations.js";

loadEnvFile();

const app = express();
const PORT = Number(process.env.UXIA_SCRAPER_PORT || 8787);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/operations-files", express.static(resolve(process.cwd(), "operations")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "uxia-scraper" });
});

app.get("/api/scrape", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const remoteOnly = req.query.remote !== "false";
  const limit = Math.min(Number(req.query.limit || 18), 30);
  const expand = req.query.expand === "true";

  if (!query) {
    res.status(400).json({ error: "Falta el parámetro q" });
    return;
  }

  try {
    const jobs = await scrapeJobs({ query, remoteOnly, limit, expand });
    res.json({ jobs, count: jobs.length });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo completar el scraping público",
      detail: error.message,
    });
  }
});

app.get("/api/opportunities", async (req, res) => {
  const query = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit || 12), 20);

  try {
    const opportunities = await scrapeOpportunities({ query, limit });
    res.json({ opportunities, count: opportunities.length });
  } catch (error) {
    res.status(500).json({
      error: "No se pudieron detectar señales de demanda",
      detail: error.message,
    });
  }
});

app.get("/api/operations", (_req, res) => {
  try {
    const tasks = readOperationsInbox();
    res.json({ companies, tasks, count: tasks.length });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo leer el inbox operativo",
      detail: error.message,
    });
  }
});

app.get("/api/operations/state", async (_req, res) => {
  try {
    res.json(await readOperationsState());
  } catch (error) {
    res.status(500).json({
      error: "No se pudo leer el estado operativo",
      detail: error.message,
    });
  }
});

app.put("/api/operations/state", async (req, res) => {
  try {
    res.json(await writeOperationsState(req.body || {}));
  } catch (error) {
    res.status(500).json({
      error: "No se pudo guardar el estado operativo",
      detail: error.message,
    });
  }
});

app.post("/api/operations", (req, res) => {
  const text = String(req.body?.text || "");
  const companyId = String(req.body?.companyId || "metrics-lab");
  const tasks = analyzeOperationsText({ text, companyId, source: "Inbox MD" });
  res.json({ tasks, count: tasks.length });
});

app.post("/api/operations/inbox/process", (_req, res) => {
  try {
    res.json(processOperationsInbox());
  } catch (error) {
    res.status(500).json({
      error: "No se pudo procesar el inbox",
      detail: error.code === "EACCES" ? "Sin permisos para procesar o eliminar fuentes" : error.message,
    });
  }
});

app.post("/api/operations/folder", (req, res) => {
  try {
    const companyId = String(req.body?.companyId || "sin-empresa");
    const client = String(req.body?.client || "Proyecto general");
    const result = ensureOperationsFolder({ companyId, client });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo crear la carpeta operativa",
      detail: error.code === "EACCES" ? "Sin permisos para crear esta carpeta" : error.message,
    });
  }
});

app.post("/api/operations/folders/status", (req, res) => {
  try {
    const companyId = String(req.body?.companyId || "sin-empresa");
    const clients = Array.isArray(req.body?.clients) ? req.body.clients.map(String) : [];
    res.json({ folders: getOperationsFolderStatus({ companyId, clients }) });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo verificar el estado de carpetas",
      detail: error.code === "EACCES" ? "Sin permisos para verificar carpetas" : error.message,
    });
  }
});

app.post("/api/operations/folder/open", (req, res) => {
  try {
    const companyId = String(req.body?.companyId || "sin-empresa");
    const client = String(req.body?.client || "Proyecto general");
    const path = openOperationsFolder({ companyId, client });
    res.json({ ok: true, path });
  } catch (error) {
    const missing = error.code === "ENOENT" || error.code === "ENOTDIR";
    res.status(missing ? 404 : 500).json({
      error: "No se pudo abrir la carpeta",
      detail: error.code === "EACCES" ? "Sin permisos para abrir esta carpeta" : error.message,
    });
  }
});

app.post("/api/operations/task-attachment", async (req, res) => {
  try {
    const parsed = await readMultipartRequest(req);
    const file = parsed.files.file?.[0];
    if (!file) {
      res.status(400).json({ error: "Falta archivo" });
      return;
    }

    const attachment = saveTaskAttachment({
      companyId: parsed.fields.companyId || "sin-empresa",
      client: parsed.fields.client || "Proyecto general",
      fileName: file.filename,
      contentType: file.contentType,
      buffer: file.buffer,
    });
    res.json({ ok: true, attachment });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo subir el adjunto",
      detail: error.code === "EACCES" ? "Sin permisos para guardar el adjunto" : error.message,
    });
  }
});

app.post("/api/operations/source-document", async (req, res) => {
  try {
    const parsed = await readMultipartRequest(req);
    const file = parsed.files.file?.[0];
    if (!file) {
      res.status(400).json({ error: "Falta archivo" });
      return;
    }

    const result = processUploadedTaskSource({
      companyId: parsed.fields.companyId || "sin-empresa",
      client: parsed.fields.client || "Proyecto general",
      fileName: file.filename,
      buffer: file.buffer,
    });
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo subir tareas",
      detail: error.code === "EACCES" ? "Sin permisos para guardar la documentacion" : error.message,
    });
  }
});

app.post("/api/operations/company-logo", async (req, res) => {
  try {
    const parsed = await readMultipartRequest(req);
    const file = parsed.files.file?.[0];
    if (!file) {
      res.status(400).json({ error: "Falta archivo" });
      return;
    }
    const logo = saveCompanyLogo({
      companyId: parsed.fields.companyId || "sin-empresa",
      fileName: file.filename,
      buffer: file.buffer,
    });
    res.json({ ok: true, logo });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo subir el logo",
      detail: error.code === "EACCES" ? "Sin permisos para guardar el logo" : error.message,
    });
  }
});

app.post("/api/operations/context-document", async (req, res) => {
  try {
    const parsed = await readMultipartRequest(req);
    const file = parsed.files.file?.[0];
    if (!file) {
      res.status(400).json({ error: "Falta archivo" });
      return;
    }
    const document = saveContextDocument({
      companyId: parsed.fields.companyId || "sin-empresa",
      client: parsed.fields.client || "",
      fileName: file.filename,
      buffer: file.buffer,
    });
    res.json({ ok: true, document });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo subir el documento de contexto",
      detail: error.code === "EACCES" ? "Sin permisos para guardar el documento" : error.message,
    });
  }
});

app.get("/api/operations/context", (req, res) => {
  try {
    res.json({
      documents: readContextDocuments({
        companyId: String(req.query.companyId || "sin-empresa"),
        client: String(req.query.client || ""),
      }),
    });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo leer el contexto",
      detail: error.code === "EACCES" ? "Sin permisos para leer contexto" : error.message,
    });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`UXIA scraper listo en http://0.0.0.0:${PORT}`);
});

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function readMultipartRequest(req) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(.+)$/)?.[1]?.replace(/^"|"$/g, "");
  if (!boundary) throw new Error("Falta boundary multipart");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return parseMultipart(Buffer.concat(chunks), boundary);
}

function parseMultipart(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = {};
  let start = body.indexOf(delimiter);

  while (start !== -1) {
    start += delimiter.length;
    if (body[start] === 45 && body[start + 1] === 45) break;
    if (body[start] === 13 && body[start + 1] === 10) start += 2;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), start);
    if (headerEnd === -1) break;
    const header = body.slice(start, headerEnd).toString("utf8");
    const next = body.indexOf(delimiter, headerEnd + 4);
    if (next === -1) break;
    let content = body.slice(headerEnd + 4, next);
    if (content.at(-2) === 13 && content.at(-1) === 10) content = content.slice(0, -2);

    const name = header.match(/name="([^"]+)"/)?.[1];
    const filename = header.match(/filename="([^"]*)"/)?.[1];
    const contentType = header.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";
    if (name && filename !== undefined) {
      files[name] = files[name] || [];
      files[name].push({ filename, contentType, buffer: content });
    } else if (name) {
      fields[name] = content.toString("utf8");
    }
    start = next;
  }

  return { fields, files };
}
