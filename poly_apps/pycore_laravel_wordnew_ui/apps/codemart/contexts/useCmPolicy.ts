import { useEffect, useMemo, useState } from 'react';
import { cmPublicApi } from '../api/CmPublicApi';
import { CM_POLICY_FALLBACK } from '../api/cmPolicyDefaults';
import { useCmBootstrap } from './CmBootstrapContext';

export interface CmPolicyValues {
  currency: string;
  aiEstimateCurrency: string;
  projectMinBudget: number;
  reviewCommentMinLength: number;
  reviewerRetryDays: number;
  reviewerPassScore: number;
  reviewerExamCount: number;
  passwordMinLength: number;
  testimonialMaxQuoteLength: number;
  walletTopUpMinAmount: number;
  walletTopUpMaxAmount: number;
  maxAttachmentKb: number;
  maxKycImageKb: number;
  allowedDocumentTypes: string[];
  paymentMethods: string[];
  paymentCreatableTypes: string[];
}

const EMPTY_LIST: string[] = [];

/** Server-owned policy numbers with the shared fallback, read from the bootstrap. */
export function useCmPolicy(): CmPolicyValues {
  const { bootstrap } = useCmBootstrap();
  const policy = bootstrap?.vocabulary.policy;
  const currency = policy?.currency || CM_POLICY_FALLBACK.currency;
  const aiEstimateCurrency = policy?.ai_estimate_currency || CM_POLICY_FALLBACK.aiEstimateCurrency;
  const projectMinBudget = policy?.project_min_budget ?? CM_POLICY_FALLBACK.projectMinBudget;
  const reviewCommentMinLength = policy?.review_comment_min_length ?? CM_POLICY_FALLBACK.reviewCommentMinLength;
  const reviewerRetryDays = policy?.reviewer_retry_days ?? CM_POLICY_FALLBACK.reviewerRetryDays;
  const reviewerPassScore = policy?.reviewer_pass_score ?? CM_POLICY_FALLBACK.reviewerPassScore;
  const reviewerExamCount = policy?.reviewer_exam_count ?? CM_POLICY_FALLBACK.reviewerExamCount;
  const passwordMinLength = policy?.password_min_length ?? CM_POLICY_FALLBACK.passwordMinLength;
  const testimonialMaxQuoteLength = policy?.testimonial_max_quote_length ?? CM_POLICY_FALLBACK.testimonialMaxQuoteLength;
  const walletTopUpMinAmount = policy?.wallet_top_up_min_amount ?? CM_POLICY_FALLBACK.walletTopUpMinAmount;
  const walletTopUpMaxAmount = policy?.wallet_top_up_max_amount ?? CM_POLICY_FALLBACK.walletTopUpMaxAmount;
  const maxAttachmentKb = policy?.max_attachment_size_kb ?? CM_POLICY_FALLBACK.maxAttachmentKb;
  const maxKycImageKb = policy?.max_kyc_image_size_kb ?? CM_POLICY_FALLBACK.maxKycImageKb;
  const allowedDocumentTypes = policy?.allowed_document_types ?? EMPTY_LIST;
  const paymentMethods = policy?.payment_methods ?? EMPTY_LIST;
  const paymentCreatableTypes = policy?.payment_creatable_types ?? EMPTY_LIST;
  return useMemo(
    () => ({
      currency,
      aiEstimateCurrency,
      projectMinBudget,
      reviewCommentMinLength,
      reviewerRetryDays,
      reviewerPassScore,
      reviewerExamCount,
      passwordMinLength,
      testimonialMaxQuoteLength,
      walletTopUpMinAmount,
      walletTopUpMaxAmount,
      maxAttachmentKb,
      maxKycImageKb,
      allowedDocumentTypes,
      paymentMethods,
      paymentCreatableTypes,
    }),
    [
      currency, aiEstimateCurrency, projectMinBudget, reviewCommentMinLength, reviewerRetryDays, reviewerPassScore,
      reviewerExamCount, passwordMinLength, testimonialMaxQuoteLength, walletTopUpMinAmount, walletTopUpMaxAmount, maxAttachmentKb,
      maxKycImageKb, allowedDocumentTypes, paymentMethods, paymentCreatableTypes,
    ],
  );
}

/**
 * Minimum account password length: the bootstrap policy when signed in, the
 * public policy endpoint for signed-out pages (registration), the shared
 * fallback until either has loaded.
 */
export function useCmPasswordMinLength(): number {
  const { bootstrap } = useCmBootstrap();
  const fromBootstrap = bootstrap?.vocabulary.policy.password_min_length;
  const [publicValue, setPublicValue] = useState<number | null>(null);

  useEffect(() => {
    if (fromBootstrap !== undefined) return undefined;
    let active = true;
    void cmPublicApi.getPublicPolicy().then((response) => {
      if (active && response.success && response.data) setPublicValue(response.data.password_min_length);
    });
    return () => {
      active = false;
    };
  }, [fromBootstrap]);

  return fromBootstrap ?? publicValue ?? CM_POLICY_FALLBACK.passwordMinLength;
}
