/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */

import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Button, ProgressBar, Sheet, IconButton, SectionTitle } from '../../components/UI';
import { PillNav } from '../../components/PillNav';
import { Star, FileText, Plus, BookOpen, Check, Trash2, Globe } from 'lucide-react';
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
    api.getWordGroups().then(data => setGroups(Array.isArray(data) ? data : [])).catch(err => {
      console.error('[Courses] Failed to load groups:', err);
      setGroups([]);
    });
  };

  const loadSelectedCollections = async () => {
    if (!user) return;

    setLoadingCollections(true);
    try {
      const response = await ApiCenter.learning.getSelectedCollections();
      if (response.success && response.data) {
        setSelectedCollections(Array.isArray(response.data.data) ? response.data.data : []);
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

  const filteredGroups = (Array.isArray(groups) ? groups : []).filter(g => {
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
  if (tabs.length > 1) tabs.unshift({ code: 'all', name: t('library.all'), flag: undefined });

  return (
    <div className="h-full flex flex-col px-5 pt-12 pb-0 animate-slide-up">
      {/* Header */}
      <div className="flex justify-between items-end mb-7">
        <h1 className="ds-section-title !text-3xl">{t('library')}</h1>
        <div className="flex gap-1">
          <IconButton icon={<Star className="w-5 h-5" />} onClick={() => navigate('recommendations')} label={t('library.recommendations') || 'Recommendations'} />
          <IconButton icon={<Icons.Search />} onClick={() => navigate('dictionary')} label={t('library.dictionary') || 'Dictionary'} />
        </div>
      </div>

      {/* Language Tabs — v4.0 pill category bar */}
      <div className="flex items-center gap-2 mb-7">
         <PillNav
           items={tabs.map((tab) => ({
             id: tab.code,
             label: (
               <span className="flex items-center gap-2">
                 {tab.code === 'all'
                   ? <Globe className="w-4 h-4" />
                   : tab.flag && <span>{tab.flag}</span>}
                 <span>{tab.name}</span>
               </span>
             ),
           }))}
           activeId={activeTab}
           onChange={setActiveTab}
           aria-label={t('library') as string}
           className="flex-1 !px-0"
         />
         <button onClick={() => navigate('settings_lang')} className="ds-fab-grad flex items-center justify-center shrink-0" style={{ width: 44, height: 44 }} title={t('library.language') || 'Add language'} aria-label={t('library.language') || 'Add language'}>
             <Plus className="w-5 h-5" />
         </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 ds-stack">
         {/* Action Cards Row */}
         <div className="ds-grid-breathing grid-cols-2">
           {/* Upload Card */}
           <div
               onClick={() => navigate('upload')}
               className="ds-empty rounded-[var(--radius-card)] p-5 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--klein-blue)] hover:text-[var(--klein-blue)] transition-colors min-h-[var(--touch-min)]"
             >
                <FileText className="w-7 h-7 mb-2" />
                <span className="font-bold text-sm text-center">{t('library.importDocument') || 'Import Document'}</span>
           </div>

           {/* Create Group Card */}
           <div
               onClick={() => setShowCreateDialog(true)}
               className="ds-empty rounded-[var(--radius-card)] p-5 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--klein-blue)] hover:text-[var(--klein-blue)] transition-colors min-h-[var(--touch-min)]"
             >
                <Plus className="w-7 h-7 mb-2" />
                <span className="font-bold text-sm text-center">{t('library.createGroup') || 'Create Group'}</span>
           </div>
         </div>

         {/* Selected Collections Section */}
         {Array.isArray(selectedCollections) && selectedCollections.length > 0 && (
           <div className="ds-stack-tight flex flex-col">
             <SectionTitle
               title={t('library.myCollections') || 'My Vocabulary Collections'}
               moreLabel={t('library.browseMore') || 'Browse More'}
               onMore={() => navigate('recommendations')}
             />
             <div className="ds-grid-breathing grid-cols-1">
               {selectedCollections.map((collection) => (
                 <div key={collection.id} className="ds-row flex items-center justify-between p-5">
                   <div className="flex-1 min-w-0">
                     <h3 className="font-bold text-base dark:text-white">{collection.name}</h3>
                     <div className="flex items-center gap-2 mt-2 text-xs text-[var(--color-text-secondary)] flex-wrap">
                       <span className="flex items-center gap-1">
                         <BookOpen className="w-3.5 h-3.5" />
                         <span>{collection.total_words} {t('library.words') || 'words'}</span>
                       </span>
                       <span className="px-2.5 py-0.5 rounded-full bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] font-bold">
                         {collection.level}
                       </span>
                       <span className="px-2.5 py-0.5 rounded-full bg-black/5 dark:bg-white/10 text-[var(--color-text-secondary)] font-medium">
                         {collection.category}
                       </span>
                     </div>
                   </div>
                   <div className="w-9 h-9 rounded-full bg-[var(--klein-blue)] text-[var(--klein-on)] flex items-center justify-center shadow-[var(--klein-glow)] shrink-0">
                     <Check className="w-4 h-4" />
                   </div>
                 </div>
               ))}
             </div>
           </div>
         )}

         {filteredGroups.length === 0 && (
             <div className="ds-empty rounded-[var(--radius-card)] text-center py-12">
                 {/* [i18n] Replaced hardcoded "No books found..." with t() */}
                 {t('library.noBooksFound')}
             </div>
         )}

         {filteredGroups.map(g => {
           const isActive = g.id === activeGroupId;
           return (
             <Card
               key={g.id}
               className={`group transition-all cursor-pointer ${isActive ? 'ring-2 ring-[var(--klein-ring)]' : 'hover:scale-[1.02]'}`}
               onClick={() => navigate('course_detail', { groupId: g.id })}
             >
               <div className="flex gap-5">
               <div className="ds-media-frame w-24 h-32 shrink-0 self-start">
                 <span className="text-5xl">{g.coverImage}</span>
               </div>
               <div className="flex flex-col py-1 flex-1 min-w-0">
                 <div className="flex justify-between items-start gap-2">
                    <h3 className="font-bold text-lg dark:text-white leading-tight line-clamp-2 flex-1">{g.name}</h3>
                    <div className="flex items-center gap-2 shrink-0">
                      {isActive && <div className="w-6 h-6 rounded-full bg-[var(--klein-blue)] text-[var(--klein-on)] flex items-center justify-center shadow-[var(--klein-glow)]"><Check className="w-3.5 h-3.5" /></div>}
                      {/* Delete button - only show for user-created groups */}
                      {(g.type === 'user' || g.type === 'document') && (
                        <button
                          onClick={(e) => handleDeleteGroup(g.id, g.name, e)}
                          className="w-8 h-8 rounded-full bg-red-500/10 hover:bg-red-500 text-red-600 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                          title={t('library.deleteGroup') || 'Delete group'}
                          aria-label={t('library.deleteGroup') || 'Delete group'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                 </div>

                 {/* [i18n] Replaced hardcoded "No description available." with t() */}
                 <p className="text-xs text-[var(--color-text-secondary)] mt-2 line-clamp-2">{g.description || t('library.noDescription')}</p>

                 <div className="mt-auto pt-3">
                     <div className="flex justify-between text-xs font-bold text-[var(--color-text-tertiary)] mb-1.5">
                         {/* [i18n] Replaced hardcoded "words" with t() */}
                         <span>{g.count} {t('library.words')}</span>
                         <span>{g.progress}%</span>
                     </div>
                     <ProgressBar value={g.progress} />
                 </div>
               </div>
               </div>
             </Card>
           );
         })}
      </div>

      {/* Create Group Dialog */}
      <Sheet open={showCreateDialog} onClose={() => setShowCreateDialog(false)} position="center">
          <div className="max-w-md mx-auto w-full">
            <h2 className="text-2xl font-bold dark:text-white mb-6">{t('library.createNewGroup') || 'Create New Group'}</h2>

            {createError && (
              <div className="mb-4 p-3 rounded-[var(--radius-button)] bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
                {createError}
              </div>
            )}

            <div className="ds-stack-tight flex flex-col">
              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  {t('library.groupName') || 'Group Name'} *
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder={t('library.groupNamePlaceholder') || 'e.g., Business English, TOEFL Words'}
                  className="w-full p-3 rounded-[var(--radius-button)] bg-black/5 dark:bg-white/10 dark:text-white outline-none focus:ring-2 focus:ring-[var(--klein-ring)] transition-all"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  {t('library.description') || 'Description'} ({t('common.optional') || 'optional'})
                </label>
                <textarea
                  value={newGroupDescription}
                  onChange={(e) => setNewGroupDescription(e.target.value)}
                  placeholder={t('library.descriptionPlaceholder') || 'Brief description of this word group'}
                  rows={3}
                  className="w-full p-3 rounded-[var(--radius-button)] bg-black/5 dark:bg-white/10 dark:text-white outline-none focus:ring-2 focus:ring-[var(--klein-ring)] resize-none transition-all"
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                  {t('library.language') || 'Language'} *
                </label>
                <select
                  value={newGroupLanguage}
                  onChange={(e) => setNewGroupLanguage(e.target.value)}
                  className="w-full p-3 rounded-[var(--radius-button)] bg-black/5 dark:bg-white/10 dark:text-white outline-none focus:ring-2 focus:ring-[var(--klein-ring)] transition-all"
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

            <div className="flex gap-3 mt-7">
              <Button
                variant="secondary"
                onClick={() => setShowCreateDialog(false)}
                disabled={creating}
              >
                {t('common.cancel') || 'Cancel'}
              </Button>
              <Button
                variant="klein"
                onClick={handleCreateGroup}
                disabled={creating}
              >
                {creating ? (t('common.creating') || 'Creating...') : (t('common.create') || 'Create')}
              </Button>
            </div>
          </div>
      </Sheet>
    </div>
  );
};

export default CoursesPage;
