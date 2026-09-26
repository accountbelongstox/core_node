import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmPublicApi, resolveCmPublicLocale, type CmPublicHomeSnapshot } from './CmPublicApi';

export interface CmPublicHomeState {
  data: CmPublicHomeSnapshot | null;
  loading: boolean;
  errorCode: string | null;
  reload: () => void;
}

/** Public home aggregates in the current UI locale, with an explicit retry. */
export function useCmPublicHome(): CmPublicHomeState {
  const { i18n } = useTranslation('cm');
  const locale = resolveCmPublicLocale(i18n.language);
  const [data, setData] = useState<CmPublicHomeSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void cmPublicApi.getHome(locale).then((result) => {
      if (!active) return;
      setData(result.data);
      setErrorCode(result.errorCode);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [locale, attempt]);

  const reload = useCallback(() => setAttempt((current) => current + 1), []);

  return { data, loading, errorCode, reload };
}
