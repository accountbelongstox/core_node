import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../../../core/api';
import type {
    TaskCenterOverview,
    GlobalTaskItem,
    GlobalWorkerInfo,
    AssistRequestItem,
} from '../../../core/api/modules/ServerManagerAPI';
import type { GlobalTasksSnapshot } from './shared';

export interface TaskCenterState {
    overview: TaskCenterOverview | null;
    globalTasks: GlobalTasksSnapshot | null;
    octaneTasks: any | null;
    assistRequests: AssistRequestItem[] | null;
    loading: boolean;
    error: string | null;
    refreshNow: () => void;
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
    const [assistRequests, setAssistRequests] = useState<AssistRequestItem[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
    const [refreshIntervalSec, setRefreshIntervalSec] = useState(5);

    const mounted = useRef(true);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [overviewRes, statsRes, listRes, workersRes, workerStatsRes, octaneRes, assistRes] = await Promise.all([
                api.serverManager.getTaskCenterOverview(),
                api.serverManager.getGlobalTaskStats(),
                api.serverManager.getGlobalTaskList({ limit: 500 }),
                api.serverManager.getWorkerList(),
                api.serverManager.getWorkerStats(),
                api.serverManager.getOctaneTasksStatus(),
                api.serverManager.listAssistRequests({ per_page: 200 }),
            ]);

            if (!mounted.current) return;

            if (overviewRes.success && overviewRes.data) {
                setOverview(overviewRes.data);
            } else {
                setError(overviewRes.error || 'Failed to load overview');
            }

            if (listRes.success && listRes.data) {
                setGlobalTasks({
                    stats: statsRes.success && statsRes.data ? statsRes.data.stats : null,
                    tasks: Array.isArray(listRes.data.tasks) ? listRes.data.tasks : [],
                    totalTasks: listRes.data.total ?? 0,
                    workers: workersRes.success && workersRes.data && Array.isArray(workersRes.data.workers) ? workersRes.data.workers : [],
                    workerStats: workerStatsRes.success && workerStatsRes.data ? workerStatsRes.data.stats : null,
                    timestamp: new Date().toLocaleString(),
                });
            }

            if (octaneRes.success && octaneRes.data) {
                setOctaneTasks(octaneRes.data);
            }

            if (assistRes.success && assistRes.data) {
                setAssistRequests(assistRes.data.items || []);
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
    }, []);

    useEffect(() => {
        fetchAll();
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

    return (
        <TaskCenterContext.Provider
            value={{
                overview,
                globalTasks,
                octaneTasks,
                assistRequests,
                loading,
                error,
                refreshNow,
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
