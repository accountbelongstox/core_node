/** Markdown to HTML: toolbar editor, live GFM preview and static HTML export. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { EditorView } from '@uiw/react-codemirror';
import { Bold, Code, Download, Eraser, Heading2, Italic, Link2, List, ListOrdered, Quote, Strikethrough, Table2, Wand2, FileText } from 'lucide-react';
import type { ToolWorkbenchProps } from '../toolWorkbenchTypes';
import { Btn, CodeEditor, CopyBtn, Pane, Seg, WebPage, downloadText, lastInput, pickString, useDebounced, useToolRecord } from './kit/webKit';
import { MarkdownPreview, markdownToHtml } from './kit/MarkdownPreview';

type View = 'preview' | 'html';

const DEBOUNCE_MS = 200;
const WORDS_PER_MINUTE = 200;
const SAMPLE = '# Markdown sample\n\nWrite **bold**, *italic*, ~~strike~~ and `inline code`.\n\n> Quotes and [links](https://example.com) work too.\n\n- [x] Task lists\n- [ ] Tables\n\n| Name | Value |\n| ---- | ----- |\n| one  | 1     |\n| two  | 2     |\n\n```js\nconsole.log("fenced code");\n```\n';
const TABLE_SNIPPET = '\n| Column | Column |\n| ------ | ------ |\n| value  | value  |\n';
const DOCUMENT_STYLE = 'body{font-family:system-ui,sans-serif;max-width:48rem;margin:2rem auto;padding:0 1rem;line-height:1.6}pre{background:#0f172a;color:#f1f5f9;padding:1rem;overflow:auto;border-radius:.5rem}code{font-family:ui-monospace,monospace}table{border-collapse:collapse}th,td{border:1px solid #cbd5e1;padding:.4rem .7rem}blockquote{border-left:4px solid #06b6d4;margin:1rem 0;padding:.1rem 1rem;color:#475569}img{max-width:100%}';

const MarkdownToHtmlWorkbench: React.FC<ToolWorkbenchProps> = ({ tool, variant, lastRun }) => {
  const { t } = useTranslation();
  const record = useToolRecord(tool.id, variant);
  const prefill = lastInput(lastRun);
  const [markdown, setMarkdown] = useState(pickString(prefill, 'markdown', ''));
  const [view, setView] = useState<View>('preview');
  const [html, setHtml] = useState('');
  const viewRef = useRef<EditorView | null>(null);
  const source = useDebounced(markdown, DEBOUNCE_MS);

  useEffect(() => {
    let cancelled = false;
    void markdownToHtml(source).then((value) => { if (!cancelled) setHtml(value); });
    return () => { cancelled = true; };
  }, [source]);

  const stats = useMemo(() => {
    const words = markdown.trim() ? markdown.trim().split(/\s+/).length : 0;
    return { words, minutes: Math.max(words ? 1 : 0, Math.ceil(words / WORDS_PER_MINUTE)) };
  }, [markdown]);

  const wrap = (before: string, after: string, placeholderKey: string) => {
    const editor = viewRef.current;
    if (!editor) return;
    const { from, to } = editor.state.selection.main;
    const selected = editor.state.sliceDoc(from, to) || t(placeholderKey);
    editor.dispatch({ changes: { from, to, insert: `${before}${selected}${after}` }, selection: { anchor: from + before.length, head: from + before.length + selected.length } });
    editor.focus();
  };
  const prefixLines = (prefix: (index: number) => string) => {
    const editor = viewRef.current;
    if (!editor) return;
    const { from, to } = editor.state.selection.main;
    const first = editor.state.doc.lineAt(from);
    const last = editor.state.doc.lineAt(to);
    const changes = [];
    for (let n = first.number; n <= last.number; n++) changes.push({ from: editor.state.doc.line(n).from, insert: prefix(n - first.number) });
    editor.dispatch({ changes });
    editor.focus();
  };
  const insertAtCursor = (text: string) => {
    const editor = viewRef.current;
    if (!editor) return;
    const { to } = editor.state.selection.main;
    editor.dispatch({ changes: { from: to, insert: text }, selection: { anchor: to + text.length } });
    editor.focus();
  };

  const documentHtml = () => {
    const title = /^#\s+(.+)$/m.exec(markdown)?.[1]?.trim() ?? t('toolsWeb.markdown.document_title');
    const safeTitle = title.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<!doctype html>\n<html>\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>${safeTitle}</title>\n<style>${DOCUMENT_STYLE}</style>\n</head>\n<body>\n${html}\n</body>\n</html>\n`;
  };
  const recordRun = () => record({ markdown }, { length: html.length });

  const actions: Array<{ icon: typeof Bold; label: string; run: () => void }> = [
    { icon: Heading2, label: 'heading', run: () => prefixLines(() => '## ') },
    { icon: Bold, label: 'bold', run: () => wrap('**', '**', 'toolsWeb.markdown.ph_bold') },
    { icon: Italic, label: 'italic', run: () => wrap('*', '*', 'toolsWeb.markdown.ph_italic') },
    { icon: Strikethrough, label: 'strike', run: () => wrap('~~', '~~', 'toolsWeb.markdown.ph_strike') },
    { icon: Code, label: 'code', run: () => wrap('`', '`', 'toolsWeb.markdown.ph_code') },
    { icon: Link2, label: 'link', run: () => wrap('[', '](https://)', 'toolsWeb.markdown.ph_link') },
    { icon: Quote, label: 'quote', run: () => prefixLines(() => '> ') },
    { icon: List, label: 'list', run: () => prefixLines(() => '- ') },
    { icon: ListOrdered, label: 'ordered', run: () => prefixLines((i) => `${i + 1}. `) },
    { icon: Table2, label: 'table', run: () => insertAtCursor(TABLE_SNIPPET) },
  ];

  return (
    <WebPage>
      <div className="grid gap-3 lg:grid-cols-2">
        <Pane
          title={t('toolsWeb.markdown.editor')}
          icon={FileText}
          className="h-[52vh] min-h-[320px] lg:h-[70vh]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Btn icon={Wand2} onClick={() => setMarkdown(SAMPLE)}>{t('toolsWeb.common.sample')}</Btn>
              <Btn icon={Eraser} disabled={!markdown} onClick={() => setMarkdown('')} title={t('uiTools.common.clear')} />
            </>
          )}
          footer={`${t('toolsWeb.markdown.words', { count: stats.words })} · ${t('toolsWeb.markdown.read_minutes', { count: stats.minutes })}`}
        >
          <div className="flex flex-wrap gap-0.5 border-b border-slate-200 px-2 py-1 dark:border-slate-800">
            {actions.map((action) => (
              <Btn key={action.label} icon={action.icon} title={t(`toolsWeb.markdown.tool_${action.label}`)} onClick={action.run} />
            ))}
          </div>
          <CodeEditor value={markdown} onChange={setMarkdown} language="md" placeholder={t('toolsWeb.markdown.placeholder')} onReady={(editor) => { viewRef.current = editor; }} className="min-h-0 flex-1" />
        </Pane>

        <Pane
          title={t('toolsWeb.markdown.output')}
          className="h-[52vh] min-h-[320px] lg:h-[70vh]"
          bodyClassName="flex flex-col"
          actions={(
            <>
              <Seg value={view} onChange={setView} options={[
                { value: 'preview', label: t('toolsWeb.markdown.view_preview') },
                { value: 'html', label: t('toolsWeb.markdown.view_html') },
              ]} />
              <CopyBtn getText={() => html} onCopied={recordRun} label={t('toolsWeb.markdown.copy_html')} disabled={!html} />
              <Btn icon={Download} title={t('toolsWeb.markdown.download_html')} disabled={!html} onClick={() => { downloadText(documentHtml(), 'document.html', 'text/html'); recordRun(); }} />
            </>
          )}
        >
          {view === 'preview'
            ? <div className="min-h-0 flex-1 overflow-auto p-4">{source.trim() ? <MarkdownPreview markdown={source} /> : <p className="text-xs text-slate-500 dark:text-slate-400">{t('toolsWeb.markdown.empty')}</p>}</div>
            : <CodeEditor value={html} readOnly language="html" className="min-h-0 flex-1" />}
        </Pane>
      </div>
    </WebPage>
  );
};

export default MarkdownToHtmlWorkbench;
