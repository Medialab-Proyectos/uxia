// Descarga directa a PDF (archivo, sin diálogo de impresión) desde el HTML que arman los reportes.
// Se renderiza el HTML COMPLETO dentro de un iframe aislado (su CSS aplica tal cual, sin scoping ni
// bleed a la app) y se captura el body con html2pdf.js (jsPDF + html2canvas). Los reportes usan hex
// y flex (no CSS vars ni grid), que es justo lo que html2canvas resuelve, así el formato se conserva.
// html2pdf.js (pesado) se carga bajo demanda: solo al descargar, no en la carga inicial de la app.

function safeName(s) {
  return String(s || "reporte")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "reporte";
}

// Recibe el HTML completo (con <style>) que arman los builders y descarga un PDF con ese nombre.
export async function downloadHtmlAsPdf(html, filename) {
  const name = filename && filename.endsWith(".pdf") ? filename : `${safeName(filename)}.pdf`;

  // Iframe aislado, invisible pero renderizado (opacity 0, detrás de todo). 794px ≈ A4 @96dpi.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:0;top:0;width:794px;height:1123px;border:0;opacity:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(iframe);

  const cleanup = () => { try { iframe.remove(); } catch { /* ignore */ } };

  try {
    const idoc = iframe.contentDocument || iframe.contentWindow.document;
    idoc.open();
    idoc.write(html);
    idoc.close();

    // Esperar a que el iframe cargue (fuentes/imágenes como el logo) antes de capturar.
    await new Promise((resolve) => {
      let done = false;
      const finish = () => { if (!done) { done = true; resolve(); } };
      iframe.onload = finish;
      setTimeout(finish, 600);
    });
    // Un frame extra para asegurar el layout final.
    await new Promise((r) => setTimeout(r, 150));

    const body = idoc.body;
    const opt = {
      margin: [8, 8, 10, 8],
      filename: name,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: 794,
        windowHeight: body.scrollHeight,
        width: 794,
        height: body.scrollHeight,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "avoid-all"] },
    };

    const { default: html2pdf } = await import("html2pdf.js");
    await html2pdf().set(opt).from(body).save();
  } catch (err) {
    console.error("PDF export falló:", err);
    alert("No se pudo generar el PDF. Reintenta en un momento.");
  } finally {
    cleanup();
  }
}
