/**
 * NCore Foundation
 *
 * Core foundational utilities for Node.js projects.
 *
 * This module provides:
 * - Encyclopedia: Global cache/key-value store
 * - EventBus: Cross-application event communication
 * - Task System: Global task queue and scheduling
 * - Common Utilities: Logger, ThreadBus, SecretManager, etc.
 *
 * Usage:
 *   const { Encyclopedia, ENCYCLOPEDIA } = require('#@foundation');
 *   const { EventBus, EventTypes } = require('#@foundation/event_bus');
 *   const { Task, TaskState } = require('#@foundation/task_models');
 */

const { Encyclopedia, ENCYCLOPEDIA } = require('./encyclopedia');
const { EventBus, Event, EventTypes } = require('./event_bus');
const { Task, TaskState, TaskPriority } = require('./task_models');
const { GlobalTaskQueue, getGlobalTaskQueue } = require('./task_queue');

const logger = require('./common/logger');
const { ThreadBus, getThreadBus } = require('./common/thread_bus');
const secretManager = require('./common/secret_manager');

module.exports = {
    Encyclopedia,
    ENCYCLOPEDIA,
    EventBus,
    Event,
    EventTypes,
    Task,
    TaskState,
    TaskPriority,
    GlobalTaskQueue,
    getGlobalTaskQueue,
    logger,
    ThreadBus,
    getThreadBus,
    secretManager
};
