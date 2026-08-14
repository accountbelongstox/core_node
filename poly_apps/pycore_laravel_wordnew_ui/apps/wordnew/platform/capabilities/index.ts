/* =============================================================================
 * apps/wordnew/platform/capabilities — public device-capability libraries (Capacitor + web)
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
 *   - CapNotifications    local notifications + spaced-repetition review reminders
 *   - CapFilesystem       file storage + JSON store + OPFS large-blob cache (10-100 GB)
 *   - CapAppState         app lifecycle (pause/resume), back-button, deep links
 *   - CapCamera           photo capture / gallery pick / avatar (normalized result)
 *   - CapDatabase         document/collection DB (IndexedDB web / SQLite native) + raw SQL
 *
 * AUDIENCE
 *   These are PUBLIC — usable by any app/page in pycore_laravel_wordnew_ui —
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
 *   import { capNetwork, useBattery, CapMicMonitor } from '@/apps/wordnew/platform/capabilities';
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
  // extended: spell-out / read-along / repeat / lang guess
  RATE_PRESETS,
  resolveRate,
  guessLang,
  toLetters,
  spellOut,
  speakSequence,
  repeatSpeak,
  useReadAlong,
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
  CapRatePreset,
  CapSpeakSequenceItem,
  CapSpeakSequenceOptions,
  UseReadAlongResult,
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
  // extended: word-level analysis + drill
  analyzePronunciation,
  bestAttemptScore,
  usePronunciationDrill,
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
  CapWordScore,
  CapPronunciationAnalysis,
  UsePronunciationDrillResult,
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
  // extended: learning cues / sequence / metronome
  LEARNING_PATTERNS,
  learningHaptics,
  playHapticSequence,
  CapHapticMetronome,
  useLearningHaptics,
  useHapticMetronome,
} from './CapHaptics';
export type {
  CapTapStrength,
  CapNotifyKind,
  CapHapticPattern,
  CapHapticsOptions,
  UseHapticsResult,
  CapHapticStep,
} from './CapHaptics';

// --- Keep awake (screen wake-lock) -----------------------------------------
export {
  CapKeepAwakeService,
  capKeepAwake,
  acquireKeepAwake,
  keepAwakeDuring,
  useKeepAwake,
  useKeepAwakeState,
  // extended: timed lock + idle-aware session
  acquireKeepAwakeTimed,
  CapAwakeSession,
  useKeepAwakeTimed,
  useAwakeSession,
} from './CapKeepAwake';
export type {
  CapKeepAwakeState,
  CapKeepAwakeListener,
  CapAwakeSessionOptions,
} from './CapKeepAwake';

// --- Local notifications ---------------------------------------------------
export {
  CapNotificationsService,
  capNotify,
  scheduleReviewReminder,
  scheduleDailyStudyReminder,
  nextDailyTime,
  describeSchedule,
  useNotificationPermission,
  useNotifications,
  // extended: quiet hours / SRS planner / badge
  setQuietHours,
  isInQuietHours,
  avoidQuietHours,
  DEFAULT_SRS_INTERVALS_HOURS,
  scheduleSrsReminders,
  cancelSrsReminders,
  scheduleWeekly,
  setAppBadge,
  clearAppBadge,
  useReviewReminders,
  registerActionTypes,
  clearDelivered,
  MOTIVATION_MESSAGES,
  messageForToday,
  scheduleDailyRotating,
  useDailyReminder,
} from './CapNotifications';
export type {
  CapNotifyPermission,
  CapNotifyEvery,
  CapNotifyContent,
  CapNotifySchedule,
  CapPendingNotification,
  CapNotifyAction,
  CapNotifyChannel,
  CapQuietHours,
  CapSrsReminderPlan,
  CapNotifyActionType,
  CapDailyReminderSetting,
} from './CapNotifications';

// --- Filesystem ------------------------------------------------------------
export {
  CapFilesystemService,
  capFs,
  CapJsonStore,
  Directory,
  Encoding,
  textToBase64,
  base64ToText,
  blobToBase64 as fsBlobToBase64,
  useJsonFile,
  // extended: tree ops / upload / remote cache / object URL
  walkFiles,
  directorySize,
  copyTree,
  importFile,
  cacheRemote,
  toObjectUrl,
  bundleForExport,
  useDirectory,
  appendJsonl,
  readJsonl,
  tailJsonl,
  writeJsonl,
  CapFileCache,
  // large-file / big-cache subsystem (10-100 GB; OPFS + native disk)
  getStorageEstimate,
  requestPersistentStorage,
  isPersistentStorage,
  CapBlobStore,
  CapLargeCache,
  useStorageEstimate,
} from './CapFilesystem';
export type {
  CapFileStat,
  CapDirEntry,
  CapFsOptions,
  UseJsonFileResult,
  CapCacheOptions,
  CapFileCacheOptions,
  CapStorageEstimate,
  CapBlobPutOptions,
  CapBlobEntry,
} from './CapFilesystem';

// --- Read-through resource packages ---------------------------------------
export { CapResourcePackage, CapResourceAssetCache } from './CapResourcePackage';
export type {
  CapResourceRefreshMode,
  CapResourceRecord,
  CapResourcePackageOptions,
  CapResourceQuery,
  CapResourcePutOptions,
  CapResourceStats,
  CapResourceAssetCacheOptions,
  CapResourceAssetStats,
} from './CapResourcePackage';

// --- App lifecycle ---------------------------------------------------------
export {
  CapAppStateService,
  capApp,
  initAppState,
  useAppActive,
  useAppState,
  useAppLifecycle,
  useBackButton,
  useAppUrlOpen,
  // extended: idle / foreground time / double-back exit
  CapIdleDetector,
  useIdle,
  useForegroundTime,
  useDoubleBackExit,
  CapStudySession,
  useStudySession,
} from './CapAppState';
export type {
  CapBackButtonEvent,
  CapUrlOpenEvent,
  CapAppStateEventMap,
  CapAppStateListener,
  CapBackHandler,
  CapDeepLinkRoute,
  CapIdleOptions,
  CapStudySessionState,
  CapStudySessionSnapshot,
} from './CapAppState';

// --- Camera ----------------------------------------------------------------
export {
  CapCameraService,
  capCamera,
  takePhoto,
  pickPhoto,
  CameraResultType,
  CameraSource,
  CameraDirection,
  stripDataUrl,
  formatOf,
  dataUrlToBlob,
  downscaleDataUrl,
  squareCropDataUrl,
  useCamera,
  // extended: image processing
  getImageDimensions,
  generateThumbnail,
  rotateDataUrl,
  toGrayscale,
  documentScan,
  scanDocument,
  useAvatarPicker,
  cropDataUrl,
  stackImagesVertically,
  CapDocumentScanner,
  useDocumentScanner,
} from './CapCamera';
export type {
  CapPhoto,
  CapPhotoOptions,
  CapGalleryOptions,
  CapCameraPermission,
  UseCameraResult,
  CapScanOptions,
} from './CapCamera';

// --- Database (document store: IndexedDB web / SQLite native) ---------------
export {
  CapDatabase,
  CapCollection,
  capDb,
  openDatabase,
  applyQuery,
  useDatabase,
  useQuery,
  useDocument,
  useCollection,
  exportCollections,
  importCollections,
} from './CapDatabase';
export type {
  CapDoc,
  CapDbBackendKind,
  CapWhereOp,
  CapWhere,
  CapQuery,
  CapStoredDoc,
  CapRawResult,
  CapDbExport,
} from './CapDatabase';

// --- Auto-store (schema-on-write typed tables over CapDatabase) -------------
export {
  CapAutoStore,
  CapTypeInferrer,
  capStore,
  syncTable,
  useAutoQuery,
  useAutoInsert,
} from './CapAutoStore';
export type {
  CapColType,
  CapTableColumns,
  CapTableSchema,
  CapAutoTableOptions,
  CapAutoStoreOptions,
} from './CapAutoStore';

// --- Social login (Google + GitHub, native + web) ---------------------------
export {
  CapSocialAuthService,
  capSocial,
  signInWithGoogle,
  signInWithGitHub,
  useSocialAuth,
} from './CapSocialAuth';
export type {
  CapSocialProvider,
  CapSocialConfig,
  CapSocialCredential,
  CapSocialError,
  UseSocialAuthResult,
} from './CapSocialAuth';
