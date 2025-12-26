/**
 * Local Task Queue - Message Protocol
 * Popup ↔ Background communication protocol
 */

import type { Task, TaskType, TaskStatus, TaskQueueStats, TaskEventType } from './types';

/**
 * Message type enum
 */
export enum MessageType {
  // Command messages (Popup → Background)
  TASK_ADD = 'TASK_ADD',
  TASK_CANCEL = 'TASK_CANCEL',
  QUEUE_START = 'QUEUE_START',
  QUEUE_STOP = 'QUEUE_STOP',
  QUEUE_PAUSE = 'QUEUE_PAUSE',
  QUEUE_RESUME = 'QUEUE_RESUME',
  QUEUE_GET_STATS = 'QUEUE_GET_STATS',
  QUEUE_GET_TASKS = 'QUEUE_GET_TASKS',
  QUEUE_GET_TASK = 'QUEUE_GET_TASK',
  QUEUE_GET_TASKS_BY_STATUS = 'QUEUE_GET_TASKS_BY_STATUS',
  QUEUE_GET_TASKS_BY_TYPE = 'QUEUE_GET_TASKS_BY_TYPE',
  QUEUE_CLEAR_COMPLETED = 'QUEUE_CLEAR_COMPLETED',
  QUEUE_IS_RUNNING = 'QUEUE_IS_RUNNING',

  // Log messages
  QUEUE_LOG_GET_ALL = 'QUEUE_LOG_GET_ALL',
  QUEUE_LOG_CLEAR = 'QUEUE_LOG_CLEAR',

  // Event messages (Background → Popup)
  QUEUE_EVENT = 'QUEUE_EVENT',
  QUEUE_LOG = 'QUEUE_LOG',
}

/**
 * Base message interface
 */
export interface BaseMessage {
  type: MessageType;
}

/**
 * Add task message
 */
export interface TaskAddMessage extends BaseMessage {
  type: MessageType.TASK_ADD;
  task: Task;
}

/**
 * Cancel task message
 */
export interface TaskCancelMessage extends BaseMessage {
  type: MessageType.TASK_CANCEL;
  taskId: string;
}

/**
 * Start queue message
 */
export interface QueueStartMessage extends BaseMessage {
  type: MessageType.QUEUE_START;
}

/**
 * Stop queue message
 */
export interface QueueStopMessage extends BaseMessage {
  type: MessageType.QUEUE_STOP;
}

/**
 * Pause queue message
 */
export interface QueuePauseMessage extends BaseMessage {
  type: MessageType.QUEUE_PAUSE;
}

/**
 * Resume queue message
 */
export interface QueueResumeMessage extends BaseMessage {
  type: MessageType.QUEUE_RESUME;
}

/**
 * Get queue stats message
 */
export interface QueueGetStatsMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_STATS;
}

/**
 * Get all tasks message
 */
export interface QueueGetTasksMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_TASKS;
}

/**
 * Get single task message
 */
export interface QueueGetTaskMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_TASK;
  taskId: string;
}

/**
 * Get tasks by status message
 */
export interface QueueGetTasksByStatusMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_TASKS_BY_STATUS;
  status: TaskStatus;
}

/**
 * Get tasks by type message
 */
export interface QueueGetTasksByTypeMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_TASKS_BY_TYPE;
  taskType: TaskType;
}

/**
 * Clear completed tasks message
 */
export interface QueueClearCompletedMessage extends BaseMessage {
  type: MessageType.QUEUE_CLEAR_COMPLETED;
}

/**
 * Check if queue is running message
 */
export interface QueueIsRunningMessage extends BaseMessage {
  type: MessageType.QUEUE_IS_RUNNING;
}

/**
 * Queue event message (broadcast)
 */
export interface QueueEventMessage extends BaseMessage {
  type: MessageType.QUEUE_EVENT;
  eventType: TaskEventType;
  task: Task;
  timestamp: number;
}

/**
 * Union type of all command messages
 */
export type CommandMessage =
  | TaskAddMessage
  | TaskCancelMessage
  | QueueStartMessage
  | QueueStopMessage
  | QueuePauseMessage
  | QueueResumeMessage
  | QueueGetStatsMessage
  | QueueGetTasksMessage
  | QueueGetTaskMessage
  | QueueGetTasksByStatusMessage
  | QueueGetTasksByTypeMessage
  | QueueClearCompletedMessage
  | QueueIsRunningMessage;

/**
 * Union type of all messages
 */
export type QueueMessage = CommandMessage | QueueEventMessage;

/**
 * Response type
 */
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Task add response
 */
export type TaskAddResponse = MessageResponse<{ added: boolean }>;

/**
 * Task cancel response
 */
export type TaskCancelResponse = MessageResponse<{ cancelled: boolean }>;

/**
 * Queue stats response
 */
export type QueueStatsResponse = MessageResponse<{ stats: TaskQueueStats }>;

/**
 * Task list response
 */
export type QueueTasksResponse = MessageResponse<{ tasks: Task[] }>;

/**
 * Single task response
 */
export type QueueTaskResponse = MessageResponse<{ task: Task | undefined }>;

/**
 * Queue running status response
 */
export type QueueRunningResponse = MessageResponse<{ isRunning: boolean; isPaused: boolean }>;

/**
 * Type guard: check if is queue message
 */
export function isQueueMessage(message: any): message is QueueMessage {
  return message && typeof message.type === 'string' && message.type in MessageType;
}

/**
 * Type guard: check if is command message
 */
export function isCommandMessage(message: any): message is CommandMessage {
  if (!isQueueMessage(message)) return false;
  return message.type !== MessageType.QUEUE_EVENT;
}

/**
 * Type guard: check if is event message
 */
export function isEventMessage(message: any): message is QueueEventMessage {
  return isQueueMessage(message) && message.type === MessageType.QUEUE_EVENT;
}
