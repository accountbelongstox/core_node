import React, { useMemo } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { loadLanguage, LanguageName } from '@uiw/codemirror-extensions-langs';

/**
 * Syntax-highlighted code viewer / editor for the unified Media explorer.
 *
 * Controlled component: the parent (FileViewer) owns the buffer (its existing
 * editValue/fileContent state). When `editable` is false this is a read-only
 * highlighted view; when true it edits and reports changes via onChange so the
 * parent's existing Save flow persists them. Loaded lazily so CodeMirror is
 * only pulled into the bundle when a code file is actually opened.
 */
interface CodeEditorProps {
  value: string;
  /** Lowercased file extension (no dot), used to pick the grammar. */
  extension: string;
  editable: boolean;
  onChange?: (next: string) => void;
}

// Map common extensions to a CodeMirror grammar key. The @uiw langs registry
// keys are short extension-style names (js/ts/rs/rb/kt/cs/sh, not
// javascript/rust/...), so values below must be valid keys of `langs`
// (LanguageName). Anything not listed renders as plain (still readable) text.
const EXT_TO_LANG: Record<string, LanguageName> = {
  js: 'js', mjs: 'mjs', cjs: 'cjs', jsx: 'jsx',
  ts: 'ts', tsx: 'tsx',
  py: 'py', php: 'php', java: 'java',
  c: 'c', h: 'h', cpp: 'cpp', cc: 'cc', cxx: 'cxx', hpp: 'hpp',
  go: 'go', rs: 'rs', rb: 'rb', kt: 'kt', swift: 'swift',
  cs: 'cs', dart: 'dart', lua: 'lua', scala: 'scala',
  json: 'json', html: 'html', htm: 'htm', xml: 'xml', vue: 'vue',
  css: 'css', scss: 'scss', sass: 'sass', less: 'less',
  md: 'md', markdown: 'markdown', sql: 'sql',
  yml: 'yml', yaml: 'yaml', toml: 'toml', ini: 'ini',
  sh: 'sh', bash: 'bash', zsh: 'sh',
};

const CodeEditor: React.FC<CodeEditorProps> = ({ value, extension, editable, onChange }) => {
  const extensions = useMemo(() => {
    const list: any[] = [EditorView.lineWrapping];
    const key = extension ? extension.toLowerCase() : '';
    const langName = EXT_TO_LANG[key];
    if (langName) {
      const lang = loadLanguage(langName);
      if (lang) {
        list.push(lang);
      }
    }
    return list;
  }, [extension]);

  return (
    <div className="h-full w-full overflow-hidden">
      <CodeMirror
        value={value}
        height="100%"
        theme="dark"
        editable={editable}
        readOnly={!editable}
        extensions={extensions}
        onChange={(next) => {
          if (onChange) {
            onChange(next);
          }
        }}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: editable,
          highlightActiveLineGutter: editable,
        }}
        style={{ height: '100%', fontSize: '12px' }}
      />
    </div>
  );
};

export default CodeEditor;
