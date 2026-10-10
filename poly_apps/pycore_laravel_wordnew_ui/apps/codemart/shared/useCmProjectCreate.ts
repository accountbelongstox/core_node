import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import { cmErrorMessage } from '../api/cmErrors';
import { cmSplitList } from '../components/workspace/cmWorkspaceFormat';
import { useCmBootstrap } from '../contexts/CmBootstrapContext';
import { useCmPolicy } from '../contexts/useCmPolicy';
import type { CmFeedback } from './cmFeedback';
import {
  CM_DEFAULT_BUDGET_TYPE,
  CM_DEFAULT_COMPLEXITY,
  CM_PROJECT_TITLE_MAX_LENGTH,
  CM_STACK_FIELDS,
  cmEmptyStackDraft,
  type CmStackDraft,
} from './cmProjectForm';

export type CmCreateField = 'title' | 'description' | 'budget' | 'endDate';

export interface CmProjectCreateForm {
  title: string;
  description: string;
  complexity: string;
  budget: string;
  budgetType: string;
  startDate: string;
  endDate: string;
  stack: CmStackDraft;
}

export interface CmProjectCreateModel {
  form: CmProjectCreateForm;
  update: (patch: Partial<CmProjectCreateForm>) => void;
  updateStack: (field: keyof CmStackDraft, value: string) => void;
  errors: Partial<Record<CmCreateField, string>>;
  /** Errors are shown only after the first submit attempt (or `reveal`). */
  showError: (field: CmCreateField) => string | undefined;
  reveal: () => void;
  submitted: boolean;
  canCreate: boolean;
  pending: boolean;
  currency: string;
  projectMinBudget: number;
  /** Creates the project; resolves to its id, or null when invalid or failed. */
  submit: () => Promise<number | null>;
}

const initialForm = (): CmProjectCreateForm => ({
  title: '',
  description: '',
  complexity: CM_DEFAULT_COMPLEXITY,
  budget: '',
  budgetType: CM_DEFAULT_BUDGET_TYPE,
  startDate: '',
  endDate: '',
  stack: cmEmptyStackDraft(),
});

/** Create-project form state, validation against the server policy and submission. */
export function useCmProjectCreate(feedback: CmFeedback): CmProjectCreateModel {
  const { t } = useTranslation('cm');
  const { hasCapability, refresh } = useCmBootstrap();
  const { currency, projectMinBudget } = useCmPolicy();
  const canCreate = hasCapability('project.create');
  const [form, setForm] = useState<CmProjectCreateForm>(initialForm);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const update = useCallback((patch: Partial<CmProjectCreateForm>): void => setForm((current) => ({ ...current, ...patch })), []);
  const updateStack = useCallback((field: keyof CmStackDraft, value: string): void => {
    setForm((current) => ({ ...current, stack: { ...current.stack, [field]: value } }));
  }, []);

  const errors = useMemo(() => {
    const result: Partial<Record<CmCreateField, string>> = {};
    if (!form.title.trim()) result.title = t('projectCreate.errors.titleRequired');
    else if (form.title.length > CM_PROJECT_TITLE_MAX_LENGTH) result.title = t('projectCreate.errors.titleTooLong', { max: CM_PROJECT_TITLE_MAX_LENGTH });
    if (!form.description.trim()) result.description = t('projectCreate.errors.descriptionRequired');
    if (!form.budget || Number(form.budget) < projectMinBudget) result.budget = t('projectCreate.errors.budgetMin', { amount: projectMinBudget, currency });
    if (form.startDate && form.endDate && form.endDate <= form.startDate) result.endDate = t('projectCreate.errors.endAfterStart');
    return result;
  }, [form, projectMinBudget, currency, t]);

  const showError = useCallback((field: CmCreateField): string | undefined => (submitted ? errors[field] : undefined), [submitted, errors]);
  const reveal = useCallback((): void => setSubmitted(true), []);

  const submit = useCallback(async (): Promise<number | null> => {
    setSubmitted(true);
    if (!canCreate || pending || Object.keys(errors).length > 0) return null;
    setPending(true);
    feedback.clear();
    const response = await cmApi.createProject({
      title: form.title.trim(),
      description: form.description.trim(),
      complexity: form.complexity,
      budget: Number(form.budget),
      budget_type: form.budgetType,
      currency,
      start_date: form.startDate || null,
      end_date: form.endDate || null,
      ...Object.fromEntries(CM_STACK_FIELDS.map((field) => [field, cmSplitList(form.stack[field])])),
    });
    setPending(false);
    if (response.success && response.data) {
      await refresh();
      return response.data.id;
    }
    feedback.error(cmErrorMessage(t, response, 'projectCreate.createFailed'));
    return null;
  }, [canCreate, pending, errors, feedback, form, currency, refresh, t]);

  return { form, update, updateStack, errors, showError, reveal, submitted, canCreate, pending, currency, projectMinBudget, submit };
}
