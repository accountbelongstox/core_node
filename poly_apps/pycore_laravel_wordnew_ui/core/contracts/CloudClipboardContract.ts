import contract from '../../../../config/cloud_clipboard_contract.json';

export const CLOUD_CLIPBOARD = contract;

export interface CloudClipboardFile {
  id: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
}

export interface CloudClipboardEntry {
  id: string;
  text: string;
  files: CloudClipboardFile[];
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface CloudClipboardSnapshot {
  namespace: string;
  revision: number;
  protected: boolean;
  current: CloudClipboardEntry;
  history: CloudClipboardEntry[];
  history_total: number;
  page: number;
  page_size: number;
  hub_url: string;
  topics: string[];
}

export type CloudClipboardAction = 'text' | 'new' | 'restore' | 'delete' | 'upload' | 'delete-file' | 'password';
