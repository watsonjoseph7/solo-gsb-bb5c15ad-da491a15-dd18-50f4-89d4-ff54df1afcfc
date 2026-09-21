import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, errorConflicts, errorMessages } from './api';
import { AnalysisPanel } from './components/AnalysisPanel';
import { MappingEditor } from './components/MappingEditor';
import { PreviewPanel } from './components/PreviewPanel';
import { TextView } from './components/TextView';
import { SAMPLE_TEXT } from './sampleText';
import type { DocMeta, DocPayload, MappingRow, PreviewResult } from './types';

interface Banner {
  type: 'ok' | 'err';
  text: string;
}

export default function App() {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [current, setCurrent] = useState<DocPayload | null>(null);
  const [creating, setCreating] = useState(true);
  const [title, setTitle] = useState('');
  const [draft, setDraft] = useState('');
  const [rows, setRows] = useState<MappingRow[]>([{ from: '', to: '' }]);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewKey, setPreviewKey] = useState('');
  const [banner, setBanner] = useState<Banner | null>(null);
  const [busy, setBusy] = useState(false);

  const rowsKey = useMemo(() => JSON.stringify(rows), [rows]);
  const previewFresh = preview !== null && previewKey === rowsKey;
  const canApply = previewFresh && preview.ok && !busy;

  const refreshList = useCallback(async () => {
    try {
      const { documents } = await api.listDocuments();
      setDocs(documents);
    } catch {
      /* 列表失败不阻塞主流程 */
    }
  }, []);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const fail = (e: unknown) => {
    const msgs = errorMessages(e);
    setBanner({ type: 'err', text: msgs.join('；') });
    const conflicts = errorConflicts(e);
    if (conflicts.length > 0) {
      setPreview({ ok: false, changes: [], conflicts, errors: msgs });
      setPreviewKey(rowsKey);
    }
  };

  const resetMapping = () => {
    setRows([{ from: '', to: '' }]);
    setPreview(null);
  };

  const openDoc = async (id: number) => {
    setBusy(true);
    try {
      const payload = await api.getDocument(id);
      setCurrent(payload);
      setCreating(false);
      resetMapping();
      setBanner(null);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const createDoc = async () => {
    if (!draft.trim()) {
      setBanner({ type: 'err', text: '请先粘贴合同文本' });
      return;
    }
    setBusy(true);
    try {
      const payload = await api.createDocument(title.trim(), draft);
      setCurrent(payload);
      setCreating(false);
      setDraft('');
      setTitle('');
      resetMapping();
      setBanner({ type: 'ok', text: '已创建并解析文档' });
      refreshList();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const removeDoc = async (id: number) => {
    if (!window.confirm('确定删除该文档及其改号历史？')) return;
    try {
      await api.deleteDocument(id);
      if (current?.document.id === id) {
        setCurrent(null);
        setCreating(true);
      }
      refreshList();
    } catch (e) {
      fail(e);
    }
  };

  const doPreview = async () => {
    if (!current) return;
    setBusy(true);
    setBanner(null);
    try {
      const result = await api.preview(current.document.id, rows);
      setPreview(result);
      setPreviewKey(rowsKey);
      if (!result.ok) setBanner({ type: 'err', text: '预览发现问题，请修正后再应用' });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const doApply = async () => {
    if (!current || !canApply) return;
    setBusy(true);
    try {
      const payload = await api.apply(current.document.id, rows);
      setCurrent(payload);
      resetMapping();
      setBanner({ type: 'ok', text: `已应用 ${payload.applied} 处变更，标题与正文引用已同步更新` });
      refreshList();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const doUndo = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const payload = await api.undo(current.document.id);
      setCurrent(payload);
      setPreview(null);
      setBanner({ type: 'ok', text: '已撤销最近一次改号' });
      refreshList();
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const startCreate = () => {
    setCreating(true);
    setCurrent(null);
    setPreview(null);
    setBanner(null);
  };

  const handleRowsChange = (r: MappingRow[]) => {
    setRows(r);
    setPreview(null); // 映射变更后旧预览失效
  };

  const headingNumbers = current?.analysis.headings.map((h) => h.number) ?? [];

  return (
    <div className="app">
      <header className="topbar">
        <h1>合同条款重编号工作台</h1>
        <div className="topbar-actions">
          {current && (
            <>
              <button className="btn" disabled={busy || !current.canUndo} onClick={doUndo}>
                ↩ 撤销最近改号
              </button>
              <a className="btn" href={api.exportUrl(current.document.id)} download>
                ⬇ 导出文本
              </a>
            </>
          )}
          <button className="btn btn-primary" onClick={startCreate}>
            ＋ 新建文档
          </button>
        </div>
      </header>

      {banner && (
        <div className={`banner banner-${banner.type}`} onClick={() => setBanner(null)}>
          {banner.text}
        </div>
      )}

      <div className="layout">
        <aside className="sidebar">
          <h3>文档</h3>
          {docs.length === 0 && <p className="muted">暂无文档，请新建。</p>}
          <ul className="doc-list">
            {docs.map((d) => (
              <li
                key={d.id}
                className={current?.document.id === d.id ? 'active' : ''}
                onClick={() => openDoc(d.id)}
              >
                <div className="doc-title">
                  #{d.id} {d.title}
                </div>
                <div className="doc-snippet">{d.snippet}</div>
                <button
                  className="btn-icon doc-del"
                  title="删除文档"
                  onClick={(e) => {
                    e.stopPropagation();
                    removeDoc(d.id);
                  }}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <main className="main">
          {creating || !current ? (
            <section className="panel">
              <h3>粘贴合同文本</h3>
              <input
                className="title-input"
                placeholder="文档标题（可选）"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="paste-area"
                placeholder={'粘贴包含「第X条」标题与引用的合同纯文本…\n支持「第三条」与「第3条」两种写法。'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={18}
              />
              <div className="row-actions">
                <button className="btn" onClick={() => setDraft(SAMPLE_TEXT)}>
                  载入示例文本
                </button>
                <button className="btn btn-primary" disabled={busy} onClick={createDoc}>
                  创建并解析
                </button>
              </div>
            </section>
          ) : (
            <>
              <AnalysisPanel analysis={current.analysis} />

              <section className="panel">
                <div className="panel-head">
                  <h3>
                    #{current.document.id} {current.document.title}
                  </h3>
                  <span className="muted small">更新于 {current.document.updated_at}</span>
                </div>
                <TextView content={current.document.content} occurrences={current.occurrences} />
              </section>

              <section className="panel">
                <h3>批量改号</h3>
                <MappingEditor
                  rows={rows}
                  headingNumbers={headingNumbers}
                  disabled={busy}
                  onChange={handleRowsChange}
                />
                <div className="row-actions">
                  <button className="btn" disabled={busy} onClick={doPreview}>
                    ① 生成变更预览
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!canApply}
                    title={canApply ? '' : '请先生成无冲突的预览'}
                    onClick={doApply}
                  >
                    ② 确认应用（原子写入）
                  </button>
                </div>
                {preview && previewFresh && <PreviewPanel preview={preview} />}
                {preview && !previewFresh && (
                  <p className="muted small">映射已修改，请重新生成预览。</p>
                )}
              </section>

              {current.history.length > 0 && (
                <section className="panel">
                  <h3>改号历史</h3>
                  <ul className="history-list">
                    {current.history.map((h) => (
                      <li key={h.id} className={h.undone ? 'undone' : ''}>
                        <span className="muted">{h.createdAt}</span>{' '}
                        {Object.entries(h.mapping)
                          .map(([f, t]) => `第${f}条 → 第${t}条`)
                          .join('，')}
                        {h.undone && <span className="chip chip-warn">已撤销</span>}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
