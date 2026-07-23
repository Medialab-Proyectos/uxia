// Descarga directa a PDF (archivo, sin diálogo de impresión) desde el HTML que arman los reportes.
// Se renderiza en el DOCUMENTO PRINCIPAL (html2canvas 1.4.1 copia de forma fiable las hojas de
// estilo del <head> del documento a su clon; con un iframe hijo NO lo hace y el PDF sale sin
// formato). Para no afectar la app, el CSS del reporte se AÍSLA (scoped bajo .pdfx-root) y el
// contenedor va offscreen con position:absolute (fixed provocaba lienzo en blanco).
// Los reportes usan hex y flex (no CSS vars ni grid), justo lo que html2canvas resuelve bien.
// html2pdf.js (pesado) se carga bajo demanda: solo al descargar, no en la carga inicial de la app.

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
        if (/^:root$/i.test(t)) return root;
        if (t === "*") return `${root} *`;
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

// Espera a que carguen las imágenes del contenedor (logo) antes de capturar.
function waitForImages(el) {
  const imgs = [...el.querySelectorAll("img")];
  return Promise.all(imgs.map((img) => (img.complete ? Promise.resolve() : new Promise((res) => {
    img.onload = res; img.onerror = res; setTimeout(res, 1500);
  }))));
}

// Recibe el HTML completo (con <style>) que arman los builders y descarga un PDF con ese nombre.
export async function downloadHtmlAsPdf(html, filename) {
  const name = filename && filename.endsWith(".pdf") ? filename : `${safeName(filename)}.pdf`;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const css = [...doc.querySelectorAll("style")].map((s) => s.textContent).join("\n");
  const root = "pdfx-root";

  const styleEl = document.createElement("style");
  styleEl.setAttribute("data-pdf", "1");
  styleEl.textContent = scopeCss(css, `.${root}`);
  document.head.appendChild(styleEl);

  const container = document.createElement("div");
  container.className = root;
  container.style.cssText = "position:absolute;left:-9999px;top:0;width:794px;background:#ffffff;";
  container.innerHTML = doc.body.innerHTML;
  document.body.appendChild(container);

  const cleanup = () => { try { container.remove(); } catch { /* ignore */ } try { styleEl.remove(); } catch { /* ignore */ } };

  try {
    await waitForImages(container);
    await new Promise((r) => setTimeout(r, 120)); // asegurar layout final

    const opt = {
      margin: [8, 8, 10, 8],
      filename: name,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "avoid-all"] },
    };

    const { default: html2pdf } = await import("html2pdf.js");
    await html2pdf().set(opt).from(container).save();
  } catch (err) {
    console.error("PDF export falló:", err);
    alert("No se pudo generar el PDF. Reintenta en un momento.");
  } finally {
    cleanup();
  }
}
