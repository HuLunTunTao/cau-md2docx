import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const coverPath = resolve(__dirname, "../../cover/cau-cover.docx");
const outPath = resolve(__dirname, "../src/generated/cover.ts");

const data = await readFile(coverPath);
const base64 = data.toString("base64");
await mkdir(dirname(outPath), { recursive: true });
await writeFile(
  outPath,
  `// 由 scripts/inline-cover.mjs 自动生成，请勿手动编辑。
export const coverDocxBase64 = "${base64}";
`
);
console.log(`已生成 ${outPath}（约 ${Math.round(base64.length / 1024)} KB base64）`);
