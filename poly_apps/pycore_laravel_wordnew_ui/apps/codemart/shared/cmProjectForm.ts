export const CM_STACK_FIELDS = ['skills', 'languages', 'frameworks', 'databases'] as const;
export type CmStackField = typeof CM_STACK_FIELDS[number];
export type CmStackDraft = Record<CmStackField, string>;

export const CM_PROJECT_TITLE_MAX_LENGTH = 255;
export const CM_DEFAULT_COMPLEXITY = 'medium';
export const CM_DEFAULT_BUDGET_TYPE = 'fixed';

export const cmEmptyStackDraft = (): CmStackDraft => ({ skills: '', languages: '', frameworks: '', databases: '' });
