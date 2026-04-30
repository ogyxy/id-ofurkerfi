import { PDFDocument } from "pdf-lib";

export interface QuoteAttachment {
  filename: string;
  /** Pre-fetched bytes of the file. */
  bytes: ArrayBuffer;
  /** lowercase extension without dot, e.g. "pdf", "png", "jpg" */
  ext: string;
}

export interface MergeResult {
  bytes: Uint8Array;
  /** Names of files that could not be embedded. */
  skipped: string[];
}

const A4_W = 595.28;
const A4_H = 841.89;
const PAGE_PADDING = 20;

/**
 * Merge generated quote PDF with selected attachments.
 * - PDFs are appended page-by-page.
 * - Images are placed centered on a new A4 page, scaled to fit.
 * Anything that fails to embed is skipped and reported.
 */
export async function mergeQuotePdf(
  basePdf: ArrayBuffer,
  attachments: QuoteAttachment[],
): Promise<MergeResult> {
  const merged = await PDFDocument.load(basePdf);
  const skipped: string[] = [];

  for (const att of attachments) {
    try {
      if (att.ext === "pdf") {
        const src = await PDFDocument.load(att.bytes, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      } else if (att.ext === "png") {
        const img = await merged.embedPng(att.bytes);
        const page = merged.addPage([A4_W, A4_H]);
        const maxW = A4_W - PAGE_PADDING * 2;
        const maxH = A4_H - PAGE_PADDING * 2;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, {
          x: (A4_W - w) / 2,
          y: (A4_H - h) / 2,
          width: w,
          height: h,
        });
      } else if (att.ext === "jpg" || att.ext === "jpeg") {
        const img = await merged.embedJpg(att.bytes);
        const page = merged.addPage([A4_W, A4_H]);
        const maxW = A4_W - PAGE_PADDING * 2;
        const maxH = A4_H - PAGE_PADDING * 2;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, {
          x: (A4_W - w) / 2,
          y: (A4_H - h) / 2,
          width: w,
          height: h,
        });
      } else {
        // gif/webp/etc — pdf-lib can't embed natively; rasterize via canvas
        const dataUrl = await blobToDataUrl(new Blob([att.bytes]));
        const pngBytes = await rasterizeImageToPng(dataUrl);
        if (!pngBytes) {
          skipped.push(att.filename);
          continue;
        }
        const img = await merged.embedPng(pngBytes);
        const page = merged.addPage([A4_W, A4_H]);
        const maxW = A4_W - PAGE_PADDING * 2;
        const maxH = A4_H - PAGE_PADDING * 2;
        const scale = Math.min(maxW / img.width, maxH / img.height, 1);
        const w = img.width * scale;
        const h = img.height * scale;
        page.drawImage(img, {
          x: (A4_W - w) / 2,
          y: (A4_H - h) / 2,
          width: w,
          height: h,
        });
      }
    } catch (err) {
      console.warn("[mergeQuotePdf] skipped", att.filename, err);
      skipped.push(att.filename);
    }
  }

  const bytes = await merged.save();
  return { bytes, skipped };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

async function rasterizeImageToPng(dataUrl: string): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(null);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob(async (blob) => {
        if (!blob) return resolve(null);
        const buf = await blob.arrayBuffer();
        resolve(new Uint8Array(buf));
      }, "image/png");
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
