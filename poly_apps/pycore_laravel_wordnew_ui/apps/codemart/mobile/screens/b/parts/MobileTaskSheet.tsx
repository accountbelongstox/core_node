import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CircleDollarSign, ExternalLink, Flag, Pencil, Send } from 'lucide-react';
import { useTranslation } from '../../../../../../core/i18n/UiI18n';
import { cmProjectPath } from '../../../../components/public-home/cmPublicRoutes';
import { cmUserLabel, useCmFormat } from '../../../../components/workspace/cmWorkspaceFormat';
import { useCmPolicy } from '../../../../contexts/useCmPolicy';
import { CM_TASK_REVIEW_STATUS, useCmTaskDetail } from '../../../../shared/useCmTaskDetail';
import { MobileButton, MobileErrorState, MobileNotice, MobileSectionHeader, MobileSheet, MobileSkeletonBlock, MobileStatusBadge, useMobileFeedback } from '../../../ui';
import { MobileReviewHistory } from './MobileReviewHistory';
import { MobileSubmissionsList } from './MobileSubmissionsList';
import { MobileTagList } from './MobileTagList';
import { MobileTaskFormSheet } from './MobileTaskFormSheet';
import { MobileTaskSubmitSheet } from './MobileTaskSubmitSheet';
import { MobileTransitionActions } from './MobileTransitionActions';

interface MobileTaskSheetProps {
  taskId: number;
  onClose: () => void;
  /** Called after any change so the list behind the sheet reloads. */
  onChanged: () => Promise<void>;
}

/** One task in a bottom sheet: status actions, edit, submission, submissions review, comments. Mount it only while a task is open. */
export const MobileTaskSheet: React.FC<MobileTaskSheetProps> = ({ taskId, onClose, onChanged }) => {
  const { t } = useTranslation('cm');
  const format = useCmFormat();
  const { currency } = useCmPolicy();
  const feedback = useMobileFeedback();
  const detail = useCmTaskDetail(taskId, onChanged, feedback);
  const { task, loading, lastReview } = detail;
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = task?.access.can_submit === true;
  const resubmit = canSubmit && (task?.submissions ?? []).length > 0;

  return (
    <>
      <MobileSheet
        open
        onClose={onClose}
        title={task?.title ?? t('tasks.detailTitle')}
        footer={canSubmit ? (
          <MobileButton variant="primary" block icon={<Send aria-hidden="true" />} onClick={() => setSubmitting(true)}>{resubmit ? t('mobile.work.resubmit') : t('tasks.submit')}</MobileButton>
        ) : undefined}
      >
        {loading ? (
          <MobileSkeletonBlock height={220} />
        ) : detail.loadError || !task ? (
          <MobileErrorState message={detail.loadError ?? t('tasks.loadFailed')} onRetry={detail.loadRetryable ? detail.retry : undefined} />
        ) : (
          <div className="cmm-stack">
            <div className="cmm-stack-tight">
              <ul className="cmm-facts">
                <li><MobileStatusBadge group="task" status={task.status} /></li>
                {task.priority && <li><Flag aria-hidden="true" /> {t(`projectDetail.priorities.${task.priority}`, { defaultValue: task.priority })}</li>}
                {task.due_date && <li><CalendarDays aria-hidden="true" /> {t('tasks.due', { date: format.date(task.due_date) })}</li>}
                {task.budget_allocation && <li><CircleDollarSign aria-hidden="true" /> {format.money(task.budget_allocation, currency)}</li>}
              </ul>
              <p className="cmm-prose">{task.description}</p>
              <MobileTagList items={task.required_skills} label={t('marketplace.skillsLabel')} />
              {task.project && (
                <Link className="cmm-link-btn" to={cmProjectPath(task.project.id)} onClick={onClose}>
                  <ExternalLink aria-hidden="true" /> {t('tasks.projectLink', { title: task.project.title })}
                </Link>
              )}
              {t(`tasks.statusHint.${task.status}`, { defaultValue: '' }) && <p className="cmm-entity__hint">{t(`tasks.statusHint.${task.status}`, { defaultValue: '' })}</p>}
            </div>

            {(task.access.allowed_transitions.length > 0 || task.access.can_edit) && (
              <div className="cmm-stack-tight">
                <MobileTransitionActions transitions={task.access.allowed_transitions} labelFor={detail.transitionLabel} onConfirm={detail.transition} />
                {task.access.can_edit && (
                  <div className="cmm-row-actions">
                    <MobileButton small icon={<Pencil aria-hidden="true" />} onClick={() => setEditing(true)}>{t('projectDetail.editTask')}</MobileButton>
                  </div>
                )}
              </div>
            )}

            {lastReview && (
              <section className="cmm-stack-tight">
                <MobileSectionHeader title={t('tasks.lastReview')} />
                <MobileReviewHistory reviews={[lastReview]} />
              </section>
            )}
            {!canSubmit && task.status === CM_TASK_REVIEW_STATUS && <MobileNotice>{t('tasks.inReview')}</MobileNotice>}

            <section className="cmm-stack-tight">
              <MobileSectionHeader title={t('submissions.title')} />
              <MobileSubmissionsList taskId={task.id} taskStatus={task.status} canReview={detail.canDecide} onChanged={detail.reload} />
            </section>

            <section className="cmm-stack-tight">
              <MobileSectionHeader title={t('tasks.commentTitle')} />
              {(task.comments ?? []).length === 0 ? (
                <p className="cmm-hint">{t('tasks.noComments')}</p>
              ) : (
                <ul className="cmm-thread">
                  {(task.comments ?? []).map((item) => (
                    <li key={item.id}>
                      <header><strong>{cmUserLabel(item.user, t('common.unavailable'))}</strong><span>{format.dateTime(item.created_at)}</span></header>
                      <p>{item.comment}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="cmm-composer">
                <textarea
                  className="cmm-input cmm-textarea"
                  rows={2}
                  value={detail.comment}
                  onChange={(event) => detail.setComment(event.target.value)}
                  placeholder={t('tasks.commentPlaceholder')}
                  aria-label={t('tasks.commentLabel')}
                />
                <MobileButton variant="primary" loading={detail.commenting} disabled={!detail.comment.trim()} onClick={() => void detail.postComment()}>{t('tasks.commentPost')}</MobileButton>
              </div>
            </section>
          </div>
        )}
      </MobileSheet>
      {task && (
        <MobileTaskFormSheet
          open={editing}
          milestoneId={task.milestone_id}
          task={task}
          onClose={() => setEditing(false)}
          onSaved={detail.reload}
        />
      )}
      {task && submitting && (
        <MobileTaskSubmitSheet taskId={task.id} resubmit={resubmit} onClose={() => setSubmitting(false)} onSubmitted={detail.reload} />
      )}
    </>
  );
};
