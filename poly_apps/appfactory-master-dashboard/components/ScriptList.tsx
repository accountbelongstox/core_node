import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Search, Copy, Check } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { modelService } from '../services/modelService';
import { ScriptTemplate } from '../types';
import { useClipboard } from '../hooks/useClipboard';

interface ScriptListProps {
  onSelectScript: (content: string) => void;
}

export const ScriptList: React.FC<ScriptListProps> = ({ onSelectScript }) => {
  const { t } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // Use React Hook for clipboard operations
  const [copyToClipboard] = useClipboard();

  // Use React's useMemo for expensive computations
  const templates = useMemo(() => modelService.getScriptTemplates(), []);
  
  // Use React's useMemo to avoid recalculating categories on every render
  const categories = useMemo(() => {
    return ['all', ...Array.from(new Set(templates.map(t => t.category)))];
  }, [templates]);

  // Use React's useMemo for filtered templates to avoid recalculating on every render
  const filteredTemplates = useMemo(() => {
    return templates.filter(template => {
      const matchesSearch = template.title.toLowerCase().includes(searchTerm.toLowerCase()) ? true :
                           (template.content.toLowerCase().includes(searchTerm.toLowerCase()) ? true :
                           template.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())));
      const matchesCategory = selectedCategory === 'all' ? true : template.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [templates, searchTerm, selectedCategory]);

  // Use React's useEffect for timeout cleanup instead of manual setTimeout
  useEffect(() => {
    if (copiedId !== null) {
      const timer = setTimeout(() => setCopiedId(null), 2000);
      // React automatically cleans up on unmount or when copiedId changes
      return () => clearTimeout(timer);
    }
  }, [copiedId]);

  // Use React's useMemo for category map to avoid recreating on every render
  const categoryMap = useMemo(() => ({
    all: t('chat.allCategories'),
    greeting: t('chat.greeting'),
    product_info: t('chat.productInfo'),
    pricing: t('chat.pricing'),
    closing: t('chat.closing'),
    follow_up: t('chat.followUp'),
    problem_solving: t('chat.problemSolving'),
  }), [t]);

  // Use React's useCallback for event handlers to avoid recreating on every render
  const handleSelectScript = useCallback((template: ScriptTemplate) => {
    let content = template.content;
    // Replace placeholders with actual values
    const csTeam = modelService.getCSTeam();
    const currentCS = csTeam[0]; // In real app, get current logged-in CS
    if (currentCS) {
      content = content.replace(/{csName}/g, currentCS.name);
    }
    onSelectScript(content);
    modelService.incrementTemplateUsage(template.id);
    setCopiedId(template.id);
    // Timeout cleanup handled by useEffect above
  }, [onSelectScript]);

  const handleCopy = useCallback(async (e: React.MouseEvent, template: ScriptTemplate) => {
    e.stopPropagation();
    let content = template.content;
    const csTeam = modelService.getCSTeam();
    const currentCS = csTeam[0];
    if (currentCS) {
      content = content.replace(/{csName}/g, currentCS.name);
    }
    // Use React Hook for clipboard operations
    const success = await copyToClipboard(content);
    if (success) {
    setCopiedId(template.id);
    // Timeout cleanup handled by useEffect above
    }
  }, [copyToClipboard]);

  const getCategoryLabel = useCallback((category: string) => {
    return categoryMap[category] ?? category;
  }, [categoryMap]);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700">
        <h3 className="font-semibold text-slate-800 dark:text-white mb-3">{t('chat.scriptTemplates')}</h3>
        
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t('chat.searchScripts')}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 text-sm text-slate-800 dark:text-white"
          />
        </div>

        {/* Category Filter */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              {getCategoryLabel(category)}
            </button>
          ))}
        </div>
      </div>

      {/* Script List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filteredTemplates.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
            <p>{t('chat.noScriptsFound')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTemplates.map(template => (
              <div
                key={template.id}
                onClick={() => handleSelectScript(template)}
                className="p-3 bg-slate-50 dark:bg-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 cursor-pointer transition-colors group"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-medium text-sm text-slate-800 dark:text-white">
                    {template.title}
                  </h4>
                  <button
                    onClick={(e) => handleCopy(e, template)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-500 rounded transition-opacity"
                    title={t('chat.copy')}
                  >
                    {copiedId === template.id ? (
                      <Check size={14} className="text-emerald-600" />
                    ) : (
                      <Copy size={14} className="text-slate-500 dark:text-slate-400" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mb-2">
                  {template.content}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {template.tags.slice(0, 3).map(tag => (
                    <span
                      key={tag}
                      className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded text-xs"
                    >
                      {tag}
                    </span>
                  ))}
                  {template.usageCount > 0 && (
                    <span className="text-xs text-slate-500 dark:text-slate-400 ml-auto">
                      {t('chat.used')} {template.usageCount}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

