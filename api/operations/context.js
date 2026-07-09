import { readContextDocuments } from "../../server/operations.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  try {
    res.status(200).json({
      documents: readContextDocuments({
        companyId: String(req.query.companyId || "sin-empresa"),
        client: String(req.query.client || ""),
      }),
    });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo leer el contexto",
      detail: error.message,
    });
  }
}
