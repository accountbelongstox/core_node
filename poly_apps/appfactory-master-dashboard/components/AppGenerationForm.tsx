import React, { useState } from 'react';
import { X, Sparkles, Loader2, Plus, Trash2 } from 'lucide-react';
import { AppCategory, TechMember } from '../types';
import { modelService } from '../services/modelService';
import { useApp } from '../contexts/AppContext';
import { generateAppMarketingCopy } from '../services/geminiService';

interface AppGenerationFormProps {
  onClose: () => void;
  onGenerate: (data: { name: string; category: AppCategory; description: string; targetAudience: string; features: string[]; assignedTechId?: string; requestedAt: string }) => void;
}

export const AppGenerationForm: React.FC<AppGenerationFormProps> = ({ onClose, onGenerate }) => {
  const { t } = useApp();
  const [appName, setAppName] = useState('');
  const [category, setCategory] = useState<AppCategory>(AppCategory.PRODUCTIVITY);
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [assignedTechId, setAssignedTechId] = useState<string>('');
  const [features, setFeatures] = useState<string[]>(['']);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = Object.values(AppCategory);

  const handleGenerateSuggestions = async () => {
    if (!appName || !description) {
      return;
    }

    setIsGeneratingSuggestions(true);
    try {
      const result = await generateAppMarketingCopy(appName, description);
      if (result && result.benefits) {
        setAiSuggestions(result.benefits);
      }
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

  const handleAddFeature = () => {
    setFeatures([...features, '']);
  };

  const handleRemoveFeature = (index: number) => {
    setFeatures(features.filter((_, i) => i !== index));
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...features];
    newFeatures[index] = value;
    setFeatures(newFeatures);
  };

  const handleUseSuggestion = (suggestion: string) => {
    setFeatures([...features.filter(f => f), suggestion]);
    setAiSuggestions(aiSuggestions.filter(s => s !== suggestion));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const appData = {
      name: appName,
      category,
      description,
      targetAudience,
      features: features.filter(f => f.trim() !== ''),
      assignedTechId: assignedTechId ? assignedTechId : undefined,
      requestedAt: new Date().toISOString(),
    };

    setTimeout(() => {
      onGenerate(appData);
      setIsSubmitting(false);
      onClose();
    }, 500);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">{t('appGeneration.title')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('appGeneration.appName')} *
            </label>
            <input
              type="text"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              placeholder={t('appGeneration.appNamePlaceholder')}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('appGeneration.category')} *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as AppCategory)}
                required
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                {t('appGeneration.assignTechLead')}
              </label>
              <select
                value={assignedTechId}
                onChange={(e) => setAssignedTechId(e.target.value)}
                className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              >
                <option value="">{t('appGeneration.autoAssign')}</option>
                {modelService.getTechTeam().map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name} ({tech.specialization})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('appGeneration.description')} *
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={4}
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white resize-none"
              placeholder={t('appGeneration.descriptionPlaceholder')}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              {t('appGeneration.targetAudience')} *
            </label>
            <input
              type="text"
              value={targetAudience}
              onChange={(e) => setTargetAudience(e.target.value)}
              required
              className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              placeholder="e.g., Small Business Owners, Students, Fitness Enthusiasts"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                {t('appGeneration.features')}
              </label>
              <button
                type="button"
                onClick={handleGenerateSuggestions}
                disabled={!appName || !description || isGeneratingSuggestions}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGeneratingSuggestions ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    {t('appGeneration.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    {t('appGeneration.aiGenerateSuggestions')}
                  </>
                )}
              </button>
            </div>

            {aiSuggestions.length > 0 && (
              <div className="mb-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-2">AI Suggestions:</p>
                <div className="flex flex-wrap gap-2">
                  {aiSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleUseSuggestion(suggestion)}
                      className="px-3 py-1 text-xs bg-white dark:bg-slate-700 border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors"
                    >
                      + {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {features.map((feature, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={feature}
                    onChange={(e) => handleFeatureChange(index, e.target.value)}
                    className="flex-1 px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    placeholder={`Feature ${index + 1}`}
                  />
                  {features.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFeature(index)}
                      className="p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={handleAddFeature}
                className="flex items-center gap-2 px-4 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-colors"
              >
                <Plus size={16} />
                {t('appGeneration.addFeature')}
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors font-medium"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  {t('appGeneration.generating')}
                </>
              ) : (
                t('appGeneration.generateApp')
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

