import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from '../../../core/i18n/UiI18n';
import { cmErrorMessage } from '../api/cmErrors';
import { cmPublicApi, type CmShowcaseSection } from '../api/CmPublicApi';

export type CmShowcaseKind = 'open_tasks' | 'completed_projects';

export const CM_SHOWCASE_PAGE_SIZE = 9;

export interface CmShowcaseSectionModel<T> {
  page: number;
  section: CmShowcaseSection<T> | null;
  loading: boolean;
  error: string | null;
  setPage: (page: number) => void;
  retry: () => void;
}

/** One public showcase section (open tasks or completed projects), paged. */
export function useCmShowcaseSection<T>(kind: CmShowcaseKind): CmShowcaseSectionModel<T> {
  const { t } = useTranslation('cm');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [section, setSection] = useState<CmShowcaseSection<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void cmPublicApi.getShowcase(page, CM_SHOWCASE_PAGE_SIZE).then((response) => {
      if (!active) return;
      setLoading(false);
      if (response.success && response.data) {
        setSection(response.data[kind] as unknown as CmShowcaseSection<T>);
      } else {
        setError(cmErrorMessage(t, response, 'showcase.loadFailed'));
      }
    });
    return () => {
      active = false;
    };
    // Reload on page or retry only; translation changes keep the data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, page, attempt]);

  const retry = useCallback((): void => setAttempt((current) => current + 1), []);

  return { page, section, loading, error, setPage, retry };
}
