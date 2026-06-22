/* [v4.1-Iris] Group Management — ported/adapted from
 * qy_capacitor/pages/Library/Courses.tsx (management facet). Self-contained:
 * lists the user's word groups from wordflowApi, lets the user pick the active
 * study group (persisted via useWfApp().setActiveGroupId) and open a group's
 * detail. Uses react-router useNavigate + wfPath() for nav and the shared Iris
 * primitives in WfUI. Faithful to design-reference-{light,dark}.webp. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Check, Plus, ChevronRight, FileText, Layers } from 'lucide-react';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import {
  BackButton,
  EmptyState,
  LoadingState,
  Badge,
  ProgressBar,
  SectionTitle,
} from '../WfUI';

const WfLibraryGroupManagementPage: React.FC = () => {
  const navigate = useNavigate();
  const { activeGroupId, setActiveGroupId, t } = useWfApp();

  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await wordflowApi.getWordGroups();
        if (!cancelled) setGroups(Array.isArray(data) ? data : []);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[WfGroupManagement] Failed to load groups:', err);
          setError(err?.message || 'Unable to load groups.');
          setGroups([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSetActive = (groupId: string, event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveGroupId(groupId);
  };

  return (
    <div className="ds-page route-fade flex flex-col pt-12 pb-0">
      {/* Header */}
      <div className="flex items-center gap-3 mb-7">
        <BackButton onClick={() => navigate(wfPath('courses'))} />
        <div className="flex-1 min-w-0">
          <h1 className="ds-section-title !text-2xl truncate">{t('library.manageGroups') || 'Manage Groups'}</h1>
          <p className="ds-section-sub truncate">
            {t('library.manageGroupsSub') || 'Choose your active study group or open one to learn.'}
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto no-scrollbar pb-24 ds-stack">
        {/* Create entry */}
        <div
          onClick={() => navigate(wfPath('upload'))}
          className="ds-empty rounded-[var(--radius-card)] p-5 flex items-center gap-4 cursor-pointer hover:border-[var(--klein-blue)] hover:text-[var(--klein-blue)] transition-colors min-h-[var(--touch-min)]"
        >
          <span className="w-11 h-11 rounded-2xl flex items-center justify-center bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] shrink-0">
            <Plus className="w-6 h-6" />
          </span>
          <div className="min-w-0">
            <p className="font-bold text-sm text-[var(--color-text-primary)]">{t('library.addGroup') || 'Add a Group'}</p>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {t('library.addGroupHint') || 'Import a document to build a new word group.'}
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingState label={t('common.loading') || 'Loading…'} />
        ) : error ? (
          <EmptyState icon={<Layers strokeWidth={1.5} />} title={error} />
        ) : groups.length === 0 ? (
          <EmptyState
            icon={<BookOpen strokeWidth={1.5} />}
            title={t('library.noGroups') || 'No groups yet'}
            description={t('library.noGroupsHint') || 'Import a document to create your first group.'}
          />
        ) : (
          <div className="ds-stack-tight flex flex-col">
            <SectionTitle title={t('library.yourGroups') || 'Your Groups'} />
            {groups.map((g) => {
              const isActive = g.id === activeGroupId;
              return (
                <div
                  key={g.id}
                  onClick={() => navigate(wfPath(`group_detail?gid=${encodeURIComponent(g.id)}`))}
                  className={`ds-row flex items-center gap-4 p-4 cursor-pointer group ${
                    isActive ? 'ring-2 ring-[var(--klein-ring)]' : ''
                  }`}
                >
                  <div className="ds-media-frame w-12 h-12 shrink-0 flex items-center justify-center text-2xl">
                    {g.coverImage && g.coverImage.length <= 2 ? g.coverImage : <BookOpen className="w-6 h-6" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-[var(--color-text-primary)] truncate">{g.name}</h3>
                      <Badge tone="neutral" className="!py-0.5 capitalize">
                        {g.type === 'document' ? <FileText className="w-3 h-3 mr-1" /> : null}
                        {g.type}
                      </Badge>
                    </div>
                    <div className="mt-1.5">
                      <div className="flex justify-between text-xs font-bold text-[var(--color-text-tertiary)] mb-1">
                        <span>{g.count} {t('library.words') || 'words'}</span>
                        <span>{g.progress}%</span>
                      </div>
                      <ProgressBar value={g.progress} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => handleSetActive(g.id, e)}
                      className={`px-3 py-2 rounded-full text-xs font-bold transition-all min-h-[var(--touch-min)] active:scale-[0.97] inline-flex items-center gap-1 ${
                        isActive
                          ? 'bg-[var(--klein-blue)] text-[var(--klein-on)] shadow-[var(--klein-glow)]'
                          : 'bg-[var(--klein-blue-soft)] text-[var(--klein-blue)] hover:opacity-80'
                      }`}
                      title={isActive ? (t('library.active') || 'Active') : (t('library.setActive') || 'Set active')}
                    >
                      {isActive ? (
                        <>
                          <Check className="w-3.5 h-3.5" /> {t('library.active') || 'Active'}
                        </>
                      ) : (
                        t('library.setActive') || 'Set active'
                      )}
                    </button>
                    <ChevronRight className="w-5 h-5 text-[var(--color-text-tertiary)]" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default WfLibraryGroupManagementPage;
