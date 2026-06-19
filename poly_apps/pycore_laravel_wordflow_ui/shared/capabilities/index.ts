/* =============================================================================
 * shared/capabilities — public device-capability libraries (Capacitor + web)
 * =============================================================================
 *
 * A small suite of cross-platform capability wrappers. Each one prefers the
 * native Capacitor plugin when running inside a native app and falls back to a
 * browser implementation otherwise, behind one clean, event-driven, typed API
 * plus a React hook.
 *
 *   - CapAudioRecorder    voice / audio recording (record -> base64/Blob clip)
 *   - CapMicMonitor       live microphone listening: level meter + VAD + waveform
 *   - CapGeolocation      current position / watch / permissions / geo math
 *   - CapNetwork          connectivity state + change events + quality hints
 *   - CapBattery          battery level / charging + low/critical warnings
 *   - CapTextToSpeech     pronunciation playback (queue, voices, karaoke boundary)
 *   - CapSpeechRecognition spoken input + built-in pronunciation scoring
 *   - CapHaptics          tactile feedback (success/error/tap, custom patterns)
 *   - CapKeepAwake        ref-counted screen wake-lock (Walkman/listening)
 *
 * AUDIENCE
 *   These are PUBLIC — usable by any app/page in pycore_laravel_wordflow_ui —
 *   but they were *built primarily for the wordnew mobile APP* (the native
 *   Capacitor build of /wordnew): pronunciation capture, "we hear you" meters,
 *   connectivity-aware sync, and battery-aware long study sessions. On the web
 *   shell every module degrades gracefully to a browser implementation.
 *
 * PLATFORM WIRING
 *   On the web build, `@capacitor/*` (and @capacitor-community/voice-recorder)
 *   resolve to browser-backed shims via vite.config.ts aliases, so these import
 *   cleanly without the npm plugins installed. In the native wordnew app the
 *   real plugins are used. The native app must still declare the OS permissions
 *   (mic, location) in its AndroidManifest.xml / Info.plist.
 *
 * USAGE
 *   import { capNetwork, useBattery, CapMicMonitor } from '@/shared/capabilities';
 * ========================================================================== */

// --- Audio recording -------------------------------------------------------
export {
  CapAudioRecorderService,
  capRecorder,
  startRecording,
  stopRecording,
  useAudioRecorder,
  formatDuration,
  formatBytes,
  blobToBase64,
  base64ToBlob,
  base64Bytes,
  // extended: playback + visualization
  clipPlaybackSrc,
  clipFileName,
  downloadClip,
  decodeWaveformPeaks,
  CapClipPlayer,
  useClipPlayback,
} from './CapAudioRecorder';
export type {
  CapRecorderState,
  CapRecordingClip,
  CapRecorderStartOptions,
  CapRecorderError,
  CapRecorderEventMap,
  CapRecorderListener,
  UseAudioRecorderResult,
  CapPlaybackState,
  CapPlaybackStatus,
} from './CapAudioRecorder';

// --- Microphone listening / metering --------------------------------------
export {
  CapMicMonitor,
  useMicLevel,
  formatDb,
  levelToBars,
  // extended: spectrum / pitch
  frequencyBandEnergies,
  dominantFrequency,
  estimatePitchHz,
  frequencyToNote,
  useMicBands,
  useMicPitch,
} from './CapMicMonitor';
export type {
  CapMicMetrics,
  CapMicError,
  CapMicEventMap,
  CapMicListener,
  CapMicOptions,
  CapMicDevice,
  UseMicLevelOptions,
  UseMicLevelResult,
  CapFrequencyBands,
} from './CapMicMonitor';

// --- Geolocation -----------------------------------------------------------
export {
  CapGeolocationService,
  capGeo,
  getCurrentPosition,
  watchPosition,
  useGeolocation,
  haversineMeters,
  bearingDegrees,
  compassLabel,
  accuracyBucket,
  formatDistance,
  formatCoords,
  // extended: DMS / geodesy / geofencing
  toDMS,
  formatCoordsDMS,
  speedKmh,
  formatSpeed,
  destinationPoint,
  midpoint,
  boundingBox,
  CapGeofenceMonitor,
  useDistanceTo,
  useGeofences,
} from './CapGeolocation';
export type {
  CapCoords,
  CapPosition,
  CapGeoPermission,
  CapGeoAccuracy,
  CapGeoOptions,
  CapGeoServiceOptions,
  CapGeoError,
  CapGeoEventMap,
  CapGeoListener,
  UseGeolocationOptions,
  UseGeolocationResult,
  CapGeofence,
  CapGeofenceEvent,
} from './CapGeolocation';

// --- Network status --------------------------------------------------------
export {
  CapNetworkService,
  capNetwork,
  initNetwork,
  getNetworkStatus,
  onNetworkChange,
  useNetworkStatus,
  useIsOnline,
  useNetworkEdges,
  describeConnectionType,
  describeQuality,
  connectionGlyph,
  deriveQuality,
  statusChanged,
  // extended: reachability / wait / retry / badge
  probeReachability,
  waitForOnline,
  retryWhenOnline,
  networkBadge,
  useNetworkBadge,
  useReachability,
} from './CapNetwork';
export type {
  CapConnectionType,
  CapNetworkQuality,
  CapNetworkSource,
  CapNetworkStatus,
  CapNetworkTransition,
  CapNetworkEventMap,
  CapNetworkListener,
  CapNetworkOptions,
  CapReachabilityOptions,
  CapReachabilityResult,
  CapRetryOptions,
  CapNetworkBadge,
} from './CapNetwork';

// --- Battery / power -------------------------------------------------------
export {
  CapBatteryService,
  capBattery,
  initBattery,
  getBatteryStatus,
  onBatteryChange,
  useBattery,
  useBatteryWarnings,
  formatBatteryPct,
  batteryGlyph,
  describeBattery,
  describeTimeToEmpty,
  // extended: power-mode guidance
  recommendPowerMode,
  describePowerMode,
  formatMinutes,
  buildPowerProfile,
  whenCharging,
  runUnlessCritical,
  usePowerMode,
  useBatterySaver,
  usePowerProfile,
  // extended: session history
  CapBatteryRecorder,
  formatSessionStats,
  useBatteryHistory,
} from './CapBattery';
export type {
  CapBatterySource,
  CapBatteryStatus,
  CapBatteryEventMap,
  CapBatteryListener,
  CapBatteryOptions,
  CapPowerMode,
  CapPowerProfile,
  CapBatterySample,
  CapBatterySessionStats,
} from './CapBattery';

// --- Text-to-speech --------------------------------------------------------
export {
  CapTextToSpeechService,
  capTTS,
  speak,
  speakWord,
  stopSpeaking,
  primaryLang,
  pickVoiceForLang,
  useTextToSpeech,
} from './CapTextToSpeech';
export type {
  CapVoice,
  CapTTSSpeakOptions,
  CapTTSBoundary,
  CapTTSError,
  CapTTSEventMap,
  CapTTSListener,
  CapTTSOptions,
  UseTextToSpeechResult,
} from './CapTextToSpeech';

// --- Speech recognition ----------------------------------------------------
export {
  CapSpeechRecognitionService,
  capSTT,
  listenOnce,
  checkPronunciation,
  scorePronunciation,
  normalizeForCompare,
  levenshtein,
  similarity,
  useSpeechRecognition,
} from './CapSpeechRecognition';
export type {
  CapSTTPermission,
  CapSTTOptions,
  CapSTTResult,
  CapSTTError,
  CapSTTEventMap,
  CapSTTListener,
  CapPronunciationScore,
  UseSpeechRecognitionResult,
} from './CapSpeechRecognition';

// --- Haptics ---------------------------------------------------------------
export {
  CapHapticsService,
  capHaptics,
  hapticSuccess,
  hapticError,
  hapticTap,
  HAPTIC_PATTERNS,
  useHaptics,
} from './CapHaptics';
export type {
  CapTapStrength,
  CapNotifyKind,
  CapHapticPattern,
  CapHapticsOptions,
  UseHapticsResult,
} from './CapHaptics';

// --- Keep awake (screen wake-lock) -----------------------------------------
export {
  CapKeepAwakeService,
  capKeepAwake,
  acquireKeepAwake,
  keepAwakeDuring,
  useKeepAwake,
  useKeepAwakeState,
} from './CapKeepAwake';
export type {
  CapKeepAwakeState,
  CapKeepAwakeListener,
} from './CapKeepAwake';
