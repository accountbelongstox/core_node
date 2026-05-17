
import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Icons, Button, Card } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
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
      const audio = new Audio(word.audioUrl);
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
        <div className="flex items-center gap-2 text-slate-400">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm">{t('common.loading') || 'Loading...'}</span>
        </div>
      </div>
    );
  }

  if (!word) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-slate-500">{t('wordDetail.notFound') || 'Word not found'}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col pt-safe animate-slide-up relative bg-white/30 dark:bg-slate-900/30">
      {/* Header Image Area */}
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-100 to-transparent -z-10 dark:from-blue-900/20"></div>

      <div className="px-5 py-4 flex justify-between items-center">
        <button
          onClick={() => navigate('dictionary')}
          className="p-2 rounded-full bg-white/50 backdrop-blur-md hover:bg-white/70 transition-colors"
        >
          <Icons.Back />
        </button>
        <button
          onClick={handleToggleFavorite}
          disabled={actionLoading === 'favorite'}
          className={`p-2 rounded-full backdrop-blur-md transition-all ${
            isFavorite
              ? 'bg-red-500 text-white'
              : 'bg-white/50 text-slate-600 hover:bg-white/70'
          } ${actionLoading === 'favorite' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={isFavorite ? (t('wordDetail.unfavorite') || 'Unfavorite') : (t('wordDetail.favorite') || 'Favorite')}
        >
          {actionLoading === 'favorite' ? '⏳' : isFavorite ? '❤️' : '🤍'}
        </button>
      </div>

      <div className="px-6 mt-4 pb-24 overflow-y-auto no-scrollbar">
        {/* Main Word */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-slate-800 dark:text-white mb-2">{word.text}</h1>
          {word.phonetic && (
            <button
              onClick={handlePlayAudio}
              className="inline-flex items-center gap-2 text-blue-500 font-mono text-lg bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors"
            >
              <span>{word.phonetic}</span>
              <span>🔊</span>
            </button>
          )}
          {word.tags && word.tags.length > 0 && (
            <div className="mt-3">
              <span className="px-3 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full text-xs font-bold">
                {word.tags[0]}
              </span>
            </div>
          )}
        </div>

        {/* Mastery Level */}
        {word.masteryLevel !== undefined && (
          <Card className="mb-4">
            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
              {t('wordDetail.masteryLevel') || 'Mastery Level'}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex-1 h-3 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-blue-500 transition-all duration-500"
                  style={{ width: `${word.masteryLevel}%` }}
                ></div>
              </div>
              <span className="text-lg font-bold text-slate-700 dark:text-white">{word.masteryLevel}%</span>
            </div>
          </Card>
        )}

        {/* Definition */}
        <Card className="mb-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">
            {t('wordDetail.definition') || 'Definition'}
          </div>
          <p className="text-xl font-bold text-slate-700 dark:text-slate-200 mb-2">{word.translation}</p>
          {word.definition && <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{word.definition}</p>}
        </Card>

        {/* Example */}
        {word.example && (
          <Card className="mb-4 bg-purple-50/50 dark:bg-purple-900/10 border-purple-100">
            <div className="text-xs font-bold text-purple-400 uppercase tracking-widest mb-2">
              {t('wordDetail.example') || 'Example'}
            </div>
            <p className="text-lg italic text-slate-700 dark:text-slate-300 mb-2">"{word.example}"</p>
            {word.exampleTranslation && (
              <p className="text-sm text-slate-500 dark:text-slate-400">{word.exampleTranslation}</p>
            )}
          </Card>
        )}

        {/* Review Info */}
        {word.lastReview && (
          <Card className="mb-4 bg-blue-50/50 dark:bg-blue-900/10">
            <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2">
              {t('wordDetail.reviewInfo') || 'Review Info'}
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">{t('wordDetail.lastReview') || 'Last Review'}:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  {new Date(word.lastReview).toLocaleDateString()}
                </span>
              </div>
              {word.nextReview && (
                <div className="flex justify-between">
                  <span className="text-slate-600 dark:text-slate-400">{t('wordDetail.nextReview') || 'Next Review'}:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {new Date(word.nextReview).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          </Card>
        )}

        {/* User Notes */}
        <div className="mb-4">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 pl-2">
            {t('wordDetail.myNotes') || 'My Notes'}
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full h-32 p-4 rounded-2xl bg-white/60 dark:bg-slate-800/60 border border-white/40 focus:ring-2 ring-blue-400 outline-none resize-none shadow-sm dark:text-white"
            placeholder={t('wordDetail.notesPlaceholder') || 'Add your memory hook here...'}
          />
        </div>
      </div>

      {/* Floating Action */}
      <div className="absolute bottom-6 left-6 right-6 flex gap-3">
        <Button
          onClick={handleMarkAsLearned}
          disabled={actionLoading === 'learned'}
          className={`flex-1 shadow-2xl ${actionLoading === 'learned' ? 'opacity-50 cursor-not-allowed' : ''}`}
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
