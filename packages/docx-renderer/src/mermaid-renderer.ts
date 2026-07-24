import "./node-dom-bootstrap";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import mermaid from "mermaid";
import type { MermaidDiagramType, MermaidStyle } from "@md2doc/shared";
import wasmUrl from "@resvg/resvg-wasm/index_bg.wasm?url";
import chineseFontUrl from "@fontsource/noto-serif-sc/files/noto-serif-sc-chinese-simplified-400-normal.woff2?url";
import latinFontUrl from "@fontsource/noto-serif-sc/files/noto-serif-sc-latin-400-normal.woff2?url";

let wasmReady: Promise<void> | undefined;
let embeddedFonts: Promise<Uint8Array[]> | undefined;
let diagramSequence = 0;

export interface MermaidPng {
  data: Uint8Array;
  widthPx: number;
  heightPx: number;
}

export async function renderMermaidPng(source: string, style: MermaidStyle): Promise<MermaidPng> {
  const diagramType = detectMermaidDiagramType(source);
  if (!style.enabled || !style.enabledDiagramTypes[diagramType]) {
    throw new Error(`${diagramType} 图未启用。`);
  }

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: "strict",
    theme: "base",
    fontFamily: "'Noto Serif SC', serif",
    flowchart: { htmlLabels: false },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true }
  });
  const id = `md2doc-mermaid-${diagramSequence++}`;
  const rendered = await mermaid.render(id, source);
  const svg = normalizeSvgForPng(style.academicMonochrome ? applyAcademicMonochrome(rendered.svg) : rendered.svg);
  if (!wasmReady) wasmReady = initWasm(loadWasm());
  if (!embeddedFonts) embeddedFonts = Promise.all([loadAsset(chineseFontUrl), loadAsset(latinFontUrl)]);
  await wasmReady;
  const fontBuffers = await embeddedFonts;
  const resvg = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "zoom", value: 2 },
    font: {
      fontBuffers,
      defaultFontFamily: "Noto Serif SC",
      serifFamily: "Noto Serif SC",
      sansSerifFamily: "Noto Serif SC"
    }
  });
  const pngImage = resvg.render();
  const data = pngImage.asPng();
  const result = { data, widthPx: pngImage.width, heightPx: pngImage.height };
  pngImage.free();
  resvg.free();
  return result;
}

async function loadWasm(): Promise<ArrayBuffer> {
  const bytes = await loadAsset(wasmUrl);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function loadAsset(url: string): Promise<Uint8Array> {
  if (typeof process !== "undefined" && !url.startsWith("data:")) {
    const { readFile } = await import("node:fs/promises");
    return new Uint8Array(await readFile(url.replace(/^\/@fs/u, "")));
  }
  return new Uint8Array(await fetch(url).then((response) => response.arrayBuffer()) as ArrayBuffer);
}

export function detectMermaidDiagramType(source: string): MermaidDiagramType {
  const first = source.replace(/^\s*(?:%%[^\n]*\n\s*)*/u, "").trimStart().toLowerCase();
  if (/^(flowchart|graph)\b/u.test(first)) return "flowchart";
  if (/^statediagram(?:-v2)?\b/u.test(first)) return "state";
  if (/^classdiagram\b/u.test(first)) return "class";
  if (/^sequencediagram\b/u.test(first)) return "sequence";
  if (/^erdiagram\b/u.test(first)) return "er";
  if (/^journey\b/u.test(first)) return "journey";
  if (/^gantt\b/u.test(first)) return "gantt";
  if (/^pie\b/u.test(first)) return "pie";
  if (/^mindmap\b/u.test(first)) return "mindmap";
  if (/^timeline\b/u.test(first)) return "timeline";
  if (/^gitgraph\b/u.test(first)) return "git";
  if (/^quadrantchart\b/u.test(first)) return "quadrant";
  if (/^xychart\b/u.test(first)) return "xy";
  if (/^sankey(?:-beta)?\b/u.test(first)) return "sankey";
  if (/^requirementdiagram\b/u.test(first)) return "requirement";
  if (/^block(?:-beta)?\b/u.test(first)) return "block";
  if (/^c4(?:context|container|component|dynamic|deployment)\b/u.test(first)) return "c4";
  return "flowchart";
}

function applyAcademicMonochrome(svg: string): string {
  const css = `<style id="md2doc-academic-monochrome"><![CDATA[
    svg { background: #ffffff !important; }
    .node rect, .node circle, .node ellipse, .node polygon, .node path, .cluster rect, .label-container,
    .actor, .actor-bottom, .actor-top, .labelBox, .loopLine, .note, .note rect, .classTitle,
    .state-start, .state-end, .state-container { fill: #ffffff !important; stroke: #000000 !important; }
    .nodeLabel, .nodeLabel *, .label, .label *, text, tspan, .messageText, .noteText, .loopText,
    .labelText, .classText, .edgeLabel, .edgeLabel * { fill: #000000 !important; color: #000000 !important; }
    .flowchart-link, .edgePath .path, .messageLine0, .messageLine1, .loopLine, .relation,
    .transition, .state-transition, .divider { stroke: #000000 !important; }
    marker path, .marker { fill: #000000 !important; stroke: #000000 !important; }
    .edgeLabel rect, .labelBkg { fill: #ffffff !important; opacity: 1 !important; }
    .node, .cluster, .edgePath, .messageLine0, .messageLine1 { filter: none !important; }
  ]]></style>`;
  return svg
    .replace(/\sstyle="([^"]*)"/gu, (_match, declarations: string) => {
      const withoutColors = declarations.replace(/(?:fill|stroke|color)\s*:[^;"]*;?/giu, "");
      return withoutColors ? ` style="${withoutColors}"` : "";
    })
    .replace(/<\/svg>/u, `${css}</svg>`);
}

function normalizeSvgForPng(svg: string): string {
  const viewBox = svg.match(/\bviewBox="([^"]+)"/u)?.[1].trim().split(/\s+/u).map(Number);
  const width = viewBox?.[2];
  const height = viewBox?.[3];
  let normalized = svg
    .replace(/\bwidth="100%"/gu, width ? `width="${Math.max(1, Math.ceil(width))}"` : "")
    .replace(/\bheight="100%"/gu, height ? `height="${Math.max(1, Math.ceil(height))}"` : "");
  // resvg does not support HTML inside SVG foreignObject. Replace Mermaid labels with positioned SVG text.
  normalized = normalized.replace(/<style(?! id="md2doc-academic-monochrome")[^>]*>[\s\S]*?<\/style>/gu, "");
  normalized = normalized.replace(
    /<foreignObject\b([^>]*)>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/foreignObject>/gu,
    (_match, attributes: string, label: string) => createSvgTextLabel(attributes, label)
  );
  normalized = normalized.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gu, "");
  return normalized;
}

function createSvgTextLabel(attributes: string, label: string): string {
  const x = readSvgNumber(attributes, "x");
  const y = readSvgNumber(attributes, "y");
  const width = readSvgNumber(attributes, "width");
  const height = readSvgNumber(attributes, "height");
  const lines = label.replace(/<br\s*\/?\s*>/giu, "\n").replace(/<[^>]+>/gu, "").trim().split(/\n+/u);
  const middleX = x + width / 2;
  const firstY = y + height / 2 - ((lines.length - 1) * 9);
  return `<text x="${middleX}" y="${firstY}" text-anchor="middle" dominant-baseline="middle">${lines.map((line, index) => `<tspan x="${middleX}" dy="${index === 0 ? 0 : 18}">${escapeXml(line.trim())}</tspan>`).join("")}</text>`;
}

function readSvgNumber(attributes: string, name: string): number {
  const value = attributes.match(new RegExp(`\\b${name}="([\\d.]+)"`, "u"))?.[1];
  return value ? Number(value) : 0;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}
