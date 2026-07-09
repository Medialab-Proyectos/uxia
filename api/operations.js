import { analyzeOperationsText, companies, readOperationsInbox } from "../server/operations.js";

export default async function handler(req, res) {
  if (req.method === "POST") {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
    const tasks = analyzeOperationsText({
      text: String(body.text || ""),
      companyId: String(body.companyId || "metrics-lab"),
      source: "Inbox MD",
    });
    res.status(200).json({ tasks, count: tasks.length });
    return;
  }

  const tasks = readOperationsInbox();
  res.status(200).json({ companies, tasks, count: tasks.length });
}
