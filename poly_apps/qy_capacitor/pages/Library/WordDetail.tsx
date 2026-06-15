/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */

import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button, Card, LoadingState, EmptyState, BackButton, Badge, ProgressBar, SectionLabel } from '../../components/UI';
import { Heart, Loader2, Volume2 } from 'lucide-react';
import { ApiCenter } from '../../services/ApiCenter';
import { resolveAudioUrl } from '../../services/TtsUrl';
import { Word } from '../../types';
import { LanguageCenter } from '../../i18n/LanguageCenter';

const WordDetailPage = () => {
  const { navigate, currentParams, t } = useContext(AppContext);
  const [word, setWord] = useState<Word | null>(null);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const wordId = currentParams?.wordId;
    if (wordId) {
      loadWordDetail(wordId);
    } else {
      console.error('[WordDetail] No wordId provided');
      navigate('dictionary');
    }
  }, [currentParams?.wordId]);

  const loadWordDetail = async (wordId: string) => {
    setLoading(true);
    try {
      const response = await ApiCenter.words.getDetail(wordId);
      if (response.success && response.data) {
        setWord(response.data);
        // TODO: Load user notes from backend if available
        setNote('');
      } else {
        console.error('[WordDetail] Failed to load:', response.error);
        alert(t('wordDetail.loadFailed') || 'Failed to load word details');
        navigate('dictionary');
      }
    } catch (err) {
      console.error('[WordDetail] Load error:', err);
      alert(t('wordDetail.loadError') || 'An error occurred');
      navigate('dictionary');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!word) return;

    setActionLoading('favorite');
    try {
      const response = await ApiCenter.learning.toggleWordFavorite(word.id);
      if (response.success) {
        setIsFavorite(!isFavorite);
      } else {
        alert(response.error?.message || t('wordDetail.favoriteFailed') || 'Failed to update favorite');
      }
    } catch (err: any) {
      alert(err.message || t('wordDetail.favoriteError') || 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkAsLearned = async () => {
    if (!word) return;

    setActionLoading('learned');
    try {
      const response = await ApiCenter.learning.markWordAsLearned(word.id);
      if (response.success) {
        alert(t('wordDetail.markedAsLearned') || 'Marked as learned!');
        // Update mastery level
        if (word.masteryLevel !== undefined) {
          setWord({ ...word, masteryLevel: Math.min(100, word.masteryLevel + 20) });
        }
      } else {
        alert(response.error?.message || t('wordDetail.markFailed') || 'Failed to mark as learned');
      }
    } catch (err: any) {
      alert(err.message || t('wordDetail.markError') || 'An error occurred');
    } finally {
      setActionLoading(null);
    }
  };

  const handlePlayAudio = () => {
    if (word?.audioUrl) {
      const audio = new Audio(resolveAudioUrl(word.audioUrl));
      audio.play().catch(err => {
        console.error('[WordDetail] Audio play failed:', err);
      });
    } else {
      // Use Web Speech API as fallback
      const utterance = new SpeechSynthesisUtterance(word?.text || '');
      utterance.lang = 'en-US';
      window.speechSynthesis.speak(utterance);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingState label={t('common.loading') || 'Loading...'} />
      </div>
    );
  }

  if (!word) {
    return (
      <div className="h-full flex items-center justify-center">
        <EmptyState title={t('wordDetail.notFound') || 'Word not found'} />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up relative ds-aura-bg">
      <div className="px-5 py-4 flex justify-between items-center">
        <BackButton onClick={() => navigate('dictionary')} />
        <button
          onClick={handleToggleFavorite}
          disabled={actionLoading === 'favorite'}
          className={`ds-touch-target flex items-center justify-center rounded-full transition-all ${
            isFavorite
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'ds-glass ds-glass-edge text-[var(--color-text-secondary)]'
          } ${actionLoading === 'favorite' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isFavorite ? (t('wordDetail.unfavorite') || 'Unfavorite') : (t('wordDetail.favorite') || 'Favorite')}
          aria-label={isFavorite ? (t('wordDetail.unfavorite') || 'Unfavorite') : (t('wordDetail.favorite') || 'Favorite')}
        >
          {actionLoading === 'favorite'
            ? <Loader2 className="w-5 h-5 animate-spin" />
            : <Heart className="w-5 h-5" fill={isFavorite ? 'currentColor' : 'none'} />}
        </button>
      </div>

      <div className="px-6 mt-4 pb-32 overflow-y-auto no-scrollbar">
        {/* Main Word */}
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

        {/* Mastery Level */}
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

        {/* Review Info */}
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

        {/* User Notes */}
        <div className="mb-4">
          <SectionLabel className="mb-2 pl-2">{t('wordDetail.myNotes') || 'My Notes'}</SectionLabel>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-32 p-4 rounded-[var(--radius-card)] ds-glass ds-glass-edge focus:ring-2 focus:ring-[var(--klein-ring)] outline-none resize-none dark:text-white transition-all"
            placeholder={t('wordDetail.notesPlaceholder') || 'Add your memory hook here...'}
          />
        </div>
      </div>

      {/* Floating Action — gradient hero CTA */}
      <div className="absolute bottom-6 left-6 right-6 flex gap-3">
        <Button
          variant="grad"
          onClick={handleMarkAsLearned}
          disabled={actionLoading === 'learned'}
          className={`flex-1 ${actionLoading === 'learned' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {actionLoading === 'learned'
            ? (t('common.processing') || 'Processing...')
            : (t('wordDetail.markAsLearned') || 'Mark as Learned')}
        </Button>
      </div>
    </div>
  );
};

export default WordDetailPage;
