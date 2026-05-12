import type { Alignment, FormatTemplate, ParagraphStyle } from "@md2doc/shared";

interface Props {
  template: FormatTemplate;
  onChange: (template: FormatTemplate) => void;
}

export function TemplateEditor({ template, onChange }: Props) {
  const readonly = Boolean(template.readonly);

  function patch(next: Partial<FormatTemplate>) {
    if (readonly) return;
    onChange({ ...template, ...next });
  }

  function patchStyle(key: keyof FormatTemplate["styles"], next: Partial<ParagraphStyle>) {
    if (readonly) return;
    onChange({
      ...template,
      styles: {
        ...template.styles,
        [key]: {
          ...template.styles[key],
          ...next
        }
      }
    });
  }

  return (
    <div className="template-editor">
      {readonly && <p className="hint">内置模板不可直接修改。请先复制为新模板。</p>}
      <div className="grid two">
        <label className="field">
          <span>模板名称</span>
          <input
            disabled={readonly}
            value={template.displayName}
            onChange={(event) => patch({ displayName: event.target.value })}
          />
        </label>
        <label className="field">
          <span>全局英文字体</span>
          <input
            disabled={readonly}
            value={template.latinFontFamily}
            onChange={(event) => patch({ latinFontFamily: event.target.value || "Times New Roman" })}
          />
        </label>
      </div>

      <h3>页面</h3>
      <div className="grid four">
        {numberField("上边距 cm", template.page.marginTopCm, readonly, (value) =>
          patch({ page: { ...template.page, marginTopCm: value } })
        )}
        {numberField("下边距 cm", template.page.marginBottomCm, readonly, (value) =>
          patch({ page: { ...template.page, marginBottomCm: value } })
        )}
        {numberField("左边距 cm", template.page.marginLeftCm, readonly, (value) =>
          patch({ page: { ...template.page, marginLeftCm: value } })
        )}
        {numberField("右边距 cm", template.page.marginRightCm, readonly, (value) =>
          patch({ page: { ...template.page, marginRightCm: value } })
        )}
      </div>

      <h3>文字</h3>
      <fieldset className="style-fields">
        <legend>标题自动编号</legend>
        <div className="grid four">
          <label className="field checkbox-field">
            <span>自动编号</span>
            <input
              disabled={readonly}
              type="checkbox"
              checked={template.headingNumbering.enabled}
              onChange={(event) =>
                patch({
                  headingNumbering: {
                    ...template.headingNumbering,
                    enabled: event.target.checked
                  }
                })
              }
            />
          </label>
          <NumberFormatSelect
            label="一级编号"
            disabled={readonly}
            value={template.headingNumbering.level1}
            onChange={(value) =>
              patch({ headingNumbering: { ...template.headingNumbering, level1: value } })
            }
          />
          <NumberFormatSelect
            label="二级编号"
            disabled={readonly}
            value={template.headingNumbering.level2}
            onChange={(value) =>
              patch({ headingNumbering: { ...template.headingNumbering, level2: value } })
            }
          />
          <NumberFormatSelect
            label="三级编号"
            disabled={readonly}
            value={template.headingNumbering.level3}
            onChange={(value) =>
              patch({ headingNumbering: { ...template.headingNumbering, level3: value } })
            }
          />
        </div>
      </fieldset>
      <fieldset className="style-fields">
        <legend>题注自动编号</legend>
        <div className="grid four">
          <label className="field checkbox-field">
            <span>图题自动编号</span>
            <input
              disabled={readonly}
              type="checkbox"
              checked={template.captionNumbering.figureEnabled}
              onChange={(event) =>
                patch({
                  captionNumbering: {
                    ...template.captionNumbering,
                    figureEnabled: event.target.checked
                  }
                })
              }
            />
          </label>
          <label className="field checkbox-field">
            <span>表题自动编号</span>
            <input
              disabled={readonly}
              type="checkbox"
              checked={template.captionNumbering.tableEnabled}
              onChange={(event) =>
                patch({
                  captionNumbering: {
                    ...template.captionNumbering,
                    tableEnabled: event.target.checked
                  }
                })
              }
            />
          </label>
        </div>
      </fieldset>
      <StyleFields label="正文" style={template.styles.body} readonly={readonly} onChange={(next) => patchStyle("body", next)} />
      <StyleFields label="论文标题" style={template.styles.title} readonly={readonly} onChange={(next) => patchStyle("title", next)} />
      <StyleFields label="一级标题" style={template.styles.heading1} readonly={readonly} onChange={(next) => patchStyle("heading1", next)} />
      <StyleFields label="二级标题" style={template.styles.heading2} readonly={readonly} onChange={(next) => patchStyle("heading2", next)} />
      <StyleFields label="三级标题" style={template.styles.heading3} readonly={readonly} onChange={(next) => patchStyle("heading3", next)} />

      <h3>摘要与关键词</h3>
      <RichStyleFields
        label="摘要标题"
        style={template.abstractTitle}
        readonly={readonly}
        onChange={(next) => patch({ abstractTitle: { ...template.abstractTitle, ...next } })}
      />
      <RichStyleFields
        label="摘要正文"
        style={template.styles.abstract}
        readonly={readonly}
        onChange={(next) => patchStyle("abstract", next)}
      />
      <RichStyleFields
        label="关键词标题"
        style={template.keywordTitle}
        readonly={readonly}
        onChange={(next) => patch({ keywordTitle: { ...template.keywordTitle, ...next } })}
      />
      <RichStyleFields
        label="关键词内容"
        style={template.keywords}
        readonly={readonly}
        onChange={(next) => patch({ keywords: { ...template.keywords, ...next } })}
      />

      <h3>代码块</h3>
      <fieldset className="style-fields">
        <legend>代码块文本框</legend>
        <div className="grid four">
          <label className="field">
            <span>代码字体</span>
            <input
              disabled={readonly}
              value={template.codeBlock.fontFamily}
              onChange={(event) =>
                patch({ codeBlock: { ...template.codeBlock, fontFamily: event.target.value || "Times New Roman" } })
              }
            />
          </label>
          {numberField("代码字号 pt", template.codeBlock.fontSizePt, readonly, (value) =>
            patch({ codeBlock: { ...template.codeBlock, fontSizePt: value } })
          )}
          {numberField("文本框宽 cm", template.codeBlock.widthCm, readonly, (value) =>
            patch({ codeBlock: { ...template.codeBlock, widthCm: value } })
          )}
          {numberField("段前 pt", template.codeBlock.spacingBeforePt, readonly, (value) =>
            patch({ codeBlock: { ...template.codeBlock, spacingBeforePt: value } })
          )}
          {numberField("段后 pt", template.codeBlock.spacingAfterPt, readonly, (value) =>
            patch({ codeBlock: { ...template.codeBlock, spacingAfterPt: value } })
          )}
        </div>
      </fieldset>

      <h3>表格与图片</h3>
      <fieldset className="style-fields">
        <legend>表格本体</legend>
        <div className="grid four">
          <label className="field">
            <span>表格中文字体</span>
            <input
              disabled={readonly}
              value={template.table.fontFamily}
              onChange={(event) => patch({ table: { ...template.table, fontFamily: event.target.value || "宋体" } })}
            />
          </label>
          {numberField("表格字号 pt", template.table.fontSizePt, readonly, (value) =>
            patch({ table: { ...template.table, fontSizePt: value } })
          )}
          {numberField("顶线 pt", template.table.topBorderPt, readonly, (value) =>
            patch({ table: { ...template.table, topBorderPt: value } })
          )}
          {numberField("栏目线 pt", template.table.headerBottomBorderPt, readonly, (value) =>
            patch({ table: { ...template.table, headerBottomBorderPt: value } })
          )}
          {numberField("底线 pt", template.table.bottomBorderPt, readonly, (value) =>
            patch({ table: { ...template.table, bottomBorderPt: value } })
          )}
        </div>
      </fieldset>
      <CaptionStyleFields
        label="表题"
        style={template.tableCaption}
        readonly={readonly}
        onChange={(next) => patch({ tableCaption: { ...template.tableCaption, ...next } })}
      />
      <fieldset className="style-fields">
        <legend>图片本体</legend>
        <div className="grid four">
          <label className="field">
            <span>图片样式名</span>
            <input
              disabled={readonly}
              value={template.image.paragraphStyleName}
              onChange={(event) =>
                patch({ image: { ...template.image, paragraphStyleName: event.target.value || "图片" } })
              }
            />
          </label>
          {numberField("图片最大宽 cm", template.image.maxWidthCm, readonly, (value) =>
            patch({ image: { ...template.image, maxWidthCm: value } })
          )}
          {numberField("图片段前 pt", template.image.spacingBeforePt, readonly, (value) =>
            patch({ image: { ...template.image, spacingBeforePt: value } })
          )}
          {numberField("图片段后 pt", template.image.spacingAfterPt, readonly, (value) =>
            patch({ image: { ...template.image, spacingAfterPt: value } })
          )}
        </div>
      </fieldset>
      <CaptionStyleFields
        label="图题"
        style={template.figureCaption}
        readonly={readonly}
        onChange={(next) => patch({ figureCaption: { ...template.figureCaption, ...next } })}
      />
    </div>
  );
}

function CaptionStyleFields({
  label,
  style,
  readonly,
  onChange
}: {
  label: string;
  style: ParagraphStyle;
  readonly: boolean;
  onChange: (style: Partial<ParagraphStyle>) => void;
}) {
  return (
    <fieldset className="style-fields">
      <legend>{label}</legend>
      <div className="grid four">
        <label className="field">
          <span>{label}字体</span>
          <input
            disabled={readonly}
            value={style.fontFamily}
            onChange={(event) => onChange({ fontFamily: event.target.value || "宋体" })}
          />
        </label>
        {numberField(`${label}字号 pt`, style.fontSizePt, readonly, (value) => onChange({ fontSizePt: value }))}
        {numberField(`${label}段前 pt`, style.spacingBeforePt ?? 0, readonly, (value) => onChange({ spacingBeforePt: value }))}
        {numberField(`${label}段后 pt`, style.spacingAfterPt ?? 0, readonly, (value) => onChange({ spacingAfterPt: value }))}
      </div>
    </fieldset>
  );
}

function NumberFormatSelect({
  label,
  value,
  disabled,
  onChange
}: {
  label: string;
  value: "arabic" | "chinese";
  disabled: boolean;
  onChange: (value: "arabic" | "chinese") => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value as "arabic" | "chinese")}
      >
        <option value="arabic">阿拉伯数字</option>
        <option value="chinese">汉字数字</option>
      </select>
    </label>
  );
}

function StyleFields({
  label,
  style,
  readonly,
  onChange
}: {
  label: string;
  style: ParagraphStyle;
  readonly: boolean;
  onChange: (style: Partial<ParagraphStyle>) => void;
}) {
  return (
    <fieldset className="style-fields">
      <legend>{label}</legend>
      <div className="grid four">
        <label className="field">
          <span>字体</span>
          <input disabled={readonly} value={style.fontFamily} onChange={(event) => onChange({ fontFamily: event.target.value })} />
        </label>
        {numberField("字号 pt", style.fontSizePt, readonly, (value) => onChange({ fontSizePt: value }))}
        {numberField("行距 pt", style.lineSpacingPt ?? 0, readonly, (value) => onChange({ lineSpacingPt: value }))}
        {numberField("首行缩进字符", style.firstLineIndentChars ?? 0, readonly, (value) => onChange({ firstLineIndentChars: value }))}
      </div>
    </fieldset>
  );
}

function RichStyleFields({
  label,
  style,
  readonly,
  onChange
}: {
  label: string;
  style: ParagraphStyle;
  readonly: boolean;
  onChange: (style: Partial<ParagraphStyle>) => void;
}) {
  return (
    <fieldset className="style-fields">
      <legend>{label}</legend>
      <div className="grid four">
        <label className="field">
          <span>字体</span>
          <input
            disabled={readonly}
            value={style.fontFamily}
            onChange={(event) => onChange({ fontFamily: event.target.value || "宋体" })}
          />
        </label>
        {numberField("字号 pt", style.fontSizePt, readonly, (value) => onChange({ fontSizePt: value }))}
        <label className="field">
          <span>对齐</span>
          <select
            disabled={readonly}
            value={style.alignment}
            onChange={(event) => onChange({ alignment: event.target.value as Alignment })}
          >
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
            <option value="justify">两端对齐</option>
          </select>
        </label>
        <label className="field checkbox-field">
          <span>加粗</span>
          <input
            disabled={readonly}
            type="checkbox"
            checked={Boolean(style.bold)}
            onChange={(event) => onChange({ bold: event.target.checked })}
          />
        </label>
        {numberField("行距 pt", style.lineSpacingPt ?? 0, readonly, (value) => onChange({ lineSpacingPt: value }))}
        {numberField("首行缩进字符", style.firstLineIndentChars ?? 0, readonly, (value) =>
          onChange({ firstLineIndentChars: value })
        )}
        {numberField("段前 pt", style.spacingBeforePt ?? 0, readonly, (value) => onChange({ spacingBeforePt: value }))}
        {numberField("段后 pt", style.spacingAfterPt ?? 0, readonly, (value) => onChange({ spacingAfterPt: value }))}
      </div>
    </fieldset>
  );
}

function numberField(label: string, value: number, disabled: boolean, onChange: (value: number) => void) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        disabled={disabled}
        type="number"
        step="0.1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
