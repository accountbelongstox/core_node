/** GitHub-flavoured Markdown renderer with Tailwind element styling (shared by preview and static HTML export). */
import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type ElementProps = Record<string, unknown> & { className?: string; node?: unknown };

const styled = (tag: string, base: string): React.FC<ElementProps> => {
  const Element: React.FC<ElementProps> = ({ node: _node, className, ...rest }) => React.createElement(tag, { ...rest, className: className ? `${base} ${className}` : base });
  return Element;
};

const COMPONENTS = {
  h1: styled('h1', 'mb-3 mt-5 border-b border-slate-200 pb-1 text-2xl font-bold dark:border-slate-700'),
  h2: styled('h2', 'mb-2 mt-5 border-b border-slate-200 pb-1 text-xl font-bold dark:border-slate-700'),
  h3: styled('h3', 'mb-2 mt-4 text-lg font-semibold'),
  h4: styled('h4', 'mb-1 mt-3 text-base font-semibold'),
  h5: styled('h5', 'mb-1 mt-3 text-sm font-semibold'),
  h6: styled('h6', 'mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500'),
  p: styled('p', 'my-2 leading-7'),
  a: styled('a', 'text-cyan-600 underline underline-offset-2 hover:text-cyan-500 dark:text-cyan-400'),
  ul: styled('ul', 'my-2 list-disc space-y-1 pl-6'),
  ol: styled('ol', 'my-2 list-decimal space-y-1 pl-6'),
  li: styled('li', 'leading-7'),
  blockquote: styled('blockquote', 'my-3 border-l-4 border-cyan-500/60 bg-slate-100 px-4 py-1 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300'),
  code: styled('code', 'rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em] text-rose-600 dark:bg-slate-800 dark:text-rose-300'),
  pre: styled('pre', 'my-3 overflow-auto rounded-lg bg-slate-900 p-3 font-mono text-xs leading-5 text-slate-100 [&_code]:bg-transparent [&_code]:p-0 [&_code]:text-slate-100'),
  table: styled('table', 'my-3 w-full border-collapse text-sm'),
  th: styled('th', 'border border-slate-300 bg-slate-100 px-3 py-1.5 text-left font-semibold dark:border-slate-700 dark:bg-slate-800'),
  td: styled('td', 'border border-slate-300 px-3 py-1.5 dark:border-slate-700'),
  hr: styled('hr', 'my-5 border-slate-200 dark:border-slate-700'),
  img: styled('img', 'my-2 max-w-full rounded'),
} as unknown as Components;

export const MarkdownPreview: React.FC<{ markdown: string }> = ({ markdown }) => (
  <div className="text-sm text-slate-800 dark:text-slate-200">
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={COMPONENTS}>{markdown}</ReactMarkdown>
  </div>
);

/** Static markup of the document without UI classes, for copy / export. */
export async function markdownToHtml(markdown: string): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm] }, markdown));
}
