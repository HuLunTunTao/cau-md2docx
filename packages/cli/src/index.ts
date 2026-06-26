import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import process from "node:process";
import { renderDocx } from "@md2doc/docx-renderer";
import { readZipDocumentPackage } from "@md2doc/document-package";
import { parseMarkdown } from "@md2doc/markdown-core";
import { getBuiltInTemplates, importTemplate } from "@md2doc/template-core";
import { coverDocxBase64 } from "./generated/cover.js";

interface CliOptions {
  inputPath?: string;
  outputPath?: string;
  templatePath?: string;
  cover: boolean;
  coverFile?: string;
  help: boolean;
  version: boolean;
}

interface ImageDimensions {
  widthPx?: number;
  heightPx?: number;
}

const version = "0.1.0";

export async function run(argv: string[]): Promise<number> {
  try {
    const options = parseArgs(argv);
    if (options.help) {
      process.stdout.write(helpText());
      return 0;
    }
    if (options.version) {
      process.stdout.write(`${version}\n`);
      return 0;
    }
    if (!options.inputPath) {
      process.stderr.write("缺少输入 zip 文件。\n\n");
      process.stderr.write(helpText());
      return 1;
    }

    const documentPackage = await readZipDocumentPackage(await readFile(options.inputPath), {
      readImageDimensions
    });
    const template = options.templatePath
      ? importTemplate(await readFile(options.templatePath, "utf8"))
      : getBuiltInTemplates()[0];
    const model = parseMarkdown(documentPackage.markdown);
    const outputPath = options.outputPath ?? defaultOutputPath(options.inputPath, documentPackage.markdownName);
    const coverBytes = options.coverFile
      ? await readFile(options.coverFile)
      : options.cover
        ? Uint8Array.from(Buffer.from(coverDocxBase64, "base64"))
        : undefined;
    const bytes = await renderDocx({
      model,
      template,
      assets: documentPackage.assets,
      metadata: { title: documentPackage.markdownName.replace(/\.(md|markdown)$/i, "") },
      coverBytes
    });

    await writeFile(outputPath, bytes);
    process.stdout.write(`已生成：${outputPath}\n`);
    process.stdout.write(`已读取文档：${documentPackage.markdownPath}；图片资源：${documentPackage.assets.length} 个。\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : "转换失败。"}\n`);
    return 1;
  }
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = { cover: false, help: false, version: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "-v" || arg === "--version") {
      options.version = true;
    } else if (arg === "-o" || arg === "--output") {
      options.outputPath = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--template") {
      options.templatePath = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg === "--cover") {
      options.cover = true;
    } else if (arg === "--cover-file") {
      options.coverFile = readOptionValue(argv, index, arg);
      index += 1;
    } else if (arg.startsWith("-")) {
      throw new Error(`未知参数：${arg}`);
    } else if (!options.inputPath) {
      options.inputPath = arg;
    } else {
      throw new Error(`只能指定一个输入 zip 文件：${arg}`);
    }
  }
  return options;
}

function readOptionValue(argv: string[], index: number, name: string): string {
  const value = argv[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${name} 缺少参数值。`);
  return value;
}

function defaultOutputPath(inputPath: string, markdownName: string): string {
  const fallback = markdownName.replace(/\.(md|markdown)$/i, ".docx");
  const zipName = basename(inputPath).replace(/\.zip$/i, ".docx");
  return zipName === basename(inputPath) ? fallback : zipName;
}

export async function readImageDimensions(
  data: Uint8Array,
  mimeType: string
): Promise<ImageDimensions> {
  const dimensions =
    readPngDimensions(data) ??
    readJpegDimensions(data) ??
    readGifDimensions(data) ??
    readBmpDimensions(data) ??
    readSvgDimensions(data, mimeType);
  return dimensions ?? {};
}

function readPngDimensions(data: Uint8Array): ImageDimensions | undefined {
  if (data.length < 24) return undefined;
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((byte, index) => data[index] === byte)) return undefined;
  const view = dataView(data);
  return {
    widthPx: view.getUint32(16),
    heightPx: view.getUint32(20)
  };
}

function readJpegDimensions(data: Uint8Array): ImageDimensions | undefined {
  if (data.length < 4 || data[0] !== 0xff || data[1] !== 0xd8) return undefined;
  const view = dataView(data);
  let offset = 2;
  while (offset + 9 < data.length) {
    if (data[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = data[offset + 1];
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    if (offset + 2 > data.length) break;
    const segmentLength = view.getUint16(offset);
    if (segmentLength < 2 || offset + segmentLength > data.length) break;
    if (isJpegStartOfFrame(marker) && offset + 7 < data.length) {
      return {
        heightPx: view.getUint16(offset + 3),
        widthPx: view.getUint16(offset + 5)
      };
    }
    offset += segmentLength;
  }
  return undefined;
}

function isJpegStartOfFrame(marker: number): boolean {
  return (
    marker >= 0xc0 &&
    marker <= 0xcf &&
    ![0xc4, 0xc8, 0xcc].includes(marker)
  );
}

function readGifDimensions(data: Uint8Array): ImageDimensions | undefined {
  if (data.length < 10) return undefined;
  const header = textFromAscii(data.subarray(0, 6));
  if (header !== "GIF87a" && header !== "GIF89a") return undefined;
  const view = dataView(data);
  return {
    widthPx: view.getUint16(6, true),
    heightPx: view.getUint16(8, true)
  };
}

function readBmpDimensions(data: Uint8Array): ImageDimensions | undefined {
  if (data.length < 26 || data[0] !== 0x42 || data[1] !== 0x4d) return undefined;
  const view = dataView(data);
  return {
    widthPx: Math.abs(view.getInt32(18, true)),
    heightPx: Math.abs(view.getInt32(22, true))
  };
}

function readSvgDimensions(
  data: Uint8Array,
  mimeType: string
): ImageDimensions | undefined {
  if (!mimeType.includes("svg") && !textFromAscii(data.subarray(0, 256)).includes("<svg")) {
    return undefined;
  }
  const source = new TextDecoder("utf-8").decode(data);
  const svgTag = source.match(/<svg\b[^>]*>/i)?.[0];
  if (!svgTag) return undefined;

  const width = readSvgNumberAttribute(svgTag, "width");
  const height = readSvgNumberAttribute(svgTag, "height");
  if (width && height) return { widthPx: width, heightPx: height };

  const viewBox = svgTag.match(/\bviewBox\s*=\s*["']([^"']+)["']/i)?.[1];
  const values = viewBox?.trim().split(/[\s,]+/).map(Number);
  if (values?.length === 4 && values.every(Number.isFinite) && values[2] > 0 && values[3] > 0) {
    return { widthPx: values[2], heightPx: values[3] };
  }
  return undefined;
}

function readSvgNumberAttribute(source: string, name: string): number | undefined {
  const value = source.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1];
  if (!value || value.trim().endsWith("%")) return undefined;
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function dataView(data: Uint8Array): DataView {
  return new DataView(data.buffer, data.byteOffset, data.byteLength);
}

function textFromAscii(data: Uint8Array): string {
  return String.fromCharCode(...data);
}

function helpText(): string {
  return `用法：
  md2doc <input.zip> [-o output.docx] [--template template.json] [--cover | --cover-file cover.docx]

选项：
  -o, --output <file>       指定输出 Word 文件名
  --template <file>         使用网页导出的模板 JSON，默认使用 CAU 课程论文模板
  --cover                   添加默认封面（中国农业大学本科生课程论文封面）
  --cover-file <file>       使用指定的封面 docx 文件，隐含 --cover
  -v, --version             显示版本号
  -h, --help                显示帮助
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
