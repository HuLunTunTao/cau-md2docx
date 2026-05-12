import { describe, expect, it } from "vitest";
import {
  cloneTemplate,
  exportTemplate,
  getBuiltInTemplates,
  importTemplate,
  validateTemplate
} from "./index";

describe("template core", () => {
  it("validates the built-in CAU template", () => {
    const [template] = getBuiltInTemplates();
    expect(template.displayName).toBe("CAU 课程论文");
    expect(template.readonly).toBe(true);
    expect(validateTemplate(template)).toEqual({ ok: true, errors: [] });
  });

  it("round-trips exported user templates", () => {
    const cloned = cloneTemplate(getBuiltInTemplates()[0]);
    cloned.displayName = "自定义模板";

    const imported = importTemplate(exportTemplate(cloned));

    expect(imported.displayName).toBe("自定义模板");
    expect(imported.schemaVersion).toBe(1);
    expect(imported.readonly).toBe(false);
  });

  it("normalizes older templates with new font fields", () => {
    const raw = JSON.stringify({
      ...getBuiltInTemplates()[0],
      latinFontFamily: undefined,
      table: {
        mode: "three-line",
        topBorderPt: 1.5,
        headerBottomBorderPt: 0.75,
        bottomBorderPt: 1.5,
        showVerticalBorders: false
      }
    });

    const imported = importTemplate(raw);

    expect(imported.latinFontFamily).toBe("Times New Roman");
    expect(imported.table.fontFamily).toBe("宋体");
    expect(imported.table.fontSizePt).toBe(10.5);
    expect(imported.tableCaption.fontFamily).toBe("宋体");
    expect(imported.figureCaption.fontFamily).toBe("宋体");
    expect(imported.headingNumbering.enabled).toBe(true);
    expect(imported.captionNumbering.figureEnabled).toBe(true);
    expect(imported.captionNumbering.tableEnabled).toBe(true);
  });
});
