import { useCallback, useEffect, useRef, useState } from 'react';
import { StorageManager } from '../../../../core/persistence';
import { RELAY_CONTRACT } from '../../../../core/contracts/RelayContract';
import { isPycoreRelayMode } from '../../../../core/integrations/pycore/pycoreTarget';
import {
  pycoreApi,
  type MachineClipboardEntry,
  type MachineSendClipboardResult,
  type MachineSendResult,
} from '../../../../core/integrations/pycore';
import { PycoreManagerStorageKeys as StorageKeys } from '../../persistence/PycoreManagerStorageKeys';
import { DEFAULT_SYNC_SHORTCUT, isUsableShortcut, matchesShortcut } from './machineSendShortcut';

export type MachineSendKind = 'file' | 'text' | 'clipboardText' | 'clipboardFile' | 'clipboardSync';
export type MachineSendStatus = 'sending' | 'done' | 'error';
export type MachineFileMode = 'receive' | 'clipboard';

interface ResultLine {
  key: string;
  params?: Record<string, string | number>;
}

export interface MachineSendActivity {
  id: string;
  kind: MachineSendKind;
  label: string;
  status: MachineSendStatus;
  progress: number;
  results: ResultLine[];
  errorKey: string;
  errorParams: Record<string, string | number>;
}

export type ClipboardHint = '' | 'permission' | 'unsupported' | 'empty';

const ERROR_KEY_PREFIX = 'machineSend.errors.';
const GENERIC_ERROR_KEY = 'machineSend.errors.generic';
const HISTORY_LIMIT = 50;
const IMAGE_KIND = 'image';
const FILE_KIND = 'file';
const LABEL_PREVIEW_CHARS = 40;
const BYTES_PER_MIB = 1024 * 1024;
const IMAGE_MIME = /^image\//i;

function errorOf(result: MachineSendResult | null | undefined): Pick<MachineSendActivity, 'errorKey' | 'errorParams'> {
  const params: Record<string, string | number> = {};
  if (result?.max_files) params.max_files = result.max_files;
  if (result?.max_bytes) params.max_mib = Math.round(result.max_bytes / BYTES_PER_MIB);
  return { errorKey: result?.error_code ? `${ERROR_KEY_PREFIX}${result.error_code}` : GENERIC_ERROR_KEY, errorParams: params };
}

const RELAY_TOO_LARGE_KEY = `${ERROR_KEY_PREFIX}relay_too_large`;

/**
 * Over the relay one request body is capped (relay contract `request_body_bytes`): a file above the cap is
 * blocked, the others are grouped into requests that each stay under it. Direct calls are limited by pycore.
 */
function planUploads(files: File[]): { groups: File[][]; blocked: File[]; limit: number } {
  if (!isPycoreRelayMode()) return { groups: files.length ? [files] : [], blocked: [], limit: 0 };
  const limit = RELAY_CONTRACT.limits.request_body_bytes;
  const groups: File[][] = [];
  const blocked: File[] = [];
  let current: File[] = [];
  let size = 0;
  files.forEach((file) => {
    if (file.size > limit) {
      blocked.push(file);
      return;
    }
    if (current.length && size + file.size > limit) {
      groups.push(current);
      current = [];
      size = 0;
    }
    current.push(file);
    size += file.size;
  });
  if (current.length) groups.push(current);
  return { groups, blocked, limit };
}

function preview(text: string): string {
  return text.length > LABEL_PREVIEW_CHARS ? `${text.slice(0, LABEL_PREVIEW_CHARS)}...` : text;
}

/** State and actions of the machine send panel: sends, activities, clipboard backups and the sync shortcut. */
export function usePcMachineSend() {
  const [activities, setActivities] = useState<MachineSendActivity[]>([]);
  const [history, setHistory] = useState<MachineClipboardEntry[]>([]);
  const [hint, setHint] = useState<ClipboardHint>('');
  const [shortcut, setShortcutState] = useState(
    () => StorageManager.getRaw(StorageKeys.PYCORE_MACHINE_SEND_SHORTCUT) || DEFAULT_SYNC_SHORTCUT,
  );
  const aborts = useRef(new Map<string, AbortController>());
  const counter = useRef(0);
  const mounted = useRef(true);

  const refreshHistory = useCallback(async () => {
    try {
      const answer = await pycoreApi.getMachineClipboardHistory(HISTORY_LIMIT);
      if (answer?.success && mounted.current) setHistory(answer.entries ?? []);
    } catch { /* the list keeps its last content */ }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refreshHistory();
    return () => {
      mounted.current = false;
      aborts.current.forEach((controller) => controller.abort());
    };
  }, [refreshHistory]);

  const patch = useCallback((id: string, change: Partial<MachineSendActivity>) => {
    if (mounted.current) setActivities((current) => current.map((entry) => (entry.id === id ? { ...entry, ...change } : entry)));
  }, []);

  const begin = useCallback((kind: MachineSendKind, label: string): { id: string; signal: AbortSignal } => {
    counter.current += 1;
    const id = `send-${counter.current}`;
    const controller = new AbortController();
    aborts.current.set(id, controller);
    setActivities((current) => [
      { id, kind, label, status: 'sending', progress: 0, results: [], errorKey: '', errorParams: {} },
      ...current,
    ]);
    return { id, signal: controller.signal };
  }, []);

  const finish = useCallback((id: string, ok: boolean, results: ResultLine[], error?: Partial<MachineSendActivity>) => {
    aborts.current.delete(id);
    patch(id, { status: ok ? 'done' : 'error', progress: ok ? 1 : 0, results, errorKey: '', errorParams: {}, ...error });
  }, [patch]);

  const fail = useCallback((id: string, error: unknown, result?: MachineSendResult | null) => {
    const name = (error as { name?: string } | null)?.name;
    if (name === 'AbortError') {
      finish(id, false, [], { errorKey: 'machineSend.cancelled' });
      return;
    }
    finish(id, false, [], name === 'TimeoutError' ? { errorKey: 'machineSend.stalled' } : errorOf(result));
  }, [finish]);

  const rememberBackup = useCallback((backup: MachineClipboardEntry | null | undefined) => {
    if (backup && mounted.current) setHistory((current) => [backup, ...current.filter((entry) => entry.id !== backup.id)].slice(0, HISTORY_LIMIT));
  }, []);

  const clipboardResult = useCallback((id: string, answer: MachineSendClipboardResult) => {
    rememberBackup(answer?.backup);
    if (answer?.success) {
      return finish(id, true, [
        { key: 'machineSend.result.clipboardReplaced' },
        ...(answer.notified ? [{ key: 'machineSend.result.notified' }] : []),
      ]);
    }
    const saved = answer?.path ? [{ key: 'machineSend.result.imageSaved', params: { path: answer.path } }] : [];
    return finish(id, false, saved, errorOf(answer));
  }, [finish, rememberBackup]);

  const sendFilesToFolder = useCallback(async (files: File[]) => {
    const label = files.length > 1 ? `${files[0].name} +${files.length - 1}` : files[0].name;
    const { id, signal } = begin('file', label);
    try {
      const answer = await pycoreApi.sendMachineFiles(files, { onProgress: (fraction) => patch(id, { progress: fraction }), signal });
      if (!answer?.success) {
        const saved = (answer?.saved ?? []).map((file) => ({ key: 'machineSend.result.fileSaved', params: { path: file.path } }));
        return finish(id, false, saved, errorOf(answer));
      }
      return finish(id, true, [
        { key: 'machineSend.result.filesSaved', params: { count: answer.saved?.length ?? 1, dir: answer.directory ?? '' } },
        ...(answer.opened ? [{ key: 'machineSend.result.folderOpened' }] : []),
      ]);
    } catch (error) {
      return fail(id, error);
    }
  }, [begin, fail, finish, patch]);

  const sendFileToClipboard = useCallback(async (file: File) => {
    const { id, signal } = begin('clipboardFile', file.name);
    try {
      const kind = IMAGE_MIME.test(file.type) ? IMAGE_KIND : FILE_KIND;
      clipboardResult(id, await pycoreApi.setMachineClipboardFile(file, kind, { onProgress: (fraction) => patch(id, { progress: fraction }), signal }));
    } catch (error) {
      fail(id, error);
    }
  }, [begin, clipboardResult, fail, patch]);

  const sendFiles = useCallback((files: File[], mode: MachineFileMode) => {
    const { groups, blocked, limit } = planUploads(files);
    blocked.forEach((file) => {
      const { id } = begin(mode === 'receive' ? 'file' : 'clipboardFile', file.name);
      finish(id, false, [], { errorKey: RELAY_TOO_LARGE_KEY, errorParams: { max_mib: Math.round(limit / BYTES_PER_MIB) } });
    });
    if (mode === 'receive') groups.forEach((group) => { void sendFilesToFolder(group); });
    else groups.flat().forEach((file) => { void sendFileToClipboard(file); });
  }, [begin, finish, sendFileToClipboard, sendFilesToFolder]);

  const sendText = useCallback(async (text: string, mode: 'editor' | 'clipboard') => {
    if (!text) return;
    const { id } = begin(mode === 'editor' ? 'text' : 'clipboardText', preview(text));
    try {
      if (mode === 'clipboard') return clipboardResult(id, await pycoreApi.setMachineClipboardText(text));
      const answer = await pycoreApi.sendMachineText(text);
      if (!answer?.success) return fail(id, null, answer);
      return finish(id, true, [
        { key: 'machineSend.result.textSaved', params: { path: answer.path ?? '' } },
        ...(answer.opened ? [{ key: 'machineSend.result.textOpened' }] : []),
      ]);
    } catch (error) {
      return fail(id, error);
    }
  }, [begin, clipboardResult, fail, finish]);

  /** This browser's clipboard to the machine's clipboard, through the same backup path. */
  const syncLocalClipboard = useCallback(async () => {
    setHint('');
    const clipboard = typeof navigator !== 'undefined' ? navigator.clipboard : undefined;
    if (!clipboard?.read && !clipboard?.readText) {
      setHint('unsupported');
      return;
    }
    let text = '';
    let image: File | null = null;
    try {
      if (clipboard.read) {
        for (const item of await clipboard.read()) {
          const imageType = item.types.find((type) => IMAGE_MIME.test(type));
          if (imageType) {
            image = new File([await item.getType(imageType)], `clipboard.${imageType.split('/')[1] || 'png'}`, { type: imageType });
            break;
          }
          if (item.types.includes('text/plain')) text = await (await item.getType('text/plain')).text();
        }
      } else {
        text = await clipboard.readText();
      }
    } catch {
      setHint('permission');
      return;
    }
    if (!image && !text) {
      setHint('empty');
      return;
    }
    const { id, signal } = begin('clipboardSync', image ? image.name : preview(text));
    try {
      clipboardResult(id, image
        ? await pycoreApi.setMachineClipboardFile(image, IMAGE_KIND, { onProgress: (fraction) => patch(id, { progress: fraction }), signal })
        : await pycoreApi.setMachineClipboardText(text));
    } catch (error) {
      fail(id, error);
    }
  }, [begin, clipboardResult, fail, patch]);

  const syncRef = useRef(syncLocalClipboard);
  syncRef.current = syncLocalClipboard;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !matchesShortcut(event, shortcut)) return;
      event.preventDefault();
      void syncRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcut]);

  const setShortcut = useCallback((combo: string): boolean => {
    if (!isUsableShortcut(combo)) return false;
    StorageManager.setRaw(StorageKeys.PYCORE_MACHINE_SEND_SHORTCUT, combo);
    setShortcutState(combo);
    return true;
  }, []);

  const cancel = useCallback((id: string) => { aborts.current.get(id)?.abort(); }, []);
  const dismiss = useCallback((id: string) => {
    aborts.current.get(id)?.abort();
    setActivities((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    setHistory((current) => current.filter((entry) => entry.id !== id));
    try { await pycoreApi.deleteMachineClipboardEntry(id); } catch { void refreshHistory(); }
  }, [refreshHistory]);

  const clearHistory = useCallback(async () => {
    setHistory([]);
    try { await pycoreApi.clearMachineClipboardHistory(); } catch { void refreshHistory(); }
  }, [refreshHistory]);

  return {
    activities, history, hint, shortcut,
    sendFiles, sendText, syncLocalClipboard, setShortcut,
    cancel, dismiss, deleteEntry, clearHistory, refreshHistory,
  };
}

