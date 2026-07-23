// Kit de generación de PDF con jsPDF (dibujo vectorial directo, texto seleccionable). No usa el DOM
// ni html2canvas, por eso NUNCA sale en blanco ni pierde formato. jsPDF + jspdf-autotable se cargan
// bajo demanda. Todo en milímetros sobre A4.

export const C = {
  teal: [23, 114, 122], ink: [29, 41, 57], gray: [102, 112, 133], line: [228, 222, 214],
  green: [13, 122, 79], amber: [183, 110, 0], red: [180, 35, 24], orange: [232, 117, 26],
  violet: [109, 40, 217], bgLight: [251, 250, 247], white: [255, 255, 255], dark: [29, 41, 57],
  softGreen: [229, 245, 238], softAmber: [255, 247, 230], softRed: [254, 243, 242],
  softTeal: [234, 244, 242], softGray: [242, 244, 247],
};

// jsPDF usa fuentes WinAnsi: normaliza caracteres que no existen ahí para que no salgan rotos.
export function t(s) {
  return String(s ?? "")
    .replace(/—/g, "-").replace(/–/g, "-")
    .replace(/≥/g, ">=").replace(/≤/g, "<=")
    .replace(/→/g, "->").replace(/←/g, "<-")
    .replace(/…/g, "...").replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

export async function newDoc() {
  const { jsPDF } = await import("jspdf");
  await import("jspdf-autotable");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  doc.setFont("helvetica", "normal");
  return doc;
}

export const PAGE = { w: 210, h: 297, mx: 14, top: 14, bottom: 16 };
export const contentW = () => PAGE.w - PAGE.mx * 2;

// Carga una imagen (misma-origin) como dataURL para incrustarla en el PDF.
export async function loadImage(url) {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = () => resolve("");
      fr.readAsDataURL(blob);
    });
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 1, h: 1 });
      img.src = dataUrl;
    });
    const fmt = /png/i.test(blob.type) ? "PNG" : /jpe?g/i.test(blob.type) ? "JPEG" : "PNG";
    return { dataUrl, ...dims, fmt };
  } catch { return null; }
}

function setFill(doc, rgb) { doc.setFillColor(rgb[0], rgb[1], rgb[2]); }
function setText(doc, rgb) { doc.setTextColor(rgb[0], rgb[1], rgb[2]); }
function setDraw(doc, rgb) { doc.setDrawColor(rgb[0], rgb[1], rgb[2]); }

// Cabecera de marca + bloque meta a la derecha. Devuelve la Y donde sigue el contenido.
export function header(doc, { title, subtitle = "", metaLines = [], logo }) {
  const x = PAGE.mx; let y = PAGE.top;
  if (logo && logo.dataUrl) {
    const h = 11, w = Math.max(6, Math.min(16, (logo.w / logo.h) * h));
    try { doc.addImage(logo.dataUrl, logo.fmt, x, y - 1, w, h); } catch { /* ignore */ }
    var bx = x + w + 3;
  } else { var bx = x; }
  setText(doc, C.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(13);
  doc.text("MediaLab Ingenieria", bx, y + 4);
  setText(doc, C.gray); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
  doc.text(t(subtitle || "Centro de Operaciones"), bx, y + 8.5);

  // Meta a la derecha
  const rx = PAGE.w - PAGE.mx;
  setText(doc, C.ink); doc.setFont("helvetica", "bold"); doc.setFontSize(11);
  doc.text(t(title), rx, y + 3, { align: "right" });
  setText(doc, C.gray); doc.setFont("helvetica", "normal"); doc.setFontSize(8);
  let my = y + 7.5;
  for (const line of metaLines) { doc.text(t(line), rx, my, { align: "right" }); my += 4; }

  y = Math.max(y + 13, my - 1);
  setDraw(doc, C.teal); doc.setLineWidth(0.8); doc.line(x, y, PAGE.w - PAGE.mx, y);
  return y + 6;
}

// Fila de tiles (métricas grandes). tiles: [{k, v, s?, color?}]. Devuelve Y siguiente.
export function tiles(doc, y, list) {
  const x = PAGE.mx, gap = 3, n = list.length;
  const w = (contentW() - gap * (n - 1)) / n, h = 18;
  list.forEach((it, i) => {
    const tx = x + i * (w + gap);
    setDraw(doc, C.line); setFill(doc, C.white); doc.setLineWidth(0.3);
    doc.roundedRect(tx, y, w, h, 1.5, 1.5, "S");
    setText(doc, C.gray); doc.setFont("helvetica", "bold"); doc.setFontSize(6.5);
    doc.text(t(String(it.k).toUpperCase()), tx + 3, y + 4.5);
    setText(doc, it.color || C.teal); doc.setFont("helvetica", "bold"); doc.setFontSize(16);
    doc.text(t(String(it.v)), tx + 3, y + 12);
    if (it.s) { setText(doc, C.gray); doc.setFont("helvetica", "normal"); doc.setFontSize(6.5); doc.text(t(it.s), tx + 3, y + 16); }
  });
  return y + h + 5;
}

// Título de sección con subrayado teal. Salta de página si no cabe.
export function sectionTitle(doc, y, text, sub = "") {
  y = ensure(doc, y, 14);
  const x = PAGE.mx;
  setText(doc, C.teal); doc.setFont("helvetica", "bold"); doc.setFontSize(12);
  doc.text(t(text), x, y);
  if (sub) { setText(doc, C.gray); doc.setFont("helvetica", "normal"); doc.setFontSize(8); doc.text(t(sub), x + doc.getTextWidth(t(text)) + 3, y); }
  y += 1.5;
  setDraw(doc, C.teal); doc.setLineWidth(0.5); doc.line(x, y, PAGE.w - PAGE.mx, y);
  return y + 5;
}

// Párrafo con ajuste de línea. opts: {size, color, bold}
export function paragraph(doc, y, text, opts = {}) {
  const size = opts.size || 9;
  doc.setFont("helvetica", opts.bold ? "bold" : "normal"); doc.setFontSize(size);
  setText(doc, opts.color || C.ink);
  const lines = doc.splitTextToSize(t(text), contentW());
  const lh = size * 0.44;
  for (const ln of lines) { y = ensure(doc, y, lh + 1); doc.text(ln, PAGE.mx, y); y += lh; }
  return y + 2;
}

// Callout: bloque con barra lateral y fondo tenue. items: array de strings (bullets).
export function callout(doc, y, items, tone = "teal") {
  const map = { teal: [C.teal, C.softTeal], red: [C.red, C.softRed], amber: [C.amber, C.softAmber] };
  const [bar, bg] = map[tone] || map.teal;
  doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
  const wrapped = items.map((it) => doc.splitTextToSize(t("• " + it), contentW() - 10));
  const lh = 4; const totalLines = wrapped.reduce((a, w) => a + w.length, 0);
  const boxH = totalLines * lh + 5;
  y = ensure(doc, y, boxH + 2);
  const x = PAGE.mx;
  setFill(doc, bg); doc.rect(x, y, contentW(), boxH, "F");
  setFill(doc, bar); doc.rect(x, y, 1.5, boxH, "F");
  setText(doc, C.ink);
  let ty = y + 4.5;
  for (const w of wrapped) { for (const ln of w) { doc.text(ln, x + 5, ty); ty += lh; } }
  return y + boxH + 4;
}

// Asegura `need` mm de espacio; si no, agrega página. Devuelve la Y usable.
export function ensure(doc, y, need = 10) {
  if (y + need > PAGE.h - PAGE.bottom) { doc.addPage(); return PAGE.top; }
  return y;
}

// Tabla con jspdf-autotable. columns: [{header, dataKey, width?, align?}]. rows: array de objetos.
// styleCell(data) opcional para colorear celdas. Devuelve Y final.
export function table(doc, y, columns, rows, opts = {}) {
  y = ensure(doc, y, 16);
  doc.autoTable({
    startY: y,
    head: [columns.map((c) => c.header)],
    body: rows.map((r) => columns.map((c) => r[c.dataKey])),
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6, lineColor: C.line, lineWidth: 0.2, textColor: C.ink, overflow: "linebreak" },
    headStyles: { fillColor: C.dark, textColor: C.white, fontStyle: "bold", fontSize: 7.5 },
    alternateRowStyles: { fillColor: C.bgLight },
    columnStyles: columns.reduce((m, c, i) => { m[i] = {}; if (c.width) m[i].cellWidth = c.width; if (c.align) m[i].halign = c.align; return m; }, {}),
    margin: { left: PAGE.mx, right: PAGE.mx },
    didParseCell: opts.didParseCell,
  });
  return doc.lastAutoTable.finalY + 5;
}

// Pie de página en todas las páginas.
export function footer(doc, leftText) {
  const pages = doc.getNumberOfPages();
  const now = new Date();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    setDraw(doc, C.line); doc.setLineWidth(0.2); doc.line(PAGE.mx, PAGE.h - 12, PAGE.w - PAGE.mx, PAGE.h - 12);
    setText(doc, C.gray); doc.setFont("helvetica", "normal"); doc.setFontSize(7.5);
    doc.text(t(leftText), PAGE.mx, PAGE.h - 8);
    doc.text(`Pagina ${i} de ${pages}`, PAGE.w - PAGE.mx, PAGE.h - 8, { align: "right" });
  }
}

export function save(doc, filename) {
  const name = filename && filename.endsWith(".pdf") ? filename : `${(filename || "reporte")}.pdf`;
  doc.save(name);
}

export function safeName(s) {
  return String(s || "reporte").normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "reporte";
}
