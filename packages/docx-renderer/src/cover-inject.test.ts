import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { AlignmentType, Document, ImageRun, Packer, Paragraph, TextRun } from "docx";
import { cauCoursePaperTemplate } from "@md2doc/template-core";
import type { DocumentModel } from "@md2doc/shared";
import { renderDocx } from "./index";
import { injectCover } from "./cover-inject";

const png1x1 = Uint8Array.from([
  137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0,
  0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 156,
  99, 248, 15, 4, 0, 9, 251, 3, 253, 160, 213, 197, 65, 0, 0, 0, 0, 73, 69, 78,
  68, 174, 66, 96, 130
]);

async function makeCoverDoc(opts: { image?: boolean; styled?: boolean } = {}): Promise<Uint8Array> {
  const { image = true, styled = false } = opts;
  const paragraphs: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "封面标题", bold: true, size: 44 })]
    })
  ];
  if (styled) {
    paragraphs.push(new Paragraph({ style: "Heading1", children: [new TextRun("带样式封面段")] }));
  }
  if (image) {
    paragraphs.push(
      new Paragraph({
        children: [new ImageRun({ type: "png", data: png1x1, transformation: { width: 100, height: 100 } })]
      })
    );
  }
  const doc = new Document({
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1080, right: 1134 } } },
        children: paragraphs
      }
    ]
  });
  return new Uint8Array(await Packer.toArrayBuffer(doc));
}

describe("injectCover", () => {
  it("prepends cover as first section with remapped image rId and prefixed styles", async () => {
    const model: DocumentModel = { nodes: [{ type: "heading", depth: 1, text: "正文标题" }] };
    const mainBytes = await renderDocx({ model, template: cauCoursePaperTemplate, assets: [] });
    const coverBytes = await makeCoverDoc({ image: true, styled: true });

    const out = await injectCover(mainBytes, coverBytes);
    const zip = await JSZip.loadAsync(out);
    const docXml = await zip.file("word/document.xml")!.async("string");
    const relsXml = await zip.file("word/_rels/document.xml.rels")!.async("string");
    const stylesXml = await zip.file("word/styles.xml")!.async("string");

    expect([...docXml.matchAll(/<w:sectPr/g)].length).toBe(2);
    expect(docXml.indexOf("封面标题")).toBeLessThan(docXml.indexOf("正文标题"));

    expect(stylesXml).toContain('w:styleId="封面_');
    expect(docXml).toContain('w:val="封面_Heading1"');
    expect(stylesXml).toContain('w:styleId="BodyText"');

    const coverImgRids = [
      ...relsXml.matchAll(/Id="(rId\d+)"[^>]*Target="media\/cover-[^"]+"/g)
    ].map((m) => m[1]);
    expect(coverImgRids.length).toBeGreaterThanOrEqual(1);
    expect(docXml).toContain(`r:embed="${coverImgRids[0]}"`);
    expect(Object.keys(zip.files).some((n) => n.startsWith("word/media/cover-"))).toBe(true);
  });

  it("works without images or style refs (minimal cover)", async () => {
    const model: DocumentModel = { nodes: [{ type: "paragraph", text: "正文" }] };
    const mainBytes = await renderDocx({ model, template: cauCoursePaperTemplate, assets: [] });
    const coverBytes = await makeCoverDoc({ image: false, styled: false });

    const out = await injectCover(mainBytes, coverBytes);
    const zip = await JSZip.loadAsync(out);
    const docXml = await zip.file("word/document.xml")!.async("string");
    expect([...docXml.matchAll(/<w:sectPr/g)].length).toBe(2);
    expect(docXml.indexOf("封面标题")).toBeLessThan(docXml.indexOf("正文"));
  });
});
