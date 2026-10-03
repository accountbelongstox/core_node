/** Prompt Manager, browser side: a local template library with {variable} fill-in and a live rendered preview. */
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilePlus2, Pencil, Search, Star, Trash2 } from 'lucide-react';
import { Btn, Chips, controlClass, CopyBtn, EmptyBlock, Field, Panel } from './opsKit';
import { extractVariables, renderPrompt } from './opsLogic';

interface PromptTemplate {
  id: string;
  name: string;
  category: string;
  content: string;
  variables: string[];
  description?: string;
  favorite?: boolean;
  timestamp: number;
}

type Mode = 'view' | 'edit';

const STORAGE_KEY = 'ai_prompts';
const ALL = 'all';
const FAVORITES = '__favorites__';
const CATEGORY_KEYS: Record<string, string> = {
  Translation: 'translation',
  'Content Generation': 'content_generation',
  'Code Generation': 'code_generation',
  Summarization: 'summarization',
  'Question Answering': 'question_answering',
  'Data Extraction': 'data_extraction',
  Classification: 'classification',
  Other: 'other',
};
const CATEGORIES = Object.keys(CATEGORY_KEYS);

const readStored = (): PromptTemplate[] | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed as PromptTemplate[] : null;
  } catch {
    return null;
  }
};

const writeStored = (prompts: PromptTemplate[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
  } catch {
    /* quota or private mode: the library stays in memory */
  }
};

const PromptTemplates: React.FC = () => {
  const { t } = useTranslation();
  const defaults = useMemo<PromptTemplate[]>(() => [
    { id: 'default-translation', name: t('uiTools.prompt_form.defaults.translation_name'), category: 'Translation', content: 'Translate the following {source_lang} text to {target_lang}:\n\n{text}', variables: ['source_lang', 'target_lang', 'text'], description: t('uiTools.prompt_form.defaults.translation_description'), timestamp: 0 },
    { id: 'default-code', name: t('uiTools.prompt_form.defaults.code_explainer_name'), category: 'Code Generation', content: 'Explain the following {language} code in simple terms:\n\n```{language}\n{code}\n```', variables: ['language', 'code'], description: t('uiTools.prompt_form.defaults.code_explainer_description'), timestamp: 0 },
    { id: 'default-summary', name: t('uiTools.prompt_form.defaults.text_summarizer_name'), category: 'Summarization', content: 'Summarize the following text in {length} sentences:\n\n{text}', variables: ['length', 'text'], description: t('uiTools.prompt_form.defaults.text_summarizer_description'), timestamp: 0 },
  ], [t]);
  const [prompts, setPrompts] = useState<PromptTemplate[]>(() => readStored() ?? defaults);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('view');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState(ALL);
  const [values, setValues] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<PromptTemplate | null>(null);

  const categoryLabel = (category: string): string => (CATEGORY_KEYS[category] ? t(`uiTools.prompt_form.categories.${CATEGORY_KEYS[category]}`) : category);
  const selected = prompts.find((prompt) => prompt.id === selectedId) ?? null;
  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return prompts
      .filter((prompt) => (filter === ALL ? true : filter === FAVORITES ? prompt.favorite : prompt.category === filter))
      .filter((prompt) => !query || `${prompt.name} ${prompt.description ?? ''} ${prompt.content}`.toLowerCase().includes(query))
      .sort((a, b) => Number(Boolean(b.favorite)) - Number(Boolean(a.favorite)));
  }, [prompts, filter, search]);

  const persist = (next: PromptTemplate[]): void => {
    setPrompts(next);
    writeStored(next);
  };

  const open = (prompt: PromptTemplate): void => {
    setSelectedId(prompt.id);
    setMode('view');
    setValues({});
  };

  const startNew = (): void => {
    setDraft({ id: '', name: '', category: CATEGORIES[0], content: '', variables: [], description: '', timestamp: Date.now() });
    setMode('edit');
    setSelectedId(null);
  };

  const startEdit = (): void => {
    if (!selected) return;
    setDraft({ ...selected });
    setMode('edit');
  };

  const save = (): void => {
    if (!draft || !draft.name.trim() || !draft.content.trim()) return;
    const stored: PromptTemplate = { ...draft, id: draft.id || `prompt-${Date.now()}`, name: draft.name.trim(), variables: extractVariables(draft.content), timestamp: Date.now() };
    persist(draft.id ? prompts.map((prompt) => (prompt.id === stored.id ? stored : prompt)) : [stored, ...prompts]);
    setSelectedId(stored.id);
    setMode('view');
    setDraft(null);
  };

  const remove = (): void => {
    if (!selected || !window.confirm(t('uiTools.prompt_form.delete_confirm'))) return;
    persist(prompts.filter((prompt) => prompt.id !== selected.id));
    setSelectedId(null);
  };

  const toggleFavorite = (id: string): void => persist(prompts.map((prompt) => (prompt.id === id ? { ...prompt, favorite: !prompt.favorite } : prompt)));
  const variables = selected ? extractVariables(selected.content) : [];
  const rendered = selected ? renderPrompt(selected.content, values) : '';

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <Panel
        title={t('toolsOps.prompt.templates')}
        icon={FilePlus2}
        accent="fuchsia"
        className="lg:col-span-2"
        actions={<Btn size="sm" variant="soft" accent="fuchsia" icon={FilePlus2} onClick={startNew}>{t('uiTools.prompt_form.new_prompt')}</Btn>}
        bodyClassName="space-y-3 p-3"
      >
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('uiTools.prompt_form.search_placeholder')} className={`${controlClass('fuchsia')} pl-9`} />
        </div>
        <Chips
          accent="fuchsia"
          value={filter}
          onChange={setFilter}
          nowrap
          options={[{ value: ALL, label: t('uiTools.prompt_form.all_categories') }, { value: FAVORITES, label: t('uiTools.prompt_form.favorites') }, ...CATEGORIES.map((category) => ({ value: category, label: categoryLabel(category) }))]}
        />
        {visible.length === 0 ? (
          <EmptyBlock icon={Search}>{t('uiTools.prompt_form.no_prompts')}</EmptyBlock>
        ) : (
          <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
            {visible.map((prompt) => (
              <li key={prompt.id}>
                <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 transition-colors ${prompt.id === selectedId ? 'border-fuchsia-300 bg-fuchsia-50 dark:border-fuchsia-500/40 dark:bg-fuchsia-500/10' : 'border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}>
                  <button type="button" onClick={() => open(prompt)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-slate-800 dark:text-slate-100">{prompt.name}</span>
                    <span className="block truncate text-[11px] text-slate-400">{categoryLabel(prompt.category)}{prompt.description ? ` · ${prompt.description}` : ''}</span>
                  </button>
                  <button type="button" onClick={() => toggleFavorite(prompt.id)} title={t('uiTools.prompt_form.favorites')} className="shrink-0 p-1">
                    <Star className={`h-4 w-4 ${prompt.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="space-y-4 lg:col-span-3">
        {mode === 'edit' && draft ? (
          <Panel title={draft.id ? t('uiTools.prompt_form.edit_prompt') : t('uiTools.prompt_form.new_prompt')} icon={Pencil} accent="fuchsia">
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('uiTools.prompt_form.name_label')}>
                  <input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder={t('uiTools.prompt_form.name_placeholder')} className={controlClass('fuchsia')} />
                </Field>
                <Field label={t('uiTools.prompt_form.category_label')}>
                  <select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} className={controlClass('fuchsia')}>
                    {CATEGORIES.map((category) => <option key={category} value={category}>{categoryLabel(category)}</option>)}
                  </select>
                </Field>
              </div>
              <Field label={t('uiTools.prompt_form.description_label')}>
                <input value={draft.description ?? ''} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder={t('uiTools.prompt_form.description_placeholder')} className={controlClass('fuchsia')} />
              </Field>
              <Field label={t('uiTools.prompt_form.content_label')} hint={t('uiTools.prompt_form.content_hint')}>
                <textarea value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder={t('uiTools.prompt_form.content_placeholder')} rows={9} className={`${controlClass('fuchsia')} resize-y font-mono`} />
              </Field>
              {extractVariables(draft.content).length > 0 && (
                <p className="text-xs text-fuchsia-600 dark:text-fuchsia-300">{t('uiTools.prompt_form.variables_detected', { variables: extractVariables(draft.content).join(', ') })}</p>
              )}
              <div className="flex justify-end gap-2">
                <Btn onClick={() => { setMode('view'); setDraft(null); }}>{t('uiTools.common.cancel')}</Btn>
                <Btn variant="primary" accent="fuchsia" onClick={save} disabled={!draft.name.trim() || !draft.content.trim()}>{t('uiTools.common.save')}</Btn>
              </div>
            </div>
          </Panel>
        ) : selected ? (
          <>
            <Panel
              title={selected.name}
              icon={Star}
              accent="fuchsia"
              actions={(
                <>
                  <Btn size="sm" icon={Pencil} onClick={startEdit}>{t('uiTools.common.edit')}</Btn>
                  <Btn size="sm" variant="dangerSoft" icon={Trash2} onClick={remove}>{t('uiTools.common.delete')}</Btn>
                </>
              )}
            >
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{categoryLabel(selected.category)}{selected.description ? ` · ${selected.description}` : ''}</p>
              {variables.length > 0 && (
                <div className="mb-3 grid gap-3 sm:grid-cols-2">
                  {variables.map((name) => (
                    <Field key={name} label={`{${name}}`}>
                      <input value={values[name] ?? ''} onChange={(event) => setValues({ ...values, [name]: event.target.value })} className={controlClass('fuchsia')} />
                    </Field>
                  ))}
                </div>
              )}
              <Field label={t('toolsOps.prompt.rendered')} hint={variables.length > 0 ? t('toolsOps.prompt.rendered_hint') : undefined}>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 font-mono text-xs leading-relaxed text-slate-800 dark:bg-slate-900/50 dark:text-slate-100">{rendered}</pre>
              </Field>
              <div className="mt-3 flex justify-end"><CopyBtn text={rendered} accent="fuchsia" size="md" /></div>
            </Panel>
          </>
        ) : (
          <Panel bodyClassName="p-0"><EmptyBlock icon={FilePlus2}>{t('toolsOps.prompt.pick_template')}</EmptyBlock></Panel>
        )}
      </div>
    </div>
  );
};

export default PromptTemplates;
