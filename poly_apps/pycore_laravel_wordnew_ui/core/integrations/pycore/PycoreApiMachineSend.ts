import { PYCORE_HTTP_ROUTES } from './PycoreApiTransport';
import { primaryPycoreHttp, type PycoreHttpApi } from './PycoreHttp';

/** One backup of the pycore machine's system clipboard, taken before it was replaced. */
export interface MachineClipboardEntry {
  id: string;
  kind: 'text' | 'image' | 'files' | 'empty' | 'other';
  /** Epoch ms of the backup. */
  at: number;
  formats?: string[];
  /** Full text of a text entry (capped by pycore). */
  text?: string;
  bytes?: number;
  mime?: string;
}

export interface MachineSendResult {
  success: boolean;
  error_code?: string | null;
  /** Limits carried by `machine_send_too_many_files` and the `..._too_large` codes. */
  max_files?: number;
  max_bytes?: number;
}

export interface MachineSavedFile {
  name: string;
  path: string;
  bytes: number;
  mime?: string;
}

/** The top-level fields describe the first file; `saved` lists every file of the request. */
export interface MachineSendFileResult extends MachineSendResult {
  path?: string;
  name?: string;
  bytes?: number;
  mime?: string;
  directory?: string;
  /** The receive directory was opened in the OS file manager. */
  opened?: boolean;
  saved?: MachineSavedFile[];
}

export interface MachineSendTextResult extends MachineSendResult {
  path?: string;
  bytes?: number;
  /** The file was opened in the OS text editor. */
  opened?: boolean;
}

export interface MachineSendClipboardResult extends MachineSendResult {
  /** The clipboard content before it was replaced (null when empty or unreadable). */
  backup?: MachineClipboardEntry | null;
  notified?: boolean;
  /** Where a sent file or an unsupported image was saved. */
  path?: string;
}

export interface MachineClipboardHistoryResult extends MachineSendResult {
  entries?: MachineClipboardEntry[];
}

export interface MachineSendUploadOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Documents, files, text and clipboard content sent to the whole selected pycore machine. */
export function createPycoreApiMachineSend(http: PycoreHttpApi) {
  const { requestPycoreHttp, requestPycoreHttpUpload } = http;
  return {
    /** One request for all files (`file` repeated); pycore saves them, opens the receive folder and notifies. */
    sendMachineFiles: (files: File[], options: MachineSendUploadOptions = {}) => {
      const form = new FormData();
      files.forEach((file) => form.append('file', file, file.name));
      form.append('open', '1');
      return requestPycoreHttpUpload<MachineSendFileResult>(PYCORE_HTTP_ROUTES.machineSendFile, form, {}, options);
    },
    sendMachineText: (text: string) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.machineSendText, { text }) as Promise<MachineSendTextResult>,
    setMachineClipboardText: (text: string) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.machineSendClipboard, { kind: 'text', text }) as Promise<MachineSendClipboardResult>,
    /** An image is saved but the clipboard cannot take it; any other file puts its saved path on the clipboard. */
    setMachineClipboardFile: (file: File, kind: 'image' | 'file', options: MachineSendUploadOptions = {}) => {
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('kind', kind);
      return requestPycoreHttpUpload<MachineSendClipboardResult>(PYCORE_HTTP_ROUTES.machineSendClipboard, form, {}, options);
    },
    getMachineClipboardHistory: (limit?: number) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.machineSendClipboardHistory, { limit }) as Promise<MachineClipboardHistoryResult>,
    deleteMachineClipboardEntry: (id: string) =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.machineSendClipboardHistoryDelete, { id }) as Promise<MachineSendResult>,
    clearMachineClipboardHistory: () =>
      requestPycoreHttp(PYCORE_HTTP_ROUTES.machineSendClipboardHistoryClear, {}) as Promise<MachineSendResult>,
  };
}

export type PycoreMachineSendApi = ReturnType<typeof createPycoreApiMachineSend>;

export const pycoreApiMachineSend = createPycoreApiMachineSend(primaryPycoreHttp);
