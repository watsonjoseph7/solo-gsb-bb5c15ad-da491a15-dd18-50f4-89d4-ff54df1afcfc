import type { MappingRow } from '../types';

interface Props {
  rows: MappingRow[];
  headingNumbers: string[];
  disabled: boolean;
  onChange: (rows: MappingRow[]) => void;
}

/** 旧编号 → 新编号 批量映射编辑器 */
export function MappingEditor({ rows, headingNumbers, disabled, onChange }: Props) {
  const update = (i: number, patch: Partial<MappingRow>) => {
    onChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  };
  const remove = (i: number) => {
    const next = rows.filter((_, k) => k !== i);
    onChange(next.length > 0 ? next : [{ from: '', to: '' }]);
  };
  const add = () => onChange([...rows, { from: '', to: '' }]);

  return (
    <div className="mapping-editor">
      <div className="mapping-head">
        <span>旧编号</span>
        <span />
        <span>新编号</span>
        <span />
      </div>
      {rows.map((row, i) => (
        <div className="mapping-row" key={i}>
          <input
            value={row.from}
            disabled={disabled}
            placeholder="如 3 或 三"
            list="heading-numbers"
            onChange={(e) => update(i, { from: e.target.value })}
          />
          <span className="arrow">→</span>
          <input
            value={row.to}
            disabled={disabled}
            placeholder="如 5 或 五"
            onChange={(e) => update(i, { to: e.target.value })}
          />
          <button
            type="button"
            className="btn-icon"
            title="删除此行"
            disabled={disabled}
            onClick={() => remove(i)}
          >
            ×
          </button>
        </div>
      ))}
      <datalist id="heading-numbers">
        {headingNumbers.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <button type="button" className="btn btn-ghost" disabled={disabled} onClick={add}>
        + 添加一行
      </button>
      <p className="muted small">
        支持交换（1↔2）、环形（1→2→3→1）与 1/10 等前缀相近编号；编号可写阿拉伯数字或中文数字。
      </p>
    </div>
  );
}
