import { openOperationsFolder } from "../../../server/operations.js";
import { readJsonBody } from "../_multipart.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const path = openOperationsFolder({
      companyId: String(body.companyId || "sin-empresa"),
      client: String(body.client || "Proyecto general"),
    });
    res.status(200).json({ ok: true, path });
  } catch (error) {
    const missing = error.code === "ENOENT" || error.code === "ENOTDIR";
    res.status(missing ? 404 : 500).json({
      error: "No se pudo abrir la carpeta",
      detail: error.message,
    });
  }
}
