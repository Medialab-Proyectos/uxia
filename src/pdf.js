// Descarga directa a PDF (archivo, sin diálogo de impresión) desde el HTML que arman los reportes.
// Renderiza el HTML en un contenedor offscreen con estilos AISLADOS (scoped) para no afectar la app,
// y usa html2pdf.js (jsPDF + html2canvas). Los reportes ya usan colores hex y flex (no CSS vars ni
// grid), que es justo lo que html2canvas sí resuelve, así el formato se conserva.
// html2pdf.js (~pesado) se carga bajo demanda: solo al descargar, no en la carga inicial de la app.

// Prefija cada selector del CSS con `root` para que los estilos del reporte no toquen el resto de la
// app. Quita @page (irrelevante en html2pdf). `body { … }` se mapea al propio contenedor (root).
function scopeCss(css, root) {
  const noPage = css.replace(/@page[^{]*\{[^}]*\}/g, "");
  return noPage.replace(/(^|\})\s*([^{}@]+)\{/g, (_m, brace, sel) => {
    const scoped = sel
      .split(",")
      .map((s) => {
        const t = s.trim();
        if (!t) return t;
        if (/^body$/i.test(t)) return root;
        return `${root} ${t}`;
      })
      .join(", ");
    return `${brace} ${scoped}{`;
  });
}

function safeName(s) {
  return String(s || "reporte")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "reporte";
}

// Recibe el HTML completo (con <style>) que arman los builders y descarga un PDF con ese nombre.
export async function downloadHtmlAsPdf(html, filename) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n");
  const rootClass = "pdfx-root";

  const container = document.createElement("div");
  container.className = rootClass;
  container.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;background:#ffffff;z-index:-1;";
  const style = document.createElement("style");
  style.textContent = scopeCss(css, `.${rootClass}`);
  container.appendChild(style);
  const content = document.createElement("div");
  content.innerHTML = doc.body.innerHTML;
  container.appendChild(content);
  document.body.appendChild(container);

  const name = filename && filename.endsWith(".pdf") ? filename : `${safeName(filename)}.pdf`;
  const opt = {
    margin: [8, 8, 10, 8],
    filename: name,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    pagebreak: { mode: ["css", "avoid-all"] },
  };

  try {
    const { default: html2pdf } = await import("html2pdf.js");
    await html2pdf().set(opt).from(container).save();
  } catch (err) {
    console.error("PDF export falló:", err);
    alert("No se pudo generar el PDF. Reintenta en un momento.");
  } finally {
    container.remove();
  }
}
