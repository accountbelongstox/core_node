import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '@/apps/laravel-manager/api';
import type {
    TaskCenterOverview,
} from '@/apps/laravel-manager/api';
import type { GlobalTasksSnapshot } from './shared';
import { diffQueueContext } from '@/core/tasks/DiffQueueContext';
import {
    laravelRealtime,
    LARAVEL_REALTIME_EVENTS,
} from '@/core/integrations/laravel/LaravelRealtime';
import {
    getGlobalTaskOrderValue,
    isGlobalTaskQueuePositionOrdered,
} from '@/core/contracts/QueueCenterContract';

export interface TaskCenterState {
    overview: TaskCenterOverview | null;
    globalTasks: GlobalTasksSnapshot | null;
    octaneTasks: any | null;
    loading: boolean;
    error: string | null;
    refreshNow: () => void;
    moveTaskToFront: (taskId: string, ordering: number | { priority?: number; queue_position?: number }) => void;
    autoRefresh: boolean;
    setAutoRefresh: (val: boolean) => void;
    refreshIntervalSec: number;
    setRefreshIntervalSec: (val: number) => void;
}

const TaskCenterContext = createContext<TaskCenterState | null>(null);

export const useTaskCenterState = () => {
    const ctx = useContext(TaskCenterContext);
    if (!ctx) throw new Error('useTaskCenterState must be used within TaskCenterProvider');
    return ctx;
};

export const TaskCenterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [overview, setOverview] = useState<TaskCenterOverview | null>(null);
    const [globalTasks, setGlobalTasks] = useState<GlobalTasksSnapshot | null>(null);
    const [octaneTasks, setOctaneTasks] = useState<any | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshIntervalSec, setRefreshIntervalSec] = useState(5);

    const mounted = useRef(true);
    const refreshInFlight = useRef<Promise<void> | null>(null);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const fetchAll = useCallback((): Promise<void> => {
        if (refreshInFlight.current) return refreshInFlight.current;

        const request = (async () => {
          setLoading(true);
          setError(null);
          try {
            const overviewRes = await api.serverManager.getTaskCenterOverview();

            if (!mounted.current) return;

            if (overviewRes.success && overviewRes.data) {
                const snapshot = overviewRes.data;
                setOverview(snapshot);
                setGlobalTasks({
                    stats: snapshot.queue.stats,
                    tasks: snapshot.queue.items,
                    totalTasks: snapshot.queue.total,
                    workers: snapshot.workers.items,
                    workerStats: snapshot.workers.stats,
                    timestamp: snapshot.timestamp,
                });
                setOctaneTasks({
                    summary: snapshot.scheduler.summary,
                    tasks: snapshot.scheduler.tasks,
                    heartbeat: snapshot.scheduler.heartbeat,
                    timestamp: snapshot.timestamp,
                });
            } else {
                setError(overviewRes.error || 'Failed to load overview');
            }
          } catch (err: any) {
            if (mounted.current) {
                setError(err?.message || 'Failed to load task center data');
            }
          } finally {
            if (mounted.current) {
                setLoading(false);
            }
          }
        })();

        refreshInFlight.current = request;
        void request.finally(() => {
            if (refreshInFlight.current === request) refreshInFlight.current = null;
        });
        return request;
    }, []);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    useEffect(() => {
        const unsubscribe = laravelRealtime.subscribe(
            LARAVEL_REALTIME_EVENTS.queueChanged,
            () => { void fetchAll(); },
        );
        laravelRealtime.start();
        return () => {
            unsubscribe();
            laravelRealtime.stop();
        };
    }, [fetchAll]);

    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(() => {
            fetchAll();
        }, refreshIntervalSec * 1000);
        return () => clearInterval(id);
    }, [autoRefresh, refreshIntervalSec, fetchAll]);

    const refreshNow = useCallback(() => {
        fetchAll();
    }, [fetchAll]);

    const moveTaskToFront = useCallback((taskId: string, ordering: number | { priority?: number; queue_position?: number }) => {
        diffQueueContext.touch('laravel-manager:global-tasks:ordering', [taskId]);
        const patch = typeof ordering === 'number' ? { priority: ordering } : ordering;
        setGlobalTasks((previous) => {
            if (!previous) return previous;
            const tasks = previous.tasks.map((task) => {
                if (task.task_id !== taskId) return task;
                if (isGlobalTaskQueuePositionOrdered(task.task_type)) {
                    // Queue-position lanes move by head ticket only.
                    const top = previous.tasks.reduce(
                        (max, row) => row.task_type === task.task_type
                            ? Math.max(max, getGlobalTaskOrderValue(row))
                            : max,
                        0,
                    );
                    return {
                        ...task,
                        queue_position: patch.queue_position ?? top + 1,
                        priority: undefined,
                        is_fast_tier: false,
                    };
                }
                return {
                    ...task,
                    priority: Math.max(task.priority ?? 0, patch.priority ?? 0),
                    is_fast_tier: true,
                };
            });
            return { ...previous, tasks, timestamp: new Date().toLocaleString() };
        });
    }, []);

    return (
        <TaskCenterContext.Provider
            value={{
                overview,
                globalTasks,
                octaneTasks,
                loading,
                error,
                refreshNow,
                moveTaskToFront,
                autoRefresh,
                setAutoRefresh,
                refreshIntervalSec,
                setRefreshIntervalSec,
            }}
        >
            {children}
        </TaskCenterContext.Provider>
    );
};
