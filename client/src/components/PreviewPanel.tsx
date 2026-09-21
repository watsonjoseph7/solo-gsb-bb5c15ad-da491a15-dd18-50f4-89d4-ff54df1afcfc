import type { PreviewResult } from '../types';

interface Props {
  preview: PreviewResult;
}

/** 逐处变更预览 + 冲突/错误展示 */
export function PreviewPanel({ preview }: Props) {
  const { changes, conflicts, errors } = preview;
  const headingChanges = changes.filter((c) => c.kind === 'heading');
  const refChanges = changes.filter((c) => c.kind === 'reference');
  return (
    <div className="preview">
      {errors.length > 0 && (
        <div className="alert-bad box">
          <h4>映射有误</h4>
          <ul>
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}
      {conflicts.length > 0 && (
        <div className="alert-bad box">
          <h4>⛔ 冲突：应用将被拒绝</h4>
          <ul>
            {conflicts.map((c, i) => (
              <li key={i}>{c.message}</li>
            ))}
          </ul>
        </div>
      )}
      {preview.ok && (
        <p className="ok-line">
          共 {changes.length} 处变更（标题 {headingChanges.length} 处 · 引用 {refChanges.length} 处），无冲突，可安全应用。
        </p>
      )}
      {changes.length > 0 && (
        <ul className="change-list">
          {changes.map((c, i) => (
            <li key={i}>
              <span className="chg-loc">
                第 {c.line} 行 · {c.kind === 'heading' ? '标题' : '引用'}
              </span>
              <span className="chg-map">
                <s>{c.oldRaw}</s> → <b>{c.newRaw}</b>
              </span>
              <span className="chg-ctx" title={c.lineText}>
                {c.lineText.trim()}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
