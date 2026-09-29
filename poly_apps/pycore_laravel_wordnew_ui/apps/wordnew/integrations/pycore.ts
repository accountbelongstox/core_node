/** WordNew-specific adapter over the optional shared Pycore runtime. */
export {
  classifyPycoreAccess,
  connectPycoreHttp,
  pycoreApi,
  PYCORE_EVENT_TOPICS,
  subscribe,
  ttsEngineBadgeLabel,
  ttsEngineUiState,
} from '../../../core/integrations/pycore';
export type { PycoreAccess } from '../../../core/integrations/pycore';
