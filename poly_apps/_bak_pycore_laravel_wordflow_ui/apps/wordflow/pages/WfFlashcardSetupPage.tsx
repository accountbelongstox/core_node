/* [v4.1-Iris] Flashcard Setup — ported from qy_capacitor/pages/Reading/Setup.tsx
 * (the material-picker pattern, retargeted at the flashcard runner). Lists study
 * decks via wordflowApi.getWordGroups() and launches the immersive flashcard
 * runner with the chosen group via wfPath(). API call is try/caught and degrades
 * to an EmptyState. Faithful Iris look. */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';
import { Card, BackButton, Badge, SectionTitle, EmptyState, Icons, LoadingState } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfT } from '../WfAppContext';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type { WordGroup } from '../../../core/api-libs/wordflow/wordflowTypes';

const WfFlashcardSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();
  const [groups, setGroups] = useState<WordGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const result = await wordflowApi.getWordGroups();
        if (!cancelled) setGroups(Array.isArray(result) ? result : []);
      } catch (error) {
        console.error('[WfFlashcardSetup] Failed to load groups:', error);
        if (!cancelled) setGroups([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  const safeGroups = Array.isArray(groups) ? groups : [];

  const openRunner = (group: WordGroup) => {
    navigate(`${wfPath('flashcard_run')}?groupId=${encodeURIComponent(group.id)}&language=${encodeURIComponent(group.language || 'en')}`);
  };

  return (
    <div className="ds-page ds-section-gap route-fade h-full flex flex-col pt-12 pb-32">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <BackButton onClick={() => navigate(wfPath('learn'))} />
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] truncate">Flashcard Decks</h1>
      </div>

      <SectionTitle
        title="Select a Deck"
        subtitle="Pick a deck and review it with smart spaced repetition."
        className="px-1"
      />

      {loading ? (
        <LoadingState label={t('common.loading')} />
      ) : safeGroups.length > 0 ? (
        <div className="ds-grid-breathing grid grid-cols-1 sm:grid-cols-2 overflow-y-auto no-scrollbar">
          {safeGroups.map((g) => (
            <div
              key={g.id}
              onClick={() => openRunner(g)}
              className="group relative cursor-pointer min-w-0"
            >
              <Card className="h-full flex flex-col items-start !p-6 transition-colors hover:border-[var(--klein-ring)]">
                <div className="flex justify-between w-full items-start mb-6 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)] shadow-inner border border-white/40 group-hover:scale-105 transition-transform duration-300 flex-shrink-0">
                    {g.coverImage && /^https?:\/\//.test(g.coverImage) ? (
                      <img src={g.coverImage} alt="" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <BookOpen className="w-7 h-7" />
                    )}
                  </div>
                  <Badge tone="klein">{Math.round(g.progress || 0)}%</Badge>
                </div>

                <div className="mt-auto w-full min-w-0">
                  <h3 className="text-xl font-bold text-[var(--color-text-primary)] mb-2 group-hover:text-[var(--klein-blue)] transition-colors leading-tight truncate">
                    {g.name}
                  </h3>
                  <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)] font-medium border-t border-[var(--border-highlight)] pt-4 mt-2 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--klein-blue)' }} />
                      <span className="uppercase tracking-wider truncate">{g.type}</span>
                    </div>
                    <span className="font-mono opacity-70 flex-shrink-0">{g.count} words</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-[var(--border-highlight)] rounded-b-[var(--radius-card)] overflow-hidden">
                  <div className="h-full" style={{ width: `${g.progress || 0}%`, background: 'var(--klein-blue)', boxShadow: 'var(--klein-glow)' }} />
                </div>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Icons.Sparkles />}
          title="No decks yet"
          description="Add a vocabulary library to start reviewing flashcards."
        />
      )}
    </div>
  );
};

export default WfFlashcardSetupPage;
