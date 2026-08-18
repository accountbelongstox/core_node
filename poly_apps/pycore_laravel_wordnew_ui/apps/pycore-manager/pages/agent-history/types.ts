export interface AgentHistorySessionSummaryView {
  tool: string;
  has_subagent: boolean;
  started_at: string;
  title?: string | null;
  project?: string | null;
  raw_id?: string;
  os_user: string;
  prompt_count: number;
  message_count: number;
}

export interface AgentHistoryTurnView {
  role: string;
  name?: string | null;
  model?: string | null;
  is_subagent?: boolean;
  time?: string | null;
  text: string;
}

export interface AgentHistorySessionDetailView {
  tool: string;
  os_user: string;
  has_subagent: boolean;
  title?: string | null;
  project?: string | null;
  raw_id?: string;
  turns?: AgentHistoryTurnView[] | null;
}
