import { useCallback, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmApi } from '../api/CmApi';
import type { CmLineComment, CmReviewerApplicationStart, CmReviewSubmission } from '../api/CmApiTypes';
import { cmErrorMessage } from '../api/cmErrors';
import { cmTotalPages } from '../components/workspace/cmWorkspaceFormat';
import { useCmPagedList, type CmPagedList } from '../components/workspace/useCmPagedList';
import { useCmPolicy } from '../contexts/useCmPolicy';
import type { CmFeedback } from './cmFeedback';

export const CM_REVIEW_RECOMMENDATIONS = ['approved', 'needs_revision', 'rejected'] as const;
export const CM_REVIEW_RATING_VALUES = [1, 2, 3, 4, 5] as const;
const DEFAULT_RATING = 3;
const PASSED_STATUS = 'passed';

export interface CmLineCommentDraft {
  file: string;
  line: string;
  comment: string;
}

export interface CmTestDraft {
  quality_rating: number;
  readability_rating: number;
  efficiency_rating: number;
  comments: string;
}

const emptyDraft = (): CmTestDraft => ({
  quality_rating: DEFAULT_RATING,
  readability_rating: DEFAULT_RATING,
  efficiency_rating: DEFAULT_RATING,
  comments: '',
});

const extractReviews = (data: { pending_reviews: CmReviewSubmission[]; pagination: unknown }) => ({
  items: Array.isArray(data.pending_reviews) ? data.pending_reviews : [],
  totalPages: cmTotalPages(data.pagination as Parameters<typeof cmTotalPages>[0]),
});
const fetchReviews = (page: number) => cmApi.getReviewTasks(page);

/** Submissions waiting for the reviewer; `enabled` is false until the account is an active reviewer. */
export function useCmReviewerQueue(enabled: boolean): CmPagedList<CmReviewSubmission> {
  return useCmPagedList(fetchReviews, extractReviews, 'reviews.loadFailed', enabled);
}

export interface CmReviewDecisionModel {
  quality: number;
  setQuality: (value: number) => void;
  readability: number;
  setReadability: (value: number) => void;
  efficiency: number;
  setEfficiency: (value: number) => void;
  security: number | '';
  setSecurity: (value: number | '') => void;
  recommendation: string;
  setRecommendation: (value: string) => void;
  comments: string;
  setComments: (value: string) => void;
  lineComments: CmLineCommentDraft[];
  addLineComment: () => void;
  updateLine: (index: number, patch: Partial<CmLineCommentDraft>) => void;
  removeLine: (index: number) => void;
  commentLength: number;
  commentMinLength: number;
  valid: boolean;
  busy: boolean;
  submit: () => Promise<boolean>;
}

/** Reviewer decision on one submission: dimensional ratings, recommendation, comment with the policy minimum, line comments. */
export function useCmReviewDecision(submissionId: number, onReviewed: (message: string) => Promise<void>, feedback: CmFeedback): CmReviewDecisionModel {
  const { t } = useTranslation('cm');
  const { reviewCommentMinLength } = useCmPolicy();
  const [quality, setQuality] = useState(DEFAULT_RATING);
  const [readability, setReadability] = useState(DEFAULT_RATING);
  const [efficiency, setEfficiency] = useState(DEFAULT_RATING);
  const [security, setSecurity] = useState<number | ''>('');
  const [recommendation, setRecommendation] = useState('');
  const [comments, setComments] = useState('');
  const [lineComments, setLineComments] = useState<CmLineCommentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const commentLength = comments.trim().length;
  const valid = commentLength >= reviewCommentMinLength;

  const addLineComment = useCallback((): void => setLineComments((current) => [...current, { file: '', line: '', comment: '' }]), []);
  const updateLine = useCallback((index: number, patch: Partial<CmLineCommentDraft>): void => {
    setLineComments((current) => current.map((line, position) => (position === index ? { ...line, ...patch } : line)));
  }, []);
  const removeLine = useCallback((index: number): void => setLineComments((current) => current.filter((_, position) => position !== index)), []);

  const submit = useCallback(async (): Promise<boolean> => {
    if (busy || !valid) return false;
    setBusy(true);
    feedback.clear();
    const lines: CmLineComment[] = lineComments
      .filter((line) => line.comment.trim() !== '')
      .map((line) => ({ file: line.file.trim(), line: line.line ? Number(line.line) : undefined, comment: line.comment.trim() }));
    const response = await cmApi.submitCodeReview(submissionId, {
      quality_rating: quality,
      readability_rating: readability,
      efficiency_rating: efficiency,
      security_rating: security === '' ? null : security,
      recommendation: recommendation || null,
      comments: comments.trim(),
      line_comments: lines.length > 0 ? lines : null,
    });
    setBusy(false);
    if (response.success) {
      await onReviewed(t('reviews.submittedWithScore', { score: response.data?.code_score ?? '' }));
      return true;
    }
    feedback.error(cmErrorMessage(t, response, 'reviews.submitFailed'));
    return false;
  }, [busy, valid, feedback, lineComments, submissionId, quality, readability, efficiency, security, recommendation, comments, onReviewed, t]);

  return {
    quality, setQuality, readability, setReadability, efficiency, setEfficiency, security, setSecurity, recommendation, setRecommendation,
    comments, setComments, lineComments, addLineComment, updateLine, removeLine, commentLength, commentMinLength: reviewCommentMinLength, valid, busy, submit,
  };
}

export interface CmReviewerApplicationModel {
  application: CmReviewerApplicationStart | null;
  drafts: CmTestDraft[];
  updateDraft: (index: number, patch: Partial<CmTestDraft>) => void;
  draftsValid: boolean;
  busy: boolean;
  examCount: number;
  passScore: number;
  retryDays: number;
  commentMinLength: number;
  apply: () => Promise<void>;
  submitTest: () => Promise<void>;
}

/** Reviewer qualification: start the application, rate the code samples, submit the test. */
export function useCmReviewerApplication(onPassed: (message: string) => Promise<void>, feedback: CmFeedback): CmReviewerApplicationModel {
  const { t } = useTranslation('cm');
  const { reviewCommentMinLength, reviewerRetryDays, reviewerExamCount, reviewerPassScore } = useCmPolicy();
  const [application, setApplication] = useState<CmReviewerApplicationStart | null>(null);
  const [drafts, setDrafts] = useState<CmTestDraft[]>([]);
  const [busy, setBusy] = useState(false);

  const apply = useCallback(async (): Promise<void> => {
    setBusy(true);
    feedback.clear();
    const response = await cmApi.applyReviewer();
    setBusy(false);
    if (response.success && response.data) {
      setApplication(response.data);
      setDrafts(response.data.test_cases.map(() => emptyDraft()));
    } else {
      feedback.error(cmErrorMessage(t, response, 'reviews.applyFailed', { days: reviewerRetryDays }));
    }
  }, [feedback, reviewerRetryDays, t]);

  const updateDraft = useCallback((index: number, patch: Partial<CmTestDraft>): void => {
    setDrafts((current) => current.map((draft, position) => (position === index ? { ...draft, ...patch } : draft)));
  }, []);

  const draftsValid = drafts.length > 0 && drafts.every((draft) => draft.comments.trim().length >= reviewCommentMinLength);

  const submitTest = useCallback(async (): Promise<void> => {
    if (!application || busy || !draftsValid) return;
    setBusy(true);
    feedback.clear();
    const reviews = application.test_cases.map((testCase, index) => ({
      code_snippet_id: testCase.code_snippet_id,
      quality_rating: drafts[index].quality_rating,
      readability_rating: drafts[index].readability_rating,
      efficiency_rating: drafts[index].efficiency_rating,
      comments: drafts[index].comments.trim(),
    }));
    const response = await cmApi.submitReviewerTest(application.application_id, reviews);
    setBusy(false);
    if (response.success && response.data) {
      if (response.data.status === PASSED_STATUS) {
        setApplication(null);
        await onPassed(t('reviews.testPassed'));
      } else {
        feedback.error(t('reviews.testFailed', { score: response.data.similarity_score, days: reviewerRetryDays }));
        setApplication(null);
      }
    } else {
      feedback.error(cmErrorMessage(t, response, 'reviews.testSubmitFailed'));
    }
  }, [application, busy, draftsValid, feedback, drafts, onPassed, reviewerRetryDays, t]);

  return {
    application, drafts, updateDraft, draftsValid, busy, examCount: reviewerExamCount, passScore: reviewerPassScore,
    retryDays: reviewerRetryDays, commentMinLength: reviewCommentMinLength, apply, submitTest,
  };
}
