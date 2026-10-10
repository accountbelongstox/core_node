/** Wordnew UI timing constants (milliseconds) and list page sizes. */

export const PRESENCE_HEARTBEAT_MS = 30_000;
export const SOCIAL_LIVE_BEAT_MS = 20_000;
export const SOCIAL_PRESENCE_POLL_MS = 45_000;
export const SOCIAL_SEARCH_DEBOUNCE_MS = 350;
export const SOCIAL_POSTS_PAGE_SIZE = 20;
export const SOCIAL_DISCOVER_PAGE_SIZE = 50;
export const AUDIO_WAVE_PULSE_MS = 1600;
export const ADMIN_SEARCH_DEBOUNCE_MS = 400;
export const LIBRARY_MEDIA_RETRY_COUNT = 3;
export const LIBRARY_MEDIA_RETRY_MS = 4000;
export const BILINGUAL_SPEECH_BEAT_MS = 600;
export const WALKMAN_NATIVE_BEAT_MS = 600;
export const WALKMAN_STEP_PAUSE_MS = 1000;
export const WALKMAN_NEXT_WORD_MS = 1200;
export const SUBTITLE_GROUPS_PAGE_SIZE = 200;
export const SUBTITLE_DETAIL_PAGE_SIZE = 500;
/** How long an interactive play waits for a clip by identity (device store, then the schedule's transfers) before its next tier (browser speech). */
export const CLIP_RESOLVE_WAIT_MS = 1500;
/** How long the first item of a playing sequence waits for its clip before the next tier plays. */
export const CLIP_FIRST_ITEM_WAIT_MS = 2500;
