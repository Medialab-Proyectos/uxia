// Función serverless de Vercel para el radar de empleos.
// Reutiliza el mismo core que el servidor Express local (server/scraper.js).
import { scrapeJobs } from "../server/scraper.js";

export default async function handler(req, res) {
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
    res.status(200).json({ jobs, count: jobs.length });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo completar el scraping público",
      detail: error.message,
    });
  }
}
