// Loaded only when a customer uploads a document; workers and Spanish model are local.
export async function readSchoolFile(file: File, progress: (message: string) => void): Promise<string> {
  if (file.type === "text/plain" || file.name.toLowerCase().endsWith(".txt")) return file.text();
  let worker: import("tesseract.js").Worker | undefined;
  async function recognize(image: File | HTMLCanvasElement) {
    if (!worker) {
      progress("Preparando lector de fotos…");
      const { createWorker } = await import("tesseract.js");
      worker = await createWorker("spa", 1, {
        workerPath: "/lectura/worker.min.js", corePath: "/lectura", langPath: "/lectura",
        logger: message => {
          if (message.status === "recognizing text") progress(`Leyendo imagen… ${Math.round(message.progress * 100)} %`);
        },
      });
    }
    return (await worker.recognize(image)).data.text;
  }
  try {
    if (file.type !== "application/pdf") return await recognize(file);
    progress("Abriendo PDF…");
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
    const task = pdfjs.getDocument({ data: await file.arrayBuffer(), useSystemFonts: true });
    try {
      const pdf = await task.promise;
      if (pdf.numPages > 10) throw new Error("El PDF admite hasta 10 páginas. Divide el documento y vuelve a subirlo.");
      const pages: string[] = [];
      for (let n = 1; n <= pdf.numPages; n++) {
        progress(`Leyendo página ${n} de ${pdf.numPages}…`);
        const page = await pdf.getPage(n);
        const content = await page.getTextContent();
        // Group text fragments by visual line, including PDFs exported as tables.
        const rows: { y: number; parts: { x: number; width:number; text: string }[] }[] = [];
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const y = item.transform[5], x = item.transform[4];
          let row = rows.find(row => Math.abs(row.y - y) < 3);
          if (!row) { row = { y, parts: [] }; rows.push(row); }
          row.parts.push({ x, width:item.width, text: item.str });
        }
        let text = rows.sort((a, b) => b.y - a.y).map(row => {
          const parts=row.parts.sort((a,b)=>a.x-b.x);
          return parts.map((part,i)=>`${i?(part.x-parts[i-1].x-parts[i-1].width>14?"\t":" "):""}${part.text}`).join("");
        }).join("\n");
        if (text.replace(/\s/g, "").length < 12) {
          const base = page.getViewport({ scale: 1 });
          const viewport = page.getViewport({ scale: Math.min(2, 2400 / Math.max(base.width, base.height)) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          await page.render({ canvas, viewport }).promise;
          text = await recognize(canvas);
          canvas.width = 0; canvas.height = 0;
        }
        pages.push(text);
        page.cleanup();
        if (pages.join("\n").length > 10000) throw new Error("El documento supera los 10 000 caracteres. Divide la lista en archivos más pequeños.");
      }
      return pages.join("\n");
    } finally { await task.destroy(); }
  } finally { await worker?.terminate(); }
}
