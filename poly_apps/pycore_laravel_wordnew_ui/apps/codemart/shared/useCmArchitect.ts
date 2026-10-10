import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import type { APIResponse } from '../../../core/integrations/laravel/transport/TransportTypes';
import { cmApi } from '../api/CmApi';
import type { CmArchitectEligibility, CmArchitectTasks } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import type { CmFeedback } from './cmFeedback';

const PENDING_STATUS = 'pending';
export const CM_ARCHITECT_METRIC_STAT_KEYS: Record<string, string> = {
  min_completed_projects: 'completed_projects',
  min_avg_code_score: 'avg_code_score',
  min_client_satisfaction: 'avg_client_satisfaction',
};

export interface CmArchitectModel {
  eligibility: CmArchitectEligibility | null;
  assignments: CmArchitectTasks | null;
  loading: boolean;
  loadError: string | null;
  loadRetryable: boolean;
  pendingActivation: boolean;
  isArchitect: boolean;
  busy: boolean;
  acceptingId: number | null;
  load: () => Promise<void>;
  apply: () => Promise<void>;
  completeActivation: () => Promise<void>;
  acceptProject: (projectId: number) => Promise<void>;
}

/** Architect eligibility, application and activation, assigned and available projects, accepting a project. */
export function useCmArchitect(feedback: CmFeedback): CmArchitectModel {
  const { t } = useTranslation('cm');
  const { refresh } = useCmBootstrap();
  const [eligibility, setEligibility] = useState<CmArchitectEligibility | null>(null);
  const [assignments, setAssignments] = useState<CmArchitectTasks | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadRetryable, setLoadRetryable] = useState(true);

  const load = useCallback(async (): Promise<void> => {
    setLoading(true);
    const [eligibilityResponse, tasksResponse] = await Promise.all([
      cmApi.getArchitectEligibility(),
      cmApi.getArchitectTasks(),
    ]);
    if (eligibilityResponse.success && eligibilityResponse.data) {
      setEligibility(eligibilityResponse.data);
      setLoadError(null);
      setLoadRetryable(true);
    } else {
      setLoadError(cmErrorMessage(t, eligibilityResponse, 'architect.loadFailed'));
      setLoadRetryable(eligibilityResponse.status !== 403 && eligibilityResponse.status !== 404);
    }
    if (tasksResponse.success && tasksResponse.data) setAssignments(tasksResponse.data);
    setLoading(false);
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const pendingActivation = eligibility?.architect_status === PENDING_STATUS;
  const isArchitect = eligibility?.is_architect === true || assignments?.is_architect === true;

  const runAction = useCallback(async (action: () => Promise<APIResponse<unknown>>, successKey: string, failKey: string): Promise<void> => {
    setBusy(true);
    feedback.clear();
    const result = await action();
    setBusy(false);
    if (result.success) {
      feedback.success(t(successKey));
      await refresh();
    } else {
      feedback.error(cmErrorMessage(t, result, failKey));
    }
    await load();
  }, [feedback, refresh, load, t]);

  const apply = useCallback(() => runAction(() => cmApi.applyArchitect(), 'architect.applied', 'architect.applyFailed'), [runAction]);
  const completeActivation = useCallback(() => runAction(() => cmApi.completeArchitectDeposit(), 'architect.activated', 'architect.activationFailed'), [runAction]);

  const acceptProject = useCallback(async (projectId: number): Promise<void> => {
    setAcceptingId(projectId);
    feedback.clear();
    const response = await cmApi.acceptArchitectTask(projectId);
    setAcceptingId(null);
    if (response.success) feedback.success(t('architect.projectAccepted'));
    else feedback.error(cmErrorMessage(t, response, 'architect.acceptFailed'));
    await load();
  }, [feedback, load, t]);

  return { eligibility, assignments, loading, loadError, loadRetryable, pendingActivation, isArchitect, busy, acceptingId, load, apply, completeActivation, acceptProject };
}
