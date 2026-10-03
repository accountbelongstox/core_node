/** Line-numbered CodeMirror pane for the web workbenches (lazy chunk). */
import React, { useMemo } from 'react';
import CodeMirror, { Decoration, EditorView, type Extension } from '@uiw/react-codemirror';
import { loadLanguage, type LanguageName } from '@uiw/codemirror-extensions-langs';

export type CodeLanguage = 'json' | 'yaml' | 'xml' | 'html' | 'sql' | 'md' | 'text';

export interface CodePaneProps {
  value: string;
  onChange?: (next: string) => void;
  language: CodeLanguage;
  readOnly?: boolean;
  dark: boolean;
  placeholder?: string;
  /** 1-based line tinted as an error pointer. */
  errorLine?: number | null;
  wrap?: boolean;
  onReady?: (view: EditorView) => void;
}

const LANGUAGE_KEYS: Record<Exclude<CodeLanguage, 'text'>, LanguageName> = {
  json: 'json', yaml: 'yaml', xml: 'xml', html: 'html', sql: 'sql', md: 'markdown',
};

const ERROR_LINE = Decoration.line({ class: 'cm-error-line' });

const PANE_THEME = EditorView.theme({
  '&': { backgroundColor: 'transparent', height: '100%', fontSize: '12.5px' },
  '.cm-scroller': { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' },
  '.cm-gutters': { backgroundColor: 'transparent', border: 'none' },
  '.cm-error-line': { backgroundColor: 'rgba(244, 63, 94, 0.2)' },
  '&.cm-focused': { outline: 'none' },
});

const CodePane: React.FC<CodePaneProps> = ({ value, onChange, language, readOnly = false, dark, placeholder, errorLine = null, wrap = true, onReady }) => {
  const extensions = useMemo(() => {
    const list: Extension[] = [PANE_THEME];
    if (wrap) list.push(EditorView.lineWrapping);
    if (language !== 'text') {
      const lang = loadLanguage(LANGUAGE_KEYS[language]);
      if (lang) list.push(lang);
    }
    if (errorLine && errorLine > 0) {
      list.push(EditorView.decorations.of((view) => (
        errorLine <= view.state.doc.lines ? Decoration.set([ERROR_LINE.range(view.state.doc.line(errorLine).from)]) : Decoration.none
      )));
    }
    return list;
  }, [language, errorLine, wrap]);

  return (
    <CodeMirror
      value={value}
      height="100%"
      theme={dark ? 'dark' : 'light'}
      editable={!readOnly}
      readOnly={readOnly}
      placeholder={placeholder}
      extensions={extensions}
      onChange={onChange}
      onCreateEditor={onReady}
      basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: !readOnly, highlightActiveLineGutter: !readOnly }}
      style={{ height: '100%' }}
    />
  );
};

export default CodePane;
