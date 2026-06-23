/* [v4.1-Iris] Study History — ported from
 * poly_apps/qy_capacitor/pages/Stats/History.tsx, upgraded from the original's
 * mock data to the real quiz history: records come from
 * wfQuizHistoryCenter.getAll() (persisted by the quiz runner) and the summary
 * row from wfQuizHistoryCenter.getStats(). Consistency heatmap = quizzes per
 * day over the last 30 days; recent sessions list = the stored records.
 * Self-contained: react-router useNavigate + wfPath() back to the stats
 * dashboard. Reference-faithful Iris look (design-reference-{light,dark}.webp). */
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, BackButton, SectionTitle, Stat, LoadingState, EmptyState, Icons } from '../WfUI';
import { wfPath } from '../WfBottomTabNav';
import { useWfT } from '../WfAppContext';
import { wfQuizHistoryCenter, WfQuizRecord } from '../services/WfQuizHistoryCenter';

interface HistorySummary {
  totalQuizzes: number;
  averageScore: number;
  bestScore: number;
  streak: number;
}

/** Local-day key (yyyy-mm-dd) for bucketing records into heatmap cells. */
function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const WfStatsHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useWfT();

  const [records, setRecords] = useState<WfQuizRecord[]>([]);
  const [summary, setSummary] = useState<HistorySummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [all, stats] = await Promise.all([
          wfQuizHistoryCenter.getAll(),
          wfQuizHistoryCenter.getStats(),
        ]);
        if (!cancelled) {
          setRecords(Array.isArray(all) ? all : []);
          setSummary(stats);
        }
      } catch (error) {
        console.error('[WfStatsHistory] Failed to load quiz history:', error);
        if (!cancelled) {
          setRecords([]);
          setSummary(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, []);

  // Consistency heatmap: quizzes per local day over the last 30 days
  // (oldest → newest), intensity scaled 0..4.
  const quizzesPerDay = new Map<string, number>();
  for (const r of records) {
    const d = new Date(r.date);
    if (Number.isNaN(d.getTime())) continue;
    const key = dayKey(d);
    quizzesPerDay.set(key, (quizzesPerDay.get(key) || 0) + 1);
  }
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const count = quizzesPerDay.get(dayKey(d)) || 0;
    return { date: d, intensity: Math.min(count, 4) };
  });

  const getIntensityStyle = (i: number): React.CSSProperties => {
    switch (i) {
      case 1: return { background: 'color-mix(in srgb, var(--klein-blue) 25%, transparent)' };
      case 2: return { background: 'color-mix(in srgb, var(--klein-blue) 50%, transparent)' };
      case 3: return { background: 'color-mix(in srgb, var(--klein-blue) 75%, transparent)' };
      case 4: return { background: 'var(--klein-blue)' };
      default: return {};
    }
  };

  const accuracyOf = (r: WfQuizRecord): number =>
    typeof r.accuracy === 'number' && Number.isFinite(r.accuracy)
      ? r.accuracy
      : r.total > 0 ? (r.score / r.total) * 100 : 0;

  const formatWhen = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const today = new Date();
    const sameDay =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return sameDay ? `Today, ${time}` : `${d.toLocaleDateString()}, ${time}`;
  };

  const formatDuration = (ms?: number): string | null => {
    if (!ms || ms <= 0) return null;
    const mins = Math.round(ms / 60000);
    return mins > 0 ? `${mins} min${mins > 1 ? 's' : ''}` : `${Math.round(ms / 1000)}s`;
  };

  const modeLabel = (r: WfQuizRecord): string => (r.mode ? r.mode : t('nav.quiz') || 'Quiz');

  return (
    <div className="ds-page ds-section-gap h-full flex flex-col pt-12 animate-slide-up pb-24">
      <div className="flex items-center gap-3">
        <BackButton onClick={() => navigate(wfPath('stats'))} />
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Study History</h1>
      </div>

      {loading ? (
        <LoadingState label={t('common.loading') || 'Loading…'} />
      ) : (
        <>
          {/* Summary — aggregated from the stored quiz history */}
          {summary && (
            <div className="ds-grid-breathing grid grid-cols-2">
              <Card className="!p-4">
                <Stat value={summary.totalQuizzes} label="Total Quizzes" accent />
              </Card>
              <Card className="!p-4">
                <Stat value={summary.streak} label={t('stats.dayStreak') || 'Day Streak'} accent />
              </Card>
              <Card className="!p-4">
                <Stat value={`${summary.averageScore.toFixed(1)}%`} label={`Avg. ${t('stats.accuracy') || 'Accuracy'}`} accent />
              </Card>
              <Card className="!p-4">
                <Stat value={`${summary.bestScore.toFixed(0)}%`} label="Best Score" accent />
              </Card>
            </div>
          )}

          <Card className="!p-6">
            <SectionTitle title="Consistency Heatmap" className="mb-4" />
            <div className="grid grid-cols-7 gap-2">
              {days.map((d, i) => (
                <div
                  key={i}
                  title={`${d.date.toLocaleDateString()}`}
                  className={`aspect-square rounded-md ${d.intensity === 0 ? 'bg-[var(--border-highlight)]' : ''}`}
                  style={getIntensityStyle(d.intensity)}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-[var(--color-text-tertiary)] mt-3 font-medium">
              <span>Less</span>
              <span>More</span>
            </div>
          </Card>

          <div>
            <SectionTitle title="Recent Sessions" className="mb-3 px-1" />
            {records.length === 0 ? (
              <EmptyState
                icon={<Icons.Chart />}
                title={t('review.noStats') || 'No stats yet'}
                description={t('review.noStatsHint') || 'Start learning to build your memory stats'}
              />
            ) : (
              <div className="ds-stack ds-stack-tight overflow-y-auto no-scrollbar">
                {records.slice(0, 20).map((r) => {
                  const acc = accuracyOf(r);
                  const duration = formatDuration(r.durationMs);
                  return (
                    <div key={r.id} className="ds-row flex justify-between items-center p-4 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs text-[var(--klein-blue)] flex-shrink-0"
                          style={{ background: 'var(--klein-blue-soft)' }}
                        >
                          QZ
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[var(--color-text-primary)] truncate">{modeLabel(r)}</h4>
                          <p className="text-xs text-[var(--color-text-secondary)]">{formatWhen(r.date)}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className={`font-bold ${acc >= 60 ? 'text-emerald-500' : 'text-red-500'}`}>
                          {r.score}/{r.total} · {acc.toFixed(0)}%
                        </div>
                        {duration && (
                          <div className="text-xs text-[var(--color-text-tertiary)]">{duration}</div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default WfStatsHistoryPage;
