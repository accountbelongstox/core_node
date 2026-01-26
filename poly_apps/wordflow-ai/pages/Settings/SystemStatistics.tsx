import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../contexts/AppContext';
import { Card, Icons } from '../../components/UI';
import { ApiCenter } from '../../services/ApiCenter';
import { ApiTestingCenter } from '../../components/ApiTestingCenter';

const SystemStatisticsPage = () => {
  const { navigate, t } = useContext(AppContext);
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
      if (response.success && response.data) {
        setSummary(response.data);
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
      if (response.success && response.data) {
        setLanguages(response.data);
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
      if (response.success && response.data) {
        setQueues(response.data);
        setShowQueues(true);
      }
    } catch (error) {
      console.error('Failed to load queues:', error);
    } finally {
      setLoadingQueues(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 pb-24">
      {/* Header */}
      <div className="pt-20 px-6 pb-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={() => navigate('settings')}
            className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
          >
            <Icons.Back />
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            System Statistics
          </h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">
          Real-time backend system statistics
        </p>
      </div>

      <div className="px-6 space-y-6">
        {/* Summary Section - Always Loaded */}
        {loadingSummary ? (
          <Card className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-center py-8">
              <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          </Card>
        ) : summary && (
          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 border border-blue-200 dark:border-slate-700">
            <h3 className="font-bold text-slate-900 dark:text-white mb-4">Summary</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{summary.total_languages}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Languages</div>
              </div>
              <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{formatNumber(summary.total_words)}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Words</div>
              </div>
              <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">{formatNumber(summary.total_sentences)}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Sentences</div>
              </div>
              <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">{formatNumber(summary.total_articles)}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Articles</div>
              </div>
              <div className="bg-white dark:bg-slate-700 rounded-lg p-4">
                <div className="text-2xl font-bold text-pink-600 dark:text-pink-400">{formatNumber(summary.total_audio)}</div>
                <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Audio</div>
              </div>
            </div>
          </Card>
        )}

        {/* Languages Section - Load on Demand */}
        <Card 
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all"
          onClick={loadLanguages}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">Language Statistics</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Click to load detailed language breakdown</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {loadingLanguages && (
                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <Icons.ChevronRight className={`transition-transform ${showLanguages ? 'rotate-90' : ''}`} />
            </div>
          </div>
        </Card>

        {showLanguages && languages && languages.length > 0 && (
          <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800 border border-purple-200 dark:border-slate-700">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">By Language</h4>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {languages.map((lang: any, index: number) => (
                <div key={index} className="bg-white dark:bg-slate-700 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-900 dark:text-white uppercase">{lang.language_code}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">Words</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{formatNumber(lang.words)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">Sentences</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{formatNumber(lang.sentences)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">Articles</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{formatNumber(lang.articles)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500 dark:text-slate-400">Audio</div>
                      <div className="font-semibold text-slate-900 dark:text-white">{formatNumber(lang.audio)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* API Testing Center - Click to Open Modal */}
        <Card 
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all"
          onClick={() => setShowApiTesting(true)}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">API Testing Center</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Click to open API endpoint testing and monitoring</span>
              </div>
            </div>
            <Icons.ChevronRight />
          </div>
        </Card>

        {/* Queues Section - Load on Demand */}
        <Card 
          className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 cursor-pointer hover:border-blue-500 dark:hover:border-blue-500 transition-all"
          onClick={loadQueues}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">Processing Queues</span>
                <span className="text-xs text-slate-500 dark:text-slate-400">Click to load queue statistics</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {loadingQueues && (
                <svg className="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <Icons.ChevronRight className={`transition-transform ${showQueues ? 'rotate-90' : ''}`} />
            </div>
          </div>
        </Card>

        {showQueues && queues && (
          <div className="space-y-4">
            {/* TTS Queue */}
            {queues.tts && (
              <Card className="bg-white dark:bg-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <h5 className="font-semibold text-slate-900 dark:text-white">TTS Audio Generation Queue</h5>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Pending</div>
                    <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{formatNumber(queues.tts.pending)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Processing</div>
                    <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatNumber(queues.tts.processing)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Completed</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatNumber(queues.tts.completed)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Failed</div>
                    <div className="text-lg font-bold text-red-600 dark:text-red-400">{formatNumber(queues.tts.failed)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Total</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(queues.tts.total)}</div>
                  </div>
                </div>
              </Card>
            )}

            {/* Audio Storage Statistics */}
            {queues.audio_storage && (
              <Card className="bg-white dark:bg-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                  </svg>
                  <h5 className="font-semibold text-slate-900 dark:text-white">Audio File Storage</h5>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Total Size</div>
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">
                      {queues.audio_storage.formatted_size || 
                        (queues.audio_storage.total_size_gb >= 1 
                          ? `${queues.audio_storage.total_size_gb.toFixed(2)} GB`
                          : `${queues.audio_storage.total_size_mb.toFixed(2)} MB`)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">Valid Files</div>
                    <div className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(queues.audio_storage.total_files)}</div>
                  </div>
                </div>
                {queues.audio_storage.zero_byte_files !== undefined && queues.audio_storage.zero_byte_files > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                    <div className="flex items-center gap-2 text-sm">
                      <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <span className="text-yellow-600 dark:text-yellow-400">
                        {queues.audio_storage.zero_byte_files} zero-byte files found (may be incomplete)
                      </span>
                    </div>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-600">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Size (MB):</span>
                      <span className="ml-2 font-semibold text-slate-900 dark:text-white">{queues.audio_storage.total_size_mb.toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Size (GB):</span>
                      <span className="ml-2 font-semibold text-slate-900 dark:text-white">{queues.audio_storage.total_size_gb.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Translation Queue */}
            {queues.translation && (
              <Card className="bg-white dark:bg-slate-700 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                  </svg>
                  <h5 className="font-semibold text-slate-900 dark:text-white">Translation Status</h5>
                </div>
                <div className="space-y-4">
                  {/* Words Statistics */}
                  <div>
                    <h6 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Words</h6>
                    <div className="grid grid-cols-2 gap-3 mb-2">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Total Words</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-white">{formatNumber(queues.translation.total_words || 0)}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">Complete Words</div>
                        <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatNumber(queues.translation.complete_words || 0)}</div>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Word Completion Rate</div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                          <div 
                            className="bg-green-600 h-2 rounded-full transition-all"
                            style={{ width: `${Math.min(queues.translation.completion_rate || 0, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-sm font-semibold text-slate-900 dark:text-white">{queues.translation.completion_rate || 0}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Sentences Statistics */}
                  {queues.translation.total_sentences !== undefined && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-600">
                      <h6 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Sentences</h6>
                      <div className="grid grid-cols-2 gap-3 mb-2">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Total Sentences</div>
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{formatNumber(queues.translation.total_sentences)}</div>
                        </div>
                        {queues.translation.complete_sentences !== undefined && (
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Complete Sentences</div>
                            <div className="text-lg font-bold text-green-600 dark:text-green-400">{formatNumber(queues.translation.complete_sentences)}</div>
                          </div>
                        )}
                      </div>
                      {queues.translation.sentence_completion_rate !== undefined && (
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Sentence Completion Rate</div>
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                              <div 
                                className="bg-purple-600 h-2 rounded-full transition-all"
                                style={{ width: `${Math.min(queues.translation.sentence_completion_rate, 100)}%` }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{queues.translation.sentence_completion_rate}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Missing Breakdown */}
                  {queues.translation.missing_breakdown && (
                    <div className="pt-3 border-t border-slate-200 dark:border-slate-600">
                      <h6 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Missing Data Breakdown</h6>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Missing Translation (Words)</div>
                          <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">{formatNumber(queues.translation.missing_breakdown.translation || 0)}</div>
                          {queues.translation.missing_percentages?.translation !== undefined && (
                            <div className="text-xs text-slate-400 dark:text-slate-500">{queues.translation.missing_percentages.translation}%</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Missing Phonetic</div>
                          <div className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">{formatNumber(queues.translation.missing_breakdown.phonetic || 0)}</div>
                          {queues.translation.missing_percentages?.phonetic !== undefined && (
                            <div className="text-xs text-slate-400 dark:text-slate-500">{queues.translation.missing_percentages.phonetic}%</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Missing Audio (Words)</div>
                          <div className="text-sm font-semibold text-pink-600 dark:text-pink-400">{formatNumber(queues.translation.missing_breakdown.audio || 0)}</div>
                          {queues.translation.missing_percentages?.audio !== undefined && (
                            <div className="text-xs text-slate-400 dark:text-slate-500">{queues.translation.missing_percentages.audio}%</div>
                          )}
                        </div>
                        <div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">Missing Images</div>
                          <div className="text-sm font-semibold text-blue-600 dark:text-blue-400">{formatNumber(queues.translation.missing_breakdown.images || 0)}</div>
                          {queues.translation.missing_percentages?.images !== undefined && (
                            <div className="text-xs text-slate-400 dark:text-slate-500">{queues.translation.missing_percentages.images}%</div>
                          )}
                        </div>
                        {queues.translation.missing_breakdown.sentence_translation !== undefined && (
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Missing Translation (Sentences)</div>
                            <div className="text-sm font-semibold text-orange-600 dark:text-orange-400">{formatNumber(queues.translation.missing_breakdown.sentence_translation)}</div>
                            {queues.translation.missing_percentages?.sentence_translation !== undefined && (
                              <div className="text-xs text-slate-400 dark:text-slate-500">{queues.translation.missing_percentages.sentence_translation}%</div>
                            )}
                          </div>
                        )}
                        {queues.translation.missing_breakdown.sentence_audio !== undefined && (
                          <div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">Missing Audio (Sentences)</div>
                            <div className="text-sm font-semibold text-pink-600 dark:text-pink-400">{formatNumber(queues.translation.missing_breakdown.sentence_audio)}</div>
                            {queues.translation.missing_percentages?.sentence_audio !== undefined && (
                              <div className="text-xs text-slate-400 dark:text-slate-500">{queues.translation.missing_percentages.sentence_audio}%</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </Card>
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

