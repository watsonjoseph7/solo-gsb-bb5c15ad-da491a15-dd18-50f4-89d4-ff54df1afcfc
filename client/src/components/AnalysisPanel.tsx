import type { Analysis } from '../types';

interface Props {
  analysis: Analysis;
}

function Chip({ label, tone }: { label: string; tone?: 'ok' | 'warn' | 'bad' | 'info' }) {
  return <span className={`chip chip-${tone ?? 'info'}`}>{label}</span>;
}

export function AnalysisPanel({ analysis }: Props) {
  const { headings, duplicates, missing, dangling, references, total } = analysis;
  return (
    <div className="panel analysis">
      <h3>解析结果</h3>
      <div className="stat-row">
        <Chip label={`标题 ${headings.reduce((s, h) => s + h.count, 0)} 个`} tone="ok" />
        <Chip label={`引用 ${references.reduce((s, r) => s + r.count, 0)} 处`} tone="info" />
        <Chip label={`命中共 ${total} 处`} tone="info" />
        {duplicates.length > 0 && <Chip label={`重复编号 ${duplicates.length}`} tone="bad" />}
        {missing.length > 0 && <Chip label={`缺失编号 ${missing.length}`} tone="warn" />}
        {dangling.length > 0 && <Chip label={`悬空引用 ${dangling.length}`} tone="warn" />}
      </div>

      <div className="analysis-section">
        <h4>条款标题</h4>
        {headings.length === 0 && <p className="muted">未识别到任何「第X条」标题。</p>}
        <ul className="num-list">
          {headings.map((h) => (
            <li key={h.number} className={h.count > 1 ? 'bad' : ''}>
              <b>第 {h.number} 条</b>
              <span className="muted">
                {h.count > 1 ? ` × ${h.count}（第 ${h.lines.join('、')} 行）` : ` · 第 ${h.lines[0]} 行`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {duplicates.length > 0 && (
        <div className="analysis-section alert-bad">
          <h4>⚠ 重复编号</h4>
          <ul className="num-list">
            {duplicates.map((d) => (
              <li key={d.number}>
                第 {d.number} 条出现 {d.count} 次（第 {d.lines.join('、')} 行）
              </li>
            ))}
          </ul>
        </div>
      )}

      {missing.length > 0 && (
        <div className="analysis-section alert-warn">
          <h4>⚠ 缺失编号（标题序列断档）</h4>
          <p>{missing.map((m) => `第 ${m} 条`).join('、')}</p>
        </div>
      )}

      {dangling.length > 0 && (
        <div className="analysis-section alert-warn">
          <h4>⚠ 悬空引用（指向不存在的条款）</h4>
          <ul className="num-list">
            {dangling.map((d) => (
              <li key={d.number}>
                第 {d.number} 条 · 被引用 {d.count} 次（第 {d.lines.join('、')} 行）
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
