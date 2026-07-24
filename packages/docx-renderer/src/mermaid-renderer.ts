import "./node-dom-bootstrap";
import { initWasm, Resvg } from "@resvg/resvg-wasm";
import mermaid from "mermaid";
import type { MermaidDiagramType, MermaidStyle } from "@md2doc/shared";
import wasmUrl from "@resvg/resvg-wasm/index_bg.wasm?url";

let wasmReady: Promise<void> | undefined;
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
    fontFamily: "Arial, 'Microsoft YaHei', 'PingFang SC', sans-serif",
    flowchart: { htmlLabels: false },
    sequence: { useMaxWidth: true },
    gantt: { useMaxWidth: true }
  });
  const id = `md2doc-mermaid-${diagramSequence++}`;
  const rendered = await mermaid.render(id, source);
  const svg = normalizeSvgForPng(
    style.academicMonochrome ? applyAcademicMonochrome(rendered.svg) : rendered.svg,
    diagramType
  );
  if (!wasmReady) wasmReady = initWasm(loadWasm());
  await wasmReady;
  const resvg = new Resvg(svg, {
    background: "white",
    fitTo: { mode: "zoom", value: 2 },
    font: { defaultFontFamily: "Arial" }
  });
  const pngImage = resvg.render();
  const data = pngImage.asPng();
  const result = { data, widthPx: pngImage.width, heightPx: pngImage.height };
  pngImage.free();
  resvg.free();
  return result;
}

async function loadWasm(): Promise<ArrayBuffer> {
  if (typeof process !== "undefined" && !wasmUrl.startsWith("data:")) {
    const { readFile } = await import("node:fs/promises");
    const bytes = await readFile(wasmUrl.replace(/^\/@fs/u, ""));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  }
  return fetch(wasmUrl).then((response) => response.arrayBuffer());
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
  return svg.replace(/<svg\b[^>]*>/u, (opening) => `${opening}${css}`);
}

function normalizeSvgForPng(svg: string, diagramType: MermaidDiagramType): string {
  const viewBox = svg.match(/\bviewBox="([^"]+)"/u)?.[1].trim().split(/\s+/u).map(Number);
  const width = viewBox?.[2];
  const height = viewBox?.[3];
  let normalized = svg
    .replace(/\bwidth="100%"/gu, width ? `width="${Math.max(1, Math.ceil(width))}"` : "")
    .replace(/\bheight="100%"/gu, height ? `height="${Math.max(1, Math.ceil(height))}"` : "");
  // Mermaid's generated CSS is unnecessary after the paper-style override and includes browser-only rules
  // that resvg's WASM renderer cannot always parse. Keep only the explicit override style.
  normalized = normalized.replace(/<style(?! id="md2doc-academic-monochrome")[^>]*>[\s\S]*?<\/style>/gu, "");
  normalized = normalized.replace(
    /<foreignObject\b[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>[\s\S]*?<\/foreignObject>/gu,
    (_match, label: string) => `<text x="0" y="0" text-anchor="middle" dominant-baseline="middle">${escapeXml(label.replace(/<[^>]+>/gu, "").trim())}</text>`
  );
  normalized = normalized.replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gu, "");
  if (diagramType === "flowchart" || diagramType === "state") {
    normalized = normalized
      .replace(/<defs>[\s\S]*?<\/defs>/gu, "")
      .replace(/\smarker-(?:start|end)="[^"]*"/gu, "")
      .replace(/\sfilter="[^"]*"/gu, "");
  }
  return normalized;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character]!);
}
