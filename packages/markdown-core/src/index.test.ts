import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./index";

describe("parseMarkdown", () => {
  it("parses common thesis markdown blocks", () => {
    const model = parseMarkdown(`# 标题

正文段落。

> 引用内容

- 第一项
- 第二项

| 列 A | 列 B |
| --- | --- |
| 1 | 2 |

![示例](images/a.png)

\`\`\`ts
const a = 1;
\`\`\`
`);

    expect(model.nodes).toMatchObject([
      { type: "heading", depth: 1, text: "标题" },
      { type: "paragraph", text: "正文段落。" },
      { type: "blockquote", text: "引用内容" },
      { type: "list", ordered: false, items: ["第一项", "第二项"] },
      { type: "table", rows: [["列 A", "列 B"], ["1", "2"]] },
      { type: "image", alt: "示例", url: "images/a.png" },
      { type: "code", language: "ts", value: "const a = 1;" }
    ]);
  });

  it("attaches table captions from the paragraph immediately before a table", () => {
    const model = parseMarkdown(`表 1 试验结果

| 指标 | 数值 |
| --- | --- |
| A | 1 |

普通段落。

表二：第二张表

| 指标 | 数值 |
| --- | --- |
| B | 2 |
`);

    expect(model.nodes).toMatchObject([
      { type: "table", caption: "表 1 试验结果", rows: [["指标", "数值"], ["A", "1"]] },
      { type: "paragraph", text: "普通段落。" },
      { type: "table", caption: "表二：第二张表", rows: [["指标", "数值"], ["B", "2"]] }
    ]);
  });

  it("attaches figure captions from the paragraph immediately after an image", () => {
    const model = parseMarkdown(`![流程](images/flow.png)

图 系统流程图

正文。
`);

    expect(model.nodes).toMatchObject([
      { type: "image", url: "images/flow.png", caption: "图 系统流程图" },
      { type: "paragraph", text: "正文。" }
    ]);
  });
});
