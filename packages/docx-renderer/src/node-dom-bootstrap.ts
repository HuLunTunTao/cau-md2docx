import { parseHTML } from "linkedom";

class CssStyleSheetShim {
  cssRules: Array<{ cssText: string }> = [];
  insertRule(rule: string, index = this.cssRules.length): number {
    this.cssRules.splice(index, 0, { cssText: rule });
    return index;
  }
  replaceSync(css: string): void {
    this.cssRules = [{ cssText: css }];
  }
}

if (typeof document === "undefined") {
  const { window } = parseHTML("<!doctype html><html><body></body></html>");
  const globals = globalThis as typeof globalThis & Record<string, unknown>;
  const svgPrototype = window.SVGElement.prototype as SVGElement & {
    getBBox?: () => { x: number; y: number; width: number; height: number };
    getComputedTextLength?: () => number;
  };
  if (!svgPrototype.getBBox) {
    svgPrototype.getBBox = function getBBox() {
      return estimateSvgBounds(this);
    };
  }
  if (!svgPrototype.getComputedTextLength) {
    svgPrototype.getComputedTextLength = function getComputedTextLength() {
      return this.getBBox?.().width ?? 0;
    };
  }
  for (const key of ["window", "document", "Node", "Element", "HTMLElement", "SVGElement", "DOMParser"] as const) {
    globals[key] = window[key as keyof typeof window];
  }
  (globals as Record<string, unknown>).CSSStyleSheet = CssStyleSheetShim;
}

function estimateSvgBounds(element: SVGElement): { x: number; y: number; width: number; height: number } {
  const boxes: Array<{ x: number; y: number; width: number; height: number }> = [];
  const x = Number(element.getAttribute("x")) || 0;
  const y = Number(element.getAttribute("y")) || 0;
  const width = Number(element.getAttribute("width"));
  const height = Number(element.getAttribute("height"));
  if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) boxes.push({ x, y, width, height });

  const tag = element.tagName.toLowerCase();
  if (tag === "text" || tag === "tspan") {
    const text = element.textContent?.trim() ?? "";
    boxes.push({ x, y: Number(element.getAttribute("y")) || 0, width: Math.max(1, text.length * 16), height: 20 });
  }
  if (tag === "circle" || tag === "ellipse") {
    const radiusX = Number(element.getAttribute(tag === "circle" ? "r" : "rx")) || 0;
    const radiusY = Number(element.getAttribute(tag === "circle" ? "r" : "ry")) || radiusX;
    const centerX = Number(element.getAttribute("cx")) || 0;
    const centerY = Number(element.getAttribute("cy")) || 0;
    boxes.push({ x: centerX - radiusX, y: centerY - radiusY, width: radiusX * 2, height: radiusY * 2 });
  }
  for (const child of Array.from(element.children)) {
    if (!(child instanceof window.SVGElement)) continue;
    const childBox = estimateSvgBounds(child);
    const transform = child.getAttribute("transform") ?? "";
    const translate = transform.match(/translate\(\s*([-.\d]+)(?:[ ,]\s*([-.\d]+))?\s*\)/u);
    boxes.push({
      x: childBox.x + Number(translate?.[1] ?? 0),
      y: childBox.y + Number(translate?.[2] ?? 0),
      width: childBox.width,
      height: childBox.height
    });
  }
  if (boxes.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
  const left = Math.min(...boxes.map((box) => box.x));
  const top = Math.min(...boxes.map((box) => box.y));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const bottom = Math.max(...boxes.map((box) => box.y + box.height));
  return { x: left, y: top, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
}
