import { useEffect, useMemo, useState } from "react";
import { renderDocx } from "@md2doc/docx-renderer";
import { parseMarkdown } from "@md2doc/markdown-core";
import type { DocumentAsset, FormatTemplate } from "@md2doc/shared";
import {
  cloneTemplate,
  exportTemplate,
  getBuiltInTemplates,
  importTemplate
} from "@md2doc/template-core";
import { TemplateEditor } from "./TemplateEditor";
import {
  loadUserTemplates,
  readZipDocumentPackage,
  saveUserTemplates,
  triggerDownload
} from "./browser";

const builtInTemplates = getBuiltInTemplates();
const flowDiagramSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="980" height="210" viewBox="0 0 980 210" role="img" aria-labelledby="title desc">
  <title id="title">论文格式整理流程</title>
  <desc id="desc">人工撰写报告初稿，整理 Markdown 和图片目录，压缩为 zip，上传网站处理，下载 Word 文档。</desc>
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="#7a3f22"/>
    </marker>
  </defs>
  <rect width="980" height="210" fill="#fffdf9"/>
  <g font-family="PingFang SC, Microsoft YaHei, sans-serif" text-anchor="middle">
    <g transform="translate(90 58)">
      <rect width="150" height="94" rx="8" fill="#faf6ef" stroke="#cfc7bb"/>
      <text x="75" y="38" font-size="18" font-weight="700" fill="#2f2b26">报告初稿</text>
      <text x="75" y="66" font-size="13" fill="#6f6a61">人工撰写正文</text>
    </g>
    <g transform="translate(290 58)">
      <rect width="150" height="94" rx="8" fill="#faf6ef" stroke="#cfc7bb"/>
      <text x="75" y="34" font-size="18" font-weight="700" fill="#2f2b26">整理材料</text>
      <text x="75" y="60" font-size="13" fill="#6f6a61">Markdown 文档</text>
      <text x="75" y="78" font-size="13" fill="#6f6a61">images 图片目录</text>
    </g>
    <g transform="translate(490 58)">
      <rect width="150" height="94" rx="8" fill="#faf6ef" stroke="#cfc7bb"/>
      <text x="75" y="38" font-size="18" font-weight="700" fill="#2f2b26">压缩 zip</text>
      <text x="75" y="66" font-size="13" fill="#6f6a61">保持相对路径</text>
    </g>
    <g transform="translate(690 58)">
      <rect width="150" height="94" rx="8" fill="#faf6ef" stroke="#cfc7bb"/>
      <text x="75" y="38" font-size="18" font-weight="700" fill="#2f2b26">上传处理</text>
      <text x="75" y="66" font-size="13" fill="#6f6a61">选择格式模板</text>
    </g>
    <g transform="translate(850 58)">
      <rect width="110" height="94" rx="8" fill="#3f6653" stroke="#3f6653"/>
      <text x="55" y="38" font-size="18" font-weight="700" fill="#ffffff">下载 Word</text>
      <text x="55" y="66" font-size="13" fill="#edf7f1">.docx 文件</text>
    </g>
  </g>
  <g stroke="#7a3f22" stroke-width="2" marker-end="url(#arrow)">
    <line x1="240" y1="105" x2="280" y2="105"/>
    <line x1="440" y1="105" x2="480" y2="105"/>
    <line x1="640" y1="105" x2="680" y2="105"/>
    <line x1="840" y1="105" x2="850" y2="105"/>
  </g>
</svg>`)}`;
const markdownPrompt = `请整理一份可被“论文格式自动整理”网站稳定处理的 Markdown 文档，并按以下规则组织内容：

1. 输出一个完整的 Markdown 文档，不要输出解释性文字。
2. 文档将与 images/ 目录一起打包为 zip；所有图片必须使用相对路径，例如：![流程图](images/flow.png)。
3. 一级 Markdown 标题 # 用作论文标题；##、###、#### 分别作为正文中的一级、二级、三级标题。
4. 不要手写标题编号，网站会自动编号。
5. 摘要可以写成“摘要：摘要正文”，也可以把“摘要”单独写一行后下一段写摘要正文；不要写成 Markdown 标题。
6. 关键词单独写一段，格式为“关键词：词一；词二；词三”。
7. 表格必须使用 GFM Markdown 表格语法。
8. 每个表格的表题必须单独放在表格正上方一行，格式为“表 1 表题文字”或“表1 表题文字”；表题行和表格之间不要插入其他内容。
9. 如果网站开启表题自动编号，表题行也可以写成“表 表题文字”，网站会自动整理为“表1-1”或“表1”。
10. 图片必须单独成段，不要和正文放在同一行。
11. 每张图片的图题必须单独放在图片正下方一行，格式为“图 图题文字”或“图1 图题文字”；图题行和图片之间不要插入其他内容。
12. 如果网站开启图题自动编号，图题会自动整理为“图1-1”或“图1”，不要在图题正文里重复编号。
13. 表格内容只写数据，不要在表格内部写表题。
14. 正文段落保持自然中文论文表达，避免使用 HTML。
15. 如果需要代码块，使用 fenced code block。

示例：

# 论文标题

摘要：这里是摘要正文。

关键词：Markdown；DOCX；论文格式

## 研究背景

这里是正文。

![系统结构图](images/system.png)

图 系统总体结构图

表 实验参数

| 参数 | 数值 | 说明 |
| --- | --- | --- |
| A | 10 | 对照组 |
| B | 20 | 实验组 |
`;

export function App() {
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [userTemplates, setUserTemplates] = useState<FormatTemplate[]>(() => loadUserTemplates());
  const [selectedTemplateId, setSelectedTemplateId] = useState(builtInTemplates[0].id);
  const [outputName, setOutputName] = useState("");
  const [messages, setMessages] = useState<string[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("");

  const templates = useMemo(() => [...builtInTemplates, ...userTemplates], [userTemplates]);
  const selectedTemplate = templates.find((item) => item.id === selectedTemplateId) ?? templates[0];

  useEffect(() => {
    return () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
  }, [downloadUrl]);

  function updateUserTemplates(next: FormatTemplate[]) {
    setUserTemplates(next);
    saveUserTemplates(next);
  }

  async function handleConvert() {
    if (!zipFile) {
      setMessages(["请先选择包含 Markdown 文档和 images 目录的 zip 文件。"]);
      return;
    }

    setIsConverting(true);
    setMessages([]);
    if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    setDownloadUrl(null);
    setDownloadName("");
    try {
      const documentPackage = await readZipDocumentPackage(zipFile);
      const model = parseMarkdown(documentPackage.markdown);
      const missingImages = model.nodes
        .filter((node) => node.type === "image")
        .map((node) => node.url)
        .filter((url) => !hasAsset(url, documentPackage.assets));

      const bytes = await renderDocx({
        model,
        template: selectedTemplate,
        assets: documentPackage.assets,
        metadata: { title: documentPackage.markdownName.replace(/\.(md|markdown)$/i, "") }
      });

      const fileName = normalizedOutputName(outputName, documentPackage.markdownName);
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength
      ) as ArrayBuffer;

      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setDownloadName(fileName);

      setMessages([
        `已整理 ${fileName}，请点击“下载 Word”保存文件。`,
        `已读取文档：${documentPackage.markdownPath}；图片资源：${documentPackage.assets.length} 个。`,
        missingImages.length
          ? `有 ${missingImages.length} 张图片未匹配，已在文档中写入缺失提示。`
          : "图片资源已全部匹配。"
      ]);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : "整理失败。"]);
    } finally {
      setIsConverting(false);
    }
  }

  function handleCloneTemplate() {
    const cloned = cloneTemplate(selectedTemplate);
    updateUserTemplates([...userTemplates, cloned]);
    setSelectedTemplateId(cloned.id);
  }

  function handleTemplateChange(template: FormatTemplate) {
    updateUserTemplates(userTemplates.map((item) => (item.id === template.id ? template : item)));
  }

  function handleDeleteTemplate() {
    if (selectedTemplate.readonly) return;
    const next = userTemplates.filter((item) => item.id !== selectedTemplate.id);
    updateUserTemplates(next);
    setSelectedTemplateId(builtInTemplates[0].id);
  }

  function handleExportTemplate() {
    triggerDownload(
      new Blob([exportTemplate(selectedTemplate)], { type: "application/json;charset=utf-8" }),
      `${selectedTemplate.displayName}.json`
    );
  }

  async function handleImportTemplate(file: File | null) {
    if (!file) return;
    try {
      const template = importTemplate(await file.text());
      const imported = { ...template, readonly: false };
      updateUserTemplates([...userTemplates.filter((item) => item.id !== imported.id), imported]);
      setSelectedTemplateId(imported.id);
      setMessages([`已导入模板：${imported.displayName}`]);
    } catch (error) {
      setMessages([error instanceof Error ? error.message : "模板导入失败。"]);
    }
  }

  async function handleCopyPrompt() {
    try {
      await navigator.clipboard.writeText(markdownPrompt);
      setMessages(["已复制 Markdown 整理提示词。"]);
    } catch {
      setMessages(["复制失败，请手动选中提示词文本复制。"]);
    }
  }

  return (
    <main className="shell">
      <header className="hero">
        <div>
          <p className="eyebrow">纯前端 · 本地处理</p>
          <h1>论文格式自动整理</h1>
          <p>用于自动化整理论文格式：上传包含 Markdown 文档和 images 目录的 zip，选择格式模板，在浏览器内整理为 .docx 文件。</p>
        </div>
      </header>

      <section className="panel">
        <h2>文件</h2>
        <div className="grid two">
          <label className="field">
            <span>文档 zip 包</span>
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setZipFile(file);
                if (file) setOutputName(file.name.replace(/\.zip$/i, ".docx"));
              }}
            />
            <small>{zipFile ? zipFile.name : "zip 内应包含一个 .md/.markdown 文件和 images/ 目录"}</small>
          </label>
          <div className="field zip-rules">
            <span>zip 结构要求</span>
            <small>推荐结构：根目录放一个 Markdown 文档，图片放在 images/ 下，文档用 `images/xxx.png` 相对路径引用。</small>
          </div>
        </div>
        <label className="field">
          <span>输出文件名</span>
          <input value={outputName} onChange={(event) => setOutputName(event.target.value)} />
        </label>
      </section>

      <section className="panel prompt-panel">
        <div className="section-head">
          <h2>Markdown 整理辅助提示词</h2>
          <button type="button" onClick={() => void handleCopyPrompt()}>复制提示词</button>
        </div>
        <p className="hint">如果已经有人工撰写的报告初稿，可以用这段提示词辅助统一 Markdown 结构和图片引用；也可以直接按下方流程手动整理。</p>
        <textarea readOnly value={markdownPrompt} />
      </section>

      <section className="panel guide-panel">
        <h2>使用流程</h2>
        <p className="hint">从人工撰写的报告初稿出发，先整理正文和图片材料，再交给工具统一生成 Word 格式文档。</p>
        <img className="flow-diagram" src={flowDiagramSvg} alt="论文格式整理流程：报告初稿、整理材料、压缩 zip、上传处理、下载 Word" />
        <div className="guide-grid">
          <div>
            <h3>网页处理</h3>
            <ol>
              <li>将报告正文整理为一个 Markdown 文档。</li>
              <li>将图片放入 images 目录，并在 Markdown 中使用相对路径引用。</li>
              <li>把 Markdown 文档和 images 目录一起压缩为 zip。</li>
              <li>上传 zip，选择模板，生成并下载 .docx 文件。</li>
            </ol>
          </div>
          <div>
            <h3>下载版本</h3>
            <p>GitHub Release 会提供命令行脚本和单 HTML 离线网页版。命令行版本适合批量转换；离线版可直接在浏览器中打开使用。</p>
            <a className="download-link secondary-link" href="https://github.com/huluntuntao/cau-md2docx/releases" target="_blank" rel="noreferrer">
              查看 GitHub Release
            </a>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="section-head">
          <h2>模板</h2>
          <div className="actions">
            <button type="button" onClick={handleCloneTemplate}>复制为新模板</button>
            <button type="button" onClick={handleExportTemplate}>导出模板</button>
            <label className="button-like">
              导入模板
              <input
                type="file"
                accept="application/json,.json"
                onChange={(event) => void handleImportTemplate(event.target.files?.[0] ?? null)}
              />
            </label>
            <button type="button" onClick={handleDeleteTemplate} disabled={selectedTemplate.readonly}>
              删除模板
            </button>
          </div>
        </div>
        <label className="field">
          <span>当前模板</span>
          <select value={selectedTemplateId} onChange={(event) => setSelectedTemplateId(event.target.value)}>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.displayName}{template.readonly ? "（内置）" : ""}
              </option>
            ))}
          </select>
        </label>
        <TemplateEditor template={selectedTemplate} onChange={handleTemplateChange} />
      </section>

      <section className="panel convert">
        <button className="primary" type="button" onClick={handleConvert} disabled={isConverting}>
          {isConverting ? "正在整理..." : "整理 Word"}
        </button>
        {downloadUrl && (
          <a className="download-link" href={downloadUrl} download={downloadName}>
            下载 Word
          </a>
        )}
        <div className="messages">
          {messages.map((message) => (
            <p key={message}>{message}</p>
          ))}
        </div>
      </section>
    </main>
  );
}

function normalizedOutputName(outputName: string, markdownName: string): string {
  const fallback = markdownName.replace(/\.(md|markdown)$/i, ".docx");
  const value = outputName.trim() || fallback;
  return value.endsWith(".docx") ? value : `${value}.docx`;
}

function hasAsset(url: string, assets: DocumentAsset[]): boolean {
  const normalized = decodeURIComponent(url).replace(/^\.?\//, "").replaceAll("\\", "/");
  const fileName = normalized.split("/").pop();
  return assets.some((asset) => asset.path === normalized || asset.fileName === fileName);
}
