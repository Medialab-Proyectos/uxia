import { listInsumosPendientes, deleteInsumoPendiente } from "../../server/operations.js";

export default async function handler(req, res) {
  try {
    if (req.method === "GET") {
      const insumos = await listInsumosPendientes({ companyId: req.query.companyId });
      res.status(200).json({ ok: true, insumos });
      return;
    }
    if (req.method === "DELETE") {
      const id = req.query.id || req.body?.id;
      const keepFile = req.query.keepFile === "1" || req.body?.keepFile === true;
      res.status(200).json(await deleteInsumoPendiente(id, { keepFile }));
      return;
    }
    res.status(405).json({ error: "Metodo no permitido" });
  } catch (error) {
    res.status(500).json({ error: "Error con insumos pendientes", detail: error.message });
  }
}
