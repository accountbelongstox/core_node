/** Collapsible, type-tinted JSON tree; clicking a key copies its JSON path. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight } from 'lucide-react';
import { copyToClipboard } from '@/apps/laravel-manager/utils/exportResult';
import { jsonChildCount, jsonPathKey, jsonTypeOf, type JsonValue } from '../logic/json';

const PAGE = 100;

const SCALAR_CLASS: Record<string, string> = {
  string: 'text-emerald-600 dark:text-emerald-400',
  number: 'text-amber-600 dark:text-amber-400',
  boolean: 'text-violet-600 dark:text-violet-400',
  null: 'text-slate-400 dark:text-slate-500',
};

interface NodeProps {
  name: string | number | null;
  value: JsonValue;
  path: string;
  level: number;
  openLevel: number;
}

const JsonNode: React.FC<NodeProps> = ({ name, value, path, level, openLevel }) => {
  const { t } = useTranslation();
  const type = jsonTypeOf(value);
  const container = type === 'object' || type === 'array';
  const [open, setOpen] = useState(level < openLevel);
  const [shown, setShown] = useState(PAGE);
  const entries: Array<[string | number, JsonValue]> = !container ? []
    : Array.isArray(value) ? value.map((item, i) => [i, item]) : Object.entries(value as { [key: string]: JsonValue });

  const label = name === null ? null : (
    <button
      type="button"
      title={path}
      onClick={() => { void copyToClipboard(path); }}
      className={`cursor-pointer rounded px-0.5 text-left hover:bg-cyan-500/10 ${typeof name === 'number' ? 'text-slate-400 dark:text-slate-500' : 'text-cyan-700 dark:text-cyan-300'}`}
    >
      {typeof name === 'number' ? name : `"${name}"`}
    </button>
  );

  if (!container) {
    const text = type === 'string' ? JSON.stringify(value) : String(value);
    return (
      <div className="flex min-w-0 gap-1 py-px pl-4">
        {label}
        {label && <span className="text-slate-400">:</span>}
        <span className={`min-w-0 break-all ${SCALAR_CLASS[type]}`}>{text}</span>
      </div>
    );
  }

  const count = jsonChildCount(value);
  const brackets = type === 'array' ? ['[', ']'] : ['{', '}'];
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 items-center gap-1 py-px">
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="cursor-pointer text-slate-400 hover:text-cyan-500">
          <ChevronRight className={`h-3 w-3 transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden />
        </button>
        {label}
        {label && <span className="text-slate-400">:</span>}
        <span className="text-slate-500">{brackets[0]}{!open && (count ? '…' : '')}{!open && brackets[1]}</span>
        <span className="font-sans text-[10px] text-slate-400">{t(type === 'array' ? 'toolsWeb.json.items' : 'toolsWeb.json.keys', { count })}</span>
      </div>
      {open && (
        <div className="ml-[7px] border-l border-slate-200 pl-3 dark:border-slate-700">
          {entries.slice(0, shown).map(([key, child]) => (
            <JsonNode key={String(key)} name={key} value={child} path={jsonPathKey(path, key)} level={level + 1} openLevel={openLevel} />
          ))}
          {entries.length > shown && (
            <button type="button" onClick={() => setShown(shown + PAGE)} className="cursor-pointer py-1 font-sans text-[11px] font-semibold text-cyan-600 hover:underline dark:text-cyan-300">
              {t('toolsWeb.json.show_more', { count: entries.length - shown })}
            </button>
          )}
          <div className="text-slate-500">{brackets[1]}</div>
        </div>
      )}
    </div>
  );
};

interface JsonTreeProps {
  value: JsonValue;
  openLevel: number;
}

export const JsonTree: React.FC<JsonTreeProps> = ({ value, openLevel }) => (
  <div className="h-full overflow-auto p-3 font-mono text-xs leading-5">
    <JsonNode name={null} value={value} path="$" level={0} openLevel={openLevel} />
  </div>
);
