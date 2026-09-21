import type { ReactNode } from 'react';
import type { Occurrence } from '../types';

interface Props {
  content: string;
  occurrences: Occurrence[];
}

/** 只读文本视图：按行渲染，标题/引用命中处高亮 */
export function TextView({ content, occurrences }: Props) {
  const lines = content.split('\n');
  const byLine = new Map<number, Occurrence[]>();
  for (const o of occurrences) {
    const arr = byLine.get(o.line) ?? [];
    arr.push(o);
    byLine.set(o.line, arr);
  }
  return (
    <div className="text-view">
      {lines.map((lineText, i) => {
        const lineNo = i + 1;
        const occs = (byLine.get(lineNo) ?? []).sort((a, b) => a.column - b.column);
        const parts: ReactNode[] = [];
        let cursor = 0;
        occs.forEach((o, k) => {
          const start = o.column - 1;
          if (start > cursor) parts.push(lineText.slice(cursor, start));
          parts.push(
            <mark key={k} className={o.kind === 'heading' ? 'mk-heading' : 'mk-ref'}>
              {o.raw}
            </mark>,
          );
          cursor = start + o.raw.length;
        });
        if (cursor < lineText.length) parts.push(lineText.slice(cursor));
        return (
          <div className="tv-line" key={lineNo}>
            <span className="tv-ln">{lineNo}</span>
            <span className="tv-lc">{parts.length > 0 ? parts : ' '}</span>
          </div>
        );
      })}
    </div>
  );
}
