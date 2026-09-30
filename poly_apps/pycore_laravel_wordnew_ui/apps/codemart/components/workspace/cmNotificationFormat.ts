import type { CmNotification } from '../../api/CmApiTypes';
import { CM_PROTECTED_ROUTE, cmProjectPath, cmTaskPath } from '../public-home/cmPublicRoutes';

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

/**
 * In-app route for a notification's resource, when one exists. Without the
 * task page capability (clients, architects) task links open the project.
 */
export function cmNotificationLink(notification: CmNotification, canOpenTasks = true): string | null {
  const type = notification.resource_type ?? '';
  const params = notification.params;
  const projectId = numericParam(params, 'project_id');
  const taskId = numericParam(params, 'task_id');
  if (PROJECT_RESOURCES.has(type) && notification.resource_id) return cmProjectPath(notification.resource_id);
  if (TASK_RESOURCES.has(type)) {
    if (!canOpenTasks && projectId) return cmProjectPath(projectId);
    return cmTaskPath(type === 'task' ? notification.resource_id : taskId);
  }
  if (PROJECT_SCOPED_RESOURCES.has(type)) {
    if (projectId) return cmProjectPath(projectId);
    return taskId ? cmTaskPath(taskId) : null;
  }
  if (WALLET_RESOURCES.has(type)) return CM_PROTECTED_ROUTE.wallet;
  if (VERIFICATION_RESOURCES.has(type)) return CM_PROTECTED_ROUTE.verification;
  if (REVIEW_RESOURCES.has(type)) return CM_PROTECTED_ROUTE.reviews;
  return projectId ? cmProjectPath(projectId) : null;
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
