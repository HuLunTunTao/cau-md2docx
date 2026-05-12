import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  Textbox,
  TextRun,
  type UniversalMeasure,
  WidthType
} from "docx";
import JSZip from "jszip";
import type {
  Alignment,
  DocumentAsset,
  DocumentNode,
  FormatTemplate,
  HeadingNumberFormat,
  ParagraphStyle,
  RenderDocxInput
} from "@md2doc/shared";
import { charsToTwip, cmToTwip, ptToEighthPoint, ptToHalfPoint } from "@md2doc/shared";

const PAGE_WIDTH_CM = 21;
const FALLBACK_PNG_1X1 = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0,
  0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120,
  156, 99, 248, 15, 4, 0, 9, 251, 3, 253, 160, 213, 197, 65, 0, 0, 0, 0, 73, 69,
  78, 68, 174, 66, 96, 130
]);

export async function renderDocx(input: RenderDocxInput): Promise<Uint8Array> {
  const context: RenderContext = {
    headingCounters: [0, 0, 0],
    figureCounter: 0,
    tableCounter: 0,
    figureChapterCounter: 0,
    tableChapterCounter: 0,
    section: undefined
  };
  const children = input.model.nodes.flatMap((node) =>
    renderNode(node, input.template, input.assets, context)
  );

  const doc = new Document({
    creator: input.metadata?.author,
    title: input.metadata?.title,
    styles: createStyles(input.template),
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: cmToTwip(input.template.page.marginTopCm),
              bottom: cmToTwip(input.template.page.marginBottomCm),
              left: cmToTwip(input.template.page.marginLeftCm),
              right: cmToTwip(input.template.page.marginRightCm)
            }
          }
        },
        children
      }
    ]
  });

  const packed = await Packer.toArrayBuffer(doc);
  const bytes = new Uint8Array(packed);
  return patchDocx(bytes, input.template);
}

function renderNode(
  node: DocumentNode,
  template: FormatTemplate,
  assets: DocumentAsset[],
  context: RenderContext
): Array<Paragraph | Table | Textbox> {
  switch (node.type) {
    case "heading":
      context.section = undefined;
      return [
        paragraph(
          headingText(node.depth, node.text, template, context),
          styleForHeading(node.depth, template),
          styleIdForHeading(node.depth),
          template
        )
      ];
    case "paragraph":
      return renderParagraphNode(node.text, template, context);
    case "blockquote":
      return [paragraph(node.text, { ...template.styles.body, firstLineIndentChars: 0 }, "BodyText", template)];
    case "code":
      return [codeTextbox(node.value, template)];
    case "list":
      return node.items.map((item, index) =>
        paragraph(`${node.ordered ? `${index + 1}.` : "•"} ${item}`, {
          ...template.styles.body,
          firstLineIndentChars: 0
        }, "BodyText", template)
      );
    case "table":
      return renderTableNode(node, template, context);
    case "image":
      return renderImageNode(node, template, assets, context);
  }
}

interface RenderContext {
  headingCounters: number[];
  figureCounter: number;
  tableCounter: number;
  figureChapterCounter: number;
  tableChapterCounter: number;
  section?: "abstract-pending" | "abstract";
}

function headingText(
  depth: number,
  text: string,
  template: FormatTemplate,
  context: RenderContext
): string {
  const level = headingNumberingLevel(depth);
  if (!template.headingNumbering.enabled || level === 0) return text;

  context.headingCounters[level - 1] += 1;
  for (let index = level; index < context.headingCounters.length; index += 1) {
    context.headingCounters[index] = 0;
  }
  if (level === 1) {
    context.figureChapterCounter = 0;
    context.tableChapterCounter = 0;
  }

  const parts = context.headingCounters
    .slice(0, level)
    .map((value, index) => formatHeadingNumber(value, headingFormatForLevel(index + 1, template)));

  return `${parts.join(".")} ${text}`;
}

function headingNumberingLevel(depth: number): 0 | 1 | 2 | 3 {
  if (depth === 2) return 1;
  if (depth === 3) return 2;
  if (depth >= 4) return 3;
  return 0;
}

function headingFormatForLevel(level: number, template: FormatTemplate): HeadingNumberFormat {
  if (level === 1) return template.headingNumbering.level1;
  if (level === 2) return template.headingNumbering.level2;
  return template.headingNumbering.level3;
}

function formatHeadingNumber(value: number, format: HeadingNumberFormat): string {
  return format === "chinese" ? toChineseNumber(value) : String(value);
}

function toChineseNumber(value: number): string {
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (value <= 10) return value === 10 ? "十" : digits[value];
  if (value < 20) return `十${digits[value % 10]}`;
  if (value < 100) {
    const ten = Math.floor(value / 10);
    const one = value % 10;
    return `${digits[ten]}十${one ? digits[one] : ""}`;
  }
  return String(value);
}

function paragraph(
  text: string,
  style: ParagraphStyle,
  styleId: string,
  template: FormatTemplate
): Paragraph {
  return new Paragraph({
    style: styleId,
    alignment: toDocxAlignment(style.alignment),
    spacing: {
      before: style.spacingBeforePt ? Math.round(style.spacingBeforePt * 20) : undefined,
      after: style.spacingAfterPt ? Math.round(style.spacingAfterPt * 20) : 0,
      line: style.lineSpacingPt ? Math.round(style.lineSpacingPt * 20) : undefined,
      lineRule: style.lineSpacingPt ? ("exact" as const) : undefined
    },
    indent: {
      firstLine: style.firstLineIndentChars
        ? charsToTwip(style.firstLineIndentChars, style.fontSizePt)
        : 0
    },
    children: [new TextRun(runOptions(text, style, template))]
  });
}

function renderParagraphNode(
  text: string,
  template: FormatTemplate,
  context: RenderContext
): Paragraph[] {
  if (isAbstractTitle(text)) {
    context.section = "abstract-pending";
    return [];
  }

  const abstractText = abstractParagraphText(text);
  if (abstractText !== undefined) {
    context.section = "abstract";
    return [labelledParagraph("摘要：", abstractText, template.abstractTitle, template.styles.abstract, "AbstractText", template)];
  }

  if (isKeywordParagraph(text)) {
    context.section = undefined;
    const keywordText = text.replace(/^关键词\s*[:：]\s*/, "");
    return [
      labelledParagraph("关键词：", keywordText, template.keywordTitle, template.keywords, "KeywordsText", template)
    ];
  }

  if (context.section === "abstract-pending") {
    context.section = "abstract";
    return [labelledParagraph("摘要：", text, template.abstractTitle, template.styles.abstract, "AbstractText", template)];
  }

  if (context.section === "abstract") {
    return [
      paragraph(
        text,
        template.styles.abstract,
        "AbstractText",
        template
      )
    ];
  }

  return [paragraph(text, template.styles.body, "BodyText", template)];
}

function isAbstractTitle(text: string): boolean {
  return text.trim() === "摘要";
}

function abstractParagraphText(text: string): string | undefined {
  const match = text.trim().match(/^摘要\s*[:：]\s*(.*)$/);
  return match ? match[1] : undefined;
}

function isKeywordParagraph(text: string): boolean {
  return /^关键词\s*[:：]/.test(text.trim());
}

function labelledParagraph(
  label: string,
  text: string,
  labelStyle: ParagraphStyle,
  contentStyle: ParagraphStyle,
  styleId: string,
  template: FormatTemplate
): Paragraph {
  return new Paragraph({
    style: styleId,
    alignment: toDocxAlignment(contentStyle.alignment),
    spacing: {
      before: contentStyle.spacingBeforePt ? Math.round(contentStyle.spacingBeforePt * 20) : undefined,
      after: contentStyle.spacingAfterPt ? Math.round(contentStyle.spacingAfterPt * 20) : 0,
      line: contentStyle.lineSpacingPt ? Math.round(contentStyle.lineSpacingPt * 20) : undefined,
      lineRule: contentStyle.lineSpacingPt ? ("exact" as const) : undefined
    },
    indent: {
      firstLine: contentStyle.firstLineIndentChars
        ? charsToTwip(contentStyle.firstLineIndentChars, contentStyle.fontSizePt)
        : 0
    },
    children: [
      new TextRun(runOptions(label, labelStyle, template)),
      new TextRun(runOptions(text, contentStyle, template))
    ]
  });
}

function codeTextbox(text: string, template: FormatTemplate): Textbox {
  const contentWidthCm =
    PAGE_WIDTH_CM - template.page.marginLeftCm - template.page.marginRightCm;
  const widthCm = Math.min(template.codeBlock.widthCm, contentWidthCm);
  const codeStyle: ParagraphStyle = {
    ...template.styles.body,
    fontFamily: template.codeBlock.fontFamily,
    fontSizePt: template.codeBlock.fontSizePt,
    alignment: "left",
    lineSpacingPt: undefined,
    firstLineIndentChars: 0,
    spacingBeforePt: 0,
    spacingAfterPt: 0
  };
  const width: UniversalMeasure = `${widthCm.toFixed(2)}cm` as UniversalMeasure;

  return new Textbox({
    alignment: AlignmentType.CENTER,
    spacing: {
      before: Math.round(template.codeBlock.spacingBeforePt * 20),
      after: Math.round(template.codeBlock.spacingAfterPt * 20)
    },
    style: {
      width,
      position: "relative",
      positionHorizontal: "center",
      positionHorizontalRelative: "text",
      wrapStyle: "none"
    },
    children: codeLines(text).map(
      (line) =>
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { before: 0, after: 0 },
          indent: { firstLine: 0 },
          children: [new TextRun(codeRunOptions(line || " ", codeStyle))]
        })
    )
  });
}

function codeLines(text: string): string[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  return lines.length ? lines : [""];
}

function codeRunOptions(text: string, style: ParagraphStyle) {
  return {
    text,
    color: style.color ?? "000000",
    size: ptToHalfPoint(style.fontSizePt),
    font: {
      ascii: style.fontFamily,
      eastAsia: style.fontFamily,
      hAnsi: style.fontFamily
    }
  };
}

function renderTableNode(
  node: Extract<DocumentNode, { type: "table" }>,
  template: FormatTemplate,
  context: RenderContext
): Array<Paragraph | Table> {
  const blocks: Array<Paragraph | Table> = [];
  if (node.caption) {
    blocks.push(
      paragraph(
        captionText("table", node.caption, template, context),
        tableCaptionStyle(template),
        "TableCaption",
        template
      )
    );
  }
  blocks.push(renderTable(node.rows, template));
  return blocks;
}

function renderTable(rows: string[][], template: FormatTemplate): Table {
  const borderNone = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
  const borderTop = {
    style: BorderStyle.SINGLE,
    size: ptToEighthPoint(template.table.topBorderPt),
    color: "000000"
  };
  const borderHeader = {
    style: BorderStyle.SINGLE,
    size: ptToEighthPoint(template.table.headerBottomBorderPt),
    color: "000000"
  };
  const borderBottom = {
    style: BorderStyle.SINGLE,
    size: ptToEighthPoint(template.table.bottomBorderPt),
    color: "000000"
  };

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders:
      template.table.mode === "grid"
        ? undefined
        : {
            top: borderNone,
            bottom: borderNone,
            left: borderNone,
            right: borderNone,
            insideHorizontal: borderNone,
            insideVertical: borderNone
          },
    rows: rows.map((row, rowIndex) =>
      new TableRow({
        children: row.map(
          (cell) =>
            new TableCell({
              borders:
                template.table.mode === "three-line"
                  ? {
                      top: rowIndex === 0 ? borderTop : borderNone,
                      bottom:
                        rowIndex === 0
                          ? borderHeader
                          : rowIndex === rows.length - 1
                            ? borderBottom
                            : borderNone,
                      left: template.table.showVerticalBorders ? borderTop : borderNone,
                      right: template.table.showVerticalBorders ? borderTop : borderNone
                    }
                  : undefined,
              children: [
                paragraph(cell, {
                  ...tableCellStyle(template),
                  firstLineIndentChars: 0,
                  alignment: "left"
                }, "BodyText", template)
              ]
            })
        )
      })
    )
  });
}

function renderImageNode(
  node: Extract<DocumentNode, { type: "image" }>,
  template: FormatTemplate,
  assets: DocumentAsset[],
  context: RenderContext
): Paragraph[] {
  const blocks = [renderImage(node, template, assets)];
  if (node.caption) {
    blocks.push(
      paragraph(
        captionText("figure", node.caption, template, context),
        figureCaptionStyle(template),
        "FigureCaption",
        template
      )
    );
  }
  return blocks;
}

function renderImage(
  node: Extract<DocumentNode, { type: "image" }>,
  template: FormatTemplate,
  assets: DocumentAsset[]
): Paragraph {
  const asset = findAsset(node.url, assets);
  if (!asset) {
    return paragraph(`[图片缺失：${node.url}]`, template.styles.body, "BodyText", template);
  }

  const contentWidthCm =
    PAGE_WIDTH_CM - template.page.marginLeftCm - template.page.marginRightCm;
  const widthCm = Math.min(template.image.maxWidthCm, contentWidthCm);
  const widthPx = Math.round(widthCm * 37.795);
  const aspectRatio = asset.widthPx && asset.heightPx ? asset.heightPx / asset.widthPx : 0.62;

  return new Paragraph({
    style: "ImageParagraph",
    alignment: toDocxAlignment(template.image.alignment),
    spacing: {
      before: Math.round(template.image.spacingBeforePt * 20),
      after: Math.round(template.image.spacingAfterPt * 20)
    },
    children: [
      new ImageRun(imageRunOptions(asset, widthPx, Math.round(widthPx * aspectRatio)))
    ]
  });
}

function imageRunOptions(asset: DocumentAsset, width: number, height: number) {
  const transformation = { width, height };
  const type = imageType(asset.mimeType);
  if (type === "svg") {
    return {
      type,
      data: asset.data,
      transformation,
      fallback: {
        type: "png" as const,
        data: FALLBACK_PNG_1X1
      }
    };
  }
  return {
    type,
    data: asset.data,
    transformation
  };
}

function findAsset(url: string, assets: DocumentAsset[]): DocumentAsset | undefined {
  const normalized = normalizePath(url);
  const fileName = normalized.split("/").pop();
  return assets.find((asset) => {
    const assetPath = normalizePath(asset.path);
    return assetPath === normalized || asset.fileName === fileName;
  });
}

function normalizePath(path: string): string {
  return decodeURIComponent(path).replace(/^\.?\//, "").replaceAll("\\", "/");
}

function imageType(mimeType: string): "png" | "jpg" | "gif" | "bmp" | "svg" {
  if (mimeType.includes("svg")) return "svg";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "jpg";
  if (mimeType.includes("gif")) return "gif";
  if (mimeType.includes("bmp")) return "bmp";
  return "png";
}

function styleForHeading(depth: number, template: FormatTemplate): ParagraphStyle {
  if (depth === 1) return template.styles.title;
  if (depth === 2) return template.styles.heading1;
  if (depth === 3) return template.styles.heading2;
  return template.styles.heading3;
}

function styleIdForHeading(depth: number): string {
  if (depth === 1) return "TitleStyle";
  if (depth === 2) return "Heading1Style";
  if (depth === 3) return "Heading2Style";
  return "Heading3Style";
}

function runOptions(text: string, style: ParagraphStyle, template: FormatTemplate) {
  return {
    text,
    bold: style.bold,
    color: style.color ?? "000000",
    size: ptToHalfPoint(style.fontSizePt),
    font: {
      ascii: latinFont(template),
      eastAsia: style.fontFamily,
      hAnsi: latinFont(template)
    }
  };
}

function toDocxAlignment(alignment: Alignment): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (alignment) {
    case "center":
      return AlignmentType.CENTER;
    case "right":
      return AlignmentType.RIGHT;
    case "justify":
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.LEFT;
  }
}

function createStyles(template: FormatTemplate) {
  return {
    paragraphStyles: [
      paragraphStyle("TitleStyle", "论文标题", template.styles.title, template),
      paragraphStyle("Heading1Style", "一级标题", template.styles.heading1, template),
      paragraphStyle("Heading2Style", "二级标题", template.styles.heading2, template),
      paragraphStyle("Heading3Style", "三级标题", template.styles.heading3, template),
      paragraphStyle("BodyText", "正文", template.styles.body, template),
      paragraphStyle("AbstractTitle", "摘要标题", template.abstractTitle, template),
      paragraphStyle("AbstractText", "摘要正文", template.styles.abstract, template),
      paragraphStyle("KeywordTitle", "关键词标题", template.keywordTitle, template),
      paragraphStyle("KeywordsText", "关键词", template.keywords, template),
      paragraphStyle("TableCaption", "表题", tableCaptionStyle(template), template),
      paragraphStyle("FigureCaption", "图题", figureCaptionStyle(template), template),
      paragraphStyle("ImageParagraph", template.image.paragraphStyleName, imageParagraphStyle(template), template)
    ]
  };
}

function tableCaptionStyle(template: FormatTemplate): ParagraphStyle {
  return template.tableCaption;
}

function figureCaptionStyle(template: FormatTemplate): ParagraphStyle {
  return template.figureCaption;
}

function captionText(
  kind: "figure" | "table",
  rawCaption: string,
  template: FormatTemplate,
  context: RenderContext
): string {
  const enabled =
    kind === "figure"
      ? template.captionNumbering.figureEnabled
      : template.captionNumbering.tableEnabled;
  if (!enabled) return rawCaption;

  const title = stripCaptionPrefix(kind, rawCaption);
  const prefix = captionNumber(kind, template, context);
  return `${prefix} ${title}`;
}

function captionNumber(
  kind: "figure" | "table",
  template: FormatTemplate,
  context: RenderContext
): string {
  const label = kind === "figure" ? "图" : "表";
  if (template.headingNumbering.enabled && context.headingCounters[0] > 0) {
    if (kind === "figure") {
      context.figureChapterCounter += 1;
      return `${label}${context.headingCounters[0]}-${context.figureChapterCounter}`;
    }
    context.tableChapterCounter += 1;
    return `${label}${context.headingCounters[0]}-${context.tableChapterCounter}`;
  }

  if (kind === "figure") {
    context.figureCounter += 1;
    return `${label}${context.figureCounter}`;
  }
  context.tableCounter += 1;
  return `${label}${context.tableCounter}`;
}

function stripCaptionPrefix(kind: "figure" | "table", caption: string): string {
  const label = kind === "figure" ? "图" : "表";
  const pattern = new RegExp(
    `^${label}\\s*([0-9]+(?:[-－][0-9]+)?|[一二三四五六七八九十百]+)?[\\s：:、.-]*(.*)$`
  );
  const match = caption.trim().match(pattern);
  return match?.[2]?.trim() || caption.trim();
}

function imageParagraphStyle(template: FormatTemplate): ParagraphStyle {
  return {
    fontFamily: template.styles.body.fontFamily,
    fontSizePt: template.styles.body.fontSizePt,
    color: template.styles.body.color ?? "000000",
    alignment: template.image.alignment,
    firstLineIndentChars: 0,
    spacingBeforePt: template.image.spacingBeforePt,
    spacingAfterPt: template.image.spacingAfterPt
  };
}

function paragraphStyle(id: string, name: string, style: ParagraphStyle, template: FormatTemplate) {
  return {
    id,
    name,
    basedOn: "Normal",
    next: "Normal",
    quickFormat: true,
    run: {
      bold: style.bold,
      color: style.color ?? "000000",
      size: ptToHalfPoint(style.fontSizePt),
      font: {
        ascii: latinFont(template),
        eastAsia: style.fontFamily,
        hAnsi: latinFont(template)
      }
    },
    paragraph: {
      alignment: toDocxAlignment(style.alignment),
      spacing: {
        before: style.spacingBeforePt ? Math.round(style.spacingBeforePt * 20) : undefined,
        after: style.spacingAfterPt ? Math.round(style.spacingAfterPt * 20) : 0,
        line: style.lineSpacingPt ? Math.round(style.lineSpacingPt * 20) : undefined,
        lineRule: style.lineSpacingPt ? ("exact" as const) : undefined
      },
      indent: {
        firstLine: style.firstLineIndentChars
          ? charsToTwip(style.firstLineIndentChars, style.fontSizePt)
          : 0
      }
    }
  };
}

function tableCellStyle(template: FormatTemplate): ParagraphStyle {
  return {
    ...template.styles.body,
    fontFamily: template.table.fontFamily,
    fontSizePt: template.table.fontSizePt,
    firstLineIndentChars: 0,
    alignment: "left"
  };
}

function latinFont(template: FormatTemplate): string {
  return template.latinFontFamily || "Times New Roman";
}

async function patchDocx(bytes: Uint8Array, template: FormatTemplate): Promise<Uint8Array> {
  const zip = await JSZip.loadAsync(bytes);
  const stylesFile = zip.file("word/styles.xml");
  if (stylesFile) {
    const stylesXml = await stylesFile.async("string");
    zip.file("word/styles.xml", ensureImageStyleName(stylesXml, template.image.paragraphStyleName));
  }
  const output = await zip.generateAsync({ type: "uint8array" });
  return output;
}

function ensureImageStyleName(stylesXml: string, styleName: string): string {
  return stylesXml.replace(
    /(<w:style[^>]+w:styleId="ImageParagraph"[\s\S]*?<w:name w:val=")([^"]+)("[\s\S]*?<\/w:style>)/,
    `$1${escapeXmlAttribute(styleName)}$3`
  );
}

function escapeXmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
