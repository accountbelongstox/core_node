import { PersistedStore } from '../../../core/persistence';
import { PycoreManagerStorageKeys } from './PycoreManagerStorageKeys';

export type AgentHistoryTabId = 'sessions' | 'prompts';
export type AgentHistoryTaskPeriod = 'today' | 'history';

export interface AgentHistoryUiState {
  tab: AgentHistoryTabId;
  filterTool: string;
  filterUser: string;
  search: string;
  sessionPage: number;
  promptPage: number;
  selectedId: string;
  selectedTool: string;
  enabledTools: string[];
  live: boolean;
  taskPeriod: AgentHistoryTaskPeriod;
}

const DEFAULT_STATE: AgentHistoryUiState = {
  tab: 'sessions',
  filterTool: '',
  filterUser: '',
  search: '',
  sessionPage: 1,
  promptPage: 1,
  selectedId: '',
  selectedTool: '',
  enabledTools: [],
  live: true,
  taskPeriod: 'today',
};

function normalizePage(value: unknown): number {
  const page = Number(value);
  return Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
}

function normalizeState(value: AgentHistoryUiState): AgentHistoryUiState {
  return {
    tab: value.tab === 'prompts' ? 'prompts' : 'sessions',
    filterTool: String(value.filterTool || ''),
    filterUser: String(value.filterUser || ''),
    search: String(value.search || ''),
    sessionPage: normalizePage(value.sessionPage),
    promptPage: normalizePage(value.promptPage),
    selectedId: String(value.selectedId || ''),
    selectedTool: String(value.selectedTool || ''),
    enabledTools: Array.isArray(value.enabledTools) ? value.enabledTools.map(String) : [],
    live: value.live !== false,
    taskPeriod: value.taskPeriod === 'history' ? 'history' : 'today',
  };
}

class AgentHistoryUiStateStore extends PersistedStore<AgentHistoryUiState> {
  constructor() {
    super(PycoreManagerStorageKeys.PYCORE_AGENT_HISTORY_UI, () => ({ ...DEFAULT_STATE }));
    this.replace(normalizeState(this.getSnapshot()));
  }

  save(value: AgentHistoryUiState): void {
    this.replace(normalizeState(value));
  }
}

export const agentHistoryUiStateStore = new AgentHistoryUiStateStore();
