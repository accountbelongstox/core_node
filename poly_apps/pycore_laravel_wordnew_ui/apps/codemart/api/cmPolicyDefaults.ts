/**
 * Fallback policy values used only until the bootstrap policy
 * (`GET /bootstrap` vocabulary.policy, owned by CodeMartV1Constants and the
 * operator-editable policy store) has loaded or when an older server omits a
 * field. The server value always wins.
 */
export const CM_POLICY_FALLBACK = {
  currency: 'CNY',
  aiEstimateCurrency: 'CNY',
  projectMinBudget: 100,
  reviewCommentMinLength: 20,
  reviewerRetryDays: 7,
  reviewerPassScore: 85,
  reviewerExamCount: 3,
  passwordMinLength: 8,
  testimonialMaxQuoteLength: 1000,
  walletTopUpMinAmount: 100,
  walletTopUpMaxAmount: 1000000,
  maxAttachmentKb: 10240,
  maxKycImageKb: 5120,
} as const;

/** Client-side minimum for a new account password until the server policy has loaded. */
export const CM_PASSWORD_MIN_LENGTH = CM_POLICY_FALLBACK.passwordMinLength;
