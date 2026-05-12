import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { cauCoursePaperTemplate } from "@md2doc/template-core";
import type { DocumentModel } from "@md2doc/shared";
import { renderDocx } from "./index";

const png1x1 = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0,
  0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156,
  99, 248, 15, 4, 0, 9, 251, 3, 253, 160, 213, 197, 65, 0, 0, 0, 0, 73, 69, 78,
  68, 174, 66, 96, 130
]);

describe("renderDocx", () => {
  it("writes CAU image style and inline images", async () => {
    const model: DocumentModel = {
      nodes: [
        { type: "heading", depth: 1, text: "测试标题" },
        { type: "paragraph", text: "正文内容。" },
        { type: "image", alt: "图", url: "a.png" }
      ]
    };

    const bytes = await renderDocx({
      model,
      template: cauCoursePaperTemplate,
      assets: [{ path: "a.png", fileName: "a.png", mimeType: "image/png", data: png1x1 }]
    });

    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const stylesXml = await zip.file("word/styles.xml")!.async("string");

    expect(stylesXml).toContain('w:styleId="ImageParagraph"');
    expect(stylesXml).toContain('w:name w:val="图片"');
    expect(stylesXml).toContain('w:ascii="Times New Roman"');
    expect(stylesXml).toContain('w:hAnsi="Times New Roman"');
    expect(stylesXml).not.toContain("图图图");
    expect(extractStyle(stylesXml, "ImageParagraph")).not.toContain('w:lineRule="exact"');
    expect(extractStyle(stylesXml, "ImageParagraph")).not.toContain("<w:line ");
    expect(extractStyle(stylesXml, "ImageParagraph")).toContain('w:before="120"');
    expect(documentXml).toContain("<wp:inline");
    expect(documentXml).not.toContain("<wp:anchor");
    expect(documentXml).not.toContain("wrapTopAndBottom");
  });

  it("writes three-line table borders", async () => {
    const model: DocumentModel = {
      nodes: [{ type: "table", caption: "表 1 测试表", rows: [["列 A", "列 B"], ["1", "2"]] }]
    };

    const bytes = await renderDocx({ model, template: cauCoursePaperTemplate, assets: [] });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const stylesXml = await zip.file("word/styles.xml")!.async("string");

    expect(documentXml).toContain('w:val="single"');
    expect(documentXml).toContain('w:sz="12"');
    expect(documentXml).toContain('w:sz="6"');
    expect(documentXml).toContain('w:sz w:val="21"');
    expect(documentXml).toContain('w:ascii="Times New Roman"');
    expect(documentXml).toContain('<w:jc w:val="left"');
    expect(documentXml).toContain('w:val="none"');
    expect(documentXml).toContain("表1 测试表");
    expect(extractStyle(stylesXml, "TableCaption")).toContain('w:name w:val="表题"');
    expect(extractStyle(stylesXml, "TableCaption")).toContain('w:eastAsia="宋体"');
    expect(extractStyle(stylesXml, "TableCaption")).toContain('w:sz w:val="21"');
    expect(extractStyle(stylesXml, "TableCaption")).toContain('w:jc w:val="center"');
  });

  it("uses configurable latin and table fonts", async () => {
    const template = {
      ...cauCoursePaperTemplate,
      latinFontFamily: "Arial",
      table: {
        ...cauCoursePaperTemplate.table,
        fontFamily: "黑体",
        fontSizePt: 9
      }
    };
    const model: DocumentModel = {
      nodes: [{ type: "table", rows: [["Header"], ["Value"]] }]
    };

    const bytes = await renderDocx({ model, template, assets: [] });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");

    expect(documentXml).toContain('w:ascii="Arial"');
    expect(documentXml).toContain('w:hAnsi="Arial"');
    expect(documentXml).toContain('w:eastAsia="黑体"');
    expect(documentXml).toContain('w:sz w:val="18"');
  });

  it("adds configurable heading numbering", async () => {
    const template = {
      ...cauCoursePaperTemplate,
      headingNumbering: {
        enabled: true,
        level1: "chinese" as const,
        level2: "arabic" as const,
        level3: "chinese" as const
      }
    };
    const model: DocumentModel = {
      nodes: [
        { type: "heading", depth: 1, text: "论文标题" },
        { type: "heading", depth: 2, text: "一级标题" },
        { type: "heading", depth: 3, text: "二级标题" },
        { type: "heading", depth: 4, text: "三级标题" },
        { type: "heading", depth: 2, text: "第二个一级标题" }
      ]
    };

    const bytes = await renderDocx({ model, template, assets: [] });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");

    expect(documentXml).toContain("论文标题");
    expect(documentXml).toContain("一 一级标题");
    expect(documentXml).toContain("一.1 二级标题");
    expect(documentXml).toContain("一.1.一 三级标题");
    expect(documentXml).toContain("二 第二个一级标题");
  });

  it("renders abstract and keywords with dedicated styles", async () => {
    const model: DocumentModel = {
      nodes: [
        { type: "heading", depth: 1, text: "论文标题" },
        { type: "paragraph", text: "摘要" },
        { type: "paragraph", text: "这里是摘要正文。" },
        { type: "paragraph", text: "关键词：Markdown；DOCX" },
        { type: "heading", depth: 2, text: "引言" },
        { type: "paragraph", text: "这里是正文。" }
      ]
    };

    const bytes = await renderDocx({ model, template: cauCoursePaperTemplate, assets: [] });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const stylesXml = await zip.file("word/styles.xml")!.async("string");

    expect(stylesXml).toContain('w:styleId="AbstractTitle"');
    expect(stylesXml).toContain('w:styleId="AbstractText"');
    expect(stylesXml).toContain('w:styleId="KeywordTitle"');
    expect(stylesXml).toContain('w:styleId="KeywordsText"');
    expect(extractParagraph(documentXml, "摘要：")).toContain('w:pStyle w:val="AbstractText"');
    expect(extractParagraph(documentXml, "摘要：")).toContain("摘要：");
    expect(extractParagraph(documentXml, "摘要：")).toContain("这里是摘要正文。");
    expect(extractParagraph(documentXml, "摘要：")).toContain('w:firstLine="0"');
    expect(extractParagraph(documentXml, "摘要：")).toContain("<w:b/>");
    expect(extractParagraph(documentXml, "关键词：")).toContain('w:pStyle w:val="KeywordsText"');
    expect(extractParagraph(documentXml, "关键词：")).toContain("Markdown；DOCX");
    expect(extractParagraph(documentXml, "关键词：")).toContain("<w:b/>");
    expect(extractParagraph(documentXml, "关键词：")).toContain('w:firstLine="0"');
    expect(documentXml).toContain("1 引言");
  });

  it("numbers figure and table captions by chapter when heading numbering is enabled", async () => {
    const model: DocumentModel = {
      nodes: [
        { type: "heading", depth: 2, text: "第一章" },
        { type: "image", alt: "流程", url: "a.png", caption: "图 YOLO 检测流程图" },
        { type: "table", caption: "表 实验参数", rows: [["参数"], ["A"]] },
        { type: "heading", depth: 2, text: "第二章" },
        { type: "image", alt: "结构", url: "a.png", caption: "图 系统总体结构图" },
        { type: "table", caption: "表 第二章参数", rows: [["参数"], ["B"]] }
      ]
    };

    const bytes = await renderDocx({
      model,
      template: cauCoursePaperTemplate,
      assets: [{ path: "a.png", fileName: "a.png", mimeType: "image/png", data: png1x1 }]
    });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");
    const stylesXml = await zip.file("word/styles.xml")!.async("string");

    expect(documentXml).toContain("图1-1 YOLO 检测流程图");
    expect(documentXml).toContain("表1-1 实验参数");
    expect(documentXml).toContain("图2-1 系统总体结构图");
    expect(documentXml).toContain("表2-1 第二章参数");
    expect(extractStyle(stylesXml, "FigureCaption")).toContain('w:name w:val="图题"');
    expect(extractStyle(stylesXml, "FigureCaption")).toContain('w:eastAsia="宋体"');
  });

  it("uses continuous caption numbering when heading numbering is disabled", async () => {
    const model: DocumentModel = {
      nodes: [
        { type: "heading", depth: 2, text: "章节" },
        { type: "image", alt: "图", url: "a.png", caption: "图 系统总体结构图" },
        { type: "table", caption: "表 数据表", rows: [["参数"], ["A"]] },
        { type: "image", alt: "图", url: "a.png", caption: "图 处理流程图" }
      ]
    };
    const template = {
      ...cauCoursePaperTemplate,
      headingNumbering: { ...cauCoursePaperTemplate.headingNumbering, enabled: false }
    };

    const bytes = await renderDocx({
      model,
      template,
      assets: [{ path: "a.png", fileName: "a.png", mimeType: "image/png", data: png1x1 }]
    });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");

    expect(documentXml).toContain("图1 系统总体结构图");
    expect(documentXml).toContain("表1 数据表");
    expect(documentXml).toContain("图2 处理流程图");
  });

  it("keeps raw captions when caption numbering is disabled", async () => {
    const model: DocumentModel = {
      nodes: [
        { type: "image", alt: "图", url: "a.png", caption: "图 自定义图题" },
        { type: "table", caption: "表 自定义表题", rows: [["参数"], ["A"]] }
      ]
    };
    const template = {
      ...cauCoursePaperTemplate,
      captionNumbering: { figureEnabled: false, tableEnabled: false }
    };

    const bytes = await renderDocx({
      model,
      template,
      assets: [{ path: "a.png", fileName: "a.png", mimeType: "image/png", data: png1x1 }]
    });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");

    expect(documentXml).toContain("图 自定义图题");
    expect(documentXml).toContain("表 自定义表题");
  });

  it("renders code blocks as centered wide textboxes with left-aligned content", async () => {
    const template = {
      ...cauCoursePaperTemplate,
      codeBlock: {
        ...cauCoursePaperTemplate.codeBlock,
        fontFamily: "Consolas",
        fontSizePt: 9,
        widthCm: 12,
        spacingBeforePt: 8,
        spacingAfterPt: 10
      }
    };
    const model: DocumentModel = {
      nodes: [
        {
          type: "code",
          language: "ts",
          value: "function main() {\n  return 1;\n}"
        }
      ]
    };

    const bytes = await renderDocx({ model, template, assets: [] });
    const zip = await JSZip.loadAsync(bytes);
    const documentXml = await zip.file("word/document.xml")!.async("string");

    expect(documentXml).toContain("<w:pict>");
    expect(documentXml).toContain("<v:textbox");
    expect(documentXml).toContain("width:12.00cm");
    expect(documentXml).toContain('mso-position-horizontal:center');
    expect(documentXml).toContain('w:val="center"');
    expect(documentXml).toContain('w:val="left"');
    expect(documentXml).toContain('w:before="160"');
    expect(documentXml).toContain('w:after="200"');
    expect(documentXml).toContain('w:sz w:val="18"');
    expect(documentXml).toContain('w:ascii="Consolas"');
    expect(documentXml).toContain('w:hAnsi="Consolas"');
    expect(documentXml).toContain("function main()");
    expect(documentXml).toContain("return 1;");
  });

  it("uses configurable figure and table caption fonts", async () => {
    const template = {
      ...cauCoursePaperTemplate,
      tableCaption: { ...cauCoursePaperTemplate.tableCaption, fontFamily: "仿宋", fontSizePt: 9 },
      figureCaption: { ...cauCoursePaperTemplate.figureCaption, fontFamily: "楷体", fontSizePt: 12 }
    };
    const model: DocumentModel = {
      nodes: [
        { type: "image", alt: "图", url: "a.png", caption: "图 图题" },
        { type: "table", caption: "表 表题", rows: [["参数"], ["A"]] }
      ]
    };

    const bytes = await renderDocx({
      model,
      template,
      assets: [{ path: "a.png", fileName: "a.png", mimeType: "image/png", data: png1x1 }]
    });
    const zip = await JSZip.loadAsync(bytes);
    const stylesXml = await zip.file("word/styles.xml")!.async("string");

    expect(extractStyle(stylesXml, "TableCaption")).toContain('w:eastAsia="仿宋"');
    expect(extractStyle(stylesXml, "TableCaption")).toContain('w:sz w:val="18"');
    expect(extractStyle(stylesXml, "FigureCaption")).toContain('w:eastAsia="楷体"');
    expect(extractStyle(stylesXml, "FigureCaption")).toContain('w:sz w:val="24"');
  });
});

function extractStyle(stylesXml: string, styleId: string): string {
  const match = stylesXml.match(
    new RegExp(`<w:style[^>]+w:styleId="${styleId}"[\\s\\S]*?<\\/w:style>`)
  );
  return match?.[0] ?? "";
}

function extractParagraph(documentXml: string, text: string): string {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = documentXml.match(new RegExp(`<w:p[\\s\\S]*?${escaped}[\\s\\S]*?<\\/w:p>`));
  return match?.[0] ?? "";
}
