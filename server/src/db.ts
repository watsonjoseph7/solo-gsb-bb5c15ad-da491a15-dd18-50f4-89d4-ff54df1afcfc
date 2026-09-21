import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), 'data', 'workbench.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS operations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  mapping_json TEXT NOT NULL,
  prev_content TEXT NOT NULL,
  new_content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  undone_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_operations_document ON operations(document_id, id);
`);

export interface DocumentRow {
  id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface OperationRow {
  id: number;
  document_id: number;
  mapping_json: string;
  prev_content: string;
  new_content: string;
  created_at: string;
  undone_at: string | null;
}
