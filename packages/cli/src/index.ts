import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import process from "node:process";
import { renderDocx } from "@md2doc/docx-renderer";
import { readZipDocumentPackage } from "@md2doc/document-package";
import { parseMarkdown } from "@md2doc/markdown-core";
import { getBuiltInTemplates, importTemplate } from "@md2doc/template-core";

interface CliOptions {
  inputPath?: string;
  outputPath?: string;
  templatePath?: string;
  help: boolean;
  version: boolean;
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

    const documentPackage = await readZipDocumentPackage(await readFile(options.inputPath));
    const template = options.templatePath
      ? importTemplate(await readFile(options.templatePath, "utf8"))
      : getBuiltInTemplates()[0];
    const model = parseMarkdown(documentPackage.markdown);
    const outputPath = options.outputPath ?? defaultOutputPath(options.inputPath, documentPackage.markdownName);
    const bytes = await renderDocx({
      model,
      template,
      assets: documentPackage.assets,
      metadata: { title: documentPackage.markdownName.replace(/\.(md|markdown)$/i, "") }
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
  const options: CliOptions = { help: false, version: false };
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

function helpText(): string {
  return `用法：
  md2doc <input.zip> [-o output.docx] [--template template.json]

选项：
  -o, --output <file>       指定输出 Word 文件名
  --template <file>         使用网页导出的模板 JSON，默认使用 CAU 课程论文模板
  -v, --version             显示版本号
  -h, --help                显示帮助
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
