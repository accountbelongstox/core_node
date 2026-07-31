import React, { useState, useEffect } from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Edit,
  Save,
  Copy,
  Check,
  RefreshCw,
  FolderOpen,
  Search,
  Star,
  Code
} from 'lucide-react';
import { api } from '@/apps/laravel-manager/api';
import { commonClasses } from '../../styles/theme';
import BentoCard from '../BentoCard';

interface PromptManagerProps {
  onPromptSelect?: (prompt: any) => void;
}

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

const PromptManager: React.FC<PromptManagerProps> = ({ onPromptSelect }) => {
  const [prompts, setPrompts] = useState<PromptTemplate[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<PromptTemplate | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [newPrompt, setNewPrompt] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form state
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
    },
    {
      id: '4',
      name: 'Data Extractor',
      category: 'Data Extraction',
      content: 'Extract {data_type} from the following text and format as {format}:\n\n{text}',
      variables: ['data_type', 'format', 'text'],
      description: 'Extracts structured data from text',
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
      } catch (error) {
        console.error('Failed to load prompts:', error);
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
          ? {
              ...p,
              name: formName,
              category: formCategory,
              content: formContent,
              description: formDescription,
              variables
            }
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

  const handleToggleFavorite = (id: string) => {
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
      filterCategory === 'favorites' && p.favorite ||
      p.category === filterCategory;

    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">AI Prompt Manager</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Create and manage reusable AI prompt templates
            </p>
          </div>
        </div>
        <button
          onClick={handleNew}
          className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
        >
          <Plus className="w-4 h-4" />
          New Prompt
        </button>
      </div>

      {/* Search and Filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search prompts..."
            className={`${commonClasses.input} pl-10`}
          />
        </div>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={commonClasses.select}
        >
          <option value="all">All Categories</option>
          <option value="favorites">Favorites</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
      </div>

      {/* Editor Panel */}
      {(editMode || newPrompt) && (
        <BentoCard title={editMode ? 'Edit Prompt' : 'New Prompt'}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Prompt Name *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g., Translation Template"
                  className={commonClasses.input}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category *</label>
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className={commonClasses.select}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <input
                type="text"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Brief description of what this prompt does"
                className={commonClasses.input}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">
                Prompt Content *
                <span className="text-xs text-slate-500 ml-2">
                  Use {'{variable_name}'} for variables
                </span>
              </label>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Enter your prompt template here..."
                className={`${commonClasses.textarea} h-48 font-mono text-sm`}
              />
              {formContent && extractVariables(formContent).length > 0 && (
                <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    Variables detected: {extractVariables(formContent).join(', ')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!formName.trim() || !formContent.trim()}
                className={`${commonClasses.button} ${commonClasses.buttonPrimary} flex items-center gap-2`}
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
            </div>
          </div>
        </BentoCard>
      )}

      {/* Prompts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPrompts.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <FolderOpen className="w-12 h-12 mx-auto mb-3 text-slate-300" />
            <p className="text-slate-500">No prompts found</p>
          </div>
        ) : (
          filteredPrompts.map(prompt => (
            <BentoCard
              key={prompt.id}
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => {
                setSelectedPrompt(prompt);
                onPromptSelect?.(prompt);
              }}
            >
              <div className="space-y-3">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{prompt.name}</h3>
                    <p className="text-xs text-slate-500">{prompt.category}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(prompt.id);
                    }}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
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

                {/* Description */}
                {prompt.description && (
                  <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                    {prompt.description}
                  </p>
                )}

                {/* Variables */}
                {prompt.variables.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {prompt.variables.slice(0, 3).map(variable => (
                      <span
                        key={variable}
                        className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded"
                      >
                        {variable}
                      </span>
                    ))}
                    {prompt.variables.length > 3 && (
                      <span className="text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded">
                        +{prompt.variables.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(prompt.content);
                    }}
                    className="flex-1 text-xs text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
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
                    className="flex-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 flex items-center justify-center gap-1 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"
                  >
                    <Edit className="w-3 h-3" />
                    Edit
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(prompt.id);
                    }}
                    className="flex-1 text-xs text-red-600 hover:text-red-700 flex items-center justify-center gap-1 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            </BentoCard>
          ))
        )}
      </div>

      {/* Tips */}
      <BentoCard title="Tips" className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
        <ul className="text-sm space-y-2 text-slate-700 dark:text-slate-300">
          <li className="flex items-start gap-2">
            <Code className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-600" />
            <span>Use curly braces like {'{variable_name}'} to create template variables</span>
          </li>
          <li className="flex items-start gap-2">
            <Star className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-600" />
            <span>Mark frequently used prompts as favorites for quick access</span>
          </li>
          <li className="flex items-start gap-2">
            <FolderOpen className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-600" />
            <span>Organize prompts by category to keep them manageable</span>
          </li>
        </ul>
      </BentoCard>
    </div>
  );
};

export default PromptManager;
