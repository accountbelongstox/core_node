import type { CmNotification } from '../../api/CmApiTypes';

type CmTranslate = (key: string, options?: Record<string, unknown>) => string;

const PROJECT_RESOURCES = new Set(['project']);
const PROJECT_SCOPED_RESOURCES = new Set(['analysis', 'milestone', 'attachment', 'submission']);
const TASK_RESOURCES = new Set(['task', 'comment']);
const WALLET_RESOURCES = new Set(['payment', 'refund', 'withdrawal', 'deposit', 'escrow', 'invoice', 'wallet']);
const VERIFICATION_RESOURCES = new Set(['user_role', 'role', 'kyc', 'user', 'testimonial']);
const REVIEW_RESOURCES = new Set(['reviewer_application', 'review']);

function numericParam(params: Record<string, unknown> | null, key: string): number | null {
  const value = params?.[key];
  const parsed = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** In-app route for a notification's resource, when one exists. */
export function cmNotificationLink(notification: CmNotification): string | null {
  const type = notification.resource_type ?? '';
  const params = notification.params;
  const projectId = numericParam(params, 'project_id');
  const taskId = numericParam(params, 'task_id');
  if (PROJECT_RESOURCES.has(type) && notification.resource_id) return `/codemart/projects/${notification.resource_id}`;
  if (TASK_RESOURCES.has(type)) {
    const id = type === 'task' ? notification.resource_id : taskId;
    return id ? `/codemart/tasks?task=${id}` : '/codemart/tasks';
  }
  if (PROJECT_SCOPED_RESOURCES.has(type)) {
    if (projectId) return `/codemart/projects/${projectId}`;
    return taskId ? `/codemart/tasks?task=${taskId}` : null;
  }
  if (WALLET_RESOURCES.has(type)) return '/codemart/wallet';
  if (VERIFICATION_RESOURCES.has(type)) return '/codemart/verification';
  if (REVIEW_RESOURCES.has(type)) return '/codemart/reviews';
  return projectId ? `/codemart/projects/${projectId}` : null;
}

function stateNamespace(resourceType: string | null): string {
  if (resourceType === 'project') return 'states.project';
  if (resourceType === 'task' || resourceType === 'comment') return 'states.task';
  if (resourceType === 'submission') return 'states.submission';
  if (resourceType === 'milestone') return 'states.milestone';
  if (resourceType === 'analysis') return 'analysis.statuses';
  return 'states.role';
}

/** Notification params with server codes (roles, states, decisions, methods) replaced by localized labels. */
export function cmNotificationParams(t: CmTranslate, notification: CmNotification): Record<string, unknown> {
  const params: Record<string, unknown> = { ...(notification.params ?? {}) };
  const namespace = stateNamespace(notification.resource_type);
  const translate = (key: string, prefix: string): void => {
    const value = params[key];
    if (typeof value === 'string' && value) params[key] = t(`${prefix}.${value}`, { defaultValue: value });
  };
  translate('role', 'roles');
  translate('status', 'states.role');
  translate('from_state', namespace);
  translate('to_state', namespace);
  translate('decision', 'states.submission');
  translate('recommendation', 'states.submission');
  translate('resolution', 'notifications.resolutions');
  translate('method', 'wallet.methods');
  return params;
}
