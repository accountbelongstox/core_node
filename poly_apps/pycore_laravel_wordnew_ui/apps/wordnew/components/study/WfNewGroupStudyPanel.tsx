/**
 * WfNewGroupStudyPanel — the study surface of the shelf deep-dive (the Default
 * Vocabulary Group and every other opened group). Orchestrates the ported
 * legacy-client study experience over the wordnew stack:
 *
 *   - Modes: Cards (flashcards) · Recite (audio auto-play loop, the default) ·
 *     Review (due words only). No Browse mode.
 *   - Start Quiz Arena: fullscreen playback overlay — covers the app top bar,
 *     the header/stats block and the bottom dock; only the recite playlist
 *     shows (3× word, 2× gloss, played words badged with the backend read
 *     count) with the floating console docked at the bottom-menu position;
 *     its Stop button ends playback and exits.
 *   - The arena console shows current page / total pages and toggles a
 *     floating PROGRESS popup (WfNewArenaStatsPopup): words read today +
 *     today's goal %, whole-library %, read / remaining / due-review /
 *     reviewed counts, full-pass cycles, quick page-jump chips, and one-tap
 *     study settings (the settings sheet renders above the overlay).
 *   - No animated wave icon during playback — the active-row highlight and
 *     the played badge carry the visual feedback.
 *   - Stats header (mastered / daily-goal / session bars + count chips) from
 *     WfNewStudyProgress (blended local + best-effort backend blob).
 *   - Per-word: reveal gloss, pronounce (real audio → Web-Speech), mark
 *     Known / Forgot, favorite, open the word-detail modal.
 *   - A settings sheet editing the persisted play/replay/interval/speed/review
 *     settings + Compact & Auto-scroll toggles.
 *   - Handoff to the existing Practice Quiz arena.
 *
 * Data source: words load through useWfNewPracticePager (POST /group/get_words),
 * the same paged reader the practice page uses — this reads the Default
 * Vocabulary Group's words from group_word_progress (the words the `words` prop /
 * getVocabulary misses, the "no words yet" bug) already ordered least-recently-read
 * and carrying translation/phonetic/audio_url/definition. The `words` prop is kept
 * as a pre-load fallback. Progress is enriched best-effort from
 * wordNewProgressCenter.getBlob for logged-in users; marks mirror best-effort to
 * /group/update_progress + /recitation/log. Everything degrades to a local,
 * device-persisted, sensible guest state.
 */
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Layers, Play, Settings2, RotateCcw, GraduationCap, RefreshCw,
} from 'lucide-react';
import type { ElementTheme } from '../../WfNewThemes';
import type { Word, WordGroup } from '../../api/WfNewApiTypes';
import { wfNewApi, isDefaultVocabularyGroup } from '../../api';
import { wfNewSettings } from '../../WfNewSettingsStore';
import { wfNewNotify } from '../../WfNewNotify';
import { wordNewProgressCenter } from '../../services';
import { resolveAudioSync } from '../../runtime-store/WfNewAudioCache';
import { wfNewStudyProgress } from './WfNewStudyProgress';
import { studyT } from './WfNewStudyLocales';
import { WfNewStudyStatsBar } from './WfNewStudyStatsBar';
import { WfNewStudyWordList } from './WfNewStudyWordList';
import { WfNewFlashcard } from './WfNewFlashcard';
import { WfNewNoTranslation } from './WfNewNoTranslation';
import { WfNewStudySettingsSheet } from './WfNewStudySettingsSheet';
import { WfNewArenaStatsPopup } from './WfNewArenaStatsPopup';
import { WfNewPracticeControlPanel } from './WfNewPracticeControlPanel';
import { useWfNewReciteController } from './useWfNewReciteController';
// Paged word loader (POST /group/get_words) shared with the practice page — the
// source of truth for the Default Vocabulary Group, whose words getVocabulary
// misses. See ../../hooks/useWfNewPracticePager.
import { useWfNewPracticePager } from '../../hooks/useWfNewPracticePager';

type StudyMode = 'cards' | 'recite' | 'review';

interface WfNewGroupStudyPanelProps {
  group: WordGroup;
  words: Word[];
  lang: string;
  // App-level translator (resolves the shared practice.ctrl.* keys used by the
  // floating control panel); studyT stays for this feature's own study.* keys.
  trans: (k: string, r?: Record<string, string | number>) => string;
  theme: ElementTheme;
  favorites: Word[];
  onToggleFavorite: (w: Word) => void;
  playPhoneticSpeech: (w: Word) => void;
  onOpenDetail: (w: Word) => void;
  onStartQuiz: () => void;
}

const isAbsoluteUrl = (u?: string): u is string =>
  !!u && (u.startsWith('http://') || u.startsWith('https://'));

export const WfNewGroupStudyPanel: React.FC<WfNewGroupStudyPanelProps> = ({
  group,
  words,
  lang,
  trans,
  theme,
  favorites,
  onToggleFavorite,
  playPhoneticSpeech,
  onOpenDetail,
  onStartQuiz,
}) => {
  const gid = group.id;
  const [mode, setMode] = useState<StudyMode>('recite');
  // Fullscreen quiz-arena overlay: started by Start Quiz Arena, covers the app
  // top bar + bottom dock; the floating console docks where the dock was and
  // carries the Stop button that exits the arena.
  const [arena, setArena] = useState(false);
  // Arena progress popup (today / library / review stats + quick page jump +
  // one-tap study settings), toggled from the console's stats button.
  const [showArenaStats, setShowArenaStats] = useState(false);
  const [brief, setBrief] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [cardsIndex, setCardsIndex] = useState(0);
  // Large-font (big word + translation) mirror of the persisted wmLargeFont flag;
  // flipped from the floating control panel so the now-playing card re-renders.
  const [largeFont, setLargeFont] = useState<boolean>(() => !!wfNewSettings.get('wmLargeFont'));
  // Bumped on every store change so the memoized stats recompute.
  const [version, setVersion] = useState(0);

  const loggedIn = wfNewApi.isAuthenticated();

  // The Default Vocabulary Group reads the UNREAD set (shuffled order applied
  // server-side): unread_only filters to rc==0 words. dailyGoal is ONLY the
  // plan shown in the stats bar — the queue is NOT capped by it: the learner
  // keeps paging through all unread words, and once the whole group has been
  // read the backend resets it to unread in a fresh shuffled order (review
  // order untouched) so reading simply continues. Other groups page through
  // all words.
  const isDefaultGroup = isDefaultVocabularyGroup(group);
  const dailyGoal = Math.max(1, Number(wfNewSettings.get('dailyGoal')) || 20);
  const pagerOpts = isDefaultGroup ? { unreadOnly: true } : undefined;

  // The panel mounts only when a shelf course is open (WfNewShelfTab renders it
  // solely in the deep-dive branch), so the pager is live for its whole lifetime.
  // pager.words is the least-recently-read-ordered live source for every mode; it
  // fixes the Default Vocabulary Group ("no words yet") and carries translations.
  const pager = useWfNewPracticePager(gid, true, pagerOpts);
  // Fall back to the accepted `words` prop only until the first page lands (that
  // prop is empty for the Default group anyway).
  const liveWords = pager.words.length ? pager.words : words;

  // Flip the persisted large-font flag and mirror it into local state so the
  // now-playing card + control panel reflect it immediately.
  const toggleLargeFont = useCallback(() => {
    const next = !wfNewSettings.get('wmLargeFont');
    wfNewSettings.setField('wmLargeFont', next);
    setLargeFont(next);
  }, []);

  // Re-render on any study-progress change (marks, backend ingest).
  useEffect(() => wfNewStudyProgress.subscribe(() => setVersion((v) => v + 1)), []);

  // Best-effort backend enrichment for logged-in users (never blocks / errors).
  useEffect(() => {
    if (!loggedIn || !gid) return;
    let cancelled = false;
    wordNewProgressCenter
      .getBlob(gid)
      .then((blob) => {
        if (!cancelled) wfNewStudyProgress.ingestBlob(gid, blob);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [gid, loggedIn]);

  // Play a word: prefer its real audio file (locally cached when preloaded —
  // see cache/WfNewAudioCache), else the app's Web-Speech helper.
  const speakWord = useCallback(
    (w: Word) => {
      if (isAbsoluteUrl(w.audioUrl)) {
        try {
          void new Audio(resolveAudioSync(w.audioUrl) ?? w.audioUrl).play().catch(() => playPhoneticSpeech(w));
          return;
        } catch {
          /* fall through */
        }
      }
      playPhoneticSpeech(w);
    },
    [playPhoneticSpeech],
  );

  const markWord = useCallback(
    (w: Word, known: boolean) => {
      wfNewStudyProgress.mark(gid, w, known, group.language);
      wfNewNotify.push(
        studyT(lang, known ? 'study.toast.known' : 'study.toast.forgot'),
        known ? 'success' : 'warning',
      );
    },
    [gid, group.language, lang],
  );

  // liveWords already arrives least-recently-read-ordered from the pager, so it is
  // the study-priority source for Browse/Cards/Recite as-is (no re-shuffle).
  const dueWords = useMemo(() => {
    const base = wfNewStudyProgress.dueWords(gid, liveWords); // least-recent first
    const order = wfNewSettings.get('reviewOrder');
    if (order === 'random') return [...base].sort(() => Math.random() - 0.5);
    if (order === 'hardest_first') {
      return [...base].sort(
        (a, b) => wfNewStudyProgress.proficiencyOf(gid, a) - wfNewStudyProgress.proficiencyOf(gid, b),
      );
    }
    return base; // due_first (default)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gid, liveWords.length, version]);
  const stats = useMemo(
    () => wfNewStudyProgress.computeStats(gid, liveWords),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gid, liveWords, version],
  );
  // Whole-library numbers for the arena progress popup (read/remaining/review
  // counts + full passes); pager.total is the backend grand total.
  const libraryStats = useMemo(
    () => wfNewStudyProgress.computeLibraryStats(gid, pager.total),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gid, pager.total, version],
  );

  const recite = useWfNewReciteController({
    gid,
    words: liveWords,
    language: group.language,
    // Drive the pager's half-page prefetch + wrap-to-next-page advance so the
    // recite loop flows continuously across the whole group (practice parity).
    onActive: pager.notifyActive,
  });
  const activeReciteId = liveWords[recite.index]?.id ?? null;

  // Clamp the cards cursor if the list shrank.
  useEffect(() => {
    if (cardsIndex >= liveWords.length) setCardsIndex(0);
  }, [liveWords.length, cardsIndex]);

  const advanceCard = useCallback(() => {
    setCardsIndex((i) => (liveWords.length ? (i + 1) % liveWords.length : 0));
  }, [liveWords.length]);

  // "Start Quiz Arena" enters the fullscreen arena: the app top bar, the bottom
  // dock and this panel's header/stats are all covered; only the recite playlist
  // shows, with the floating console docked at the bottom-menu position. Stop
  // (in the console) ends playback and exits the arena. onStartQuiz just records
  // the practice-group context (no tab switch).
  const handleStartQuiz = () => {
    setMode('recite');
    setArena(true);
    recite.play();
    onStartQuiz();
  };
  // Bumped on arena exit so the underlying list scrolls the CURRENT word into
  // focus (the playback page/word the user stopped at).
  const [focusTick, setFocusTick] = useState(0);
  const stopArena = () => {
    recite.pause();
    setArena(false);
    setShowArenaStats(false);
    setFocusTick((t) => t + 1);
  };
  // Quick page jump from the arena stats popup: swap the page window and reset
  // the recite cursor to the page's first word (playback continues there).
  const jumpToPage = (p: number) => {
    pager.goToPage(p);
    recite.setIndex(0);
  };
  // Row tap = continue FROM that card: stop the current clip, move the play
  // cursor to the tapped card and resume there (never snaps back to the old
  // sequence position).
  const playFromCard = (i: number) => {
    recite.pause();
    recite.setIndex(i);
    recite.play();
  };

  const modes: Array<{ id: StudyMode; label: string; icon: React.ReactNode }> = [
    { id: 'cards', label: studyT(lang, 'study.mode.cards'), icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'recite', label: studyT(lang, 'study.mode.recite'), icon: <Play className="w-3.5 h-3.5" /> },
    { id: 'review', label: studyT(lang, 'study.mode.review'), icon: <RotateCcw className="w-3.5 h-3.5" /> },
  ];

  const cardWord = liveWords[cardsIndex];
  const reciteWord = liveWords[recite.index];

  return (
    <div className="space-y-5">
      {/* Mode switch + tools */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5 p-1 bg-white/5 rounded-2xl border border-white/5">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                if (m.id !== 'recite' && recite.isPlaying) recite.pause();
                setMode(m.id);
              }}
              className={`flex items-center gap-1.5 text-[10px] font-mono uppercase px-3 py-2 rounded-xl transition-all ${
                mode === m.id
                  ? 'bg-indigo-500/15 text-indigo-300'
                  : 'text-zinc-500 hover:text-white'
              }`}
            >
              {m.icon}
              {m.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => {
              wfNewStudyProgress.resetSession(gid);
              wfNewNotify.push(studyT(lang, 'study.toast.reset'), 'info');
            }}
            className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400"
            title={studyT(lang, 'study.reset')}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`p-2.5 rounded-xl border transition-all ${
              showSettings
                ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300'
                : 'bg-white/5 border-white/5 hover:bg-white/10 text-zinc-400'
            }`}
            title={studyT(lang, 'study.settings.title')}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — stats / settings / handoff */}
        <div className="space-y-4">
          {showSettings ? (
            <WfNewStudySettingsSheet
              lang={lang}
              theme={theme}
              brief={brief}
              setBrief={setBrief}
              autoScroll={autoScroll}
              setAutoScroll={setAutoScroll}
              onClose={() => setShowSettings(false)}
            />
          ) : (
            <div className={`p-5 rounded-3xl ${theme.cardClass} space-y-5`}>
              <WfNewStudyStatsBar stats={stats} dailyGoal={dailyGoal} lang={lang} />
              {group.description && (
                <p className="text-[11px] text-zinc-500 leading-relaxed font-mono border-t border-white/5 pt-3">
                  {group.description}
                </p>
              )}
              {!loggedIn && (
                <div className="text-[10px] text-amber-400/90 font-mono border-t border-white/5 pt-3">
                  <p className="font-bold">{studyT(lang, 'study.guest.title')}</p>
                  <p className="text-amber-400/70 mt-1">{studyT(lang, 'study.guest.sub')}</p>
                </div>
              )}
              <button
                onClick={handleStartQuiz}
                className="w-full bg-white/5 hover:bg-white/10 text-zinc-300 font-mono uppercase tracking-widest py-3 rounded-2xl text-[11px] font-bold flex items-center justify-center gap-2 border border-white/5"
              >
                <GraduationCap className="w-4 h-4" />
                {studyT(lang, 'study.startQuiz')}
              </button>
            </div>
          )}
        </div>

        {/* Right column — active mode */}
        <div className="lg:col-span-2">
          {mode === 'review' && (
            <WfNewStudyWordList
              words={dueWords}
              lang={lang}
              sourceLanguage={group.language}
              theme={theme}
              brief={brief}
              favorites={favorites}
              alwaysShowTranslation
              emptyText={studyT(lang, 'study.review.empty')}
              onSpeak={speakWord}
              onKnown={(w) => markWord(w, true)}
              onForgot={(w) => markWord(w, false)}
              onToggleFav={onToggleFavorite}
              onOpenDetail={onOpenDetail}
            />
          )}

          {mode === 'cards' &&
            (cardWord ? (
              <WfNewFlashcard
                key={cardWord.id}
                word={cardWord}
                theme={theme}
                lang={lang}
                index={cardsIndex}
                total={liveWords.length}
                onSpeak={() => speakWord(cardWord)}
                onKnown={() => {
                  markWord(cardWord, true);
                  advanceCard();
                }}
                onForgot={() => {
                  markWord(cardWord, false);
                  advanceCard();
                }}
              />
            ) : (
              <div className="py-16 text-center text-xs font-mono text-zinc-500">
                {studyT(lang, 'study.list.empty')}
              </div>
            ))}

          {mode === 'recite' && (
            <div className="space-y-4">
              {reciteWord ? (
                <>
                  {/* Now playing (word + translation grow when large-font is on) */}
                  <div className="p-6 rounded-3xl bg-slate-900/40 border border-indigo-500/20 flex flex-col items-center text-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500">
                      {studyT(lang, 'study.recite.of', {
                        i: recite.index + 1,
                        n: liveWords.length,
                      })}
                    </span>
                    <h3 className={`font-black tracking-tight ${largeFont ? 'text-5xl md:text-6xl' : 'text-3xl'}`}>
                      {reciteWord.text}
                    </h3>
                    <p className="text-xs font-mono text-indigo-400">{reciteWord.phonetic}</p>
                    {/* No animated wave icon during playback (per design request). */}
                    {reciteWord.translation ? (
                      <p className={`text-zinc-400 pt-1 ${largeFont ? 'text-xl' : 'text-sm'}`}>{reciteWord.translation}</p>
                    ) : (
                      <span className="pt-1">
                        <WfNewNoTranslation lang={lang} />
                      </span>
                    )}
                    {recite.isPlaying && (
                      <p className="text-[10px] text-emerald-400 font-mono animate-pulse pt-1">
                        {trans('practice.listeningActive')}
                      </p>
                    )}
                  </div>

                  {/* Sequential-reading queue: translations always shown; a row tap
                      moves the play cursor and starts (no detail modal). */}
                  <WfNewStudyWordList
                    words={liveWords}
                    lang={lang}
                    sourceLanguage={group.language}
                    theme={theme}
                    brief={brief}
                    favorites={favorites}
                    activeWordId={activeReciteId}
                    autoScroll={autoScroll}
                    scrollSignal={focusTick}
                    alwaysShowTranslation
                    emptyText={studyT(lang, 'study.recite.empty')}
                    onSpeak={speakWord}
                    onKnown={(w) => markWord(w, true)}
                    onForgot={(w) => markWord(w, false)}
                    onToggleFav={onToggleFavorite}
                    onOpenDetail={onOpenDetail}
                    onSelectWord={(_w, i) => playFromCard(i)}
                  />
                </>
              ) : (
                <div className="py-16 text-center text-xs font-mono text-zinc-500">
                  {pager.loading ? trans('practice.loadingWords') : studyT(lang, 'study.recite.empty')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen quiz arena (§4.4 playback-scoped): covers the app top bar,
          this panel's header/stats and the bottom dock — only the recite
          playlist shows (translations visible, 3× word / 2× gloss, played words
          badged with the backend read count). The floating console docks at the
          bottom-menu position; its Stop button ends playback and exits. */}
      {arena && (
        <div className="fixed inset-0 z-[60] bg-slate-950 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-4 pt-6 pb-32">
            <WfNewStudyWordList
              words={liveWords}
              lang={lang}
              sourceLanguage={group.language}
              theme={theme}
              brief={brief}
              favorites={favorites}
              activeWordId={activeReciteId}
              autoScroll={autoScroll}
              alwaysShowTranslation
              jumbo
              readCountOf={(w) => wfNewStudyProgress.recordOf(gid, w.id)?.rc ?? 0}
              emptyText={pager.loading ? trans('practice.loadingWords') : studyT(lang, 'study.recite.empty')}
              onSpeak={speakWord}
              onKnown={(w) => markWord(w, true)}
              onForgot={(w) => markWord(w, false)}
              onToggleFav={onToggleFavorite}
              onOpenDetail={onOpenDetail}
              onSelectWord={(_w, i) => playFromCard(i)}
            />
          </div>
          <WfNewPracticeControlPanel
            trans={trans}
            recite={recite}
            pager={pager}
            largeFont={largeFont}
            onToggleLargeFont={toggleLargeFont}
            onStop={stopArena}
            docked
            onToggleStats={() => setShowArenaStats((s) => !s)}
            statsOpen={showArenaStats}
          />
          {/* Floating progress panel: today / library / review stats, quick
              page jump, one-tap study settings — without leaving the arena. */}
          {showArenaStats && (
            <WfNewArenaStatsPopup
              lang={lang}
              dailyGoal={dailyGoal}
              session={stats}
              library={libraryStats}
              pager={{ page: pager.page, totalPages: pager.totalPages }}
              onJumpPage={jumpToPage}
              onOpenSettings={() => setShowSettings(true)}
              onClose={() => setShowArenaStats(false)}
            />
          )}
          {/* Study settings, opened from the arena stats popup (the left-column
              sheet is covered by the overlay, so it renders above it here). */}
          {showSettings && (
            <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 backdrop-blur-sm p-4 flex justify-center">
              <div className="w-full max-w-md my-auto">
                <WfNewStudySettingsSheet
                  lang={lang}
                  theme={theme}
                  brief={brief}
                  setBrief={setBrief}
                  autoScroll={autoScroll}
                  setAutoScroll={setAutoScroll}
                  onClose={() => setShowSettings(false)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
