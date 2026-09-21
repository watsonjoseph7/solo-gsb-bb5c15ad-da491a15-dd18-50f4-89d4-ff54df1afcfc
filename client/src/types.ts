export type OccurrenceKind = 'heading' | 'reference';

export interface Occurrence {
  index: number;
  line: number;
  column: number;
  raw: string;
  number: string;
  kind: OccurrenceKind;
  style: 'chinese' | 'arabic';
  lineText: string;
}

export interface NumberGroup {
  number: string;
  lines: number[];
  count: number;
}

export interface Analysis {
  headings: NumberGroup[];
  references: NumberGroup[];
  duplicates: NumberGroup[];
  missing: string[];
  dangling: NumberGroup[];
  total: number;
}

export interface DocMeta {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  snippet: string;
}

export interface Document {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface HistoryItem {
  id: number;
  mapping: Record<string, string>;
  createdAt: string;
  undone: boolean;
}

export interface DocPayload {
  document: Document;
  analysis: Analysis;
  occurrences: Occurrence[];
  canUndo: boolean;
  history: HistoryItem[];
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

export interface PreviewResult {
  ok: boolean;
  changes: PreviewChange[];
  conflicts: Conflict[];
  errors: string[];
}

export interface MappingRow {
  from: string;
  to: string;
}
