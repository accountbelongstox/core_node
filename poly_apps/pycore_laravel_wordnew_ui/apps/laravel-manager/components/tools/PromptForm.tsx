import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Save,
  Copy,
  Check,
  FolderOpen,
  Search,
  Star,
  Code
} from 'lucide-react';
import { useToolModel, useClipboard } from '@/apps/laravel-manager/hooks';
import { AI_TOOLS } from '@/apps/laravel-manager/config/tools.config';
import ToolWrapper from '@/shared/ui/ToolWrapper';
import { commonClasses } from '@/shared/styles/theme';
import {
  AI_BODY,
  AI_GRID_2,
  AI_GRID_3,
  AiBentoCard,
  AiToolActions,
  AiToolEmpty,
  AiToolField,
  AiToolTips,
} from '@/shared/ui/AiToolUi';

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

const CATEGORIES = [
  'Translation',
  'Content Generation',
  'Code Generation',
  'Summarization',
  'Question Answering',
  'Data Extraction',
  'Classification',
  'Other'
];

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  'Translation': 'translation',
  'Content Generation': 'content_generation',
  'Code Generation': 'code_generation',
  'Summarization': 'summarization',
  'Question Answering': 'question_answering',
  'Data Extraction': 'data_extraction',
  'Classification': 'classification',
  'Other': 'other'
};

const PromptForm: React.FC = () => {
  const { copy } = useClipboard();
  const { t } = useTranslation();
  const config = AI_TOOLS.promptManager;
  const { isFavorite, toggleFavorite } = useToolModel(config);

  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [newPrompt, setNewPrompt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [copied, setCopied] = useState(false);

  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formDescription, setFormDescription] = useState('');

  const getCategoryLabel = (category: string): string =>
    CATEGORY_LABEL_KEYS[category] ? t(`uiTools.prompt_form.categories.${CATEGORY_LABEL_KEYS[category]}`) : category;

  const DEFAULT_PROMPTS: PromptTemplate[] = [
    {
      id: '1',
      name: t('uiTools.prompt_form.defaults.translation_name'),
      category: 'Translation',
      content: 'Translate the following {source_lang} text to {target_lang}:\n\n{text}',
      variables: ['source_lang', 'target_lang', 'text'],
      description: t('uiTools.prompt_form.defaults.translation_description'),
      timestamp: Date.now()
    },
    {
      id: '2',
      name: t('uiTools.prompt_form.defaults.code_explainer_name'),
      category: 'Code Generation',
      content: 'Explain the following {language} code in simple terms:\n\n```{language}\n{code}\n```',
      variables: ['language', 'code'],
      description: t('uiTools.prompt_form.defaults.code_explainer_description'),
      timestamp: Date.now()
    },
    {
      id: '3',
      name: t('uiTools.prompt_form.defaults.text_summarizer_name'),
      category: 'Summarization',
      content: 'Summarize the following text in {length} sentences:\n\n{text}',
      variables: ['length', 'text'],
      description: t('uiTools.prompt_form.defaults.text_summarizer_description'),
      timestamp: Date.now()
    }
  ];

  useEffect(() => {
    loadPrompts();
  }, []);

  const loadPrompts = () => {
    const saved = localStorage.getItem('ai_prompts');
    if (saved) {
      try {
        setPrompts(JSON.parse(saved));
      } catch {
        setPrompts(DEFAULT_PROMPTS);
      }
    } else {
      setPrompts(DEFAULT_PROMPTS);
    }
  };

  const savePrompts = (newPrompts: PromptTemplate[]) => {
    localStorage.setItem('ai_prompts', JSON.stringify(newPrompts));
    setPrompts(newPrompts);
  };

  const extractVariables = (content: string): string[] => {
    const matches = content.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  };

  const handleSave = () => {
    if (!formName.trim() || !formContent.trim()) return;

    const variables = extractVariables(formContent);

    if (editMode && selectedPrompt) {
      const updated = prompts.map(p =>
        p.id === selectedPrompt.id
          ? { ...p, name: formName, category: formCategory, content: formContent, description: formDescription, variables }
          : p
      );
      savePrompts(updated);
      setSelectedPrompt(null);
    } else if (newPrompt) {
      const newTemplate: PromptTemplate = {
        id: Date.now().toString(),
        name: formName,
        category: formCategory,
        content: formContent,
        description: formDescription,
        variables,
        timestamp: Date.now()
      };
      savePrompts([newTemplate, ...prompts]);
    }

    handleCancel();
  };

  const handleEdit = (prompt: PromptTemplate) => {
    setSelectedPrompt(prompt);
    setFormName(prompt.name);
    setFormCategory(prompt.category);
    setFormContent(prompt.content);
    setFormDescription(prompt.description || '');
    setEditMode(true);
    setNewPrompt(false);
  };

  const handleNew = () => {
    setSelectedPrompt(null);
    setFormName('');
    setFormCategory(CATEGORIES[0]);
    setFormContent('');
    setFormDescription('');
    setEditMode(false);
    setNewPrompt(true);
  };

  const handleCancel = () => {
    setEditMode(false);
    setNewPrompt(false);
    setSelectedPrompt(null);
    setFormName('');
    setFormCategory('');
    setFormContent('');
    setFormDescription('');
  };

  const handleDelete = (id: string) => {
    if (confirm(t('uiTools.prompt_form.delete_confirm'))) {
      const updated = prompts.filter(p => p.id !== id);
      savePrompts(updated);
      if (selectedPrompt?.id === id) {
        setSelectedPrompt(null);
        handleCancel();
      }
    }
  };

  const handleTogglePromptFavorite = (id: string) => {
    const updated = prompts.map(p =>
      p.id === id ? { ...p, favorite: !p.favorite } : p
    );
    savePrompts(updated);
  };

  const handleCopy = async (content: string) => {
    if (!(await copy(content))) return;
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredPrompts = prompts.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.content.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      filterCategory === 'all' ||
      (filterCategory === 'favorites' && p.favorite) ||
      p.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <ToolWrapper
      title={config.name}
      icon={FileText}
      gradient="purple-pink"
      description={config.description}
      favorites={config.favorites}
      isFavorite={isFavorite}
      onToggleFavorite={toggleFavorite}
      actions={
        <button
          onClick={handleNew}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 text-xs`}
        >
          <Plus className="w-4 h-4" />
          {t('uiTools.prompt_form.new_prompt')}
        </button>
      }
    >
      <div className={AI_BODY}>
        <AiBentoCard title={t('uiTools.prompt_form.search_filter')}>
          <div className={AI_GRID_2}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('uiTools.prompt_form.search_placeholder')}
                className={`${commonClasses.input} w-full pl-10`}
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`${commonClasses.input} w-full`}
            >
              <option value="all">{t('uiTools.prompt_form.all_categories')}</option>
              <option value="favorites">{t('uiTools.prompt_form.favorites')}</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
              ))}
            </select>
          </div>
        </AiBentoCard>

        {(editMode || newPrompt) && (
          <AiBentoCard title={editMode ? t('uiTools.prompt_form.edit_prompt') : t('uiTools.prompt_form.new_prompt')}>
            <div className="space-y-4">
              <div className={AI_GRID_2}>
                <AiToolField label={t('uiTools.prompt_form.name_label')}>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder={t('uiTools.prompt_form.name_placeholder')}
                    className={`${commonClasses.input} w-full`}
                  />
                </AiToolField>
                <AiToolField label={t('uiTools.prompt_form.category_label')}>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className={`${commonClasses.input} w-full`}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{getCategoryLabel(cat)}</option>
                    ))}
                  </select>
                </AiToolField>
              </div>

              <AiToolField label={t('uiTools.prompt_form.description_label')}>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder={t('uiTools.prompt_form.description_placeholder')}
                  className={`${commonClasses.input} w-full`}
                />
              </AiToolField>

              <AiToolField
                label={
                  <>
                    {t('uiTools.prompt_form.content_label')}
                    <span className="text-xs font-normal text-slate-500 ml-2">
                      {t('uiTools.prompt_form.content_hint')}
                    </span>
                  </>
                }
              >
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder={t('uiTools.prompt_form.content_placeholder')}
                  className={`${commonClasses.input} w-full h-48 font-mono text-sm resize-none`}
                />
                {formContent && extractVariables(formContent).length > 0 && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40">
                    <p className="text-xs text-violet-700 dark:text-violet-300">
                      {t('uiTools.prompt_form.variables_detected', { variables: extractVariables(formContent).join(', ') })}
                    </p>
                  </div>
                )}
              </AiToolField>

              <AiToolActions className="!justify-start">
                <button
                  onClick={handleSave}
                  disabled={!formName.trim() || !formContent.trim()}
                  className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2 disabled:opacity-50`}
                >
                  <Save className="w-4 h-4" />
                  {t('uiTools.common.save')}
                </button>
                <button
                  onClick={handleCancel}
                  className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
                >
                  {t('uiTools.common.cancel')}
                </button>
              </AiToolActions>
            </div>
          </AiBentoCard>
        )}

        <div className={AI_GRID_3}>
          {filteredPrompts.length === 0 ? (
            <AiToolEmpty icon={FolderOpen} message={t('uiTools.prompt_form.no_prompts')} />
          ) : (
            filteredPrompts.map(prompt => (
              <AiBentoCard
                key={prompt.id}
                className="hover:shadow-md transition-shadow"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate text-slate-800 dark:text-slate-100">{prompt.name}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{getCategoryLabel(prompt.category)}</p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTogglePromptFavorite(prompt.id);
                      }}
                      className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Star
                        className={`w-4 h-4 ${
                          prompt.favorite
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-slate-400'
                        }`}
                      />
                    </button>
                  </div>

                  {prompt.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      {prompt.description}
                    </p>
                  )}

                  {prompt.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {prompt.variables.slice(0, 3).map(variable => (
                        <span
                          key={variable}
                          className="text-xs px-2 py-0.5 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-md font-mono"
                        >
                          {variable}
                        </span>
                      ))}
                      {prompt.variables.length > 3 && (
                        <span className="text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-md">
                          +{prompt.variables.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1 pt-2 border-t border-slate-200/80 dark:border-slate-700/80">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopy(prompt.content);
                      }}
                      className="flex-1 text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400 flex items-center justify-center gap-1 py-2 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3 h-3" />
                          {t('uiTools.common.copied')}
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          {t('uiTools.common.copy')}
                        </>
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(prompt);
                      }}
                      className="flex-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center gap-1 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                    >
                      <Edit className="w-3 h-3" />
                      {t('uiTools.common.edit')}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(prompt.id);
                      }}
                      className="flex-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 flex items-center justify-center gap-1 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      {t('uiTools.common.delete')}
                    </button>
                  </div>
                </div>
              </AiBentoCard>
            ))
          )}
        </div>

        <AiToolTips
          accent="violet"
          items={[
            { icon: Code, text: t('uiTools.prompt_form.tip_variables') },
            { icon: Star, text: t('uiTools.prompt_form.tip_favorites') },
            { icon: FolderOpen, text: t('uiTools.prompt_form.tip_categories') },
          ]}
        />
      </div>
    </ToolWrapper>
  );
};

export default PromptForm;
