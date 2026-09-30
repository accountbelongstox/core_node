/** Video look presets (pycore `ui/audio_orch/video/presets`) shared by the preset panel and the task pickers. */
import { useCallback, useEffect, useState } from 'react';
import { pycoreApi, type OrchVideoPresetsResponse } from '@/apps/pycore-manager/api';
import { ORCH_L, orchErrorMessage } from './orchShared';

export function useOrchVideoPresets() {
  const [data, setData] = useState<OrchVideoPresetsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await pycoreApi.orchVideoPresets();
      if (!response.success) throw new Error(ORCH_L.videoLoadFailed);
      setData(response);
      setError(null);
    } catch (e) {
      setError(orchErrorMessage(e, ORCH_L.videoLoadFailed));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, reload, apply: setData };
}

export type OrchVideoPresetsState = ReturnType<typeof useOrchVideoPresets>;
