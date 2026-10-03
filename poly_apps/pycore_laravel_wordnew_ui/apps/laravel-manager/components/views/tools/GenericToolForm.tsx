/** Schema-driven fallback for a tool that has no dedicated workbench yet. */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Code, Copy, Loader, Play, X } from 'lucide-react';
import { copyToClipboard, toJsonString } from '@/apps/laravel-manager/utils/exportResult';
import { unifiedToolsInputClass as inputCls } from '../unifiedToolsTheme';
import { callToolApi, useToolRun } from './toolRunner';
import type { ToolWorkbenchProps } from './toolWorkbenchTypes';

interface FieldSchema {
  type?: string;
  enum?: Array<string | number>;
  title?: string;
  accept?: string;
}

const GenericToolForm: React.FC<ToolWorkbenchProps> = ({ tool, variant }) => {
  const { t } = useTranslation();
  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [copied, setCopied] = useState(false);
  const { result, error, running, run } = useToolRun<unknown>(tool.id, variant);
  const properties = (tool.inputSchema?.properties ?? {}) as Record<string, FieldSchema>;
  const required: string[] = tool.inputSchema?.required ?? [];
  const resultText = result == null ? '' : typeof result === 'string' ? result : toJsonString(result);

  const setField = (name: string, value: unknown) => setFormData((prev) => ({ ...prev, [name]: value }));

  const renderField = (name: string, schema: FieldSchema) => {
    const value = formData[name] ?? '';
    const label = schema.title || name.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    return (
      <div key={name} className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
          {required.includes(name) && <span className="text-rose-500 ml-1">*</span>}
        </label>
        {schema.enum ? (
          <select value={String(value)} onChange={(e) => setField(name, e.target.value)} className={inputCls}>
            <option value="">{t('uiTools.page.select_option')}</option>
            {schema.enum.map((option) => <option key={String(option)} value={option}>{String(option)}</option>)}
          </select>
        ) : schema.type === 'number' ? (
          <input type="number" value={String(value)} className={inputCls}
            onChange={(e) => setField(name, e.target.value === '' ? '' : parseFloat(e.target.value))} />
        ) : schema.type === 'boolean' ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!value} onChange={(e) => setField(name, e.target.checked)} className="w-4 h-4 rounded" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('uiTools.page.enable')}</span>
          </label>
        ) : schema.type === 'file' ? (
          <input type="file" accept={schema.accept} onChange={(e) => setField(name, e.target.files?.[0])} className={inputCls} />
        ) : (
          <textarea value={String(value)} rows={3} onChange={(e) => setField(name, e.target.value)} className={inputCls + ' resize-none'} />
        )}
      </div>
    );
  };

  const copy = async () => {
    if (await copyToClipboard(resultText)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-4 sm:p-6">
      <div className="rounded-xl p-5 border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2"><Code className="w-4 h-4 text-indigo-500" />{t('uiTools.common.input')}</h3>
        <div className="space-y-4">
          {Object.keys(properties).length === 0
            ? <p className="text-sm text-slate-500">{t('uiTools.page.no_parameters')}</p>
            : Object.entries(properties).map(([name, schema]) => renderField(name, schema))}
        </div>
      </div>
      <button onClick={() => run(formData, () => callToolApi(tool.apiMethod, formData))} disabled={running}
        className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400">
        {running ? <><Loader className="w-5 h-5 animate-spin" />{t('uiTools.page.button_processing')}</>
          : <><Play className="w-5 h-5" />{t('uiTools.page.button_execute')}<ChevronRight className="w-4 h-4" /></>}
      </button>
      {error && (
        <div className="rounded-xl p-4 border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 flex gap-3">
          <X className="w-5 h-5 text-rose-500 flex-shrink-0" /><p className="text-sm text-rose-600 dark:text-rose-300">{error}</p>
        </div>
      )}
      {result != null && (
        <div className="rounded-xl p-5 border border-slate-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold flex items-center gap-2 text-emerald-600"><Check className="w-5 h-5" />{t('uiTools.page.result')}</h3>
            <button onClick={copy} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-slate-100 dark:bg-slate-700/60">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? t('uiTools.common.copied') : t('uiTools.common.copy')}
            </button>
          </div>
          <pre className="text-sm font-mono whitespace-pre-wrap break-words p-4 rounded-lg bg-slate-50 dark:bg-slate-950/50">{resultText}</pre>
        </div>
      )}
    </div>
  );
};

export default GenericToolForm;
