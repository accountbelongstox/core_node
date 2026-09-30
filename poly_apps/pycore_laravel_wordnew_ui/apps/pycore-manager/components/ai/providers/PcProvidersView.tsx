/**
 * PcProvidersView — the "Providers & Keys" tab: the AI provider grid (status,
 * tier, rate budget, key rotation, Test / Test image through the hub test popup,
 * Test all) above the provider key console.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Activity, AlertTriangle, ArrowDown, ArrowUp, BrainCircuit, RefreshCcw, Wand2,
} from 'lucide-react';
import { useAiHubCatalog } from '@/apps/pycore-manager/api';
import type { AiProvider } from '@/apps/pycore-manager/api';
import {
  usePcProviders, type ProviderSortField,
} from '../../../hooks/usePcProviders';
import PcAiKeysView from '../../PcAiKeysView';
import { PcTestChip } from '../test/PcTestChip';
import { PcProviderCard } from './PcProviderCard';

const SORT_FIELDS: Array<{ field: Exclude<ProviderSortField, 'original'>; labelKey: string }> = [
  { field: 'availability', labelKey: 'aiStatus.sortAvailability' },
  { field: 'name', labelKey: 'aiStatus.sortName' },
  { field: 'speed', labelKey: 'aiStatus.sortSpeed' },
];
const CATEGORY_AI_TEXT = 'ai_text';
const CATEGORY_AI_IMAGE = 'ai_image';

const PcProvidersView: React.FC<{ refreshSignal?: number }> = ({ refreshSignal }) => {
  const { t } = useTranslation('pc');
  const catalog = useAiHubCatalog();
  const state = usePcProviders(refreshSignal);
  const list = state.providers ?? [];

  const renderActions = (provider: AiProvider) => {
    const textEntry = catalog.find(provider.name, CATEGORY_AI_TEXT) ?? catalog.find(provider.name);
    const imageEntry = provider.image ? (catalog.find(provider.name, CATEGORY_AI_IMAGE) ?? textEntry) : null;
    return (
      <>
        {textEntry && <PcTestChip entry={textEntry} disabled={state.testingAll || !provider.configured} />}
        {imageEntry && (
          <PcTestChip
            entry={imageEntry}
            label={t('aiHub.providers.testImage')}
            Icon={Wand2}
            disabled={!provider.image_ready}
          />
        )}
      </>
    );
  };

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {state.error && (
        <div className="flex items-start gap-2 text-xs rounded-2xl p-3 border bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="break-words">{t(`aiHub.providers.error.${state.error}`)}</span>
        </div>
      )}
      {state.notice && <p className="text-[11px] text-indigo-500 break-words">{state.notice}</p>}

      <section className="pc-glass p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <h2 className="text-sm font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <BrainCircuit className="w-4 h-4 text-indigo-500" /> {t('aiStatus.aiProviders')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{t('aiStatus.aiProvidersHint')}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-0.5">{t('common.sort')}</span>
              {SORT_FIELDS.map(({ field, labelKey }) => {
                const active = state.sortField === field;
                const SortIcon = state.sortDir === 'asc' ? ArrowUp : ArrowDown;
                return (
                  <button
                    key={field}
                    type="button"
                    onClick={() => state.toggleSort(field)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition border ${
                      active
                        ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-600 dark:text-indigo-300'
                        : 'pc-glass border-transparent text-slate-500 hover:bg-indigo-500/10'
                    }`}>
                    {t(labelKey)}
                    {active && <SortIcon className="w-3 h-3" />}
                  </button>
                );
              })}
              {state.sortField !== 'original' && (
                <button
                  type="button"
                  onClick={state.resetSort}
                  className="px-2 py-1 rounded-lg text-[10px] font-bold text-slate-400 hover:text-indigo-500 transition">
                  {t('common.resetOrder')}
                </button>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => { void state.testAll(); }}
            disabled={state.testingAll || state.loading || list.length === 0}
            title={t('aiStatus.testAllTitle')}
            className="shrink-0 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition disabled:opacity-50">
            <Activity className={`w-3.5 h-3.5 ${state.testingAll ? 'animate-pulse' : ''}`} />
            {state.testingAll ? t('common.testing') : t('common.testAll')}
          </button>
        </div>

        {state.loading && list.length === 0 ? (
          <div className="text-xs text-slate-500 py-8 text-center flex flex-col items-center gap-2">
            <RefreshCcw className="w-5 h-5 animate-spin text-slate-400" /> {t('aiStatus.loadingProviders')}
          </div>
        ) : list.length === 0 ? (
          <div className="text-xs text-slate-500 py-6 text-center border border-dashed border-slate-300 dark:border-white/10 rounded-2xl mt-3">
            {t('aiStatus.noProviders')}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-3">
            {list.map((provider) => (
              <PcProviderCard
                key={provider.name}
                provider={provider}
                resetting={state.resetting[provider.name]}
                onResetCooldown={state.resetCooldown}
                actions={renderActions(provider)}
              />
            ))}
          </div>
        )}
      </section>

      <PcAiKeysView refreshSignal={refreshSignal} />
    </div>
  );
};

export default PcProvidersView;
