import JSZip from "jszip";

const COVER_PREFIX = "封面_";
const IMAGE_REL_TYPE = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image";

export async function injectCover(
  mainBytes: Uint8Array,
  coverBytes: Uint8Array
): Promise<Uint8Array> {
  const mainZip = await JSZip.loadAsync(mainBytes);
  const coverZip = await JSZip.loadAsync(coverBytes);

  await mergeCoverStyles(mainZip, coverZip);
  await mergeCoverCompat(mainZip, coverZip);

  const coverDocXml = await coverZip.file("word/document.xml")!.async("string");
  const { coverBodyContent, coverSectPr } = extractCoverBody(coverDocXml);
  const ridMap = await remapCoverImages(mainZip, coverZip);

  let injectedBody = rewriteImageRids(coverBodyContent, ridMap);
  injectedBody = rewriteStyleRefs(injectedBody);

  const coverSection = injectedBody + `<w:p><w:pPr>${coverSectPr}</w:pPr></w:p>`;
  const mainDocXml = await mainZip.file("word/document.xml")!.async("string");
  mainZip.file("word/document.xml", mainDocXml.replace("<w:body>", "<w:body>" + coverSection));

  await ensureContentTypes(mainZip);

  return mainZip.generateAsync({ type: "uint8array" });
}

async function mergeCoverCompat(mainZip: JSZip, coverZip: JSZip): Promise<void> {
  const coverSettingsFile = coverZip.file("word/settings.xml");
  const mainSettingsFile = mainZip.file("word/settings.xml");
  if (!coverSettingsFile || !mainSettingsFile) return;
  const coverSettingsXml = await coverSettingsFile.async("string");
  const mainSettingsXml = await mainSettingsFile.async("string");

  // 封面用东亚排版兼容性开关（如 ulTrailSpace 让下划线覆盖尾随空格、spaceForUL 为下划线留空间），
  // 主文档（docx 库生成）默认缺失，导致封面下划线空格不渲染。补全封面 compat 子元素。
  const coverCompatChildren = coverSettingsXml.match(/<w:compat>([\s\S]*?)<\/w:compat>/)?.[1];
  if (!coverCompatChildren) return;
  const mainCompatMatch = mainSettingsXml.match(/<w:compat>[\s\S]*?<\/w:compat>/);
  if (!mainCompatMatch) {
    mainZip.file("word/settings.xml", mainSettingsXml.replace("</w:settings>", `<w:compat>${coverCompatChildren}</w:compat></w:settings>`));
    return;
  }
  const existing = new Set(
    [...mainCompatMatch[0].matchAll(/<w:(\w+)\b[^>]*\/>/g)].map((m) => m[1])
  );
  const additions = [...coverCompatChildren.matchAll(/<w:(\w+)\b[^>]*\/>/g)]
    .filter((m) => !existing.has(m[1]))
    .map((m) => m[0])
    .join("");
  if (additions) {
    mainZip.file(
      "word/settings.xml",
      mainSettingsXml.replace("</w:compat>", additions + "</w:compat>")
    );
  }
}

async function mergeCoverStyles(mainZip: JSZip, coverZip: JSZip): Promise<void> {
  const coverStylesFile = coverZip.file("word/styles.xml");
  const mainStylesFile = mainZip.file("word/styles.xml");
  if (!coverStylesFile || !mainStylesFile) return;
  const coverStylesXml = await coverStylesFile.async("string");
  let mainStylesXml = await mainStylesFile.async("string");

  // 合并封面 docDefaults 的 rPrDefault：封面部分 run 仅写 w:hint 未指定字体，依赖文档默认字体。
  // 主文档 rPrDefault 为空，且正文 run 均显式指定字体，故用封面默认字体填充不影响正文。
  const coverRprDefault = coverStylesXml.match(
    /<w:rPrDefault>\s*(<w:rPr>[\s\S]*?<\/w:rPr>)\s*<\/w:rPrDefault>/
  )?.[1];
  if (coverRprDefault) {
    mainStylesXml = mainStylesXml.replace(
      /<w:rPrDefault\s*\/>|<w:rPrDefault><\/w:rPrDefault>/,
      `<w:rPrDefault>${coverRprDefault}</w:rPrDefault>`
    );
  }

  const styles = extractStyleElements(coverStylesXml);
  if (styles.length > 0) {
    const prefixed = styles.map(addCoverPrefix).join("");
    mainStylesXml = mainStylesXml.replace("</w:styles>", prefixed + "</w:styles>");
  }
  mainZip.file("word/styles.xml", mainStylesXml);
}

function extractStyleElements(stylesXml: string): string[] {
  const result: string[] = [];
  const re = /<w:style\b[^>]*>[\s\S]*?<\/w:style>/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(stylesXml)) !== null) result.push(match[0]);
  return result;
}

function addCoverPrefix(styleXml: string): string {
  let xml = styleXml;
  xml = xml.replace(/(<w:style\b[^>]*?)\s+w:default="1"/, "$1");
  xml = xml.replace(/(<w:style\b[^>]*?w:styleId=")/, `$1${COVER_PREFIX}`);
  xml = xml.replace(/(<w:(?:basedOn|link|next)\s+w:val=")/g, `$1${COVER_PREFIX}`);
  return xml;
}

function extractCoverBody(coverDocXml: string): { coverBodyContent: string; coverSectPr: string } {
  const bodyOpenEnd = coverDocXml.indexOf("<w:body>") + "<w:body>".length;
  const bodyCloseStart = coverDocXml.lastIndexOf("</w:body>");
  const bodyInner = coverDocXml.slice(bodyOpenEnd, bodyCloseStart);
  const sectPrStart = bodyInner.lastIndexOf("<w:sectPr");
  if (sectPrStart < 0) return { coverBodyContent: bodyInner, coverSectPr: "" };
  const sectPrCloseEnd = bodyInner.indexOf("</w:sectPr>", sectPrStart) + "</w:sectPr>".length;
  return {
    coverBodyContent: bodyInner.slice(0, sectPrStart),
    coverSectPr: bodyInner.slice(sectPrStart, sectPrCloseEnd)
  };
}

async function remapCoverImages(mainZip: JSZip, coverZip: JSZip): Promise<Map<string, string>> {
  const ridMap = new Map<string, string>();
  const coverRelsFile = coverZip.file("word/_rels/document.xml.rels");
  if (!coverRelsFile) return ridMap;

  const coverRelsXml = await coverRelsFile.async("string");
  const coverRels = [...coverRelsXml.matchAll(/<Relationship\b[^>]*\/>/g)].map((m) => parseRel(m[0]));
  const imageRels = coverRels.filter((rel) => rel.type.includes("/image"));
  if (imageRels.length === 0) return ridMap;

  const mainRelsFile = mainZip.file("word/_rels/document.xml.rels")!;
  const mainRelsXml = await mainRelsFile.async("string");
  const usedRIds = new Set([...mainRelsXml.matchAll(/Id="([^"]+)"/g)].map((m) => m[1]));
  let maxNum = 0;
  for (const rid of usedRIds) {
    const m = rid.match(/^rId(\d+)$/);
    if (m) maxNum = Math.max(maxNum, Number.parseInt(m[1], 10));
  }
  let nextNum = maxNum + 1;
  const allocRId = (): string => {
    let rid: string;
    do {
      rid = `rId${nextNum++}`;
    } while (usedRIds.has(rid));
    usedRIds.add(rid);
    return rid;
  };

  const newRelEntries: string[] = [];
  for (const rel of imageRels) {
    const newRid = allocRId();
    ridMap.set(rel.id, newRid);
    const baseName = rel.target.split("/").pop() ?? rel.id;
    const newTarget = `media/cover-${baseName}`;
    const coverFile = coverZip.file(`word/${rel.target}`);
    if (coverFile) {
      const data = await coverFile.async("uint8array");
      mainZip.file(`word/${newTarget}`, data);
    }
    newRelEntries.push(
      `<Relationship Id="${newRid}" Type="${IMAGE_REL_TYPE}" Target="${newTarget}"/>`
    );
  }

  mainZip.file(
    "word/_rels/document.xml.rels",
    mainRelsXml.replace("</Relationships>", newRelEntries.join("") + "</Relationships>")
  );
  return ridMap;
}

function parseRel(element: string): { id: string; type: string; target: string } {
  return {
    id: element.match(/Id="([^"]+)"/)?.[1] ?? "",
    type: element.match(/Type="([^"]+)"/)?.[1] ?? "",
    target: element.match(/Target="([^"]+)"/)?.[1] ?? ""
  };
}

function rewriteImageRids(bodyXml: string, ridMap: Map<string, string>): string {
  if (ridMap.size === 0) return bodyXml;
  return bodyXml.replace(/r:(embed|link)="([^"]+)"/g, (match, attr: string, rid: string) =>
    ridMap.has(rid) ? `r:${attr}="${ridMap.get(rid)}"` : match
  );
}

function rewriteStyleRefs(bodyXml: string): string {
  return bodyXml.replace(
    /(<w:(?:pStyle|rStyle|tblStyle)\s+w:val=")/g,
    `$1${COVER_PREFIX}`
  );
}

async function ensureContentTypes(mainZip: JSZip): Promise<void> {
  const ctFile = mainZip.file("[Content_Types].xml");
  if (!ctFile) return;
  let ctXml = await ctFile.async("string");

  const exts = new Set<string>();
  for (const path of Object.keys(mainZip.files)) {
    if (path.startsWith("word/media/cover-")) {
      const ext = path.split(".").pop()?.toLowerCase();
      if (ext) exts.add(ext);
    }
  }

  const typeMap: Record<string, string> = {
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    bmp: "image/bmp",
    svg: "image/svg+xml"
  };

  let changed = false;
  for (const ext of exts) {
    if (!ctXml.includes(`Extension="${ext}"`) && typeMap[ext]) {
      ctXml = ctXml.replace(
        /<Override /,
        `<Default Extension="${ext}" ContentType="${typeMap[ext]}"/><Override `
      );
      changed = true;
    }
  }
  if (changed) mainZip.file("[Content_Types].xml", ctXml);
}
