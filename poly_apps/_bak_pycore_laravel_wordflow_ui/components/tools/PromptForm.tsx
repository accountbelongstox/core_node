import React, { useState, useEffect } from 'react';
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
import { useToolModel } from '../../hooks';
import { AI_TOOLS } from '../../config/tools.config';
import ToolWrapper from '../universal/ToolWrapper';
import { commonClasses } from '../../styles/theme';
import {
  AI_BODY,
  AI_GRID_2,
  AI_GRID_3,
  AiBentoCard,
  AiToolActions,
  AiToolEmpty,
  AiToolField,
  AiToolTips,
} from '../ai-tools/ui';

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

const PromptForm: React.FC = () => {
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

  const DEFAULT_PROMPTS: PromptTemplate[] = [
    {
      id: '1',
      name: 'Translation Template',
      category: 'Translation',
      content: 'Translate the following {source_lang} text to {target_lang}:\n\n{text}',
      variables: ['source_lang', 'target_lang', 'text'],
      description: 'Basic translation template',
      timestamp: Date.now()
    },
    {
      id: '2',
      name: 'Code Explainer',
      category: 'Code Generation',
      content: 'Explain the following {language} code in simple terms:\n\n```{language}\n{code}\n```',
      variables: ['language', 'code'],
      description: 'Explains code in simple terms',
      timestamp: Date.now()
    },
    {
      id: '3',
      name: 'Text Summarizer',
      category: 'Summarization',
      content: 'Summarize the following text in {length} sentences:\n\n{text}',
      variables: ['length', 'text'],
      description: 'Summarizes text to specified length',
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
    if (confirm('Are you sure you want to delete this prompt?')) {
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
    await navigator.clipboard.writeText(content);
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
          New Prompt
        </button>
      }
    >
      <div className={AI_BODY}>
        <AiBentoCard title="Search & Filter">
          <div className={AI_GRID_2}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search prompts..."
                className={`${commonClasses.input} w-full pl-10`}
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className={`${commonClasses.input} w-full`}
            >
              <option value="all">All Categories</option>
              <option value="favorites">Favorites</option>
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </AiBentoCard>

        {(editMode || newPrompt) && (
          <AiBentoCard title={editMode ? 'Edit Prompt' : 'New Prompt'}>
            <div className="space-y-4">
              <div className={AI_GRID_2}>
                <AiToolField label="Prompt Name *">
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g., Translation Template"
                    className={`${commonClasses.input} w-full`}
                  />
                </AiToolField>
                <AiToolField label="Category *">
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className={`${commonClasses.input} w-full`}
                  >
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </AiToolField>
              </div>

              <AiToolField label="Description">
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Brief description of what this prompt does"
                  className={`${commonClasses.input} w-full`}
                />
              </AiToolField>

              <AiToolField
                label={
                  <>
                    Prompt Content *
                    <span className="text-xs font-normal text-slate-500 ml-2">
                      Use {'{variable_name}'} for variables
                    </span>
                  </>
                }
              >
                <textarea
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Enter your prompt template here..."
                  className={`${commonClasses.input} w-full h-48 font-mono text-sm resize-none`}
                />
                {formContent && extractVariables(formContent).length > 0 && (
                  <div className="mt-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200/60 dark:border-violet-800/40">
                    <p className="text-xs text-violet-700 dark:text-violet-300">
                      Variables detected: {extractVariables(formContent).join(', ')}
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
                  Save
                </button>
                <button
                  onClick={handleCancel}
                  className={`${commonClasses.button} ${commonClasses.buttonSecondary}`}
                >
                  Cancel
                </button>
              </AiToolActions>
            </div>
          </AiBentoCard>
        )}

        <div className={AI_GRID_3}>
          {filteredPrompts.length === 0 ? (
            <AiToolEmpty icon={FolderOpen} message="No prompts found" />
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
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{prompt.category}</p>
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
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
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
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(prompt.id);
                      }}
                      className="flex-1 text-xs text-red-600 hover:text-red-700 dark:text-red-400 flex items-center justify-center gap-1 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
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
            { icon: Code, text: "Use curly braces like {variable_name} to create template variables" },
            { icon: Star, text: 'Mark frequently used prompts as favorites for quick access' },
            { icon: FolderOpen, text: 'Organize prompts by category to keep them manageable' },
          ]}
        />
      </div>
    </ToolWrapper>
  );
};

export default PromptForm;
