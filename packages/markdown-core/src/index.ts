import { toString } from "mdast-util-to-string";
import { unified } from "unified";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import type { DocumentModel, DocumentNode } from "@md2doc/shared";

type MdNode = {
  type: string;
  children?: MdNode[];
  depth?: number;
  ordered?: boolean | null;
  lang?: string | null;
  value?: string;
  alt?: string | null;
  url?: string;
};

export function parseMarkdown(markdown: string): DocumentModel {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdNode;
  const nodes: DocumentNode[] = [];

  for (const child of tree.children ?? []) {
    const node = convertNode(child);
    if (node) nodes.push(node);
  }

  return { nodes: attachCaptions(nodes) };
}

function convertNode(node: MdNode): DocumentNode | null {
  switch (node.type) {
    case "heading":
      return {
        type: "heading",
        depth: Math.min(node.depth ?? 1, 6) as 1 | 2 | 3 | 4 | 5 | 6,
        text: toString(node).trim()
      };
    case "paragraph": {
      const image = node.children?.find((child) => child.type === "image");
      if (image?.type === "image" && node.children?.length === 1) {
        return {
          type: "image",
          alt: image.alt ?? "",
          url: image.url ?? ""
        };
      }
      return textNode("paragraph", toString(node));
    }
    case "blockquote":
      return textNode("blockquote", toString(node));
    case "code":
      return {
        type: "code",
        language: node.lang ?? undefined,
        value: node.value ?? ""
      };
    case "list":
      return convertList(node);
    case "table":
      return convertTable(node);
    case "html":
    case "thematicBreak":
    case "definition":
    case "footnoteDefinition":
    case "yaml":
      return null;
    default:
      return textNode("paragraph", toString(node));
  }
}

function textNode(type: "paragraph" | "blockquote", value: string): DocumentNode | null {
  const text = value.trim();
  return text ? { type, text } : null;
}

function convertList(node: MdNode): DocumentNode {
  return {
    type: "list",
    ordered: Boolean(node.ordered),
    items: (node.children ?? []).map((item) => toString(item).trim()).filter(Boolean)
  };
}

function convertTable(node: MdNode): DocumentNode {
  return {
    type: "table",
    rows: (node.children ?? []).map((row) =>
      (row.children ?? []).map((cell) => toString(cell).trim())
    )
  };
}

function attachCaptions(nodes: DocumentNode[]): DocumentNode[] {
  const result: DocumentNode[] = [];
  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (node.type === "table" && result.length > 0) {
      const previous = result[result.length - 1];
      if (previous.type === "paragraph" && isTableCaption(previous.text)) {
        result.pop();
        result.push({ ...node, caption: previous.text });
        continue;
      }
    }
    if (node.type === "image" && index + 1 < nodes.length) {
      const next = nodes[index + 1];
      if (next.type === "paragraph" && isFigureCaption(next.text)) {
        result.push({ ...node, caption: next.text });
        index += 1;
        continue;
      }
    }
    result.push(node);
  }
  return result;
}

function isTableCaption(text: string): boolean {
  return /^表\s*([0-9]+(?:[-－][0-9]+)?|[一二三四五六七八九十百]+)?(\s+|[：:、.-])/.test(text.trim());
}

function isFigureCaption(text: string): boolean {
  return /^图\s*([0-9]+(?:[-－][0-9]+)?|[一二三四五六七八九十百]+)?(\s+|[：:、.-])/.test(text.trim());
}
