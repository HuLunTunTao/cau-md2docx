import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { readZipDocumentPackage } from "./index";

describe("readZipDocumentPackage", () => {
  it("reads one markdown file and images directory assets", async () => {
    const zip = new JSZip();
    zip.file("report.md", "# 标题");
    zip.file("images/flow.svg", "<svg width=\"10\" height=\"20\"></svg>");
    zip.file("assets/ignored.png", new Uint8Array([1]));
    const data = await zip.generateAsync({ type: "uint8array" });

    const documentPackage = await readZipDocumentPackage(data, {
      readImageDimensions: async () => ({ widthPx: 10, heightPx: 20 })
    });

    expect(documentPackage.markdownName).toBe("report.md");
    expect(documentPackage.markdown).toBe("# 标题");
    expect(documentPackage.assets).toMatchObject([
      {
        path: "images/flow.svg",
        fileName: "flow.svg",
        mimeType: "image/svg+xml",
        widthPx: 10,
        heightPx: 20
      }
    ]);
  });

  it("requires exactly one markdown file", async () => {
    const zip = new JSZip();
    zip.file("a.md", "# A");
    zip.file("b.md", "# B");
    const data = await zip.generateAsync({ type: "uint8array" });

    await expect(readZipDocumentPackage(data)).rejects.toThrow("当前找到 2 个");
  });
});
