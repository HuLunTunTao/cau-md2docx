import type { DocumentAsset, FormatTemplate } from "@md2doc/shared";
import JSZip from "jszip";
import { normalizeTemplate } from "@md2doc/template-core";

const USER_TEMPLATES_KEY = "md2doc.userTemplates";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg"]);

export interface ZipDocumentPackage {
  markdownName: string;
  markdownPath: string;
  markdown: string;
  assets: DocumentAsset[];
}

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
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const entries = Object.values(zip.files).filter((entry) => !entry.dir && isUsefulEntry(entry.name));
  const markdownEntries = entries.filter((entry) => /\.(md|markdown)$/i.test(entry.name));

  if (markdownEntries.length !== 1) {
    throw new Error(`zip 中必须包含且只能包含一个 Markdown 文档，当前找到 ${markdownEntries.length} 个。`);
  }

  const markdownEntry = markdownEntries[0];
  const markdownDir = directoryName(markdownEntry.name);
  const markdown = await markdownEntry.async("string");
  const imageEntries = entries.filter((entry) => isImageEntry(entry.name) && isInsideImagesDirectory(entry.name));
  const assets = await Promise.all(
    imageEntries.map(async (entry) => {
      const data = await entry.async("uint8array");
      const mimeType = mimeTypeFromPath(entry.name);
      const dimensions = await readImageDimensions(data, mimeType);
      return {
        path: relativeToMarkdown(entry.name, markdownDir),
        fileName: fileNameFromPath(entry.name),
        mimeType,
        data,
        ...dimensions
      };
    })
  );

  return {
    markdownName: fileNameFromPath(markdownEntry.name),
    markdownPath: markdownEntry.name,
    markdown,
    assets
  };
}

export function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

function isUsefulEntry(path: string): boolean {
  return !path.startsWith("__MACOSX/") && !fileNameFromPath(path).startsWith(".");
}

function isImageEntry(path: string): boolean {
  return IMAGE_EXTENSIONS.has(extensionName(path));
}

function isInsideImagesDirectory(path: string): boolean {
  return path.split("/").includes("images");
}

function relativeToMarkdown(path: string, markdownDir: string): string {
  const normalized = normalizePath(path);
  const normalizedDir = normalizePath(markdownDir);
  if (!normalizedDir) return normalized;
  return normalized.startsWith(`${normalizedDir}/`)
    ? normalized.slice(normalizedDir.length + 1)
    : normalized;
}

function directoryName(path: string): string {
  const parts = normalizePath(path).split("/");
  parts.pop();
  return parts.join("/");
}

function fileNameFromPath(path: string): string {
  return normalizePath(path).split("/").pop() ?? path;
}

function extensionName(path: string): string {
  const fileName = fileNameFromPath(path);
  const dot = fileName.lastIndexOf(".");
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : "";
}

function normalizePath(path: string): string {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

function mimeTypeFromPath(path: string): string {
  switch (extensionName(path)) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".svg":
      return "image/svg+xml";
    default:
      return "image/png";
  }
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
