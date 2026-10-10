import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { cmPublicApi, type CmEstimateLimits, type CmEstimateOptions, type CmPublicEstimateResult } from '../api/CmPublicApi';

export interface CmEstimateDraft {
  complexity: string;
  budgetType: string;
  platforms: string;
  features: string;
}

export type CmEstimateCountField = 'platforms' | 'features';

export const CM_ESTIMATE_HOURLY_BUDGET_TYPE = 'hourly';
export const CM_ESTIMATE_COUNT_FIELDS: readonly CmEstimateCountField[] = ['platforms', 'features'];

function clampCount(value: string, limits: CmEstimateLimits): string {
  const parsed = value.trim() === '' ? Number.NaN : Number(value);
  return String(Math.max(limits.min, Math.min(limits.max, Number.isFinite(parsed) ? Math.round(parsed) : limits.min)));
}

function clampDraft(draft: CmEstimateDraft, options: CmEstimateOptions): CmEstimateDraft {
  return {
    ...draft,
    platforms: clampCount(draft.platforms, options.platforms),
    features: clampCount(draft.features, options.features),
  };
}

function initialDraft(options: CmEstimateOptions): CmEstimateDraft {
  return {
    complexity: options.default_complexity,
    budgetType: options.default_budget_type,
    platforms: String(options.platforms.default),
    features: String(options.features.default),
  };
}

export interface CmEstimateModel {
  options: CmEstimateOptions | null;
  optionsLoading: boolean;
  optionsError: string | null;
  retryOptions: () => void;
  draft: CmEstimateDraft | null;
  result: CmPublicEstimateResult | null;
  pending: boolean;
  error: string | null;
  currency: string | null;
  isHourly: boolean;
  teamRoles: Array<{ role: string; count: number }>;
  updateDraft: (patch: Partial<CmEstimateDraft>) => void;
  commitCount: (field: CmEstimateCountField) => void;
  submit: () => void;
}

/**
 * Public project-estimate state. Options and limits come from Laravel, which
 * owns the rates and policy; the UI only renders the returned ranges.
 */
export function useCmEstimate(): CmEstimateModel {
  const { t } = useTranslation('cm');
  const [options, setOptions] = useState<CmEstimateOptions | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const [draft, setDraft] = useState<CmEstimateDraft | null>(null);
  const [result, setResult] = useState<CmPublicEstimateResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runEstimate = useCallback(async (next: CmEstimateDraft) => {
    setPending(true);
    setError(null);
    const response = await cmPublicApi.estimate({
      complexity: next.complexity,
      platforms: Number(next.platforms),
      features: Number(next.features),
      budget_type: next.budgetType || undefined,
    });
    if (response.success && response.data) {
      setResult(response.data);
    } else {
      setResult(null);
      setError(cmErrorMessage(t, response, 'estimate.failed'));
    }
    setPending(false);
  }, [t]);

  useEffect(() => {
    let active = true;
    setOptionsLoading(true);
    setOptionsError(null);
    void cmPublicApi.getEstimateOptions().then((response) => {
      if (!active) return;
      setOptionsLoading(false);
      if (!response.success || !response.data) {
        setOptionsError(cmErrorMessage(t, response, 'estimate.optionsFailed'));
        return;
      }
      const nextDraft = initialDraft(response.data);
      setOptions(response.data);
      setDraft(nextDraft);
      void runEstimate(nextDraft);
    });
    return () => {
      active = false;
    };
    // Options load once per explicit retry; translations must not refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsAttempt]);

  const updateDraft = useCallback((patch: Partial<CmEstimateDraft>): void => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }, []);

  const commitCount = useCallback((field: CmEstimateCountField): void => {
    if (!options) return;
    setDraft((current) => (current ? { ...current, [field]: clampCount(current[field], options[field]) } : current));
  }, [options]);

  const submit = useCallback((): void => {
    if (!draft || !options) return;
    const next = clampDraft(draft, options);
    setDraft(next);
    void runEstimate(next);
  }, [draft, options, runEstimate]);

  const retryOptions = useCallback((): void => setOptionsAttempt((current) => current + 1), []);

  const teamRoles = result?.team_roles && result.team_roles.length > 0
    ? result.team_roles
    : (result?.recommended_team ?? []).map((role) => ({ role, count: 1 }));

  return {
    options,
    optionsLoading,
    optionsError,
    retryOptions,
    draft,
    result,
    pending,
    error,
    currency: result?.currency || options?.currency || null,
    isHourly: result?.budget_type === CM_ESTIMATE_HOURLY_BUDGET_TYPE,
    teamRoles,
    updateDraft,
    commitCount,
    submit,
  };
}
