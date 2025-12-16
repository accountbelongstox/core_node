/**
 * Local Task Queue - Message Protocol
 * Popup ↔ Background 通信协议
 */

import type { Task, TaskType, TaskStatus, TaskQueueStats, TaskEventType } from './types';

/**
 * 消息类型枚举
 */
export enum MessageType {
  // 命令消息（Popup → Background）
  TASK_ADD = 'TASK_ADD',
  TASK_CANCEL = 'TASK_CANCEL',
  QUEUE_START = 'QUEUE_START',
  QUEUE_STOP = 'QUEUE_STOP',
  QUEUE_GET_STATS = 'QUEUE_GET_STATS',
  QUEUE_GET_TASKS = 'QUEUE_GET_TASKS',
  QUEUE_GET_TASK = 'QUEUE_GET_TASK',
  QUEUE_GET_TASKS_BY_STATUS = 'QUEUE_GET_TASKS_BY_STATUS',
  QUEUE_GET_TASKS_BY_TYPE = 'QUEUE_GET_TASKS_BY_TYPE',
  QUEUE_CLEAR_COMPLETED = 'QUEUE_CLEAR_COMPLETED',
  QUEUE_IS_RUNNING = 'QUEUE_IS_RUNNING',

  // 事件消息（Background → Popup）
  QUEUE_EVENT = 'QUEUE_EVENT',
}

/**
 * 基础消息接口
 */
export interface BaseMessage {
  type: MessageType;
}

/**
 * 添加任务消息
 */
export interface TaskAddMessage extends BaseMessage {
  type: MessageType.TASK_ADD;
  task: Task;
}

/**
 * 取消任务消息
 */
export interface TaskCancelMessage extends BaseMessage {
  type: MessageType.TASK_CANCEL;
  taskId: string;
}

/**
 * 启动队列消息
 */
export interface QueueStartMessage extends BaseMessage {
  type: MessageType.QUEUE_START;
}

/**
 * 停止队列消息
 */
export interface QueueStopMessage extends BaseMessage {
  type: MessageType.QUEUE_STOP;
}

/**
 * 获取队列统计消息
 */
export interface QueueGetStatsMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_STATS;
}

/**
 * 获取所有任务消息
 */
export interface QueueGetTasksMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_TASKS;
}

/**
 * 获取单个任务消息
 */
export interface QueueGetTaskMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_TASK;
  taskId: string;
}

/**
 * 按状态获取任务消息
 */
export interface QueueGetTasksByStatusMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_TASKS_BY_STATUS;
  status: TaskStatus;
}

/**
 * 按类型获取任务消息
 */
export interface QueueGetTasksByTypeMessage extends BaseMessage {
  type: MessageType.QUEUE_GET_TASKS_BY_TYPE;
  taskType: TaskType;
}

/**
 * 清除已完成任务消息
 */
export interface QueueClearCompletedMessage extends BaseMessage {
  type: MessageType.QUEUE_CLEAR_COMPLETED;
}

/**
 * 检查队列是否运行消息
 */
export interface QueueIsRunningMessage extends BaseMessage {
  type: MessageType.QUEUE_IS_RUNNING;
}

/**
 * 队列事件消息（广播）
 */
export interface QueueEventMessage extends BaseMessage {
  type: MessageType.QUEUE_EVENT;
  eventType: TaskEventType;
  task: Task;
  timestamp: number;
}

/**
 * 所有命令消息的联合类型
 */
export type CommandMessage =
  | TaskAddMessage
  | TaskCancelMessage
  | QueueStartMessage
  | QueueStopMessage
  | QueueGetStatsMessage
  | QueueGetTasksMessage
  | QueueGetTaskMessage
  | QueueGetTasksByStatusMessage
  | QueueGetTasksByTypeMessage
  | QueueClearCompletedMessage
  | QueueIsRunningMessage;

/**
 * 所有消息的联合类型
 */
export type QueueMessage = CommandMessage | QueueEventMessage;

/**
 * 响应类型
 */
export interface MessageResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * 任务添加响应
 */
export type TaskAddResponse = MessageResponse<{ added: boolean }>;

/**
 * 任务取消响应
 */
export type TaskCancelResponse = MessageResponse<{ cancelled: boolean }>;

/**
 * 队列统计响应
 */
export type QueueStatsResponse = MessageResponse<{ stats: TaskQueueStats }>;

/**
 * 任务列表响应
 */
export type QueueTasksResponse = MessageResponse<{ tasks: Task[] }>;

/**
 * 单个任务响应
 */
export type QueueTaskResponse = MessageResponse<{ task: Task | undefined }>;

/**
 * 队列运行状态响应
 */
export type QueueRunningResponse = MessageResponse<{ isRunning: boolean }>;

/**
 * 类型守卫：检查是否是队列消息
 */
export function isQueueMessage(message: any): message is QueueMessage {
  return message && typeof message.type === 'string' && message.type in MessageType;
}

/**
 * 类型守卫：检查是否是命令消息
 */
export function isCommandMessage(message: any): message is CommandMessage {
  if (!isQueueMessage(message)) return false;
  return message.type !== MessageType.QUEUE_EVENT;
}

/**
 * 类型守卫：检查是否是事件消息
 */
export function isEventMessage(message: any): message is QueueEventMessage {
  return isQueueMessage(message) && message.type === MessageType.QUEUE_EVENT;
}
