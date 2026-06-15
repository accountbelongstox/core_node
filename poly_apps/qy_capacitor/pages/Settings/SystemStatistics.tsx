/* [v4.1-Iris] Redesigned to match public/design-reference-{light,dark}.webp. Verified reference parity. Some sibling/imported code may still be un-beautified — propagate the Iris layer there too. */
import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons, Spinner, BackButton, ProgressBar, Stat, SectionTitle } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
import { ApiTestingCenter } from '../../components/ApiTestingCenter';

const SystemStatisticsPage = () => {
  const { navigate } = useContext(AppContext);
  const [summary, setSummary] = useState<any>(null);
  const [languages, setLanguages] = useState<any[] | null>(null);
  const [queues, setQueues] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [loadingQueues, setLoadingQueues] = useState(false);
  const [showLanguages, setShowLanguages] = useState(false);
  const [showQueues, setShowQueues] = useState(false);
  const [showApiTesting, setShowApiTesting] = useState(false);

  useEffect(() => {
    loadSummary();
  }, []);

  const loadSummary = async () => {
    setLoadingSummary(true);
    try {
      const response = await ApiCenter.system.getSystemStatisticsSummary();
      if (response.success) {
        // Backend may return a non-JSON / non-object body (observed
        // "Non-JSON body status 200"); normalize so property reads can't throw.
        const obj =
          response.data && typeof response.data === 'object' && !Array.isArray(response.data)
            ? response.data
            : {};
        setSummary(obj);
      }
    } catch (error) {
      console.error('Failed to load summary:', error);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadLanguages = async () => {
    if (languages !== null) {
      setShowLanguages(!showLanguages);
      return;
    }

    setLoadingLanguages(true);
    try {
      const response = await ApiCenter.system.getSystemStatisticsLanguages();
      if (response.success) {
        // Normalize: guarantee an array so `.map` / `.length` can't throw.
        const arr = Array.isArray(response.data) ? response.data : [];
        setLanguages(arr);
        setShowLanguages(true);
      }
    } catch (error) {
      console.error('Failed to load languages:', error);
    } finally {
      setLoadingLanguages(false);
    }
  };

  const loadQueues = async () => {
    // If already showing, just toggle visibility
    if (showQueues) {
      setShowQueues(false);
      return;
    }

    // Always reload data when expanding
    setLoadingQueues(true);
    try {
      const response = await ApiCenter.system.getSystemStatisticsQueues(true);
      if (response.success) {
        // Normalize: guarantee an object so nested reads can't throw.
        const obj =
          response.data && typeof response.data === 'object' && !Array.isArray(response.data)
            ? response.data
            : {};
        setQueues(obj);
        setShowQueues(true);
      }
    } catch (error) {
      console.error('Failed to load queues:', error);
    } finally {
      setLoadingQueues(false);
    }
  };

  const formatNumber = (num: number): string => {
    const n = typeof num === 'number' && isFinite(num) ? num : 0;
    if (n >= 1000000) {
      return (n / 1000000).toFixed(1) + 'M';
    }
    if (n >= 1000) {
      return (n / 1000).toFixed(1) + 'K';
    }
    return n.toString();
  };

  // Single metric tile as a breathing card (no dense grid cells)
  const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="ds-card p-5">
      <Stat value={value} label={label} accent />
    </div>
  );

  return (
    <div className="ds-aura-bg min-h-screen pb-28">
      <div className="ds-aura-overlay" />

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] pt-[var(--page-padding-v)] pb-[var(--space-breath)]">
        {/* Minimal asymmetric header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[2rem] leading-[1.15] font-black tracking-tight text-[var(--color-text-primary)]">
            System Statistics
          </h1>
          <BackButton onClick={() => navigate('settings')} />
        </div>

        {/* Overview — gradient hero card */}
        <div
          className="rounded-[var(--radius-card)] p-6 text-white relative overflow-hidden"
          style={{ background: 'var(--klein-gradient)', boxShadow: 'var(--klein-grad-glow)' }}
        >
          <div className="absolute -top-12 -right-10 w-44 h-44 bg-white/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-14 -left-10 w-40 h-40 bg-white/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative">
            <div className="w-14 h-14 bg-white/15 rounded-2xl flex items-center justify-center mb-4">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="font-bold text-lg mb-1">Backend Overview</h3>
            <p className="text-white/80 text-sm">Real-time backend system statistics</p>
          </div>
        </div>
      </div>

      <div className="relative w-full max-w-md mx-auto px-[var(--page-padding-h)] ds-section-gap">
        {/* Summary Section - Always Loaded */}
        {loadingSummary ? (
          <Card>
            <div className="flex items-center justify-center py-8">
              <Spinner />
            </div>
          </Card>
        ) : summary && (
          <div className="ds-stack-tight flex flex-col">
            <SectionTitle title="Summary" className="px-1 mb-1" />
            <div className="ds-grid-breathing grid-cols-2">
              <Metric label="Languages" value={summary.total_languages ?? 0} />
              <Metric label="Words" value={formatNumber(summary.total_words)} />
              <Metric label="Sentences" value={formatNumber(summary.total_sentences)} />
              <Metric label="Articles" value={formatNumber(summary.total_articles)} />
              <Metric label="Audio" value={formatNumber(summary.total_audio)} />
            </div>
          </div>
        )}

        {/* Languages Section - Load on Demand */}
        <div
          className="ds-row p-4 cursor-pointer ds-touch-target flex items-center justify-between gap-3"
          onClick={loadLanguages}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 bg-[var(--klein-blue-soft)] rounded-xl flex items-center justify-center text-[var(--klein-blue)] flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
              </svg>
            </span>
            <div className="min-w-0">
              <span className="font-semibold text-[var(--color-text-primary)] block truncate">Language Statistics</span>
              <span className="text-xs text-[var(--color-text-secondary)]">Detailed language breakdown</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {loadingLanguages && <Spinner size="sm" />}
            <span className={`text-[var(--color-text-tertiary)] transition-transform ${showLanguages ? 'rotate-90' : ''}`}>
              <Icons.ChevronRight />
            </span>
          </div>
        </div>

        {showLanguages && Array.isArray(languages) && languages.length > 0 && (
          <div className="ds-stack-tight flex flex-col">
            <SectionTitle title="By Language" className="px-1 mb-1" />
            <div className="ds-stack-tight flex flex-col max-h-96 overflow-y-auto no-scrollbar">
              {languages.map((lang: any, index: number) => (
                <div key={index} className="ds-row p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-[var(--color-text-primary)] uppercase">{lang?.language_code ?? '—'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <div className="text-[var(--color-text-tertiary)]">Words</div>
                      <div className="font-semibold text-[var(--color-text-primary)]">{formatNumber(lang?.words)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--color-text-tertiary)]">Sentences</div>
                      <div className="font-semibold text-[var(--color-text-primary)]">{formatNumber(lang?.sentences)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--color-text-tertiary)]">Articles</div>
                      <div className="font-semibold text-[var(--color-text-primary)]">{formatNumber(lang?.articles)}</div>
                    </div>
                    <div>
                      <div className="text-[var(--color-text-tertiary)]">Audio</div>
                      <div className="font-semibold text-[var(--color-text-primary)]">{formatNumber(lang?.audio)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* API Testing Center - Click to Open Modal */}
        <div
          className="ds-row p-4 cursor-pointer ds-touch-target flex items-center justify-between gap-3"
          onClick={() => setShowApiTesting(true)}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 bg-[var(--klein-blue-soft)] rounded-xl flex items-center justify-center text-[var(--klein-blue)] flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
              </svg>
            </span>
            <div className="min-w-0">
              <span className="font-semibold text-[var(--color-text-primary)] block truncate">API Testing Center</span>
              <span className="text-xs text-[var(--color-text-secondary)]">Endpoint testing and monitoring</span>
            </div>
          </div>
          <span className="text-[var(--color-text-tertiary)] flex-shrink-0"><Icons.ChevronRight /></span>
        </div>

        {/* Queues Section - Load on Demand */}
        <div
          className="ds-row p-4 cursor-pointer ds-touch-target flex items-center justify-between gap-3"
          onClick={loadQueues}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 bg-[var(--klein-blue-soft)] rounded-xl flex items-center justify-center text-[var(--klein-blue)] flex-shrink-0 shadow-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </span>
            <div className="min-w-0">
              <span className="font-semibold text-[var(--color-text-primary)] block truncate">Processing Queues</span>
              <span className="text-xs text-[var(--color-text-secondary)]">Queue statistics</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {loadingQueues && <Spinner size="sm" />}
            <span className={`text-[var(--color-text-tertiary)] transition-transform ${showQueues ? 'rotate-90' : ''}`}>
              <Icons.ChevronRight />
            </span>
          </div>
        </div>

        {showQueues && queues && (
          <div className="ds-section-gap">
            {/* TTS Queue */}
            {queues.tts && (
              <div className="ds-stack-tight flex flex-col">
                <SectionTitle title="TTS Audio Generation Queue" className="px-1 mb-1" />
                <div className="ds-grid-breathing grid-cols-2">
                  <Metric label="Pending" value={formatNumber(queues.tts.pending)} />
                  <Metric label="Processing" value={formatNumber(queues.tts.processing)} />
                  <Metric label="Completed" value={formatNumber(queues.tts.completed)} />
                  <Metric label="Failed" value={formatNumber(queues.tts.failed)} />
                  <Metric label="Total" value={formatNumber(queues.tts.total)} />
                </div>
              </div>
            )}

            {/* Audio Storage Statistics */}
            {queues.audio_storage && (
              <div className="ds-stack-tight flex flex-col">
                <SectionTitle title="Audio File Storage" className="px-1 mb-1" />
                <div className="ds-grid-breathing grid-cols-2">
                  <Metric
                    label="Total Size"
                    value={queues.audio_storage.formatted_size ||
                      ((queues.audio_storage.total_size_gb ?? 0) >= 1
                        ? `${(queues.audio_storage.total_size_gb ?? 0).toFixed(2)} GB`
                        : `${(queues.audio_storage.total_size_mb ?? 0).toFixed(2)} MB`)}
                  />
                  <Metric label="Valid Files" value={formatNumber(queues.audio_storage.total_files)} />
                </div>
                {queues.audio_storage.zero_byte_files !== undefined && queues.audio_storage.zero_byte_files > 0 && (
                  <div className="ds-row p-4 flex items-center gap-2 text-sm">
                    <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="text-yellow-600 dark:text-yellow-400">
                      {queues.audio_storage.zero_byte_files} zero-byte files found (may be incomplete)
                    </span>
                  </div>
                )}
                <div className="ds-grid-breathing grid-cols-2">
                  <Metric label="Size (MB)" value={(queues.audio_storage.total_size_mb ?? 0).toFixed(2)} />
                  <Metric label="Size (GB)" value={(queues.audio_storage.total_size_gb ?? 0).toFixed(2)} />
                </div>
              </div>
            )}

            {/* Translation Queue */}
            {queues.translation && (
              <div className="ds-stack-tight flex flex-col">
                <SectionTitle title="Translation Status" className="px-1 mb-1" />

                {/* Words Statistics */}
                <div className="ds-card p-6 space-y-4">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Words</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">Total Words</div>
                      <div className="text-lg font-bold text-[var(--color-text-primary)]">{formatNumber(queues.translation.total_words || 0)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-text-tertiary)]">Complete Words</div>
                      <div className="text-lg font-bold text-[var(--klein-blue)]">{formatNumber(queues.translation.complete_words || 0)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Word Completion Rate</div>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={Math.min(queues.translation.completion_rate || 0, 100)} className="flex-1" />
                      <span className="text-sm font-semibold text-[var(--color-text-primary)]">{queues.translation.completion_rate || 0}%</span>
                    </div>
                  </div>
                </div>

                {/* Sentences Statistics */}
                {queues.translation.total_sentences !== undefined && (
                  <div className="ds-card p-6 space-y-4">
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Sentences</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <div className="text-xs text-[var(--color-text-tertiary)]">Total Sentences</div>
                        <div className="text-lg font-bold text-[var(--klein-blue)]">{formatNumber(queues.translation.total_sentences)}</div>
                      </div>
                      {queues.translation.complete_sentences !== undefined && (
                        <div>
                          <div className="text-xs text-[var(--color-text-tertiary)]">Complete Sentences</div>
                          <div className="text-lg font-bold text-[var(--klein-blue)]">{formatNumber(queues.translation.complete_sentences)}</div>
                        </div>
                      )}
                    </div>
                    {queues.translation.sentence_completion_rate !== undefined && (
                      <div>
                        <div className="text-xs text-[var(--color-text-tertiary)] mb-1">Sentence Completion Rate</div>
                        <div className="flex items-center gap-2">
                          <ProgressBar value={Math.min(queues.translation.sentence_completion_rate, 100)} className="flex-1" />
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{queues.translation.sentence_completion_rate}%</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Missing Breakdown */}
                {queues.translation.missing_breakdown && (
                  <div className="ds-stack-tight flex flex-col">
                    <SectionTitle title="Missing Data Breakdown" className="px-1 mb-1" />
                    <div className="ds-grid-breathing grid-cols-2">
                      <div className="ds-card p-5">
                        <div className="text-xs text-[var(--color-text-tertiary)]">Missing Translation (Words)</div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{formatNumber(queues.translation.missing_breakdown.translation || 0)}</div>
                        {queues.translation.missing_percentages?.translation !== undefined && (
                          <div className="text-xs text-[var(--color-text-tertiary)]">{queues.translation.missing_percentages.translation}%</div>
                        )}
                      </div>
                      <div className="ds-card p-5">
                        <div className="text-xs text-[var(--color-text-tertiary)]">Missing Phonetic</div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{formatNumber(queues.translation.missing_breakdown.phonetic || 0)}</div>
                        {queues.translation.missing_percentages?.phonetic !== undefined && (
                          <div className="text-xs text-[var(--color-text-tertiary)]">{queues.translation.missing_percentages.phonetic}%</div>
                        )}
                      </div>
                      <div className="ds-card p-5">
                        <div className="text-xs text-[var(--color-text-tertiary)]">Missing Audio (Words)</div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{formatNumber(queues.translation.missing_breakdown.audio || 0)}</div>
                        {queues.translation.missing_percentages?.audio !== undefined && (
                          <div className="text-xs text-[var(--color-text-tertiary)]">{queues.translation.missing_percentages.audio}%</div>
                        )}
                      </div>
                      <div className="ds-card p-5">
                        <div className="text-xs text-[var(--color-text-tertiary)]">Missing Images</div>
                        <div className="text-sm font-semibold text-[var(--color-text-primary)]">{formatNumber(queues.translation.missing_breakdown.images || 0)}</div>
                        {queues.translation.missing_percentages?.images !== undefined && (
                          <div className="text-xs text-[var(--color-text-tertiary)]">{queues.translation.missing_percentages.images}%</div>
                        )}
                      </div>
                      {queues.translation.missing_breakdown.sentence_translation !== undefined && (
                        <div className="ds-card p-5">
                          <div className="text-xs text-[var(--color-text-tertiary)]">Missing Translation (Sentences)</div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{formatNumber(queues.translation.missing_breakdown.sentence_translation)}</div>
                          {queues.translation.missing_percentages?.sentence_translation !== undefined && (
                            <div className="text-xs text-[var(--color-text-tertiary)]">{queues.translation.missing_percentages.sentence_translation}%</div>
                          )}
                        </div>
                      )}
                      {queues.translation.missing_breakdown.sentence_audio !== undefined && (
                        <div className="ds-card p-5">
                          <div className="text-xs text-[var(--color-text-tertiary)]">Missing Audio (Sentences)</div>
                          <div className="text-sm font-semibold text-[var(--color-text-primary)]">{formatNumber(queues.translation.missing_breakdown.sentence_audio)}</div>
                          {queues.translation.missing_percentages?.sentence_audio !== undefined && (
                            <div className="text-xs text-[var(--color-text-tertiary)]">{queues.translation.missing_percentages.sentence_audio}%</div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* API Testing Center Modal */}
      {showApiTesting && (
        <ApiTestingCenter onClose={() => setShowApiTesting(false)} />
      )}
    </div>
  );
};

export default SystemStatisticsPage;
