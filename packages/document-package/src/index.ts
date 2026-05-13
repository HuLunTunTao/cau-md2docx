import type { DocumentAsset } from "@md2doc/shared";
import JSZip from "jszip";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".svg"]);

export interface ZipDocumentPackage {
  markdownName: string;
  markdownPath: string;
  markdown: string;
  assets: DocumentAsset[];
}

export interface ReadZipDocumentPackageOptions {
  readImageDimensions?: (
    data: Uint8Array,
    mimeType: string
  ) => Promise<Pick<DocumentAsset, "widthPx" | "heightPx">>;
}

export async function readZipDocumentPackage(
  data: ArrayBuffer | Uint8Array,
  options: ReadZipDocumentPackageOptions = {}
): Promise<ZipDocumentPackage> {
  const zip = await JSZip.loadAsync(data);
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
      const assetData = await entry.async("uint8array");
      const mimeType = mimeTypeFromPath(entry.name);
      const dimensions = options.readImageDimensions
        ? await options.readImageDimensions(assetData, mimeType)
        : {};
      return {
        path: relativeToMarkdown(entry.name, markdownDir),
        fileName: fileNameFromPath(entry.name),
        mimeType,
        data: assetData,
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
