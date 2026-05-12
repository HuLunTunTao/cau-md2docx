export type Alignment = "left" | "center" | "right" | "justify";

export type PaperSize = "A4";

export interface DocumentAsset {
  path: string;
  fileName: string;
  mimeType: string;
  data: Uint8Array;
  widthPx?: number;
  heightPx?: number;
}

export interface TextStyle {
  fontFamily: string;
  fontSizePt: number;
  bold?: boolean;
  color?: string;
}

export interface ParagraphStyle extends TextStyle {
  alignment: Alignment;
  lineSpacingPt?: number;
  firstLineIndentChars?: number;
  spacingBeforePt?: number;
  spacingAfterPt?: number;
}

export interface PageStyle {
  paperSize: PaperSize;
  marginTopCm: number;
  marginBottomCm: number;
  marginLeftCm: number;
  marginRightCm: number;
}

export interface TableStyle {
  mode: "three-line" | "grid";
  fontFamily: string;
  fontSizePt: number;
  topBorderPt: number;
  headerBottomBorderPt: number;
  bottomBorderPt: number;
  showVerticalBorders: boolean;
}

export interface ImageStyle {
  paragraphStyleName: string;
  layout: "inline" | "top-bottom-wrap";
  alignment: Alignment;
  maxWidthCm: number;
  spacingBeforePt: number;
  spacingAfterPt: number;
}

export type HeadingNumberFormat = "arabic" | "chinese";

export interface HeadingNumberingStyle {
  enabled: boolean;
  level1: HeadingNumberFormat;
  level2: HeadingNumberFormat;
  level3: HeadingNumberFormat;
}

export interface CaptionNumberingStyle {
  figureEnabled: boolean;
  tableEnabled: boolean;
}

export interface FormatTemplate {
  schemaVersion: 1;
  id: string;
  displayName: string;
  readonly?: boolean;
  latinFontFamily: string;
  page: PageStyle;
  styles: {
    title: ParagraphStyle;
    heading1: ParagraphStyle;
    heading2: ParagraphStyle;
    heading3: ParagraphStyle;
    body: ParagraphStyle;
    abstract: ParagraphStyle;
    references: ParagraphStyle;
  };
  table: TableStyle;
  image: ImageStyle;
  tableCaption: ParagraphStyle;
  figureCaption: ParagraphStyle;
  headingNumbering: HeadingNumberingStyle;
  captionNumbering: CaptionNumberingStyle;
}

export interface FormatTemplateValidationResult {
  ok: boolean;
  errors: string[];
}

export type DocumentNode =
  | { type: "heading"; depth: 1 | 2 | 3 | 4 | 5 | 6; text: string }
  | { type: "paragraph"; text: string }
  | { type: "blockquote"; text: string }
  | { type: "code"; language?: string; value: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; rows: string[][]; caption?: string }
  | { type: "image"; alt: string; url: string; caption?: string };

export interface DocumentModel {
  nodes: DocumentNode[];
}

export interface RenderDocxInput {
  model: DocumentModel;
  template: FormatTemplate;
  assets: DocumentAsset[];
  metadata?: {
    title?: string;
    author?: string;
  };
}

export function cmToTwip(cm: number): number {
  return Math.round((cm / 2.54) * 1440);
}

export function ptToHalfPoint(pt: number): number {
  return Math.round(pt * 2);
}

export function ptToEighthPoint(pt: number): number {
  return Math.round(pt * 8);
}

export function charsToTwip(chars: number, fontSizePt = 12): number {
  return Math.round(chars * fontSizePt * 20);
}
