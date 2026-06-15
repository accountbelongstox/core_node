/* [v4.1-Iris] Word Detail — ported from
 * qy_capacitor/pages/Library/WordDetail.tsx. Self-contained for the shell:
 * reads the wordId from the route query (?wordId=) and loads the word via
 * wfTranslationCenter.getWordDetail() (~30-min lookup cache over
 * wordflowApi.getWordDetail); degrades to inline states on failure. Favorite
 * and Mark-as-Learned are wired to the backend word actions (POST
 * /words/{id}/favorite, /words/{id}/learn) with optimistic update and
 * rollback-on-error; notes stay client-side. Audio goes through wfAudioCenter
 * (legacy audio_url repair + Web Speech fallback — the TtsUrl.ts port lives
 * there now). Uses react-router useNavigate/useSearchParams + wfPath() and the
 * shared Iris primitives in WfUI. Faithful to design-reference-{light,dark}.webp. */
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Heart, Loader2, Volume2 } from 'lucide-react';
import { wordflowApi } from '../../../core/api-libs/wordflow/WordflowApi';
import type { Word } from '../../../core/api-libs/wordflow/wordflowTypes';
import { useWfApp } from '../WfAppContext';
import { wfPath } from '../WfBottomTabNav';
import { wfTranslationCenter } from '../services/WfTranslationCenter';
import { wfAudioCenter } from '../services/WfAudioCenter';
import { Button, Card, LoadingState, EmptyState, BackButton, Badge, ProgressBar, SectionLabel } from '../WfUI';

const WfLibraryWordDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { t } = useWfApp();

  const wordId = searchParams.get('wordId') || '';

  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!wordId) {
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const data = await wfTranslationCenter.getWordDetail(wordId);
        if (!cancelled) {
          setWord(data || null);
          setNote('');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[WfWordDetail] Load error:', err);
          setWord(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [wordId]);

  // Real backend call (POST /words/{id}/favorite): optimistic toggle, rolled
  // back if the request fails. When the backend reports the resulting state
  // (is_favorite / favorited / favorite boolean) we trust that over the toggle.
  const handleToggleFavorite = async () => {
    if (!wordId || actionLoading) return;
    setActionLoading('favorite');
    setActionError(null);
    const previous = isFavorite;
    setIsFavorite(!previous);
    try {
      const res: any = await wordflowApi.toggleWordFavorite(wordId);
      if (res && typeof res === 'object') {
        const serverState = res.is_favorite ?? res.favorited ?? res.favorite;
        if (typeof serverState === 'boolean') setIsFavorite(serverState);
      }
    } catch (err) {
      console.error('[WfWordDetail] Favorite toggle failed:', err);
      setIsFavorite(previous);
      setActionError(t('wordDetail.favoriteFailed') || 'Failed to update favorite');
    } finally {
      setActionLoading(null);
    }
  };

  // Real backend call (POST /words/{id}/learn): optimistic mastery bump,
  // rolled back if the request fails.
  const handleMarkAsLearned = async () => {
    if (!word || !wordId || actionLoading) return;
    setActionLoading('learned');
    setActionError(null);
    const previousWord = word;
    if (word.masteryLevel !== undefined) {
      setWord({ ...word, masteryLevel: Math.min(100, word.masteryLevel + 20) });
    }
    try {
      await wordflowApi.markWordLearned(wordId);
    } catch (err) {
      console.error('[WfWordDetail] Mark-as-learned failed:', err);
      setWord(previousWord);
      setActionError(t('wordDetail.markFailed') || 'Failed to mark as learned');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePlayAudio = () => {
    if (!word) return;
    // Backend audio file (with legacy audio_url repair) when present, else the
    // Web Speech fallback (original behavior, now owned by wfAudioCenter).
    wfAudioCenter.playWord({ audioUrl: word.audioUrl, text: word.text, lang: 'en-US' });
  };

  if (loading) {
    return (
      <div className="ds-page route-fade flex items-center justify-center pt-12">
        <LoadingState label={t('common.loading') || 'Loading…'} />
      </div>
    );
  }

  if (!word) {
    return (
      <div className="ds-page route-fade flex flex-col pt-12">
        <div className="mb-7">
          <BackButton onClick={() => navigate(wfPath('dictionary'))} />
        </div>
        <EmptyState title={t('wordDetail.notFound') || 'Word not found'} />
      </div>
    );
  }

  return (
    <div className="ds-page route-fade flex flex-col pt-4 relative">
      <div className="py-4 flex justify-between items-center">
        <BackButton onClick={() => navigate(wfPath('dictionary'))} />
        <button
          onClick={handleToggleFavorite}
          disabled={actionLoading === 'favorite'}
          className={`ds-touch-target flex items-center justify-center rounded-full p-2 transition-all ${
            isFavorite
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'ds-glass ds-glass-edge text-[var(--color-text-secondary)]'
          } ${actionLoading === 'favorite' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isFavorite ? (t('wordDetail.unfavorite') || 'Unfavorite') : (t('wordDetail.favorite') || 'Favorite')}
          aria-label={isFavorite ? (t('wordDetail.unfavorite') || 'Unfavorite') : (t('wordDetail.favorite') || 'Favorite')}
        >
          {actionLoading === 'favorite' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Heart className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />
          )}
        </button>
      </div>

      <div className="mt-4 pb-32 overflow-y-auto no-scrollbar flex-1">
        {/* Main word */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-[var(--color-text-primary)] mb-3">{word.text}</h1>
          {word.phonetic && (
            <button
              onClick={handlePlayAudio}
              className="inline-flex items-center gap-2 text-[var(--klein-blue)] font-mono text-lg bg-[var(--klein-blue-soft)] px-4 py-2 rounded-full hover:opacity-80 transition-opacity min-h-[var(--touch-min)]"
            >
              <span>{word.phonetic}</span>
              <Volume2 className="w-5 h-5" />
            </button>
          )}
          {word.tags && word.tags.length > 0 && (
            <div className="mt-3">
              <Badge tone="klein">{word.tags[0]}</Badge>
            </div>
          )}
        </div>

        {/* Mastery */}
        {word.masteryLevel !== undefined && (
          <Card className="mb-4">
            <SectionLabel className="mb-2">{t('wordDetail.masteryLevel') || 'Mastery Level'}</SectionLabel>
            <div className="flex items-center gap-3">
              <ProgressBar value={word.masteryLevel} className="flex-1 !h-3" />
              <span className="text-lg font-bold text-[var(--klein-blue)]">{word.masteryLevel}%</span>
            </div>
          </Card>
        )}

        {/* Definition */}
        <Card className="mb-4">
          <SectionLabel className="mb-2">{t('wordDetail.definition') || 'Definition'}</SectionLabel>
          <p className="text-xl font-bold text-[var(--color-text-primary)] mb-2">{word.translation}</p>
          {word.definition && <p className="text-[var(--color-text-secondary)] leading-relaxed">{word.definition}</p>}
        </Card>

        {/* Example */}
        {word.example && (
          <Card className="mb-4 !bg-[var(--klein-blue-soft)] border-[var(--border-highlight)]">
            <SectionLabel className="mb-2">{t('wordDetail.example') || 'Example'}</SectionLabel>
            <p className="text-lg italic text-[var(--color-text-primary)] mb-2">"{word.example}"</p>
            {word.exampleTranslation && (
              <p className="text-sm text-[var(--color-text-secondary)]">{word.exampleTranslation}</p>
            )}
          </Card>
        )}

        {/* Review info */}
        {word.lastReview && (
          <Card className="mb-4 !bg-[var(--klein-blue-soft)] border-[var(--border-highlight)]">
            <SectionLabel className="mb-2">{t('wordDetail.reviewInfo') || 'Review Info'}</SectionLabel>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-secondary)]">{t('wordDetail.lastReview') || 'Last Review'}:</span>
                <span className="font-bold text-[var(--color-text-primary)]">
                  {new Date(word.lastReview).toLocaleDateString()}
                </span>
              </div>
              {word.nextReview && (
                <div className="flex justify-between">
                  <span className="text-[var(--color-text-secondary)]">{t('wordDetail.nextReview') || 'Next Review'}:</span>
                  <span className="font-bold text-[var(--color-text-primary)]">
                    {new Date(word.nextReview).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* Notes */}
        <div className="mb-4">
          <SectionLabel className="mb-2 pl-2">{t('wordDetail.myNotes') || 'My Notes'}</SectionLabel>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-32 p-4 rounded-[var(--radius-card)] ds-glass ds-glass-edge focus:ring-2 focus:ring-[var(--klein-ring)] outline-none resize-none dark:text-white transition-all"
            placeholder={t('wordDetail.notesPlaceholder') || 'Add your memory hook here…'}
          />
        </div>
      </div>

      {/* Action error (rollback notice) */}
      {actionError && (
        <div className="absolute bottom-24 left-0 right-0 px-1" role="alert">
          <div className="ds-glass ds-glass-edge rounded-[var(--radius-card)] px-4 py-3 text-sm font-semibold text-red-500 text-center">
            {actionError}
          </div>
        </div>
      )}

      {/* Floating gradient CTA */}
      <div className="absolute bottom-6 left-0 right-0 px-1 flex gap-3">
        <Button
          variant="grad"
          onClick={handleMarkAsLearned}
          disabled={actionLoading === 'learned'}
          className={`flex-1 ${actionLoading === 'learned' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {actionLoading === 'learned'
            ? t('common.processing') || 'Processing…'
            : t('wordDetail.markAsLearned') || 'Mark as Learned'}
        </Button>
      </div>
    </div>
  );
};

export default WfLibraryWordDetailPage;
