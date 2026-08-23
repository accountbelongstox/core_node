import { useEffect, useState } from 'react';
import { cmApi } from './CmApi';
import type { CmPublicHomeData } from './CmApiTypes';

export interface CmPublicHomeState {
  data: CmPublicHomeData | null;
  loading: boolean;
}

const INITIAL_STATE: CmPublicHomeState = {
  data: null,
  loading: true,
};

export function useCmPublicHome(): CmPublicHomeState {
  const [state, setState] = useState<CmPublicHomeState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;
    void cmApi.getPublicHome().then((result) => {
      if (!active) return;
      setState({ data: result.data, loading: false });
    });
    return () => {
      active = false;
    };
  }, []);

  return state;
}
