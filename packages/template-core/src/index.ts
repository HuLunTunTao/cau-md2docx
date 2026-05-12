import type {
  FormatTemplate,
  FormatTemplateValidationResult,
  ParagraphStyle
} from "@md2doc/shared";

const bodyStyle: ParagraphStyle = {
  fontFamily: "宋体",
  fontSizePt: 12,
  color: "000000",
  alignment: "justify",
  lineSpacingPt: 20,
  firstLineIndentChars: 2,
  spacingAfterPt: 0
};

export const cauCoursePaperTemplate: FormatTemplate = {
  schemaVersion: 1,
  id: "cau-course-paper",
  displayName: "CAU 课程论文",
  readonly: true,
  latinFontFamily: "Times New Roman",
  page: {
    paperSize: "A4",
    marginTopCm: 2.54,
    marginBottomCm: 2.54,
    marginLeftCm: 3.18,
    marginRightCm: 3.18
  },
  styles: {
    title: {
      fontFamily: "隶书",
      fontSizePt: 22,
      bold: true,
      color: "000000",
      alignment: "center",
      lineSpacingPt: 20,
      spacingAfterPt: 12
    },
    heading1: {
      ...bodyStyle,
      fontSizePt: 16,
      bold: true,
      alignment: "left",
      firstLineIndentChars: 0,
      spacingBeforePt: 12,
      spacingAfterPt: 6
    },
    heading2: {
      ...bodyStyle,
      fontSizePt: 14,
      bold: true,
      alignment: "left",
      firstLineIndentChars: 0,
      spacingBeforePt: 10,
      spacingAfterPt: 6
    },
    heading3: {
      ...bodyStyle,
      fontSizePt: 12,
      bold: true,
      alignment: "left",
      firstLineIndentChars: 0,
      spacingBeforePt: 8,
      spacingAfterPt: 4
    },
    body: bodyStyle,
    abstract: {
      ...bodyStyle,
      firstLineIndentChars: 0
    },
    references: {
      ...bodyStyle,
      fontSizePt: 10.5,
      firstLineIndentChars: 0,
      lineSpacingPt: 18
    }
  },
  table: {
    mode: "three-line",
    fontFamily: "宋体",
    fontSizePt: 10.5,
    topBorderPt: 1.5,
    headerBottomBorderPt: 0.75,
    bottomBorderPt: 1.5,
    showVerticalBorders: false
  },
  image: {
    paragraphStyleName: "图片",
    layout: "inline",
    alignment: "center",
    maxWidthCm: 14.64,
    spacingBeforePt: 6,
    spacingAfterPt: 0
  },
  codeBlock: {
    fontFamily: "Times New Roman",
    fontSizePt: 10.5,
    widthCm: 14.64,
    spacingBeforePt: 6,
    spacingAfterPt: 6
  },
  abstractTitle: {
    fontFamily: "宋体",
    fontSizePt: 12,
    bold: true,
    color: "000000",
    alignment: "justify",
    lineSpacingPt: 20,
    firstLineIndentChars: 0,
    spacingBeforePt: 0,
    spacingAfterPt: 0
  },
  keywordTitle: {
    fontFamily: "宋体",
    fontSizePt: 12,
    bold: true,
    color: "000000",
    alignment: "justify",
    lineSpacingPt: 20,
    firstLineIndentChars: 0,
    spacingBeforePt: 0,
    spacingAfterPt: 0
  },
  keywords: {
    fontFamily: "宋体",
    fontSizePt: 12,
    color: "000000",
    alignment: "justify",
    lineSpacingPt: 20,
    firstLineIndentChars: 0,
    spacingBeforePt: 0,
    spacingAfterPt: 0
  },
  tableCaption: {
    fontFamily: "宋体",
    fontSizePt: 10.5,
    color: "000000",
    alignment: "center",
    firstLineIndentChars: 0,
    spacingBeforePt: 6,
    spacingAfterPt: 3
  },
  figureCaption: {
    fontFamily: "宋体",
    fontSizePt: 10.5,
    color: "000000",
    alignment: "center",
    firstLineIndentChars: 0,
    spacingBeforePt: 3,
    spacingAfterPt: 6
  },
  headingNumbering: {
    enabled: true,
    level1: "arabic",
    level2: "arabic",
    level3: "arabic"
  },
  captionNumbering: {
    figureEnabled: true,
    tableEnabled: true
  }
};

export function getBuiltInTemplates(): FormatTemplate[] {
  return [structuredClone(cauCoursePaperTemplate)];
}

export function validateTemplate(template: unknown): FormatTemplateValidationResult {
  const errors: string[] = [];
  const item = template as Partial<FormatTemplate> | null;

  if (!item || typeof item !== "object") {
    return { ok: false, errors: ["模板必须是一个 JSON 对象。"] };
  }

  if (item.schemaVersion !== 1) errors.push("模板 schemaVersion 必须为 1。");
  if (!item.id || typeof item.id !== "string") errors.push("模板缺少 id。");
  if (!item.displayName || typeof item.displayName !== "string") errors.push("模板缺少显示名称。");
  if (!item.latinFontFamily || typeof item.latinFontFamily !== "string") errors.push("模板缺少全局英文字体。");
  if (!item.page) errors.push("模板缺少页面设置。");
  if (!item.styles?.body) errors.push("模板缺少正文样式。");
  if (!item.table) errors.push("模板缺少表格样式。");
  if (item.table && (!item.table.fontFamily || typeof item.table.fontFamily !== "string")) {
    errors.push("模板缺少表格中文字体。");
  }
  if (item.table && typeof item.table.fontSizePt !== "number") {
    errors.push("模板缺少表格字号。");
  }
  if (!item.image) errors.push("模板缺少图片样式。");
  if (!item.codeBlock) errors.push("模板缺少代码块样式。");
  if (item.codeBlock && (!item.codeBlock.fontFamily || typeof item.codeBlock.fontFamily !== "string")) {
    errors.push("模板缺少代码块字体。");
  }
  if (item.codeBlock && typeof item.codeBlock.fontSizePt !== "number") {
    errors.push("模板缺少代码块字号。");
  }
  if (item.codeBlock && typeof item.codeBlock.widthCm !== "number") {
    errors.push("模板缺少代码块宽度。");
  }
  if (!item.abstractTitle) errors.push("模板缺少摘要标题样式。");
  if (!item.keywordTitle) errors.push("模板缺少关键词标题样式。");
  if (!item.keywords) errors.push("模板缺少关键词样式。");
  if (!item.tableCaption) errors.push("模板缺少表题样式。");
  if (!item.figureCaption) errors.push("模板缺少图题样式。");
  if (!item.headingNumbering) errors.push("模板缺少标题自动编号设置。");
  if (!item.captionNumbering) errors.push("模板缺少题注自动编号设置。");

  return { ok: errors.length === 0, errors };
}

export function importTemplate(json: string): FormatTemplate {
  const parsed = normalizeTemplate(JSON.parse(json) as Partial<FormatTemplate>);
  const validation = validateTemplate(parsed);
  if (!validation.ok) {
    throw new Error(validation.errors.join("\n"));
  }
  return parsed as FormatTemplate;
}

export function exportTemplate(template: FormatTemplate): string {
  return JSON.stringify(template, null, 2);
}

export function cloneTemplate(template: FormatTemplate): FormatTemplate {
  return {
    ...structuredClone(template),
    id: `user-${cryptoSafeId()}`,
    displayName: `${template.displayName} 副本`,
    readonly: false
  };
}

export function normalizeTemplate(template: Partial<FormatTemplate>): FormatTemplate {
  return {
    ...template,
    schemaVersion: 1,
    id: template.id ?? `user-${cryptoSafeId()}`,
    displayName: template.displayName ?? "未命名模板",
    latinFontFamily: template.latinFontFamily ?? "Times New Roman",
    page: template.page ?? structuredClone(cauCoursePaperTemplate.page),
    styles: template.styles ?? structuredClone(cauCoursePaperTemplate.styles),
    table: {
      ...structuredClone(cauCoursePaperTemplate.table),
      ...template.table
    },
    image: {
      ...structuredClone(cauCoursePaperTemplate.image),
      ...template.image
    },
    codeBlock: {
      ...structuredClone(cauCoursePaperTemplate.codeBlock),
      ...template.codeBlock
    },
    abstractTitle: {
      ...structuredClone(cauCoursePaperTemplate.abstractTitle),
      ...template.abstractTitle
    },
    keywordTitle: {
      ...structuredClone(cauCoursePaperTemplate.keywordTitle),
      ...template.keywordTitle
    },
    keywords: {
      ...structuredClone(cauCoursePaperTemplate.keywords),
      ...template.keywords
    },
    tableCaption: {
      ...structuredClone(cauCoursePaperTemplate.tableCaption),
      ...template.tableCaption
    },
    figureCaption: {
      ...structuredClone(cauCoursePaperTemplate.figureCaption),
      ...template.figureCaption
    },
    headingNumbering: {
      ...structuredClone(cauCoursePaperTemplate.headingNumbering),
      ...template.headingNumbering
    },
    captionNumbering: {
      ...structuredClone(cauCoursePaperTemplate.captionNumbering),
      ...template.captionNumbering
    }
  };
}

function cryptoSafeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
