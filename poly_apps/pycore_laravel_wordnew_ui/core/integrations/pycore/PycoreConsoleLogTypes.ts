/** Wire types of the pycore console log journal (`pycore_log` topic + history route). */
export interface ConsoleLogEntry {
  instance_id: string;
  seq: number;
  ts: number;
  source: string;
  level: string;
  color: string;
  thread: string;
  message: string;
}

export interface ConsoleLogHistory {
  success: boolean;
  instance_id: string;
  seq: number;
  earliest_seq: number;
  replay_lost: boolean;
  cursor_ahead: boolean;
  has_more: boolean;
  has_older?: boolean;
  entries: ConsoleLogEntry[];
}
