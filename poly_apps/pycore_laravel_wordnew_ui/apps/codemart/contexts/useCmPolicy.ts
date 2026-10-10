import { useMemo } from 'react';
import { CM_POLICY_FALLBACK } from '../api/cmPolicyDefaults';
import { useCmBootstrap } from './CmBootstrapContext';

export interface CmPolicyValues {
  currency: string;
  projectMinBudget: number;
  reviewCommentMinLength: number;
  reviewerRetryDays: number;
}

/** Server-owned policy numbers with the shared fallback, read from the bootstrap. */
export function useCmPolicy(): CmPolicyValues {
  const { bootstrap } = useCmBootstrap();
  const policy = bootstrap?.vocabulary.policy;
  const currency = policy?.currency || CM_POLICY_FALLBACK.currency;
  const projectMinBudget = policy?.project_min_budget ?? CM_POLICY_FALLBACK.projectMinBudget;
  const reviewCommentMinLength = policy?.review_comment_min_length ?? CM_POLICY_FALLBACK.reviewCommentMinLength;
  const reviewerRetryDays = policy?.reviewer_retry_days ?? CM_POLICY_FALLBACK.reviewerRetryDays;
  return useMemo(
    () => ({ currency, projectMinBudget, reviewCommentMinLength, reviewerRetryDays }),
    [currency, projectMinBudget, reviewCommentMinLength, reviewerRetryDays],
  );
}
