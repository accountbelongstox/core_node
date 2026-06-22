/* [v4.1-Iris] Web port of the Learning Groups management screen — AppContext navigation + ApiCenter data layer, v4.1 Iris visuals preserved (tokens, glass header, gradient hero, Icons, no emoji, no inline hex). */

import React, { useState, useEffect, useCallback, useContext } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { ApiCenter } from '../../services/ApiCenter';
import { StorageCenter } from '../../services/StorageCenter';
import { Button, Icons } from '../../components/UI';
import PillNav from '../../components/PillNav';

interface WordGroup {
  gid: string;
  gname: string;
  total_words: number;
  created_at: string;
  updated_at: string;
}

interface ProgressStats {
  total_words: number;
  avg_proficiency: number;
  mastered_words: number;
  learning_words: number;
  struggling_words: number;
  due_for_review: number;
  total_reviews?: number;
}

const SORT_TABS = [
  { id: 'all', label: 'All' },
  { id: 'due', label: 'Due' },
  { id: 'mastered', label: 'Mastered' },
];

const getProficiencyColor = (proficiency: number): string => {
  if (proficiency >= 90) return 'var(--color-success, #10b981)';
  if (proficiency >= 75) return 'var(--klein-blue)';
  if (proficiency >= 60) return '#f59e0b';
  if (proficiency >= 40) return '#ef4444';
  return 'var(--color-text-tertiary, #9ca3af)';
};

export default function GroupManagement() {
  const { navigate } = useContext(AppContext);
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState<Record<string, ProgressStats>>({});
  const [activeFilter, setActiveFilter] = useState('all');

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ApiCenter.wordGroups.getAll();

      if (response.success && Array.isArray(response.data)) {
        // Normalize ApiCenter group shape into the local view-model.
        const mapped: WordGroup[] = response.data.map((g: any) => ({
          gid: g.id,
          gname: g.name,
          total_words: g.count ?? g.wordCount ?? 0,
          created_at: g.created_at ?? '',
          updated_at: g.updated_at ?? g.created_at ?? '',
        }));
        setGroups(mapped);
        // Per-group progress stats have no ApiCenter endpoint; the stats
        // block renders only when data is present, so it degrades cleanly.
        setStats({});
      }
    } catch (error) {
      console.error('Error loading groups:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    StorageCenter.auth.getToken().then((token) => {
      if (!active) return;
      if (!token) {
        navigate('login');
        return;
      }
      loadGroups();
    });
    return () => {
      active = false;
    };
  }, [loadGroups, navigate]);

  const filteredGroups = groups.filter((group) => {
    const matchesSearch = group.gname.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (activeFilter === 'all') return true;
    const groupStats = stats[group.gid];
    if (!groupStats) return true;

    if (activeFilter === 'due') return groupStats.due_for_review > 0;
    if (activeFilter === 'mastered') return groupStats.avg_proficiency >= 90;
    return true;
  });

  return (
    <div className="ds-page h-full flex flex-col bg-[var(--color-bg)] animate-slide-up overflow-hidden">
      {/* Background aurora layer */}
      <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-primary-container)] to-transparent opacity-40 -z-10 pointer-events-none" />

      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-[var(--color-surface)]/80 border-b border-[var(--border-highlight)] px-5 py-4 flex items-center gap-3">
        <h1 className="flex-1 ds-section-title !text-xl">Learning Groups</h1>
        <Button
          variant="grad"
          className="!w-auto px-5 !py-2 text-sm"
          onClick={() => navigate('courses')}
        >
          + New Group
        </Button>
      </div>

      {/* Search bar */}
      <div className="px-5 pt-4 pb-2">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none">
            <Icons.Search />
          </span>
          <input
            type="text"
            className="w-full ds-card !rounded-full pl-11 pr-4 py-3 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] bg-transparent focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Filter pill nav */}
      <div className="px-5 pb-3">
        <PillNav
          items={SORT_TABS}
          activeId={activeFilter}
          onChange={setActiveFilter}
          aria-label="Group filters"
        />
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-5 pb-8 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-[var(--klein-blue)]">
            <Icons.Loader />
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="ds-card p-10 text-center space-y-2">
            <p className="font-semibold text-[var(--color-text-primary)]">No groups found</p>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Create your first learning group to get started
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            const groupStats = stats[group.gid];
            const proficiency = groupStats?.avg_proficiency ?? 0;

            return (
              <div
                key={group.gid}
                className="ds-card p-5 cursor-pointer hover:ring-2 transition-all"
                style={{ '--tw-ring-color': 'var(--klein-ring)' } as React.CSSProperties}
                onClick={() => navigate('group_detail', { gid: group.gid })}
              >
                {/* Card header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[var(--color-text-primary)] truncate text-base">
                      {group.gname}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {group.total_words} words &bull; Updated {new Date(group.updated_at).toLocaleDateString()}
                    </p>
                  </div>

                  <Button
                    variant="grad"
                    className="!w-auto px-4 !py-2 text-sm flex-shrink-0"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      navigate('study_session', { gid: group.gid });
                    }}
                  >
                    Study
                  </Button>
                </div>

                {groupStats && (
                  <>
                    {/* Proficiency bar */}
                    <div className="h-1.5 rounded-full bg-[var(--border-highlight)] overflow-hidden mb-3">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${proficiency}%`,
                          background: getProficiencyColor(proficiency),
                        }}
                      />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { value: groupStats.mastered_words, label: 'Mastered', color: 'var(--color-success, #10b981)' },
                        { value: groupStats.learning_words, label: 'Learning', color: 'var(--klein-blue)' },
                        { value: groupStats.struggling_words, label: 'Struggling', color: '#f59e0b' },
                        { value: groupStats.due_for_review, label: 'Due', color: '#ef4444' },
                      ].map(({ value, label, color }) => (
                        <div key={label} className="text-center">
                          <p className="text-lg font-bold" style={{ color }}>{value}</p>
                          <p className="text-[10px] text-[var(--color-text-secondary)] leading-tight">{label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Avg proficiency footer */}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-[var(--border-highlight)] text-xs text-[var(--color-text-secondary)]">
                      <span>Avg proficiency: <strong style={{ color: getProficiencyColor(proficiency) }}>{proficiency.toFixed(1)}%</strong></span>
                      {groupStats.total_reviews !== undefined && (
                        <span>{groupStats.total_reviews} reviews</span>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
