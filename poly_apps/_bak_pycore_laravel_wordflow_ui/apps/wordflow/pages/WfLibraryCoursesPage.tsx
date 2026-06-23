/* [v4.1-Iris] Courses — ported from qy_capacitor/pages/Library/Courses.tsx.
 * Self-contained for the unified shell: reads word groups from wordflowApi,
 * uses react-router useNavigate + wfPath() for nav, useWfApp() for user /
 * activeGroupId / t, and the shared Iris primitives in WfUI. Language filter is
 * a pill row (.ds-pill-nav/.ds-pill-chip), not a <select>. Faithful to
 * design-reference-{light,dark}.webp. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, FileText, Plus, BookOpen, Check, Globe, Search, Trash2, Layers } from 'lucide-react';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import {
  Card,
  Button,
  ProgressBar,
  Sheet,
  IconButton,
  SectionTitle,
  EmptyState,
  LoadingState,
} from '../WfUI';

const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
];

const WfLibraryCoursesPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeGroupId, learningLanguage, t } = useWfApp();

  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('all');
  // [restored] All/Due/Mastered status filter (original GroupManagement.tsx pills).
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [newGroupLanguage, setNewGroupLanguage] = useState(learningLanguage || 'en');
  const [createError, setCreateError] = useState('');

  const loadGroups = async () => {
    setLoading(true);
    try {
      const data = await wordflowApi.getWordGroups();
      setGroups(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('[WfCourses] Failed to load groups:', err);
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGroups();
    if (learningLanguage) {
      setActiveTab(learningLanguage);
      setNewGroupLanguage(learningLanguage);
    }
  }, [learningLanguage]);

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      setCreateError('Group name is required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      // Real backend creation (original Courses.tsx behavior), then refresh.
      await wordflowApi.createGroup({
        name: newGroupName.trim(),
        description: newGroupDescription.trim(),
        language: newGroupLanguage,
      });
      setShowCreateDialog(false);
      setNewGroupName('');
      setNewGroupDescription('');
      await loadGroups();
    } catch (err: any) {
      setCreateError(err?.message || t('library.createError') || 'An error occurred');
    } finally {
      setCreating(false);
    }
  };

  // Delete a user/document group (original Courses.tsx behavior).
  const handleDeleteGroup = async (groupId: string, groupName: string, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent navigation
    if (!window.confirm(t('library.confirmDelete') || `Are you sure you want to delete "${groupName}"?`)) {
      return;
    }
    try {
      await wordflowApi.deleteGroupByGid(groupId);
      await loadGroups();
    } catch (err: any) {
      console.error('[WfCourses] Failed to delete group:', err);
      alert(err?.message || t('library.deleteFailed') || 'Failed to delete group');
    }
  };

  const filteredGroups = (Array.isArray(groups) ? groups : []).filter((g) => {
    // Language tab filter (original Courses.tsx behavior).
    if (activeTab !== 'all') {
      if (g.type === 'document') {
        if (activeTab !== 'en') return false;
      } else if (g.language !== activeTab) {
        return false;
      }
    }
    // [restored] Status filter. The original filtered on per-group progress
    // stats (due_for_review > 0 / avg_proficiency >= 90); the unified shell
    // only has the group-level progress %, so it serves as the proficiency
    // proxy: mastered = progress >= 90, due = still below mastery.
    if (statusFilter === 'mastered') return (g.progress ?? 0) >= 90;
    if (statusFilter === 'due') return (g.progress ?? 0) < 90;
    return true;
  });

  // [restored] Status filter pills (labels follow the original SORT_TABS).
  const statusTabs = [
    { id: 'all', label: t('library.all') || 'All' },
    { id: 'due', label: t('library.due') || 'Due' },
    { id: 'mastered', label: t('library.mastered') || 'Mastered' },
  ];

  // Build language tabs from the active learning language (+ All when needed).
  const langSet = Array.from(
    new Set([learningLanguage || 'en', ...groups.map((g) => g.language).filter(Boolean)])
  );
  const tabs = langSet.map((code) => {
    const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    return { code, name: lang?.name || code, flag: lang?.flag };
  });
  if (tabs.length > 1) tabs.unshift({ code: 'all', name: t('library.all') || 'All', flag: undefined });

  return (
    <div className="ds-page route-fade flex flex-col pt-12 pb-0">
      {/* Header */}
      <div className="flex justify-between items-end mb-7">
        <h1 className="ds-section-title !text-3xl">{t('nav.library') || 'Library'}</h1>
        <div className="flex gap-1">
          <IconButton
            icon={<Star className="w-5 h-5" />}
            onClick={() => navigate(wfPath('recommendations'))}
            label="Recommendations"
          />
          <IconButton
            icon={<Search className="w-5 h-5" />}
            onClick={() => navigate(wfPath('dictionary'))}
            label="Dictionary"
          />
        </div>
      </div>

      {/* Language Tabs — pill category bar */}
      <div className="flex items-center gap-2 mb-7">
        <div className="ds-pill-nav flex-1" role="tablist" aria-label="Library languages">
          {tabs.map((tab) => (
            <button
              key={tab.code}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.code}
              onClick={() => setActiveTab(tab.code)}
              className={`ds-pill-chip ${activeTab === tab.code ? 'is-active' : ''}`}
            >
              {tab.code === 'all' ? <Globe className="w-4 h-4" /> : tab.flag && <span>{tab.flag}</span>}
              <span>{tab.name}</span>
            </button>
          ))}
        </div>
        <button
          onClick={() => navigate(wfPath('settings_lang'))}
          className="ds-fab-grad flex items-center justify-center shrink-0"
          style={{ width: 44, height: 44 }}
          title="Add language"
          aria-label="Add language"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* [restored] Status filter — All / Due / Mastered pill row */}
      <div className="ds-pill-nav mb-7" role="tablist" aria-label={t('library.statusFilter') || 'Status filter'}>
        {statusTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={statusFilter === tab.id}
            onClick={() => setStatusFilter(tab.id)}
            className={`ds-pill-chip ${statusFilter === tab.id ? 'is-active' : ''}`}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 ds-stack">
        {/* Action Cards Row */}
        <div className="ds-grid-breathing grid grid-cols-2">
          <div
            onClick={() => navigate(wfPath('upload'))}
            className="ds-empty rounded-[var(--radius-card)] p-5 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--klein-blue)] hover:text-[var(--klein-blue)] transition-colors min-h-[var(--touch-min)]"
          >
            <FileText className="w-7 h-7 mb-2" />
            <span className="font-bold text-sm text-center">{t('library.importDocument') || 'Import Document'}</span>
          </div>
          <div
            onClick={() => setShowCreateDialog(true)}
            className="ds-empty rounded-[var(--radius-card)] p-5 flex flex-col items-center justify-center cursor-pointer hover:border-[var(--klein-blue)] hover:text-[var(--klein-blue)] transition-colors min-h-[var(--touch-min)]"
          >
            <Plus className="w-7 h-7 mb-2" />
            <span className="font-bold text-sm text-center">{t('library.createGroup') || 'Create Group'}</span>
          </div>
        </div>

        {loading ? (
          <LoadingState label={t('common.loading') || 'Loading…'} />
        ) : filteredGroups.length === 0 ? (
          <EmptyState
            icon={<BookOpen strokeWidth={1.5} />}
            title={t('library.noBooksFound') || 'No books found'}
            description={t('library.noBooksHint') || 'Import a document or create a group to get started.'}
          />
        ) : (
          filteredGroups.map((g) => {
            const isActive = g.id === activeGroupId;
            return (
              <Card
                key={g.id}
                className={`group transition-all cursor-pointer ${
                  isActive ? 'ring-2 ring-[var(--klein-ring)]' : 'hover:scale-[1.02]'
                }`}
                onClick={() => navigate(wfPath(`course_detail?groupId=${encodeURIComponent(g.id)}`))}
              >
                <div className="flex gap-5">
                  <div className="ds-media-frame w-24 h-32 shrink-0 self-start flex items-center justify-center">
                    <span className="text-5xl">{g.coverImage || '📚'}</span>
                  </div>
                  <div className="flex flex-col py-1 flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-2">
                      <h3 className="font-bold text-lg dark:text-white leading-tight line-clamp-2 flex-1">{g.name}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        {isActive && (
                          <div className="w-6 h-6 rounded-full bg-[var(--klein-blue)] text-[var(--klein-on)] flex items-center justify-center shadow-[var(--klein-glow)]">
                            <Check className="w-3.5 h-3.5" />
                          </div>
                        )}
                        {/* Group detail entry (registered group_detail route) */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(wfPath(`group_detail?gid=${encodeURIComponent(g.id)}`));
                          }}
                          className="w-8 h-8 rounded-full bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] flex items-center justify-center transition-all hover:opacity-80"
                          title={t('library.groupDetail') || 'Group details'}
                          aria-label={t('library.groupDetail') || 'Group details'}
                        >
                          <Layers className="w-4 h-4" />
                        </button>
                        {/* Delete (user/document groups only — original behavior) */}
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
                    <p className="text-xs text-[var(--color-text-secondary)] mt-2 line-clamp-2">
                      {g.description || t('library.noDescription') || 'No description available.'}
                    </p>
                    <div className="mt-auto pt-3">
                      <div className="flex justify-between text-xs font-bold text-[var(--color-text-tertiary)] mb-1.5">
                        <span>{g.count} {t('library.words') || 'words'}</span>
                        <span>{g.progress}%</span>
                      </div>
                      <ProgressBar value={g.progress} />
                    </div>
                  </div>
                </div>
              </Card>
            );
          })
        )}
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
                placeholder="e.g., Business English, TOEFL Words"
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
                placeholder="Brief description of this word group"
                rows={3}
                className="w-full p-3 rounded-[var(--radius-button)] bg-black/5 dark:bg-white/10 dark:text-white outline-none focus:ring-2 focus:ring-[var(--klein-ring)] resize-none transition-all"
                disabled={creating}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2">
                {t('library.language') || 'Language'} *
              </label>
              <div className="ds-pill-nav" role="tablist" aria-label="Group language">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    role="tab"
                    aria-selected={newGroupLanguage === lang.code}
                    onClick={() => setNewGroupLanguage(lang.code)}
                    className={`ds-pill-chip ${newGroupLanguage === lang.code ? 'is-active' : ''}`}
                    disabled={creating}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 mt-7">
            <Button variant="secondary" onClick={() => setShowCreateDialog(false)} disabled={creating}>
              {t('common.cancel') || 'Cancel'}
            </Button>
            <Button variant="klein" onClick={handleCreateGroup} disabled={creating}>
              {creating ? (t('common.creating') || 'Creating…') : (t('common.create') || 'Create')}
            </Button>
          </div>
        </div>
      </Sheet>
    </div>
  );
};

export default WfLibraryCoursesPage;
