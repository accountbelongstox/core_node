/** React binding of one cached generated file (see orchTaskFileCache). */
import { useCallback, useEffect, useState } from 'react';
import type { OrchTaskFile } from '@/apps/pycore-manager/api';
import {
  loadOrchFile,
  orchFileKey,
  orchFileState,
  orchFileTooLarge,
  retainOrchFile,
  saveOrchFile,
} from './orchTaskFileCache';

export function useOrchTaskFile(taskId: string, file: OrchTaskFile) {
  const key = orchFileKey(taskId, file);
  const [, setRevision] = useState(0);

  useEffect(() => {
    const release = retainOrchFile(key, () => setRevision((value) => value + 1));
    setRevision((value) => value + 1);
    return release;
  }, [key]);

  const load = useCallback(() => loadOrchFile(key, taskId, file), [key, taskId, file]);
  const download = useCallback(async () => {
    if (await load()) saveOrchFile(key, file.name);
  }, [key, file.name, load]);

  return { state: orchFileState(key), tooLarge: orchFileTooLarge(file), load, download };
}
