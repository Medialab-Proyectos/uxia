import { ensureOperationsFolder } from "../../server/operations.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Metodo no permitido" });
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  const result = ensureOperationsFolder({
    companyId: String(body.companyId || "sin-empresa"),
    client: String(body.client || "Proyecto general"),
  });
  res.status(200).json({ ok: true, ...result });
}
