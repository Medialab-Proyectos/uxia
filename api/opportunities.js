// Función serverless de Vercel para el radar comercial (señales de demanda).
// Reutiliza el mismo core que el servidor Express local (server/scraper.js).
import { scrapeOpportunities } from "../server/scraper.js";

export default async function handler(req, res) {
  const query = String(req.query.q || "").trim();
  const limit = Math.min(Number(req.query.limit || 12), 20);

  try {
    const opportunities = await scrapeOpportunities({ query, limit });
    res.status(200).json({ opportunities, count: opportunities.length });
  } catch (error) {
    res.status(500).json({
      error: "No se pudieron detectar señales de demanda",
      detail: error.message,
    });
  }
}
