export async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

export async function readMultipartRequest(req) {
  const contentType = req.headers["content-type"] || "";
  const boundary = contentType.match(/boundary=(.+)$/)?.[1]?.replace(/^"|"$/g, "");
  if (!boundary) throw new Error("Falta boundary multipart");
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return parseMultipart(Buffer.concat(chunks), boundary);
}

function parseMultipart(body, boundary) {
  const delimiter = Buffer.from(`--${boundary}`);
  const fields = {};
  const files = {};
  let start = body.indexOf(delimiter);

  while (start !== -1) {
    start += delimiter.length;
    if (body[start] === 45 && body[start + 1] === 45) break;
    if (body[start] === 13 && body[start + 1] === 10) start += 2;

    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), start);
    if (headerEnd === -1) break;
    const header = body.slice(start, headerEnd).toString("utf8");
    const next = body.indexOf(delimiter, headerEnd + 4);
    if (next === -1) break;
    let content = body.slice(headerEnd + 4, next);
    if (content.at(-2) === 13 && content.at(-1) === 10) content = content.slice(0, -2);

    const name = header.match(/name="([^"]+)"/)?.[1];
    const filename = header.match(/filename="([^"]*)"/)?.[1];
    const contentType = header.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "";
    if (name && filename !== undefined) {
      files[name] = files[name] || [];
      files[name].push({ filename, contentType, buffer: content });
    } else if (name) {
      fields[name] = content.toString("utf8");
    }
    start = next;
  }

  return { fields, files };
}
