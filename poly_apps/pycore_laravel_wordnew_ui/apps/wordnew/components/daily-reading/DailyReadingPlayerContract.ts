import type { DailyReadingRow } from './dailyReadingApi';
import type { WordNewSentenceWordRow } from '../../services/WordNewSentenceWordTable';
import type {
  DailyReadingPlaybackSettings,
  DailyReadingPlaybackStep,
  DailyReadingResourceStatus,
  DailyReadingSentencePlaybackStep,
} from './DailyReadingPlaybackModel';
import type { DailyReadingTransportState } from './DailyReadingPlaybackEngine';

export interface DailyReadingPlayer extends DailyReadingPlaybackSettings {
  open: boolean;
  playing: boolean;
  paused: boolean;
  transportState: DailyReadingTransportState;
  list: DailyReadingRow[];
  index: number;
  current: DailyReadingRow | null;
  currentTime: number;
  duration: number;
  activeStepType: DailyReadingPlaybackStep['type'] | null;
  activeStepId: string | null;
  activeStepItemIndex: number;
  activeSentenceLanguage: DailyReadingSentencePlaybackStep['lang'] | null;
  activeWord: string | null;
  activeWordIndex: number;
  activeWords: WordNewSentenceWordRow[];
  articleWords: WordNewSentenceWordRow[];
  resourceStatus: DailyReadingResourceStatus;
  wordProgressVersion: number;
  sessionReadTotal: number;
  start: (rows: DailyReadingRow[], startId?: string) => void;
  toggle: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  next: () => void;
  prev: () => void;
  updateSettings: (patch: Partial<DailyReadingPlaybackSettings>) => void;
}
