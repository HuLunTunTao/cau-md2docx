import { describe, expect, it } from "vitest";
import { cauCoursePaperTemplate } from "@md2doc/template-core";
import { detectMermaidDiagramType, renderMermaidPng } from "./mermaid-renderer";

describe("Mermaid renderer", () => {
  it("detects the diagram types used by the course-paper sample", () => {
    expect(detectMermaidDiagramType("flowchart TD\nA --> B")).toBe("flowchart");
    expect(detectMermaidDiagramType("stateDiagram-v2\n[*] --> 待复核")).toBe("state");
    expect(detectMermaidDiagramType("sequenceDiagram\n甲->>乙: 提交")).toBe("sequence");
    expect(detectMermaidDiagramType("classDiagram\nclass MealRecord")).toBe("class");
  });

  it("renders a Mermaid flowchart as a non-empty PNG", async () => {
    const png = await renderMermaidPng(
      "flowchart TD\nA[Record] --> B[Review]",
      cauCoursePaperTemplate.mermaid
    );
    expect(Array.from(png.data.slice(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(png.widthPx).toBeGreaterThan(100);
    expect(png.heightPx).toBeGreaterThan(50);
  });

  it.each([
    ["state", "stateDiagram-v2\n[*] --> 待复核\n待复核 --> 已确认: 信息完整"],
    ["class", "classDiagram\nclass MealRecord {\n  +String dishName\n  +submit()\n}\nclass Review {\n  +confirm()\n}\nMealRecord --> Review : 对应"]
  ])("renders a %s diagram as a PNG", async (_type, source) => {
    const png = await renderMermaidPng(source, cauCoursePaperTemplate.mermaid);
    expect(png.data.length).toBeGreaterThan(100);
  });

});
