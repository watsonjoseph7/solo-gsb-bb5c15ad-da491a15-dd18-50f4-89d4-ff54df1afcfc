/**
 * 条款解析与重编号引擎。
 *
 * 识别文本中的「第X条」：
 *  - X 支持阿拉伯数字（含层级编号，如 1、1.2、01.03）与中文数字（一 ~ 九千九百九十九）；
 *  - 位于行首（前面仅有空白）的视为「标题」，其余视为「正文引用」。
 *
 * 重编号采用「单遍替换」：对全文做一次正则扫描，逐个命中处按映射表查新号，
 * 因此交换（1↔2）、环形（1→2→3→1）以及 1/10 这类前缀相近编号都不会互相污染。
 */

export type OccurrenceKind = 'heading' | 'reference';
export type NumeralStyle = 'chinese' | 'arabic';

export interface Occurrence {
  index: number; // 在全文中的字符偏移
  line: number; // 1 起始行号
  column: number; // 1 起始列号（行内）
  raw: string; // 原始命中文本，如「第三条」
  number: string; // 归一化编号，如 "3"、"1.2"
  kind: OccurrenceKind;
  style: NumeralStyle;
  lineText: string; // 所在行全文（用于预览上下文）
}

const CN_CHARS = '零〇一二三四五六七八九十百千两';
const CLAUSE_RE_SOURCE = `第([0-9０-９]+(?:[.．][0-9０-９]+)*|[${CN_CHARS}]+)条`;

const CN_DIGITS: Record<string, number> = {
  零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5,
  六: 6, 七: 7, 八: 8, 九: 9,
};
const CN_UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 };
const CN_DIGIT_CHARS = '零一二三四五六七八九';

/** 中文数字 → 整数（支持 0~9999），无法解析返回 null */
export function chineseToNumber(s: string): number | null {
  let result = 0;
  let current = 0;
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      current = CN_DIGITS[ch];
    } else if (ch in CN_UNITS) {
      const unit = CN_UNITS[ch];
      if (current === 0) current = 1; // 「十」即「一十」
      result += current * unit;
      current = 0;
    } else {
      return null;
    }
  }
  return result + current;
}

/** 整数（0~9999）→ 中文数字；超出范围回退为阿拉伯数字字符串 */
export function numberToChinese(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 9999) return String(n);
  if (n === 0) return '零';
  if (n < 10) return CN_DIGIT_CHARS[n];
  if (n === 10) return '十';
  if (n < 20) return '十' + CN_DIGIT_CHARS[n - 10];
  const units = ['', '十', '百', '千'];
  const s = String(n);
  let out = '';
  let zeroPending = false;
  for (let i = 0; i < s.length; i++) {
    const d = s.charCodeAt(i) - 48;
    const unit = units[s.length - 1 - i];
    if (d === 0) {
      zeroPending = true;
      continue;
    }
    if (zeroPending) {
      out += '零';
      zeroPending = false;
    }
    out += CN_DIGIT_CHARS[d] + unit;
  }
  return out;
}

function toHalfWidth(s: string): string {
  return s
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/．/g, '.');
}

/** 归一化编号：「三」→"3"，"01.02"→"1.2"；无法识别返回 null */
export function normalizeNumber(raw: string): string | null {
  const t = toHalfWidth(String(raw ?? '').trim());
  if (!t) return null;
  if (/^\d+(\.\d+)*$/.test(t)) {
    return t
      .split('.')
      .map((seg) => String(parseInt(seg, 10)))
      .join('.');
  }
  const n = chineseToNumber(t);
  return n === null ? null : String(n);
}

export function isChineseNumeral(s: string): boolean {
  return new RegExp(`^[${CN_CHARS}]+$`).test(s);
}

/** 编号自然序比较：按段数值比较，"1.2" < "1.10" */
export function compareNumbers(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? -1;
    const y = pb[i] ?? -1;
    if (x !== y) return x - y;
  }
  return 0;
}

export function parseOccurrences(text: string): Occurrence[] {
  const lineStarts: number[] = [0];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\n') lineStarts.push(i + 1);
  }
  const lines = text.split('\n');
  const occurrences: Occurrence[] = [];
  const re = new RegExp(CLAUSE_RE_SOURCE, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const index = m.index;
    // 二分查找所在行
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (lineStarts[mid] <= index) lo = mid;
      else hi = mid - 1;
    }
    const lineStart = lineStarts[lo];
    const before = text.slice(lineStart, index);
    const numeral = m[1];
    const normalized = normalizeNumber(numeral);
    if (normalized === null) continue;
    occurrences.push({
      index,
      line: lo + 1,
      column: index - lineStart + 1,
      raw: m[0],
      number: normalized,
      kind: /^\s*$/.test(before) ? 'heading' : 'reference',
      style: isChineseNumeral(numeral) ? 'chinese' : 'arabic',
      lineText: lines[lo],
    });
  }
  return occurrences;
}

export interface NumberGroup {
  number: string;
  lines: number[];
  count: number;
}

export interface Analysis {
  headings: NumberGroup[]; // 全部标题编号（按自然序）
  references: NumberGroup[]; // 全部被引用编号
  duplicates: NumberGroup[]; // 重复标题编号
  missing: string[]; // 标题序列中的缺号（含层级子序列）
  dangling: NumberGroup[]; // 引用了不存在的标题
  total: number; // 命中总数
}

export function analyze(text: string): { occurrences: Occurrence[]; analysis: Analysis } {
  const occurrences = parseOccurrences(text);
  const headingMap = new Map<string, number[]>();
  const refMap = new Map<string, number[]>();
  for (const o of occurrences) {
    const map = o.kind === 'heading' ? headingMap : refMap;
    const arr = map.get(o.number) ?? [];
    arr.push(o.line);
    map.set(o.number, arr);
  }
  const toGroups = (map: Map<string, number[]>): NumberGroup[] =>
    [...map.entries()]
      .map(([number, lines]) => ({ number, lines, count: lines.length }))
      .sort((a, b) => compareNumbers(a.number, b.number));

  const headings = toGroups(headingMap);
  const references = toGroups(refMap);
  const duplicates = headings.filter((h) => h.count > 1);
  const dangling = references.filter((r) => !headingMap.has(r.number));

  // 缺号：按层级前缀分组，在每组的最小~最大之间找空洞
  const missing: string[] = [];
  const byPrefix = new Map<string, Set<number>>();
  for (const h of headings) {
    const segs = h.number.split('.');
    const last = parseInt(segs[segs.length - 1], 10);
    const prefix = segs.slice(0, -1).join('.');
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, new Set());
    byPrefix.get(prefix)!.add(last);
  }
  for (const [prefix, set] of byPrefix) {
    const vals = [...set].sort((a, b) => a - b);
    for (let v = vals[0]; v <= vals[vals.length - 1]; v++) {
      if (!set.has(v)) missing.push(prefix ? `${prefix}.${v}` : String(v));
    }
  }
  missing.sort(compareNumbers);

  return {
    occurrences,
    analysis: { headings, references, duplicates, missing, dangling, total: occurrences.length },
  };
}

// ---------------------------------------------------------------- 重编号

export interface MappingEntry {
  from: string;
  to: string;
}

export interface Conflict {
  type: 'heading-collision';
  number: string;
  lines: number[];
  message: string;
}

export interface PreviewChange {
  line: number;
  column: number;
  kind: OccurrenceKind;
  oldRaw: string;
  newRaw: string;
  oldNumber: string;
  newNumber: string;
  lineText: string;
}

/** 校验并归一化用户提交的映射（源/目标均可写「三」或「3」） */
export function buildMapping(entries: MappingEntry[]): {
  map: Record<string, string>;
  errors: string[];
} {
  const errors: string[] = [];
  const map: Record<string, string> = {};
  const targetOf = new Map<string, string>(); // to -> from
  entries.forEach((e, i) => {
    const row = i + 1;
    const fromRaw = String(e?.from ?? '').trim();
    const toRaw = String(e?.to ?? '').trim();
    if (!fromRaw && !toRaw) return; // 跳过空行
    const from = normalizeNumber(fromRaw);
    const to = normalizeNumber(toRaw);
    if (from === null) {
      errors.push(`第 ${row} 行：源编号「${fromRaw}」无法识别`);
      return;
    }
    if (to === null) {
      errors.push(`第 ${row} 行：目标编号「${toRaw}」无法识别`);
      return;
    }
    if (from === to) {
      errors.push(`第 ${row} 行：源编号与目标编号相同（第 ${from} 条）`);
      return;
    }
    if (from in map) {
      errors.push(`第 ${row} 行：源编号「第 ${from} 条」在映射中重复`);
      return;
    }
    const existingFrom = targetOf.get(to);
    if (existingFrom !== undefined) {
      errors.push(
        `第 ${row} 行：目标编号「第 ${to} 条」与源编号「第 ${existingFrom} 条」的目标重复`,
      );
      return;
    }
    map[from] = to;
    targetOf.set(to, from);
  });
  return { map, errors };
}

/** 按原文数字风格渲染新编号：中文标题改号后仍是中文 */
export function renderNumeral(normalized: string, style: NumeralStyle): string {
  if (style === 'chinese' && /^\d+$/.test(normalized)) {
    return numberToChinese(parseInt(normalized, 10));
  }
  return normalized;
}

/**
 * 预览映射：返回逐处变更、冲突与错误。
 * 冲突判定：改号后的标题编号集合中，凡「由本次映射新造成」的重号即冲突
 * （改号前已存在且未被映射触碰的重号仅提示，不阻断）。
 */
export function previewMapping(
  text: string,
  map: Record<string, string>,
): { changes: PreviewChange[]; conflicts: Conflict[]; errors: string[] } {
  const { occurrences } = analyze(text);
  const errors: string[] = [];
  const present = new Set(occurrences.map((o) => o.number));
  for (const from of Object.keys(map)) {
    if (!present.has(from)) errors.push(`源编号「第 ${from} 条」在文档中不存在`);
  }

  const conflicts: Conflict[] = [];
  const finalGroups = new Map<string, { line: number; orig: string }[]>();
  for (const h of occurrences) {
    if (h.kind !== 'heading') continue;
    const final = map[h.number] ?? h.number;
    const arr = finalGroups.get(final) ?? [];
    arr.push({ line: h.line, orig: h.number });
    finalGroups.set(final, arr);
  }
  for (const [num, items] of finalGroups) {
    if (items.length < 2) continue;
    const preExisting = items.every((it) => it.orig === num) && !(num in map);
    if (preExisting) continue;
    const lines = items.map((i) => i.line).sort((a, b) => a - b);
    conflicts.push({
      type: 'heading-collision',
      number: num,
      lines,
      message: `改号后「第 ${num} 条」将出现 ${items.length} 个标题，位于第 ${lines.join('、')} 行`,
    });
  }
  conflicts.sort((a, b) => compareNumbers(a.number, b.number));

  const changes: PreviewChange[] = [];
  for (const o of occurrences) {
    const target = map[o.number];
    if (target === undefined) continue;
    changes.push({
      line: o.line,
      column: o.column,
      kind: o.kind,
      oldRaw: o.raw,
      newRaw: `第${renderNumeral(target, o.style)}条`,
      oldNumber: o.number,
      newNumber: target,
      lineText: o.lineText,
    });
  }
  return { changes, conflicts, errors };
}

/** 单遍替换应用映射：交换/环形/前缀相近编号均安全 */
export function applyMappingToText(text: string, map: Record<string, string>): string {
  const re = new RegExp(CLAUSE_RE_SOURCE, 'g');
  return text.replace(re, (raw: string, numeral: string) => {
    const normalized = normalizeNumber(numeral);
    if (normalized === null) return raw;
    const target = map[normalized];
    if (target === undefined) return raw;
    const style: NumeralStyle = isChineseNumeral(numeral) ? 'chinese' : 'arabic';
    return `第${renderNumeral(target, style)}条`;
  });
}
