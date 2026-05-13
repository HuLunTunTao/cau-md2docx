# CAU Markdown 论文格式整理工具

一个纯前端的 Markdown 到 DOCX 整理工具，面向中国农业大学课程论文等校内论文格式场景。当前版本提供 React 网页应用，所有解析、图片读取和 Word 生成都在浏览器本地完成，不依赖服务端。

## 功能概览

- 将包含 Markdown 文档和 `images/` 目录的 zip 包整理为 `.docx`。
- 内置 `CAU 课程论文` 模板。
- 支持用户复制、编辑、导入和导出模板 JSON。
- 支持标题自动编号、图题自动编号、表题自动编号。
- 支持 GFM 表格，并按三线表规则渲染。
- 支持 Markdown 图片相对路径，并按 zip 内资源匹配图片。
- 支持摘要、关键词、正文、标题、表格、图片、题注和代码块等常见论文排版项。
- 导出的 Word 中图片段落样式名称为 `图片`。

当前不包含 CLI、实时预览、PDF 导出和服务端转换，但代码结构已经按未来 CLI 复用核心逻辑拆分。

## 输入格式

上传文件必须是 zip 包，推荐结构如下：

```text
report.zip
├── report.md
└── images/
    ├── flow.png
    ├── chart.svg
    └── nested/
        └── detail.jpg
```

要求：

- zip 内应包含一个 Markdown 文件，扩展名为 `.md` 或 `.markdown`。
- 图片放在任意 `images/` 目录下。
- Markdown 中使用相对路径引用图片，例如 `![流程图](images/flow.png)`。
- 图片单独成段，不要和正文放在同一行。
- 支持常见图片格式：PNG、JPG、JPEG、GIF、BMP、SVG。

项目内提供复杂样例：

- Markdown：[fixtures/complex-zip-sample/report.md](fixtures/complex-zip-sample/report.md)
- zip 包：[fixtures/complex-zip-sample/complex-zip-sample.zip](fixtures/complex-zip-sample/complex-zip-sample.zip)

## Markdown 约定

### 标题

```md
# 论文标题

## 引言

### 研究目标

#### 具体方法
```

默认编号规则：

- `#` 用作论文标题，不自动编号。
- `##`、`###`、`####` 分别作为正文中的一级、二级、三级标题。
- 不建议在 Markdown 中手写标题编号，工具会按模板设置自动编号。

### 摘要与关键词

推荐写法：

```md
摘要：这里是摘要正文。

关键词：Markdown；DOCX；论文格式
```

也兼容：

```md
摘要

这里是摘要正文。
```

摘要标签、摘要正文、关键词标签和关键词内容都可以在模板中分别设置。

### 表格与表题

表题放在表格正上方，且中间不要插入其他内容：

```md
表 实验参数

| 参数 | 数值 | 说明 |
| --- | --- | --- |
| A | 10 | 对照组 |
| B | 20 | 实验组 |
```

开启表题自动编号后，`表 实验参数` 会整理为类似 `表1-1 实验参数` 或 `表1 实验参数`。

CAU 模板默认表格规则：

- 三线表。
- 无竖线。
- 顶线和底线 1.5 磅。
- 表头下方栏目线 0.75 磅。
- 表内文字五号宋体，左对齐。

### 图片与图题

图片单独成段，图题放在图片正下方：

```md
![系统结构图](images/system.png)

图 系统总体结构图
```

开启图题自动编号后，`图 系统总体结构图` 会整理为类似 `图1-1 系统总体结构图` 或 `图1 系统总体结构图`。

图片规则：

- 使用 Word 嵌入型图片。
- 图片段落居中。
- 自动限制到正文可用宽度内。
- 图题和表题样式可在模板中设置。

### 代码块

````md
```ts
export interface DocumentAsset {
  path: string;
  fileName: string;
}
```
````

代码块会渲染为普通文档流中的嵌入式容器，整体居中，内容左对齐，避免与上下正文重叠。代码字体、字号、宽度、段前和段后可以在模板中设置。

## 模板系统

内置模板为 `CAU 课程论文`。内置模板只读，用户可以复制后编辑。

模板覆盖范围包括：

- 页面边距。
- 全局英文字体。
- 论文标题、各级标题、正文。
- 摘要标题、摘要正文、关键词标题、关键词内容。
- 标题自动编号。
- 图题和表题自动编号。
- 三线表线宽、表格字体和字号。
- 图片样式名、最大宽度、段前段后。
- 图题、表题字体和段落设置。
- 代码块字体、字号、宽度、段前段后。

用户模板保存在浏览器本地存储，并支持 JSON 导入导出。

## 项目结构

```text
apps/
  web/              React 中文界面
packages/
  markdown-core/    Markdown -> DocumentModel
  template-core/    模板 schema、内置模板、校验、导入导出
  docx-renderer/    DocumentModel + FormatTemplate -> DOCX Uint8Array
  shared/           通用类型、单位换算
fixtures/
  complex-zip-sample/
```

依赖边界：

- `apps/web` 负责文件上传、zip 读取、状态展示和下载。
- `packages/*` 不依赖 React。
- `docx-renderer` 不访问 DOM，输出 `Uint8Array`。
- 未来 CLI 可以复用 `packages/*`。

## 本地开发

环境要求：

- Node.js 20 或更新版本。
- pnpm。

安装依赖：

```bash
pnpm install
```

启动开发服务器：

```bash
pnpm dev
```

默认地址：

```text
http://localhost:5173/
```

构建：

```bash
pnpm build
```

测试：

```bash
pnpm test
```

类型检查：

```bash
pnpm typecheck
```

## 部署

Web 应用是静态站点，生产构建输出位于：

```text
apps/web/dist
```

本仓库已配置 GitHub Pages workflow，推送到 `main` 后会自动构建并发布到：

```text
https://huluntuntao.github.io/cau-md2docx/
```

部署到其他子路径时，需要同步调整 [apps/web/vite.config.ts](apps/web/vite.config.ts) 中的 `base`。

## 当前限制

- 暂不提供 CLI。
- 暂不提供实时预览。
- 暂不提供 PDF 导出。
- 暂不处理参考文献专用格式。
- 模板系统覆盖论文常见排版项，不是完整 Word 样式编辑器。
