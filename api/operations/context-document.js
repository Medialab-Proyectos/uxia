import { saveContextDocument } from "../../server/operations.js";
import { readMultipartRequest } from "./_multipart.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

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
    res.status(200).json({ ok: true, document });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo subir el documento de contexto",
      detail: error.message,
    });
  }
}
