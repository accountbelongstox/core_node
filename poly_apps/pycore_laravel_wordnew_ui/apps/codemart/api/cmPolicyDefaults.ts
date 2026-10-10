/**
 * Fallback policy values used only until the bootstrap policy
 * (`GET /bootstrap` vocabulary.policy, owned by CodeMartV1Constants) has
 * loaded or when an older server omits a field. The server value always wins.
 */
export const CM_POLICY_FALLBACK = {
  currency: 'CNY',
  projectMinBudget: 100,
  reviewCommentMinLength: 20,
  reviewerRetryDays: 7,
} as const;
