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
      const text = this.textContent?.trim() ?? "";
      return {
        x: 0,
        y: 0,
        width: Number(this.getAttribute("width")) || Math.min(400, Math.max(1, text.length * 8)),
        height: Number(this.getAttribute("height")) || Math.min(80, Math.max(16, Math.ceil(text.length / 40) * 16))
      };
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
