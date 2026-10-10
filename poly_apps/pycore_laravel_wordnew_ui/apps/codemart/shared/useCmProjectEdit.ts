import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmProjectDetail } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { cmJoinList, cmShortDate, cmSplitList } from '../components/workspace/cmWorkspaceFormat';
import { useCmPolicy } from '../contexts/useCmPolicy';
import type { CmFeedback } from './cmFeedback';
import { CM_DEFAULT_COMPLEXITY, CM_STACK_FIELDS, type CmStackDraft } from './cmProjectForm';

/** Mirrors the server: scope fields change only before the proposal is accepted. */
const SCOPE_EDITABLE_STATUSES = new Set(['draft', 'proposal_review']);

export interface CmProjectEditModel {
  scopeEditable: boolean;
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  complexity: string;
  setComplexity: (value: string) => void;
  budget: string;
  setBudget: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  stack: CmStackDraft;
  setStackField: (field: keyof CmStackDraft, value: string) => void;
  budgetInvalid: boolean;
  endInvalid: boolean;
  invalid: boolean;
  projectMinBudget: number;
  busy: boolean;
  save: () => Promise<boolean>;
}

/** Edit form of a project; the scope fields (budget, dates, stack) lock once the proposal is accepted. */
export function useCmProjectEdit(project: CmProjectDetail, onSaved: () => Promise<void>, feedback: CmFeedback): CmProjectEditModel {
  const { t } = useTranslation('cm');
  const { projectMinBudget } = useCmPolicy();
  const scopeEditable = SCOPE_EDITABLE_STATUSES.has(project.status);
  const [title, setTitle] = useState(project.title);
  const [description, setDescription] = useState(project.description);
  const [complexity, setComplexity] = useState<string>(project.complexity ?? CM_DEFAULT_COMPLEXITY);
  const [budget, setBudget] = useState(project.budget ?? '');
  const [startDate, setStartDate] = useState(cmShortDate(project.start_date));
  const [endDate, setEndDate] = useState(cmShortDate(project.end_date));
  const [stack, setStack] = useState<CmStackDraft>({
    skills: cmJoinList(project.skills),
    languages: cmJoinList(project.languages),
    frameworks: cmJoinList(project.frameworks),
    databases: cmJoinList(project.databases),
  });
  const [busy, setBusy] = useState(false);

  const budgetInvalid = scopeEditable && (!budget || Number(budget) < projectMinBudget);
  const endInvalid = scopeEditable && startDate !== '' && endDate !== '' && endDate <= startDate;
  const invalid = !title.trim() || !description.trim() || budgetInvalid || endInvalid;

  const setStackField = useCallback((field: keyof CmStackDraft, value: string): void => {
    setStack((current) => ({ ...current, [field]: value }));
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (busy || invalid) return false;
    setBusy(true);
    feedback.clear();
    const payload: Record<string, unknown> = { title: title.trim(), description: description.trim() };
    if (scopeEditable) {
      payload.complexity = complexity;
      payload.budget = Number(budget);
      payload.start_date = startDate || null;
      payload.end_date = endDate || null;
      CM_STACK_FIELDS.forEach((field) => {
        payload[field] = cmSplitList(stack[field]);
      });
    }
    const response = await cmApi.updateProject(project.id, payload);
    setBusy(false);
    if (response.success) {
      feedback.success(t('projectDetail.saved'));
      await onSaved();
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'projectDetail.saveFailed'));
    return false;
  }, [busy, invalid, feedback, title, description, scopeEditable, complexity, budget, startDate, endDate, stack, project.id, onSaved, t]);

  return {
    scopeEditable, title, setTitle, description, setDescription, complexity, setComplexity, budget, setBudget,
    startDate, setStartDate, endDate, setEndDate, stack, setStackField, budgetInvalid, endInvalid, invalid, projectMinBudget, busy, save,
  };
}
