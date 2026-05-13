import type { DocumentAsset, FormatTemplate } from "@md2doc/shared";
import { normalizeTemplate } from "@md2doc/template-core";
import { readZipDocumentPackage as readZipDocumentPackageData } from "@md2doc/document-package";
import type { ZipDocumentPackage } from "@md2doc/document-package";

const USER_TEMPLATES_KEY = "md2doc.userTemplates";

export function loadUserTemplates(): FormatTemplate[] {
  try {
    const raw = localStorage.getItem(USER_TEMPLATES_KEY);
    return raw ? (JSON.parse(raw) as Partial<FormatTemplate>[]).map(normalizeTemplate) : [];
  } catch {
    return [];
  }
}

export function saveUserTemplates(templates: FormatTemplate[]): void {
  localStorage.setItem(USER_TEMPLATES_KEY, JSON.stringify(templates));
}

export async function readZipDocumentPackage(file: File): Promise<ZipDocumentPackage> {
  return readZipDocumentPackageData(await file.arrayBuffer(), { readImageDimensions });
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function readImageDimensions(
  data: Uint8Array,
  mimeType: string
): Promise<Pick<DocumentAsset, "widthPx" | "heightPx">> {
  const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("图片尺寸读取失败。"));
      img.src = url;
    });
    return { widthPx: image.naturalWidth, heightPx: image.naturalHeight };
  } catch {
    return {};
  } finally {
    URL.revokeObjectURL(url);
  }
}
