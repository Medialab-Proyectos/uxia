import { getOperationsFolderStatus } from "../../../server/operations.js";
import { readJsonBody } from "../_multipart.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  try {
    const body = await readJsonBody(req);
    res.status(200).json({
      folders: getOperationsFolderStatus({
        companyId: String(body.companyId || "sin-empresa"),
        clients: Array.isArray(body.clients) ? body.clients.map(String) : [],
      }),
    });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo verificar el estado de carpetas",
      detail: error.message,
    });
  }
}
