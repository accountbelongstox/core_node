
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { api } from '../../services/api';
import { WordGroup, SelectedCollection } from '../../types';
import { SUPPORTED_LANGUAGES } from '../../services/mockData';
import { ApiCenter } from '../../services/ApiCenter';
import { LanguageCenter } from '../../i18n/LanguageCenter';

const CoursesPage = () => {
  const { navigate, t, user, activeGroupId, settings } = useContext(AppContext);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [selectedCollections, setSelectedCollections] = useState<SelectedCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupLanguage, setNewGroupLanguage] = useState('en');
  const [createError, setCreateError] = useState('');

  const loadGroups = () => {
    if (!user) return;
    api.getWordGroups().then(setGroups).catch(err => {
      console.error('[Courses] Failed to load groups:', err);
    });
  };

  const loadSelectedCollections = async () => {
    if (!user) return;

    setLoadingCollections(true);
    try {
      const response = await ApiCenter.learning.getSelectedCollections();
      if (response.success && response.data) {
        setSelectedCollections(response.data.data || []);
      }
    } catch (err) {
      console.error('[Courses] Failed to load selected collections:', err);
      setSelectedCollections([]);
    } finally {
      setLoadingCollections(false);
    }
  };

  useEffect(() => {
    loadGroups();
    loadSelectedCollections();
    // [GLOBAL SETTING] Use settings.language.learningLanguages instead of user.learningLanguages
    if (settings.language.learningLanguages && settings.language.learningLanguages.length > 0) {
        setActiveTab(settings.language.learningLanguages[0]);
        setNewGroupLanguage(settings.language.learningLanguages[0]);
    }
  }, [settings.language.learningLanguages, user]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setCreateError(t('library.groupNameRequired') || 'Group name is required');
      return;
    }

    setCreating(true);
    setCreateError('');

    try {
      const response = await ApiCenter.wordGroups.create({
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        language: newGroupLanguage,
      });

      if (response.success) {
        // Close dialog and refresh
        setShowCreateDialog(false);
        setNewGroupName('');
        setNewGroupDescription('');
        loadGroups();
      } else {
        setCreateError(response.error?.message || t('library.createFailed') || 'Failed to create group');
      }
    } catch (err: any) {
      setCreateError(err.message || t('library.createError') || 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteGroup = async (groupId: string, groupName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation

    if (!confirm(t('library.confirmDelete') || `Are you sure you want to delete "${groupName}"?`)) {
      return;
    }

    try {
      const response = await ApiCenter.wordGroups.delete(groupId);

      if (response.success) {
        loadGroups();
      } else {
        alert(response.error?.message || t('library.deleteFailed') || 'Failed to delete group');
      }
    } catch (err: any) {
      alert(err.message || t('library.deleteError') || 'An error occurred');
    }
  };

  const filteredGroups = groups.filter(g => {
    if (activeTab === 'all') return true;
    // Show 'user' or 'document' types in all tabs or specific logic?
    // Assuming documents might have a language tag, or default to show in all.
    // Here we strictly filter by language code matching the tab.
    if (g.type === 'document') return activeTab === 'en'; // Hack for demo documents defaulting to EN
    return g.language === activeTab;
  });

  // [GLOBAL SETTING] Get tab objects from global settings preferences
  const tabs = settings.language.learningLanguages?.map(code => {
      const lang = SUPPORTED_LANGUAGES.find(l => l.code === code);
      return { code, name: lang?.name || code, flag: lang?.flag };
  }) || [];

  // [i18n] Replaced hardcoded 'All' with t()
  // Add 'All' tab if user has multiple languages
  if (tabs.length > 1) tabs.unshift({ code: 'all', name: t('library.all'), flag: '🌍' });

  return (
    <div className="h-full flex flex-col p-5 pt-12 animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold dark:text-white">{t('library')}</h1>
        <div className="flex gap-2">
          <button onClick={() => navigate('recommendations')} className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl backdrop-blur-md shadow-sm border border-white/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title={t('library.recommendations') || 'Recommendations'}>
            <span className="text-lg">⭐</span>
          </button>
          <button onClick={() => navigate('dictionary')} className="p-3 bg-white/60 dark:bg-slate-800/60 rounded-xl backdrop-blur-md shadow-sm border border-white/40 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors" title={t('library.dictionary') || 'Dictionary'}>
            <span className="text-lg">🔍</span>
          </button>
        </div>
      </div>

      {/* Language Tabs */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar mb-6 pb-2">
         {tabs.map((tab) => (
           <button
             key={tab.code}
             onClick={() => setActiveTab(tab.code)}
             className={`
               flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-bold transition-all duration-300 shrink-0 border
               ${activeTab === tab.code
                 ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/30'
                 : 'bg-white/50 dark:bg-slate-800/50 text-slate-500 border-white/40 hover:bg-white/80'}
             `}
           >
             <span>{tab.flag}</span>
             <span>{tab.name}</span>
           </button>
         ))}

         <button onClick={() => navigate('settings_lang')} className="px-4 py-3 rounded-2xl bg-slate-100 text-slate-400 font-bold text-xl shrink-0 border border-transparent hover:bg-slate-200">
             +
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 space-y-4">
         {/* Action Cards Row */}
         <div className="grid grid-cols-2 gap-4">
           {/* Upload Card */}
           <div
               onClick={() => navigate('upload')}
               className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-2xl p-4 flex flex-col items-center justify-center text-blue-500 bg-blue-50/50 dark:bg-blue-900/10 cursor-pointer hover:bg-blue-50 transition-colors"
             >
                <div className="mb-2 text-2xl">📄</div>
                <span className="font-bold text-sm text-center">{t('library.importDocument') || 'Import Document'}</span>
           </div>

           {/* Create Group Card */}
           <div
               onClick={() => setShowCreateDialog(true)}
               className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-2xl p-4 flex flex-col items-center justify-center text-green-500 bg-green-50/50 dark:bg-green-900/10 cursor-pointer hover:bg-green-50 transition-colors"
             >
                <div className="mb-2 text-2xl">➕</div>
                <span className="font-bold text-sm text-center">{t('library.createGroup') || 'Create Group'}</span>
           </div>
         </div>

         {/* Selected Collections Section */}
         {selectedCollections.length > 0 && (
           <div className="space-y-3">
             <div className="flex items-center justify-between">
               <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">{t('library.myCollections') || 'My Vocabulary Collections'}</h2>
               <button onClick={() => navigate('recommendations')} className="text-xs font-bold text-blue-500 bg-blue-50 px-2 py-1 rounded-lg">
                 {t('library.browseMore') || 'Browse More'}
               </button>
             </div>
             <div className="grid grid-cols-1 gap-3">
               {selectedCollections.map((collection) => (
                 <Card key={collection.id} className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50/80 to-indigo-50/80 dark:from-purple-900/20 dark:to-indigo-900/20 border-purple-200/50 dark:border-purple-700/50">
                   <div className="flex-1">
                     <h3 className="font-bold text-base dark:text-white">{collection.name}</h3>
                     <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                       <span className="flex items-center gap-1">
                         <span>📚</span>
                         <span>{collection.total_words} {t('library.words') || 'words'}</span>
                       </span>
                       <span className="px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 font-bold">
                         {collection.level}
                       </span>
                       <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-medium">
                         {collection.category}
                       </span>
                     </div>
                   </div>
                   <div className="w-8 h-8 rounded-full bg-purple-500 text-white flex items-center justify-center text-sm shadow-md">
                     ✓
                   </div>
                 </Card>
               ))}
             </div>
           </div>
         )}

         {filteredGroups.length === 0 && (
             <div className="text-center text-slate-400 py-10">
                 {/* [i18n] Replaced hardcoded "No books found..." with t() */}
                 {t('library.noBooksFound')}
             </div>
         )}

         {filteredGroups.map(g => {
           const isActive = g.id === activeGroupId;
           return (
             <Card key={g.id} className={`flex gap-4 group transition-all cursor-pointer ${isActive ? 'ring-2 ring-blue-500/30' : 'hover:scale-[1.02]'}`} onClick={() => navigate('course_detail', { groupId: g.id })}>
               <div className="w-24 h-32 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 rounded-xl flex items-center justify-center text-5xl shadow-inner shrink-0 relative overflow-hidden">
                 <div className="absolute inset-0 bg-white/20"></div>
                 <span className="relative z-10">{g.coverImage}</span>
               </div>

               <div className="flex flex-col py-1 flex-1">
                 <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-lg dark:text-white leading-tight line-clamp-2 flex-1">{g.name}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && <div className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs shadow-md">✓</div>}
                      {/* Delete button - only show for user-created groups */}
                      {(g.type === 'user' || g.type === 'document') && (
                        <button
                          onClick={(e) => handleDeleteGroup(g.id, g.name, e)}
                          className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white flex items-center justify-center text-sm transition-all opacity-0 group-hover:opacity-100"
                          title={t('library.deleteGroup') || 'Delete group'}
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                 </div>

                 {/* [i18n] Replaced hardcoded "No description available." with t() */}
                 <p className="text-xs text-slate-500 mt-2 line-clamp-2">{g.description || t('library.noDescription')}</p>

                 <div className="mt-auto">
                     <div className="flex justify-between text-xs font-bold text-slate-400 mb-1">
                         {/* [i18n] Replaced hardcoded "words" with t() */}
                         <span>{g.count} {t('library.words')}</span>
                         <span>{g.progress}%</span>
                     </div>
                     <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${g.progress}%` }}></div>
                     </div>
                 </div>
               </div>
             </Card>
           );
         })}
      </div>

      {/* Create Group Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-5" onClick={() => setShowCreateDialog(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold dark:text-white mb-6">{t('library.createNewGroup') || 'Create New Group'}</h2>

            {createError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                {createError}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('library.groupName') || 'Group Name'} *
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={t('library.groupNamePlaceholder') || 'e.g., Business English, TOEFL Words'}
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 ring-blue-400"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('library.description') || 'Description'} ({t('common.optional') || 'optional'})
                </label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder={t('library.descriptionPlaceholder') || 'Brief description of this word group'}
                  rows={3}
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 ring-blue-400 resize-none"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  {t('library.language') || 'Language'} *
                </label>
                <select
                  value={newGroupLanguage}
                  onChange={(e) => setNewGroupLanguage(e.target.value)}
                  className="w-full p-3 rounded-xl bg-slate-100 dark:bg-slate-700 dark:text-white outline-none focus:ring-2 ring-blue-400"
                  disabled={creating}
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code}>
                      {lang.flag} {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateDialog(false)}
                className="flex-1 py-3 rounded-xl bg-slate-200 dark:bg-slate-700 dark:text-white font-bold hover:bg-slate-300 transition-colors"
                disabled={creating}
              >
                {t('common.cancel') || 'Cancel'}
              </button>
              <button
                onClick={handleCreateGroup}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                disabled={creating}
              >
                {creating ? (t('common.creating') || 'Creating...') : (t('common.create') || 'Create')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CoursesPage;
