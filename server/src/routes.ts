import { Router, Request, Response } from 'express';
import { db, DocumentRow, OperationRow } from './db';
import {
  analyze,
  applyMappingToText,
  buildMapping,
  previewMapping,
  MappingEntry,
} from './parser';

export const router = Router();

function getDoc(id: number): DocumentRow | undefined {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id) as
    | DocumentRow
    | undefined;
}

function docPayload(doc: DocumentRow) {
  const { occurrences, analysis } = analyze(doc.content);
  const lastUndone = db
    .prepare(
      'SELECT COUNT(*) AS n FROM operations WHERE document_id = ? AND undone_at IS NULL',
    )
    .get(doc.id) as { n: number };
  const history = db
    .prepare(
      `SELECT id, mapping_json, created_at, undone_at
       FROM operations WHERE document_id = ? ORDER BY id DESC LIMIT 20`,
    )
    .all(doc.id) as Pick<
    OperationRow,
    'id' | 'mapping_json' | 'created_at' | 'undone_at'
  >[];
  return {
    document: doc,
    analysis,
    occurrences,
    canUndo: lastUndone.n > 0,
    history: history.map((h) => ({
      id: h.id,
      mapping: JSON.parse(h.mapping_json) as Record<string, string>,
      createdAt: h.created_at,
      undone: h.undone_at !== null,
    })),
  };
}

// 文档列表
router.get('/documents', (_req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT id, title, created_at, updated_at, substr(content, 1, 80) AS snippet
       FROM documents ORDER BY updated_at DESC, id DESC`,
    )
    .all();
  res.json({ documents: rows });
});

// 新建文档（粘贴文本并解析）
router.post('/documents', (req: Request, res: Response) => {
  const title = String(req.body?.title ?? '').trim();
  const content = String(req.body?.content ?? '');
  if (!content.trim()) {
    res.status(400).json({ errors: ['内容不能为空'] });
    return;
  }
  const info = db
    .prepare('INSERT INTO documents (title, content) VALUES (?, ?)')
    .run(title || '未命名合同', content);
  const doc = getDoc(Number(info.lastInsertRowid))!;
  res.status(201).json(docPayload(doc));
});

// 文档详情 + 解析结果
router.get('/documents/:id', (req: Request, res: Response) => {
  const doc = getDoc(Number(req.params.id));
  if (!doc) {
    res.status(404).json({ errors: ['文档不存在'] });
    return;
  }
  res.json(docPayload(doc));
});

// 删除文档
router.delete('/documents/:id', (req: Request, res: Response) => {
  const info = db
    .prepare('DELETE FROM documents WHERE id = ?')
    .run(Number(req.params.id));
  if (info.changes === 0) {
    res.status(404).json({ errors: ['文档不存在'] });
    return;
  }
  res.json({ ok: true });
});

function readMapping(req: Request, res: Response): Record<string, string> | null {
  const entries = req.body?.mapping as MappingEntry[] | undefined;
  if (!Array.isArray(entries)) {
    res.status(400).json({ errors: ['请求体缺少 mapping 数组'] });
    return null;
  }
  const { map, errors } = buildMapping(entries);
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return null;
  }
  if (Object.keys(map).length === 0) {
    res.status(400).json({ errors: ['映射为空，请至少填写一行旧编号 → 新编号'] });
    return null;
  }
  return map;
}

// 预览：返回逐处变更 / 冲突 / 错误，不写库
router.post('/documents/:id/preview', (req: Request, res: Response) => {
  const doc = getDoc(Number(req.params.id));
  if (!doc) {
    res.status(404).json({ errors: ['文档不存在'] });
    return;
  }
  const map = readMapping(req, res);
  if (!map) return;
  const { changes, conflicts, errors } = previewMapping(doc.content, map);
  res.json({ ok: errors.length === 0 && conflicts.length === 0, changes, conflicts, errors });
});

// 应用：校验通过后在一个事务里同步更新标题与正文引用；冲突则 409 拒绝写入
router.post('/documents/:id/apply', (req: Request, res: Response) => {
  const doc = getDoc(Number(req.params.id));
  if (!doc) {
    res.status(404).json({ errors: ['文档不存在'] });
    return;
  }
  const map = readMapping(req, res);
  if (!map) return;

  const { changes, conflicts, errors } = previewMapping(doc.content, map);
  if (errors.length > 0) {
    res.status(400).json({ errors });
    return;
  }
  if (conflicts.length > 0) {
    res.status(409).json({ errors: ['改号会产生编号冲突，已拒绝写入'], conflicts });
    return;
  }

  const newContent = applyMappingToText(doc.content, map);
  const applyTx = db.transaction(() => {
    db.prepare(
      "UPDATE documents SET content = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(newContent, doc.id);
    db.prepare(
      'INSERT INTO operations (document_id, mapping_json, prev_content, new_content) VALUES (?, ?, ?, ?)',
    ).run(doc.id, JSON.stringify(map), doc.content, newContent);
  });
  applyTx();

  const updated = getDoc(doc.id)!;
  res.json({ ...docPayload(updated), applied: changes.length });
});

// 撤销最近一次改号
router.post('/documents/:id/undo', (req: Request, res: Response) => {
  const doc = getDoc(Number(req.params.id));
  if (!doc) {
    res.status(404).json({ errors: ['文档不存在'] });
    return;
  }
  const op = db
    .prepare(
      `SELECT * FROM operations
       WHERE document_id = ? AND undone_at IS NULL
       ORDER BY id DESC LIMIT 1`,
    )
    .get(doc.id) as OperationRow | undefined;
  if (!op) {
    res.status(400).json({ errors: ['没有可撤销的改号操作'] });
    return;
  }
  const undoTx = db.transaction(() => {
    db.prepare(
      "UPDATE documents SET content = ?, updated_at = datetime('now') WHERE id = ?",
    ).run(op.prev_content, doc.id);
    db.prepare("UPDATE operations SET undone_at = datetime('now') WHERE id = ?").run(op.id);
  });
  undoTx();
  const updated = getDoc(doc.id)!;
  res.json({ ...docPayload(updated), undone: op.id });
});

// 导出处理后的文本
router.get('/documents/:id/export', (req: Request, res: Response) => {
  const doc = getDoc(Number(req.params.id));
  if (!doc) {
    res.status(404).json({ errors: ['文档不存在'] });
    return;
  }
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="renumbered-doc-${doc.id}.txt"`,
  );
  res.send(doc.content);
});
