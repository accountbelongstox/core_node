import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProjectDetail, CmMilestone } from '../api/CmApiTypes';
import { cmErrorCode, cmErrorMessage } from '../api/cmErrors';
import { useCmFormat } from '../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import type { CmFeedback } from './cmFeedback';

const OWNER_ROLE = 'owner';
export const CM_FUNDING_PENDING_STATUS = 'funding_pending';
const NOT_FOUND_STATUS = 404;
const FORBIDDEN_STATUS = 403;
const EMPTY_MILESTONES: CmMilestone[] = [];

export interface CmProjectDetailModel {
  project: CmProjectDetail | null;
  loading: boolean;
  loadError: string | null;
  notFound: boolean;
  forbidden: boolean;
  /** Reload the project only. */
  load: () => Promise<void>;
  /** Reload the project and the bootstrap (capabilities, counters). */
  reloadAll: () => Promise<void>;
  retry: () => void;
  isOwner: boolean;
  canManage: boolean;
  readOnly: boolean;
  closed: boolean;
  publishable: boolean;
  currentUserId: number | null;
  milestones: CmMilestone[];
  nextAction: string;
  architectLabel: string;
  publishing: boolean;
  transition: (toStatus: string, reason: string) => Promise<boolean>;
  publish: () => Promise<boolean>;
}

/** One project with the viewer's access, state transitions and publication. */
export function useCmProjectDetail(projectId: number, feedback: CmFeedback): CmProjectDetailModel {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { bootstrap, refresh, terminalStates, stateRule } = useCmBootstrap();
  const [project, setProject] = useState<CmProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async (): Promise<void> => {
    if (!Number.isFinite(projectId)) {
      setNotFound(true);
      setLoading(false);
      return;
    }
    const response = await cmApi.getProject(projectId);
    if (response.success && response.data) {
      setProject(response.data);
      setLoadError(null);
      setNotFound(false);
    } else {
      setNotFound(response.status === NOT_FOUND_STATUS || cmErrorCode(response) === 'project_not_found');
      setForbidden(response.status === FORBIDDEN_STATUS);
      setLoadError(cmErrorMessage(t, response, 'projectDetail.loadFailed'));
    }
    setLoading(false);
  }, [projectId, t]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const reloadAll = useCallback(async (): Promise<void> => {
    await load();
    await refresh();
  }, [load, refresh]);

  const retry = useCallback((): void => {
    setLoading(true);
    void load();
  }, [load]);

  const access = project?.access;
  const isOwner = access?.role === OWNER_ROLE;
  const canManage = access?.can_manage === true;
  const closed = project ? terminalStates('project').includes(project.status) : false;
  const publishable = project ? stateRule('project_task_publishable').includes(project.status) && !project.published_at : false;
  const currentUserId = bootstrap?.user.id ?? null;
  const nextAction = project && isOwner ? t(`projects.nextAction.${project.status}`, { defaultValue: '' }) : '';
  const architectLabel = !project?.architect_id
    ? t('projectDetail.unassigned')
    : (project.architect_id === currentUserId ? t('projectDetail.architectYou') : t('projectDetail.architectAssigned'));

  const transition = useCallback(async (toStatus: string, reason: string): Promise<boolean> => {
    if (!project) return false;
    feedback.clear();
    const response = await cmApi.transitionProject(project.id, toStatus, reason);
    if (response.success) {
      const refundedAmount = response.data?.side_effects?.escrow_refund?.refunded_amount;
      const refunded = refundedAmount && Number(refundedAmount) > 0
        ? t('transitions.escrowRefunded', { amount: format.money(refundedAmount, project.currency) })
        : '';
      feedback.success([t('transitions.projectDone', { status: t(`states.project.${toStatus}`, { defaultValue: toStatus }) }), refunded].filter(Boolean).join(' '));
      await reloadAll();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'transitions.failed'));
    return false;
  }, [project, feedback, format, reloadAll, t]);

  const publish = useCallback(async (): Promise<boolean> => {
    if (!project) return false;
    setPublishing(true);
    feedback.clear();
    const response = await cmApi.publishProject(project.id);
    setPublishing(false);
    if (response.success) {
      feedback.success(t('projects.published'));
      await reloadAll();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'projects.publishFailed'));
    return false;
  }, [project, feedback, reloadAll, t]);

  return {
    project, loading, loadError, notFound, forbidden, load, reloadAll, retry,
    isOwner, canManage, readOnly: access?.read_only === true, closed, publishable, currentUserId,
    milestones: project?.milestones ?? EMPTY_MILESTONES, nextAction, architectLabel, publishing, transition, publish,
  };
}
