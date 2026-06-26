import express from "express";
import cors from "cors";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { scrapeJobs } from "./scraper.js";

loadEnvFile();

const app = express();
const PORT = Number(process.env.UXIA_SCRAPER_PORT || 8787);

app.use(cors({ origin: [/^http:\/\/127\.0\.0\.1:\d+$/, /^http:\/\/localhost:\d+$/] }));
app.use(express.json({ limit: "1mb" }));

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

app.listen(PORT, "127.0.0.1", () => {
  console.log(`UXIA scraper listo en http://127.0.0.1:${PORT}`);
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
