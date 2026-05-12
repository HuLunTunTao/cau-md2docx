import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { readZipDocumentPackage } from "./browser";

describe("readZipDocumentPackage", () => {
  it("reads one markdown document and images directory assets from a zip", async () => {
    const zip = new JSZip();
    zip.file(
      "sample/report.md",
      "# 标题\n\n![图一](images/one.png)\n\n![图二](images/nested/two.jpg)\n"
    );
    zip.file("sample/images/one.png", Uint8Array.from([1, 2, 3]));
    zip.file("sample/images/nested/two.jpg", Uint8Array.from([4, 5, 6]));
    zip.file("sample/notes.txt", "ignored");

    const bytes = await zip.generateAsync({ type: "uint8array" });
    const file = new File([toArrayBuffer(bytes)], "sample.zip", { type: "application/zip" });

    const result = await readZipDocumentPackage(file);

    expect(result.markdownName).toBe("report.md");
    expect(result.markdownPath).toBe("sample/report.md");
    expect(result.markdown).toContain("![图一](images/one.png)");
    expect(result.assets.map((asset) => asset.path).sort()).toEqual([
      "images/nested/two.jpg",
      "images/one.png"
    ]);
  });

  it("rejects zips without exactly one markdown document", async () => {
    const zip = new JSZip();
    zip.file("a.md", "# A");
    zip.file("b.md", "# B");
    const bytes = await zip.generateAsync({ type: "uint8array" });

    await expect(readZipDocumentPackage(new File([toArrayBuffer(bytes)], "bad.zip"))).rejects.toThrow(
      "必须包含且只能包含一个 Markdown 文档"
    );
  });
});

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
