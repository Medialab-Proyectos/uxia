import { processUploadedTaskSource } from "../../server/operations.js";
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

    const result = processUploadedTaskSource({
      companyId: parsed.fields.companyId || "sin-empresa",
      client: parsed.fields.client || "Proyecto general",
      fileName: file.filename,
      contentType: file.contentType,
      buffer: file.buffer,
    });
    res.status(200).json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo subir tareas",
      detail: error.message,
    });
  }
}
