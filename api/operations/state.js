import { readOperationsState, writeOperationsState } from "../../server/operations.js";
import { readJsonBody } from "./_multipart.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      res.status(200).json(await readOperationsState());
      return;
    }

    if (req.method === "PUT") {
      res.status(200).json(await writeOperationsState(await readJsonBody(req)));
      return;
    }

    res.status(405).json({ error: "Metodo no permitido" });
  } catch (error) {
    res.status(500).json({
      error: "No se pudo sincronizar el estado operativo",
      detail: error.message,
    });
  }
}
