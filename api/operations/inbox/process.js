import { processOperationsInbox } from "../../../server/operations.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  try {
    res.status(200).json(processOperationsInbox());
  } catch (error) {
    res.status(500).json({
      error: "No se pudo procesar la documentacion",
      detail: error.code === "EACCES" ? "Sin permisos para procesar fuentes" : error.message,
    });
  }
}
