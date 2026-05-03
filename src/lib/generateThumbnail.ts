// Render page 1 of a PDF/AI file to a PNG Blob via PDF.js.
// Returns null for unsupported extensions (e.g. .eps).
import * as pdfjs from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined" && !pdfjs.GlobalWorkerOptions.workerSrc) {
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
}

const MAX_DIM = 400;

function getExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

export function isThumbnailSupported(filename: string): boolean {
  const ext = getExt(filename);
  return ext === "pdf" || ext === "ai";
}

export async function generateThumbnail(
  file: File | Blob,
  filename: string,
): Promise<Blob | null> {
  const ext = getExt(filename);
  if (ext !== "pdf" && ext !== "ai") return null;

  const buf = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const pdf = await loadingTask.promise;
  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = MAX_DIM / Math.max(baseViewport.width, baseViewport.height);
    const viewport = page.getViewport({ scale });

    const width = Math.ceil(viewport.width);
    const height = Math.ceil(viewport.height);

    let canvas: OffscreenCanvas | HTMLCanvasElement;
    if (typeof OffscreenCanvas !== "undefined") {
      canvas = new OffscreenCanvas(width, height);
    } else {
      canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
    }
    const ctx = canvas.getContext("2d") as
      | OffscreenCanvasRenderingContext2D
      | CanvasRenderingContext2D
      | null;
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    // Fill white background (PDFs without bg become transparent)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    await page.render({
      canvas: canvas as HTMLCanvasElement,
      canvasContext: ctx as CanvasRenderingContext2D,
      viewport,
    }).promise;

    if (canvas instanceof OffscreenCanvas) {
      return await canvas.convertToBlob({ type: "image/png" });
    }
    return await new Promise<Blob>((resolve, reject) => {
      (canvas as HTMLCanvasElement).toBlob(
        (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
        "image/png",
      );
    });
  } finally {
    try {
      await pdf.destroy();
    } catch {
      /* ignore */
    }
  }
}
