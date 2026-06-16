/* [v4.1-Iris] Daily Recitation (每日背诵) — card-stack recite flow over the
 * /recitation/* backend surface (2026-06-12 contract). Login-gated (personal
 * progress). Data + event batching live in WfRecitationCenter: every reveal /
 * action is recordAction()-buffered and flushed as one idempotent batch; the
 * header live-updates from 'recitation-updated' (queued-offline flushes are
 * counted optimistically and surfaced as a pending-sync note, the queued toast
 * itself is centralized in WordflowApi). Iris look: gradient hero with
 * progress ring + streak flame, pill tabs (recite / history), 35-day heat
 * strip with per-day summary Sheet. Keyboard: Space = reveal, 1/2/3 = actions. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  Check,
  Flame,
  GraduationCap,
  Keyboard,
  RotateCcw,
  Trophy,
  Volume2,
  X,
} from 'lucide-react';
import { Badge, Button, Card, EmptyState, Icons, Sheet, Spinner } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfApp } from '../WfAppContext';
import { wfRecitationCenter } from '../services/WfRecitationCenter';
import { wfAudioCenter } from '../services/WfAudioCenter';
import type {
  WfRecitationAction,
  WfRecitationPlanWord,
  WfRecitationStreak,
  WfRecitationSummary,
  WfRecitationToday,
} from '../../../core/api-libs/wordflow/WordflowApi';

/** Klein-stroked circular progress ring (done/goal), label slot centered. */
const ProgressRing: React.FC<{
  done: number;
  goal: number;
  size?: number;
  stroke?: number;
  className?: string;
  children?: React.ReactNode;
}> = ({ done, goal, size = 84, stroke = 7, className = '', children }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(done / goal, 1) : 0;
  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
};

/** Visual tone per recitation action (history sheet badges). */
const ACTION_TONE: Record<WfRecitationAction, 'neutral' | 'klein' | 'success' | 'danger'> = {
  read: 'neutral',
  learn: 'klein',
  review_correct: 'success',
  review_wrong: 'danger',
};

const WfDailyRecitationPage: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, learningLanguage, t, lang } = useWfApp();

  const [tab, setTab] = useState<'recite' | 'history'>('recite');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [planDate, setPlanDate] = useState<string>('');
  /** Initial size of today's stack — distinguishes "empty plan" from "done". */
  const [planSize, setPlanSize] = useState(0);
  const [queue, setQueue] = useState<WfRecitationPlanWord[]>([]);
  const [revealed, setRevealed] = useState(false);
  /** Monotonic key so a re-queued word still re-runs the enter animation. */
  const [cardSeq, setCardSeq] = useState(0);
  const [counts, setCounts] = useState({ read: 0, know: 0, forgot: 0, mastered: 0 });
  const [today, setToday] = useState<WfRecitationToday | null>(wfRecitationCenter.getToday());
  const [pendingSync, setPendingSync] = useState(wfRecitationCenter.hasPendingSync());
  const [streak, setStreak] = useState<WfRecitationStreak | null>(null);
  // Per-day summary sheet (history heat-strip tap).
  const [summaryDate, setSummaryDate] = useState<string | null>(null);
  const [summary, setSummary] = useState<WfRecitationSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  /** Words whose 'read' was already logged this session (once per word). */
  const readLoggedRef = useRef<Set<string>>(new Set());

  const current = queue[0];

  const loadPlan = useCallback(async (cancelledRef?: { current: boolean }) => {
    setLoading(true);
    setLoadError(null);
    try {
      const plan = await wfRecitationCenter.getTodayPlan({ language: learningLanguage });
      if (cancelledRef?.current) return;
      const words = Array.isArray(plan.words) ? plan.words : [];
      setPlanDate(plan.date || '');
      setPlanSize(words.length);
      setQueue(words);
      setRevealed(false);
      setCardSeq((s) => s + 1);
      setToday(wfRecitationCenter.getToday());
    } catch (e: any) {
      if (cancelledRef?.current) return;
      setLoadError(e?.message || t('recitation.loadFailed'));
    } finally {
      if (!cancelledRef?.current) setLoading(false);
    }
  }, [learningLanguage, t]);

  const loadStreak = useCallback(async (cancelledRef?: { current: boolean }) => {
    try {
      const s = await wfRecitationCenter.getStreak();
      if (!cancelledRef?.current) setStreak(s);
    } catch (e) {
      // Streak is decorative — keep the page usable without it.
      console.error('[WfDailyRecitation] streak failed:', e);
    }
  }, []);

  // Initial load (plan + streak), auth-gated, cancellation-safe.
  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    const cancelled = { current: false };
    void loadPlan(cancelled);
    void loadStreak(cancelled);
    return () => { cancelled.current = true; };
  }, [isAuthenticated, loadPlan, loadStreak]);

  // Live header updates from the center's batched flushes.
  useEffect(() => {
    return wfRecitationCenter.subscribe((update) => {
      setToday(update.today);
      setPendingSync(!!update.pending);
    });
  }, []);

  // Flush any buffered events when the user leaves the page (in-app route
  // change; the center's own 'pagehide' listener covers tab close).
  useEffect(() => {
    return () => { void wfRecitationCenter.flushNow(); };
  }, []);

  // Refresh the streak once the stack completes (the first goal-met flush of
  // the day extends the streak server-side).
  const completed = !loading && !loadError && planSize > 0 && queue.length === 0;
  useEffect(() => {
    if (!completed) return;
    const cancelled = { current: false };
    void wfRecitationCenter.flushNow().then(() => loadStreak(cancelled));
    return () => { cancelled.current = true; };
  }, [completed, loadStreak]);

  // ---- Recite actions ----

  const reveal = useCallback(() => {
    if (!current || revealed) return;
    setRevealed(true);
    const key = current.word.toLowerCase();
    if (!readLoggedRef.current.has(key)) {
      readLoggedRef.current.add(key);
      wfRecitationCenter.recordAction(current.word, 'read', learningLanguage);
      setCounts((c) => ({ ...c, read: c.read + 1 }));
    }
  }, [current, revealed, learningLanguage]);

  const advance = useCallback((action: 'forgot' | 'know' | 'mastered') => {
    if (!current || !revealed) return;
    if (action === 'forgot') {
      wfRecitationCenter.recordAction(current.word, 'review_wrong', learningLanguage);
      setCounts((c) => ({ ...c, forgot: c.forgot + 1 }));
      // Re-queue to the back of today's stack for another pass.
      setQueue((q) => (q.length > 0 ? [...q.slice(1), q[0]] : q));
    } else if (action === 'know') {
      wfRecitationCenter.recordAction(current.word, 'review_correct', learningLanguage);
      setCounts((c) => ({ ...c, know: c.know + 1 }));
      setQueue((q) => q.slice(1));
    } else {
      wfRecitationCenter.recordAction(current.word, 'learn', learningLanguage);
      setCounts((c) => ({ ...c, mastered: c.mastered + 1 }));
      setQueue((q) => q.slice(1));
    }
    setRevealed(false);
    setCardSeq((s) => s + 1);
  }, [current, revealed, learningLanguage]);

  const playCurrent = useCallback(() => {
    if (!current) return;
    wfAudioCenter.playWord({ text: current.word, lang: learningLanguage });
  }, [current, learningLanguage]);

  // Desktop nicety: Space = reveal, 1/2/3 = forgot/know/mastered.
  useEffect(() => {
    if (!isAuthenticated || tab !== 'recite') return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || target?.isContentEditable) return;
      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        reveal();
      } else if (e.key === '1') {
        advance('forgot');
      } else if (e.key === '2') {
        advance('know');
      } else if (e.key === '3') {
        advance('mastered');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isAuthenticated, tab, reveal, advance]);

  // ---- History ----

  const openDaySummary = useCallback((date: string) => {
    setSummaryDate(date);
    setSummary(null);
    setSummaryError(null);
    setSummaryLoading(true);
    wfRecitationCenter.getSummary(date)
      .then((s) => {
        // Stale-response guard: only the latest tapped day may land.
        setSummaryDate((cur) => {
          if (cur === date) {
            setSummary(s);
            setSummaryLoading(false);
          }
          return cur;
        });
      })
      .catch((e: any) => {
        setSummaryDate((cur) => {
          if (cur === date) {
            setSummaryError(e?.message || t('recitation.summaryLoadFailed'));
            setSummaryLoading(false);
          }
          return cur;
        });
      });
  }, [t]);

  /** Last 35 days, oldest → newest, normalized for the heat strip. */
  const heatDays = useMemo(() => {
    const days = Array.isArray(streak?.days) ? [...streak!.days] : [];
    days.sort((a, b) => a.date.localeCompare(b.date));
    const max = days.reduce((m, d) => Math.max(m, d.unique_words || 0), 0);
    return days.slice(-35).map((d) => ({
      ...d,
      intensity: max > 0 && d.unique_words > 0 ? 0.3 + 0.7 * Math.min(1, d.unique_words / max) : 0,
    }));
  }, [streak]);

  const todayKey = planDate || new Date().toISOString().slice(0, 10);

  const heroDateLabel = useMemo(() => {
    const source = planDate ? new Date(`${planDate}T00:00:00`) : new Date();
    try {
      return source.toLocaleDateString(lang, { month: 'long', day: 'numeric', weekday: 'long' });
    } catch {
      return planDate || source.toDateString();
    }
  }, [planDate, lang]);

  const formatDayLabel = useCallback((date: string) => {
    try {
      return new Date(`${date}T00:00:00`).toLocaleDateString(lang, {
        year: 'numeric', month: 'long', day: 'numeric',
      });
    } catch {
      return date;
    }
  }, [lang]);

  // ---- Login gate (personal feature — same lock-card pattern as Review) ----
  if (!isAuthenticated) {
    return (
      <div className="ds-page route-fade min-h-screen bg-transparent pb-32 flex items-center justify-center">
        <Card className="mx-6 w-full max-w-sm text-center p-8 flex flex-col items-center">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] mb-4"
            style={{ background: 'var(--klein-blue-soft)' }}
          >
            <Icons.Lock />
          </div>
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-2">
            {t('recitation.loginTitle')}
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6">
            {t('recitation.loginDescription')}
          </p>
          <Button variant="grad" onClick={() => navigate(wfPath('auth/login'))}>
            {t('auth.login')}
          </Button>
        </Card>
      </div>
    );
  }

  const done = today?.unique_words ?? 0;
  const goal = today?.goal ?? 0;

  return (
    <div className="ds-page ds-section-gap route-fade min-h-screen bg-transparent pb-32">
      {/* Header hero — date, progress ring, streak flame */}
      <div className="pt-16 w-full">
        <div
          className="rounded-[var(--radius-card)] p-6 text-[color:var(--klein-on)] relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/15 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-8 w-36 h-36 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-white/80 text-xs font-semibold uppercase tracking-wide">{heroDateLabel}</p>
              <h1 className="text-[1.7rem] leading-tight font-black tracking-tight mt-1">
                {t('recitation.title')}
              </h1>
              <p className="text-white/80 text-sm font-medium mt-1">
                {t('recitation.progressLabel', { done, goal })}
              </p>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                  <Flame className="w-3.5 h-3.5" aria-hidden />
                  {t('recitation.streakDays', { count: streak?.current_streak ?? 0 })}
                </span>
                {today?.goal_met && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-bold backdrop-blur-sm">
                    <Check className="w-3.5 h-3.5" aria-hidden />
                    {t('recitation.goalMet')}
                  </span>
                )}
              </div>
              {streak && streak.longest_streak > 0 && (
                <p className="text-white/65 text-[11px] font-medium mt-2">
                  {t('recitation.longestStreak', { count: streak.longest_streak })}
                </p>
              )}
            </div>
            <ProgressRing done={done} goal={goal} className="text-white flex-shrink-0">
              <span className="text-base font-black rotate-0">
                {goal > 0 ? `${Math.round(Math.min(done / goal, 1) * 100)}%` : done}
              </span>
            </ProgressRing>
          </div>
        </div>
        {pendingSync && (
          <p className="text-xs text-[var(--color-text-tertiary)] mt-2 px-1">
            {t('recitation.pendingSync')}
          </p>
        )}
      </div>

      {/* Recite / History pill tabs */}
      <div className="ds-pill-nav" role="tablist" aria-label={t('recitation.title')}>
        {([
          { id: 'recite', label: t('recitation.tabRecite') },
          { id: 'history', label: t('recitation.tabHistory') },
        ] as const).map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`ds-pill-chip ${tab === item.id ? 'is-active' : ''}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* ---- RECITE FLOW ---- */}
      {tab === 'recite' && (
        <div className="w-full ds-section-gap">
          {loading ? (
            <div className="ds-card flex items-center justify-center p-12">
              <Spinner size="md" />
            </div>
          ) : loadError ? (
            <EmptyState
              icon={<X className="w-10 h-10 text-red-500" aria-hidden />}
              title={t('recitation.loadFailed')}
              description={loadError}
              action={
                <Button variant="secondary" className="!w-auto px-6 !py-2.5" onClick={() => void loadPlan()}>
                  {t('recitation.retry')}
                </Button>
              }
            />
          ) : planSize === 0 ? (
            <EmptyState
              icon={<CalendarDays className="w-10 h-10 text-[var(--klein-blue)]" aria-hidden />}
              title={t('recitation.emptyPlan')}
              description={t('recitation.emptyPlanHint')}
              action={
                <Button variant="secondary" className="!w-auto px-6 !py-2.5" onClick={() => navigate(wfPath('learn/library'))}>
                  {t('home.library')}
                </Button>
              }
            />
          ) : current ? (
            <>
              {/* Card stack — current card with stacked layers behind */}
              <div className="relative px-1">
                {queue.length > 2 && (
                  <div className="absolute inset-x-6 -bottom-3 h-full rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--border-highlight)] opacity-40 scale-[0.94] pointer-events-none" aria-hidden />
                )}
                {queue.length > 1 && (
                  <div className="absolute inset-x-3 -bottom-1.5 h-full rounded-[var(--radius-card)] bg-[var(--color-surface)] border border-[var(--border-highlight)] opacity-70 scale-[0.97] pointer-events-none" aria-hidden />
                )}
                <div
                  key={`${current.word}-${cardSeq}`}
                  role="button"
                  tabIndex={0}
                  onClick={reveal}
                  onKeyDown={(e) => { if (e.key === 'Enter') reveal(); }}
                  className={`ds-card ds-card-elevated route-fade relative p-6 min-h-[19rem] flex flex-col ${revealed ? '' : 'cursor-pointer'}`}
                  aria-label={revealed ? current.word : t('recitation.tapToReveal')}
                >
                  <div className="flex items-center justify-between gap-2">
                    {current.source === 'due' ? (
                      <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                        {t('recitation.sourceDue')}
                      </Badge>
                    ) : (
                      <Badge className="bg-indigo-500/15 text-indigo-500 dark:text-indigo-400">
                        {t('recitation.sourceNew')}
                      </Badge>
                    )}
                    <span className="text-xs font-semibold text-[var(--color-text-tertiary)]">
                      {t('recitation.remaining', { count: queue.length })}
                    </span>
                  </div>

                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-4">
                    <h2 className="text-[2.2rem] leading-tight font-black tracking-tight text-[var(--color-text-primary)] break-words max-w-full">
                      {current.word}
                    </h2>
                    {current.phonetic && (
                      <p className="text-base font-medium text-[var(--color-text-secondary)]">
                        {current.phonetic}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); playCurrent(); }}
                      className="w-11 h-11 rounded-full bg-[var(--klein-blue-soft)] flex items-center justify-center text-[var(--klein-blue)] hover:bg-[var(--klein-blue)] hover:text-[var(--klein-on)] transition-all active:scale-95"
                      aria-label={t('recitation.playAudio')}
                      title={t('recitation.playAudio')}
                    >
                      <Volume2 className="w-5 h-5" aria-hidden />
                    </button>

                    {revealed ? (
                      <div className="route-fade mt-2 w-full">
                        <div className="border-t border-[var(--border-highlight)] pt-4">
                          <p className="text-lg font-semibold text-[var(--color-text-primary)] break-words">
                            {current.translation || t('recitation.noTranslation')}
                          </p>
                          {current.personal && current.personal.reviewed > 0 && (
                            <p className="text-xs text-[var(--color-text-tertiary)] mt-2">
                              {t('recitation.timesReviewed', { count: current.personal.reviewed })}
                            </p>
                          )}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-[var(--color-text-tertiary)] mt-2">
                        {t('recitation.tapToReveal')}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Action row — enabled once the meaning is revealed */}
              <div className="grid grid-cols-3 gap-3 px-1">
                <button
                  type="button"
                  disabled={!revealed}
                  onClick={() => advance('forgot')}
                  className="ds-card !p-4 flex flex-col items-center gap-1.5 font-bold text-red-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
                >
                  <RotateCcw className="w-5 h-5" aria-hidden />
                  <span className="text-sm">{t('recitation.forgot')}</span>
                </button>
                <button
                  type="button"
                  disabled={!revealed}
                  onClick={() => advance('know')}
                  className="ds-card !p-4 flex flex-col items-center gap-1.5 font-bold text-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
                >
                  <Check className="w-5 h-5" aria-hidden />
                  <span className="text-sm">{t('recitation.know')}</span>
                </button>
                <button
                  type="button"
                  disabled={!revealed}
                  onClick={() => advance('mastered')}
                  className="ds-card !p-4 flex flex-col items-center gap-1.5 font-bold text-[var(--klein-blue)] disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.97] transition-transform"
                >
                  <GraduationCap className="w-5 h-5" aria-hidden />
                  <span className="text-sm">{t('recitation.mastered')}</span>
                </button>
              </div>

              {/* Desktop keyboard hint */}
              <p className="hidden md:flex items-center justify-center gap-1.5 text-xs text-[var(--color-text-tertiary)]">
                <Keyboard className="w-3.5 h-3.5" aria-hidden />
                {t('recitation.keyboardHint')}
              </p>
            </>
          ) : (
            /* ---- Completion state — stack cleared ---- */
            <Card className="route-fade text-center p-8 flex flex-col items-center">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center text-[color:var(--klein-blue)] mb-4"
                style={{ background: 'var(--klein-blue-soft)' }}
              >
                <Trophy className="w-8 h-8" aria-hidden />
              </div>
              <h2 className="text-2xl font-black tracking-tight text-[var(--color-text-primary)] mb-1">
                {t('recitation.completeTitle')}
              </h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6">
                {today?.goal_met ? t('recitation.completeGoalMet') : t('recitation.completeKeepGoing')}
              </p>
              <div className="grid grid-cols-4 gap-2 w-full mb-6">
                {([
                  { label: t('recitation.statRead'), value: counts.read },
                  { label: t('recitation.statKnow'), value: counts.know },
                  { label: t('recitation.statForgot'), value: counts.forgot },
                  { label: t('recitation.statMastered'), value: counts.mastered },
                ] as const).map((s) => (
                  <div key={s.label} className="rounded-2xl border border-[var(--border-highlight)] py-3 px-1">
                    <p className="text-xl font-black text-[var(--color-text-primary)] leading-none">{s.value}</p>
                    <p className="text-[10px] text-[var(--color-text-secondary)] mt-1 truncate">{s.label}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 w-full">
                <Button variant="secondary" className="flex-1" onClick={() => void loadPlan()}>
                  {t('recitation.reviewAgain')}
                </Button>
                <Button variant="grad" className="flex-1" onClick={() => navigate(wfPath('learn'))}>
                  {t('recitation.backToLearn')}
                </Button>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---- HISTORY — 35-day heat strip + per-day summary sheet ---- */}
      {tab === 'history' && (
        <div className="w-full ds-section-gap">
          <div className="ds-card p-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="ds-section-title">{t('recitation.last35Days')}</h2>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-[var(--color-text-secondary)]">
                <Flame className="w-3.5 h-3.5 text-orange-500" aria-hidden />
                {streak?.current_streak ?? 0}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4">
              {t('recitation.historyHint')}
            </p>
            {heatDays.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="w-10 h-10 text-[var(--klein-blue)]" aria-hidden />}
                title={t('recitation.noActivity')}
                className="!py-8"
              />
            ) : (
              <div className="grid grid-cols-7 gap-1.5">
                {heatDays.map((d) => {
                  const isToday = d.date === todayKey;
                  return (
                    <button
                      key={d.date}
                      type="button"
                      onClick={() => openDaySummary(d.date)}
                      title={`${d.date} · ${d.unique_words}`}
                      aria-label={`${d.date} · ${d.unique_words}`}
                      className={`aspect-square rounded-lg border transition-transform active:scale-90 ${
                        isToday ? 'ring-2 ring-[var(--klein-blue)] ring-offset-1' : ''
                      } ${d.intensity > 0 ? 'border-transparent' : 'border-[var(--border-highlight)]'}`}
                      style={
                        d.intensity > 0
                          ? { background: 'var(--klein-blue)', opacity: d.intensity }
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Per-day summary bottom sheet */}
      <Sheet open={summaryDate !== null} onClose={() => setSummaryDate(null)} position="bottom">
        <div className="pb-2">
          <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-1">
            {summaryDate ? formatDayLabel(summaryDate) : ''}
          </h2>
          {summaryLoading ? (
            <div className="flex items-center justify-center py-10">
              <Spinner size="sm" />
            </div>
          ) : summaryError ? (
            <p className="text-sm text-red-500 py-4">{summaryError}</p>
          ) : summary ? (
            <>
              <div className="flex items-center gap-2 mb-4 flex-wrap">
                <Badge tone="klein">
                  {t('recitation.wordsRecited', { count: summary.unique_words })}
                </Badge>
                <Badge tone="neutral">
                  {t('recitation.actionsCount', { count: summary.actions })}
                </Badge>
                {summary.goal_met && (
                  <Badge tone="success">
                    <Check className="w-3 h-3" aria-hidden /> {t('recitation.goalMet')}
                  </Badge>
                )}
              </div>
              {summary.words.length === 0 ? (
                <p className="text-sm text-[var(--color-text-secondary)] py-4">
                  {t('recitation.noActivity')}
                </p>
              ) : (
                <div className="max-h-[50vh] overflow-y-auto flex flex-col gap-2">
                  {summary.words.map((w) => (
                    <div
                      key={w.word}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-highlight)] px-4 py-3"
                    >
                      <span className="font-bold text-sm text-[var(--color-text-primary)] truncate">
                        {w.word}
                      </span>
                      <span className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                        {w.actions.map((a, i) => (
                          <Badge key={`${a}-${i}`} tone={ACTION_TONE[a] || 'neutral'} className="!px-2 !py-0.5 !text-[10px]">
                            {t(`recitation.action_${a}`)}
                          </Badge>
                        ))}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
};

export default WfDailyRecitationPage;
