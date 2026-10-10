export type CmStatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TONE_BY_STATUS: Record<string, CmStatusTone> = {
  active: 'success',
  completed: 'success',
  approved: 'success',
  paid: 'success',
  success: 'success',
  open: 'success',
  released: 'success',
  pending: 'warning',
  pending_review: 'warning',
  proposal_review: 'warning',
  funding_pending: 'warning',
  needs_revision: 'warning',
  revision_requested: 'warning',
  processing: 'warning',
  review: 'warning',
  frozen: 'warning',
  suspended: 'danger',
  rejected: 'danger',
  cancelled: 'danger',
  blocked: 'danger',
  disputed: 'danger',
  failed: 'danger',
  in_progress: 'info',
  assigned: 'info',
};

/** Tone of a server status code, the same grouping the web status badge uses; unknown codes are neutral. */
export function cmStatusTone(status: string | null | undefined): CmStatusTone {
  return (status && TONE_BY_STATUS[status]) || 'neutral';
}
