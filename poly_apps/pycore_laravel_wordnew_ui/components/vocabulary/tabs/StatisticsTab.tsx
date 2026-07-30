import React from 'react';
import { RefreshCw, Eye, BarChart3, Sliders } from 'lucide-react';
import { commonClasses } from '../../../styles/theme';
import { LoadingBlock, EmptyState } from '../../common';
import { CollapsibleSection } from '../CollapsibleSection';

interface StatisticsTabProps {
  statistics: any;
  loadingStatistics: boolean;
  statsLanguageFilter: string;
  setStatsLanguageFilter: (v: string) => void;
  statsFilterOpen: boolean;
  setStatsFilterOpen: (updater: (v: boolean) => boolean) => void;
  loadStatistics: (filter: string) => void;
  openLibrariesDrill: () => void;
  openDictionaryDrill: (
    label: string,
    filter: 'all' | 'with_translation' | 'without_translation' | 'invalid' | 'with_audio' | 'without_audio',
    language?: string
  ) => void;
  openLanguageRowDrill: (languageName: string) => void;
  setWordModalLanguage: (v: string) => void;
  setWordModalOpen: (v: boolean) => void;
}

/** Statistics tab body: language filter, summary cards, dictionary-level totals, language breakdown table. */
const StatisticsTab: React.FC<StatisticsTabProps> = ({
  statistics,
  loadingStatistics,
  statsLanguageFilter,
  setStatsLanguageFilter,
  statsFilterOpen,
  setStatsFilterOpen,
  loadStatistics,
  openLibrariesDrill,
  openDictionaryDrill,
  openLanguageRowDrill,
  setWordModalLanguage,
  setWordModalOpen,
}) => {
  return (
      <>
      {/* Collapsible language-filter side panel (secondary settings) */}
      <CollapsibleSection
        title="Filters"
        icon={<Sliders className="w-4 h-4 text-indigo-500" />}
        open={statsFilterOpen}
        onToggle={() => setStatsFilterOpen((v) => !v)}
        className="mb-4"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <label className="text-xs text-slate-500 dark:text-slate-400">Language</label>
          <select
            value={statsLanguageFilter}
            onChange={(e) => setStatsLanguageFilter(e.target.value)}
            className={`${commonClasses.input} text-sm`}
          >
            <option value="all">All languages</option>
            <option value="english">English</option>
            <option value="chinese">Chinese</option>
            <option value="japanese">Japanese</option>
            <option value="korean">Korean</option>
            <option value="french">French</option>
            <option value="german">German</option>
            <option value="spanish">Spanish</option>
          </select>
          <button
            onClick={() => loadStatistics(statsLanguageFilter)}
            disabled={loadingStatistics}
            className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
          >
            <RefreshCw className={`w-3 h-3 ${loadingStatistics ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </CollapsibleSection>

      {/* Statistics Section */}
      {(statistics || loadingStatistics) ? (
        <div className={`${commonClasses.card} p-4 mb-4`}>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <h3 className="font-semibold text-lg">Vocabulary Statistics</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadStatistics(statsLanguageFilter)}
                disabled={loadingStatistics}
                className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${loadingStatistics ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>

          {loadingStatistics && !statistics ? (
            <LoadingBlock size="lg" className="py-12" />
          ) : statistics ? (
            <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">
                {statistics.summary?.total_languages || 0}
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Languages Supported</div>
            </div>
            <button
              type="button"
              onClick={openLibrariesDrill}
              className="text-left bg-green-50 dark:bg-green-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
            >
              <div className="text-2xl font-bold text-green-700 dark:text-green-400 flex items-center gap-1">
                {(statistics.summary?.total_libraries || 0).toLocaleString()}
                <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Total Libraries</div>
            </button>
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <button
                type="button"
                className="w-full text-left"
                onClick={() => {
                  const lang = statsLanguageFilter === 'all' ? 'english' : statsLanguageFilter;
                  setWordModalLanguage(lang);
                  setWordModalOpen(true);
                }}
              >
                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400 underline decoration-dotted">
                  {(statistics.summary?.total_words || 0).toLocaleString()}
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-400">Total Words</div>
              </button>
            </div>
            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
                {statistics.summary?.tts_percentage || 0}%
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">TTS Coverage</div>
            </div>
          </div>

          {/* Dictionary-level totals: distinct words, translation coverage, validity */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <button
              type="button"
              onClick={() => openDictionaryDrill('Dictionary Words', 'all')}
              className="text-left bg-slate-50 dark:bg-slate-800/40 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
            >
              <div className="text-2xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                {(statistics.summary?.total_dictionary_words || 0).toLocaleString()}
                <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Dictionary Words</div>
            </button>
            <button
              type="button"
              onClick={() => openDictionaryDrill('With Translation', 'with_translation')}
              className="text-left bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
            >
              <div className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                {(statistics.summary?.total_with_translation || 0).toLocaleString()}
                <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">With Translation</div>
            </button>
            <button
              type="button"
              onClick={() => openDictionaryDrill('Without Translation', 'without_translation')}
              className="text-left bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
            >
              <div className="text-2xl font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                {(statistics.summary?.total_without_translation || 0).toLocaleString()}
                <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">Without Translation</div>
            </button>
            <button
              type="button"
              onClick={() => openDictionaryDrill('Invalid Words', 'invalid')}
              className="text-left bg-rose-50 dark:bg-rose-900/20 rounded-lg p-4 cursor-pointer hover:ring-2 hover:ring-indigo-400/40 transition group"
            >
              <div className="text-2xl font-bold text-rose-700 dark:text-rose-400 flex items-center gap-1">
                {(statistics.summary?.total_invalid_words || 0).toLocaleString()}
                <Eye className="w-3.5 h-3.5 opacity-0 group-hover:opacity-50" />
              </div>
              <div className="text-xs text-slate-600 dark:text-slate-400">
                Invalid Words
                {statistics.summary?.total_validity_checked != null && (
                  <span className="ml-1 text-slate-400">
                    ({(statistics.summary?.total_validity_checked || 0).toLocaleString()} checked)
                  </span>
                )}
              </div>
            </button>
          </div>

          {/* Language Breakdown - total table */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Language Breakdown</h4>
            {statistics.languages && statistics.languages.length > 0 ? (
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Language</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Words</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Translated</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">No Translation</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Valid</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Invalid</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Libraries</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">TTS</th>
                      <th className="text-right py-2 px-3 font-semibold text-slate-700 dark:text-slate-300">Translation %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statistics.languages.map((lang: any, idx: number) => {
                      const words = (lang.dictionary_words ?? 0) > 0 ? lang.dictionary_words : (lang.total_words || 0);
                      return (
                      <tr
                        key={idx}
                        onClick={() => openLanguageRowDrill(lang.language)}
                        className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 cursor-pointer hover:bg-indigo-50/50 dark:hover:bg-indigo-900/10 transition"
                      >
                        <td className="py-2 px-3 font-medium text-slate-800 dark:text-slate-200">
                          <span className="inline-flex items-center gap-1 underline decoration-dotted">
                            {lang.language}
                            <Eye className="w-3 h-3 opacity-40" />
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-slate-700 dark:text-slate-300 font-medium">{(words || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-emerald-600 dark:text-emerald-400">{(lang.with_translation || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">{(lang.without_translation || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-600 dark:text-slate-400">{(lang.valid_words ?? words ?? 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400">{(lang.invalid_words || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-slate-500 dark:text-slate-500">{(lang.libraries_count || 0).toLocaleString()}</td>
                        <td className="py-2 px-3 text-right text-green-600 dark:text-green-400">{lang.tts_percentage ?? 0}%</td>
                        <td className="py-2 px-3 text-right text-purple-600 dark:text-purple-400">{lang.review_percentage ?? 0}%</td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-2">No language data for the selected filter.</p>
            )}
          </div>
            </>
          ) : null}
        </div>
      ) : (
        <div className={`${commonClasses.card} p-8 mb-4`}>
          <EmptyState icon={BarChart3} message="No statistics available yet." />
        </div>
      )}
      </>
  );
};

export default StatisticsTab;
