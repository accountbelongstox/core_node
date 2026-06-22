import 'package:flutter/foundation.dart';

class LanguageVoiceSettings {
  final String appLanguage;
  final String pronunciationEngine;
  final double pronunciationSpeed;
  final String phoneticFormat;
  final String ttsEngine;
  final double ttsVolume;
  final bool autoPlayOnClick;
  final bool autoPlayOnStudy;
  final bool autoPlayExamples;
  final bool autoPlayOnContinuous;
  final List<String> downloadedVoicePacks;
  final String targetLanguage;
  final String translationLanguage;
  final String exampleTranslationLanguage;
  final bool showExampleTranslation;

  const LanguageVoiceSettings({
    this.appLanguage = 'zh',
    this.pronunciationEngine = 'en-US',
    this.pronunciationSpeed = 1.0,
    this.phoneticFormat = 'KK',
    this.ttsEngine = 'google',
    this.ttsVolume = 0.8,
    this.autoPlayOnClick = true,
    this.autoPlayOnStudy = true,
    this.autoPlayExamples = false,
    this.autoPlayOnContinuous = true,
    this.downloadedVoicePacks = const [],
    this.targetLanguage = 'en',
    this.translationLanguage = 'zh',
    this.exampleTranslationLanguage = 'zh',
    this.showExampleTranslation = true,
  });

  LanguageVoiceSettings copyWith({
    String? appLanguage,
    String? pronunciationEngine,
    double? pronunciationSpeed,
    String? phoneticFormat,
    String? ttsEngine,
    double? ttsVolume,
    bool? autoPlayOnClick,
    bool? autoPlayOnStudy,
    bool? autoPlayExamples,
    bool? autoPlayOnContinuous,
    List<String>? downloadedVoicePacks,
    String? targetLanguage,
    String? translationLanguage,
    String? exampleTranslationLanguage,
    bool? showExampleTranslation,
  }) {
    return LanguageVoiceSettings(
      appLanguage: appLanguage ?? this.appLanguage,
      pronunciationEngine: pronunciationEngine ?? this.pronunciationEngine,
      pronunciationSpeed: pronunciationSpeed ?? this.pronunciationSpeed,
      phoneticFormat: phoneticFormat ?? this.phoneticFormat,
      ttsEngine: ttsEngine ?? this.ttsEngine,
      ttsVolume: ttsVolume ?? this.ttsVolume,
      autoPlayOnClick: autoPlayOnClick ?? this.autoPlayOnClick,
      autoPlayOnStudy: autoPlayOnStudy ?? this.autoPlayOnStudy,
      autoPlayExamples: autoPlayExamples ?? this.autoPlayExamples,
      autoPlayOnContinuous: autoPlayOnContinuous ?? this.autoPlayOnContinuous,
      downloadedVoicePacks: downloadedVoicePacks ?? this.downloadedVoicePacks,
      targetLanguage: targetLanguage ?? this.targetLanguage,
      translationLanguage: translationLanguage ?? this.translationLanguage,
      exampleTranslationLanguage: exampleTranslationLanguage ?? this.exampleTranslationLanguage,
      showExampleTranslation: showExampleTranslation ?? this.showExampleTranslation,
    );
  }

  Map<String, dynamic> toJson() => {
    'app_language': appLanguage,
    'pronunciation_engine': pronunciationEngine,
    'pronunciation_speed': pronunciationSpeed,
    'phonetic_format': phoneticFormat,
    'tts_engine': ttsEngine,
    'tts_volume': ttsVolume,
    'auto_play_on_click': autoPlayOnClick,
    'auto_play_on_study': autoPlayOnStudy,
    'auto_play_examples': autoPlayExamples,
    'auto_play_on_continuous': autoPlayOnContinuous,
    'downloaded_voice_packs': downloadedVoicePacks,
    'target_language': targetLanguage,
    'translation_language': translationLanguage,
    'example_translation_language': exampleTranslationLanguage,
    'show_example_translation': showExampleTranslation,
  };

  factory LanguageVoiceSettings.fromJson(Map<String, dynamic> json) {
    return LanguageVoiceSettings(
      appLanguage: json['app_language'] as String? ?? 'zh',
      pronunciationEngine: json['pronunciation_engine'] as String? ?? 'en-US',
      pronunciationSpeed: (json['pronunciation_speed'] as num?)?.toDouble() ?? 1.0,
      phoneticFormat: json['phonetic_format'] as String? ?? 'KK',
      ttsEngine: json['tts_engine'] as String? ?? 'google',
      ttsVolume: (json['tts_volume'] as num?)?.toDouble() ?? 0.8,
      autoPlayOnClick: json['auto_play_on_click'] as bool? ?? true,
      autoPlayOnStudy: json['auto_play_on_study'] as bool? ?? true,
      autoPlayExamples: json['auto_play_examples'] as bool? ?? false,
      autoPlayOnContinuous: json['auto_play_on_continuous'] as bool? ?? true,
      downloadedVoicePacks: (json['downloaded_voice_packs'] as List<dynamic>?)?.cast<String>() ?? [],
      targetLanguage: json['target_language'] as String? ?? 'en',
      translationLanguage: json['translation_language'] as String? ?? 'zh',
      exampleTranslationLanguage: json['example_translation_language'] as String? ?? 'zh',
      showExampleTranslation: json['show_example_translation'] as bool? ?? true,
    );
  }
}

class LearningSettings {
  final int dailyNewWords;
  final int dailyReviewWords;
  final int dailyMinutes;
  final String learningPlanType;
  final String defaultLearningMode;
  final String learningOrder;
  final bool breakpointResume;
  final bool spellingCheck;
  final String reviewAlgorithm;
  final int reviewReminderHour;
  final int reviewReminderMinute;
  final bool allowEarlyReview;
  final int earlyReviewDays;
  final bool accumulateOverdue;
  final double completionStandard;
  final String difficultyFilter;
  final bool adaptiveDifficulty;
  final String cefrLevel;

  const LearningSettings({
    this.dailyNewWords = 20,
    this.dailyReviewWords = 50,
    this.dailyMinutes = 20,
    this.learningPlanType = 'standard',
    this.defaultLearningMode = 'reading',
    this.learningOrder = 'smart',
    this.breakpointResume = true,
    this.spellingCheck = false,
    this.reviewAlgorithm = 'ebbinghaus',
    this.reviewReminderHour = 8,
    this.reviewReminderMinute = 0,
    this.allowEarlyReview = true,
    this.earlyReviewDays = 3,
    this.accumulateOverdue = true,
    this.completionStandard = 0.8,
    this.difficultyFilter = 'all',
    this.adaptiveDifficulty = true,
    this.cefrLevel = 'B1',
  });

  LearningSettings copyWith({
    int? dailyNewWords,
    int? dailyReviewWords,
    int? dailyMinutes,
    String? learningPlanType,
    String? defaultLearningMode,
    String? learningOrder,
    bool? breakpointResume,
    bool? spellingCheck,
    String? reviewAlgorithm,
    int? reviewReminderHour,
    int? reviewReminderMinute,
    bool? allowEarlyReview,
    int? earlyReviewDays,
    bool? accumulateOverdue,
    double? completionStandard,
    String? difficultyFilter,
    bool? adaptiveDifficulty,
    String? cefrLevel,
  }) {
    return LearningSettings(
      dailyNewWords: dailyNewWords ?? this.dailyNewWords,
      dailyReviewWords: dailyReviewWords ?? this.dailyReviewWords,
      dailyMinutes: dailyMinutes ?? this.dailyMinutes,
      learningPlanType: learningPlanType ?? this.learningPlanType,
      defaultLearningMode: defaultLearningMode ?? this.defaultLearningMode,
      learningOrder: learningOrder ?? this.learningOrder,
      breakpointResume: breakpointResume ?? this.breakpointResume,
      spellingCheck: spellingCheck ?? this.spellingCheck,
      reviewAlgorithm: reviewAlgorithm ?? this.reviewAlgorithm,
      reviewReminderHour: reviewReminderHour ?? this.reviewReminderHour,
      reviewReminderMinute: reviewReminderMinute ?? this.reviewReminderMinute,
      allowEarlyReview: allowEarlyReview ?? this.allowEarlyReview,
      earlyReviewDays: earlyReviewDays ?? this.earlyReviewDays,
      accumulateOverdue: accumulateOverdue ?? this.accumulateOverdue,
      completionStandard: completionStandard ?? this.completionStandard,
      difficultyFilter: difficultyFilter ?? this.difficultyFilter,
      adaptiveDifficulty: adaptiveDifficulty ?? this.adaptiveDifficulty,
      cefrLevel: cefrLevel ?? this.cefrLevel,
    );
  }

  Map<String, dynamic> toJson() => {
    'daily_new_words': dailyNewWords,
    'daily_review_words': dailyReviewWords,
    'daily_minutes': dailyMinutes,
    'learning_plan_type': learningPlanType,
    'default_learning_mode': defaultLearningMode,
    'learning_order': learningOrder,
    'breakpoint_resume': breakpointResume,
    'spelling_check': spellingCheck,
    'review_algorithm': reviewAlgorithm,
    'review_reminder_hour': reviewReminderHour,
    'review_reminder_minute': reviewReminderMinute,
    'allow_early_review': allowEarlyReview,
    'early_review_days': earlyReviewDays,
    'accumulate_overdue': accumulateOverdue,
    'completion_standard': completionStandard,
    'difficulty_filter': difficultyFilter,
    'adaptive_difficulty': adaptiveDifficulty,
    'cefr_level': cefrLevel,
  };

  factory LearningSettings.fromJson(Map<String, dynamic> json) {
    return LearningSettings(
      dailyNewWords: json['daily_new_words'] as int? ?? 20,
      dailyReviewWords: json['daily_review_words'] as int? ?? 50,
      dailyMinutes: json['daily_minutes'] as int? ?? 20,
      learningPlanType: json['learning_plan_type'] as String? ?? 'standard',
      defaultLearningMode: json['default_learning_mode'] as String? ?? 'reading',
      learningOrder: json['learning_order'] as String? ?? 'smart',
      breakpointResume: json['breakpoint_resume'] as bool? ?? true,
      spellingCheck: json['spelling_check'] as bool? ?? false,
      reviewAlgorithm: json['review_algorithm'] as String? ?? 'ebbinghaus',
      reviewReminderHour: json['review_reminder_hour'] as int? ?? 8,
      reviewReminderMinute: json['review_reminder_minute'] as int? ?? 0,
      allowEarlyReview: json['allow_early_review'] as bool? ?? true,
      earlyReviewDays: json['early_review_days'] as int? ?? 3,
      accumulateOverdue: json['accumulate_overdue'] as bool? ?? true,
      completionStandard: (json['completion_standard'] as num?)?.toDouble() ?? 0.8,
      difficultyFilter: json['difficulty_filter'] as String? ?? 'all',
      adaptiveDifficulty: json['adaptive_difficulty'] as bool? ?? true,
      cefrLevel: json['cefr_level'] as String? ?? 'B1',
    );
  }
}

class DisplaySettings {
  final String themeMode;
  final String themeColor;
  final bool eyeCareMode;
  final String backgroundType;
  final int fontSize;
  final String wordFont;
  final String translationFont;
  final String fontWeight;
  final double lineSpacing;
  final String cardStyle;
  final bool showPhonetic;
  final bool showPartOfSpeech;
  final bool showExamples;
  final bool showWordRoot;
  final bool showSynonyms;
  final bool showProgressBar;
  final bool enableAnimations;
  final int animationFps;
  final String transitionEffect;
  final bool hapticFeedback;
  final String hapticStrength;
  final bool soundEffects;
  final double soundVolume;

  const DisplaySettings({
    this.themeMode = 'light',
    this.themeColor = 'blue',
    this.eyeCareMode = false,
    this.backgroundType = 'solid',
    this.fontSize = 16,
    this.wordFont = 'times_new_roman',
    this.translationFont = 'system',
    this.fontWeight = 'normal',
    this.lineSpacing = 1.5,
    this.cardStyle = 'standard',
    this.showPhonetic = true,
    this.showPartOfSpeech = true,
    this.showExamples = true,
    this.showWordRoot = false,
    this.showSynonyms = false,
    this.showProgressBar = true,
    this.enableAnimations = true,
    this.animationFps = 60,
    this.transitionEffect = 'fade',
    this.hapticFeedback = true,
    this.hapticStrength = 'medium',
    this.soundEffects = true,
    this.soundVolume = 0.5,
  });

  DisplaySettings copyWith({
    String? themeMode,
    String? themeColor,
    bool? eyeCareMode,
    String? backgroundType,
    int? fontSize,
    String? wordFont,
    String? translationFont,
    String? fontWeight,
    double? lineSpacing,
    String? cardStyle,
    bool? showPhonetic,
    bool? showPartOfSpeech,
    bool? showExamples,
    bool? showWordRoot,
    bool? showSynonyms,
    bool? showProgressBar,
    bool? enableAnimations,
    int? animationFps,
    String? transitionEffect,
    bool? hapticFeedback,
    String? hapticStrength,
    bool? soundEffects,
    double? soundVolume,
  }) {
    return DisplaySettings(
      themeMode: themeMode ?? this.themeMode,
      themeColor: themeColor ?? this.themeColor,
      eyeCareMode: eyeCareMode ?? this.eyeCareMode,
      backgroundType: backgroundType ?? this.backgroundType,
      fontSize: fontSize ?? this.fontSize,
      wordFont: wordFont ?? this.wordFont,
      translationFont: translationFont ?? this.translationFont,
      fontWeight: fontWeight ?? this.fontWeight,
      lineSpacing: lineSpacing ?? this.lineSpacing,
      cardStyle: cardStyle ?? this.cardStyle,
      showPhonetic: showPhonetic ?? this.showPhonetic,
      showPartOfSpeech: showPartOfSpeech ?? this.showPartOfSpeech,
      showExamples: showExamples ?? this.showExamples,
      showWordRoot: showWordRoot ?? this.showWordRoot,
      showSynonyms: showSynonyms ?? this.showSynonyms,
      showProgressBar: showProgressBar ?? this.showProgressBar,
      enableAnimations: enableAnimations ?? this.enableAnimations,
      animationFps: animationFps ?? this.animationFps,
      transitionEffect: transitionEffect ?? this.transitionEffect,
      hapticFeedback: hapticFeedback ?? this.hapticFeedback,
      hapticStrength: hapticStrength ?? this.hapticStrength,
      soundEffects: soundEffects ?? this.soundEffects,
      soundVolume: soundVolume ?? this.soundVolume,
    );
  }

  Map<String, dynamic> toJson() => {
    'theme_mode': themeMode,
    'theme_color': themeColor,
    'eye_care_mode': eyeCareMode,
    'background_type': backgroundType,
    'font_size': fontSize,
    'word_font': wordFont,
    'translation_font': translationFont,
    'font_weight': fontWeight,
    'line_spacing': lineSpacing,
    'card_style': cardStyle,
    'show_phonetic': showPhonetic,
    'show_part_of_speech': showPartOfSpeech,
    'show_examples': showExamples,
    'show_word_root': showWordRoot,
    'show_synonyms': showSynonyms,
    'show_progress_bar': showProgressBar,
    'enable_animations': enableAnimations,
    'animation_fps': animationFps,
    'transition_effect': transitionEffect,
    'haptic_feedback': hapticFeedback,
    'haptic_strength': hapticStrength,
    'sound_effects': soundEffects,
    'sound_volume': soundVolume,
  };

  factory DisplaySettings.fromJson(Map<String, dynamic> json) {
    return DisplaySettings(
      themeMode: json['theme_mode'] as String? ?? 'light',
      themeColor: json['theme_color'] as String? ?? 'blue',
      eyeCareMode: json['eye_care_mode'] as bool? ?? false,
      backgroundType: json['background_type'] as String? ?? 'solid',
      fontSize: json['font_size'] as int? ?? 16,
      wordFont: json['word_font'] as String? ?? 'times_new_roman',
      translationFont: json['translation_font'] as String? ?? 'system',
      fontWeight: json['font_weight'] as String? ?? 'normal',
      lineSpacing: (json['line_spacing'] as num?)?.toDouble() ?? 1.5,
      cardStyle: json['card_style'] as String? ?? 'standard',
      showPhonetic: json['show_phonetic'] as bool? ?? true,
      showPartOfSpeech: json['show_part_of_speech'] as bool? ?? true,
      showExamples: json['show_examples'] as bool? ?? true,
      showWordRoot: json['show_word_root'] as bool? ?? false,
      showSynonyms: json['show_synonyms'] as bool? ?? false,
      showProgressBar: json['show_progress_bar'] as bool? ?? true,
      enableAnimations: json['enable_animations'] as bool? ?? true,
      animationFps: json['animation_fps'] as int? ?? 60,
      transitionEffect: json['transition_effect'] as String? ?? 'fade',
      hapticFeedback: json['haptic_feedback'] as bool? ?? true,
      hapticStrength: json['haptic_strength'] as String? ?? 'medium',
      soundEffects: json['sound_effects'] as bool? ?? true,
      soundVolume: (json['sound_volume'] as num?)?.toDouble() ?? 0.5,
    );
  }
}

class NotificationSettings {
  final bool dailyStudyReminder;
  final List<int> studyReminderTimes;
  final bool reviewReminder;
  final List<int> reviewReminderTimes;
  final bool checkInReminder;
  final bool goalReminder;
  final bool achievementNotification;
  final bool socialNotification;
  final bool systemNotification;
  final bool doNotDisturbEnabled;
  final int doNotDisturbStartHour;
  final int doNotDisturbEndHour;
  final bool weekendDoNotDisturb;

  const NotificationSettings({
    this.dailyStudyReminder = true,
    this.studyReminderTimes = const [8, 20],
    this.reviewReminder = true,
    this.reviewReminderTimes = const [9, 21],
    this.checkInReminder = true,
    this.goalReminder = true,
    this.achievementNotification = true,
    this.socialNotification = false,
    this.systemNotification = true,
    this.doNotDisturbEnabled = true,
    this.doNotDisturbStartHour = 22,
    this.doNotDisturbEndHour = 8,
    this.weekendDoNotDisturb = false,
  });

  NotificationSettings copyWith({
    bool? dailyStudyReminder,
    List<int>? studyReminderTimes,
    bool? reviewReminder,
    List<int>? reviewReminderTimes,
    bool? checkInReminder,
    bool? goalReminder,
    bool? achievementNotification,
    bool? socialNotification,
    bool? systemNotification,
    bool? doNotDisturbEnabled,
    int? doNotDisturbStartHour,
    int? doNotDisturbEndHour,
    bool? weekendDoNotDisturb,
  }) {
    return NotificationSettings(
      dailyStudyReminder: dailyStudyReminder ?? this.dailyStudyReminder,
      studyReminderTimes: studyReminderTimes ?? this.studyReminderTimes,
      reviewReminder: reviewReminder ?? this.reviewReminder,
      reviewReminderTimes: reviewReminderTimes ?? this.reviewReminderTimes,
      checkInReminder: checkInReminder ?? this.checkInReminder,
      goalReminder: goalReminder ?? this.goalReminder,
      achievementNotification: achievementNotification ?? this.achievementNotification,
      socialNotification: socialNotification ?? this.socialNotification,
      systemNotification: systemNotification ?? this.systemNotification,
      doNotDisturbEnabled: doNotDisturbEnabled ?? this.doNotDisturbEnabled,
      doNotDisturbStartHour: doNotDisturbStartHour ?? this.doNotDisturbStartHour,
      doNotDisturbEndHour: doNotDisturbEndHour ?? this.doNotDisturbEndHour,
      weekendDoNotDisturb: weekendDoNotDisturb ?? this.weekendDoNotDisturb,
    );
  }

  Map<String, dynamic> toJson() => {
    'daily_study_reminder': dailyStudyReminder,
    'study_reminder_times': studyReminderTimes,
    'review_reminder': reviewReminder,
    'review_reminder_times': reviewReminderTimes,
    'check_in_reminder': checkInReminder,
    'goal_reminder': goalReminder,
    'achievement_notification': achievementNotification,
    'social_notification': socialNotification,
    'system_notification': systemNotification,
    'do_not_disturb_enabled': doNotDisturbEnabled,
    'do_not_disturb_start_hour': doNotDisturbStartHour,
    'do_not_disturb_end_hour': doNotDisturbEndHour,
    'weekend_do_not_disturb': weekendDoNotDisturb,
  };

  factory NotificationSettings.fromJson(Map<String, dynamic> json) {
    return NotificationSettings(
      dailyStudyReminder: json['daily_study_reminder'] as bool? ?? true,
      studyReminderTimes: (json['study_reminder_times'] as List<dynamic>?)?.cast<int>() ?? [8, 20],
      reviewReminder: json['review_reminder'] as bool? ?? true,
      reviewReminderTimes: (json['review_reminder_times'] as List<dynamic>?)?.cast<int>() ?? [9, 21],
      checkInReminder: json['check_in_reminder'] as bool? ?? true,
      goalReminder: json['goal_reminder'] as bool? ?? true,
      achievementNotification: json['achievement_notification'] as bool? ?? true,
      socialNotification: json['social_notification'] as bool? ?? false,
      systemNotification: json['system_notification'] as bool? ?? true,
      doNotDisturbEnabled: json['do_not_disturb_enabled'] as bool? ?? true,
      doNotDisturbStartHour: json['do_not_disturb_start_hour'] as int? ?? 22,
      doNotDisturbEndHour: json['do_not_disturb_end_hour'] as int? ?? 8,
      weekendDoNotDisturb: json['weekend_do_not_disturb'] as bool? ?? false,
    );
  }
}

class DataStorageSettings {
  final bool autoSync;
  final String syncFrequency;
  final bool wifiOnlySync;
  final bool autoBackup;
  final String backupFrequency;
  final int maxCacheSize;
  final bool autoCleanCache;

  const DataStorageSettings({
    this.autoSync = true,
    this.syncFrequency = 'realtime',
    this.wifiOnlySync = true,
    this.autoBackup = true,
    this.backupFrequency = 'daily',
    this.maxCacheSize = 500,
    this.autoCleanCache = true,
  });

  DataStorageSettings copyWith({
    bool? autoSync,
    String? syncFrequency,
    bool? wifiOnlySync,
    bool? autoBackup,
    String? backupFrequency,
    int? maxCacheSize,
    bool? autoCleanCache,
  }) {
    return DataStorageSettings(
      autoSync: autoSync ?? this.autoSync,
      syncFrequency: syncFrequency ?? this.syncFrequency,
      wifiOnlySync: wifiOnlySync ?? this.wifiOnlySync,
      autoBackup: autoBackup ?? this.autoBackup,
      backupFrequency: backupFrequency ?? this.backupFrequency,
      maxCacheSize: maxCacheSize ?? this.maxCacheSize,
      autoCleanCache: autoCleanCache ?? this.autoCleanCache,
    );
  }

  Map<String, dynamic> toJson() => {
    'auto_sync': autoSync,
    'sync_frequency': syncFrequency,
    'wifi_only_sync': wifiOnlySync,
    'auto_backup': autoBackup,
    'backup_frequency': backupFrequency,
    'max_cache_size': maxCacheSize,
    'auto_clean_cache': autoCleanCache,
  };

  factory DataStorageSettings.fromJson(Map<String, dynamic> json) {
    return DataStorageSettings(
      autoSync: json['auto_sync'] as bool? ?? true,
      syncFrequency: json['sync_frequency'] as String? ?? 'realtime',
      wifiOnlySync: json['wifi_only_sync'] as bool? ?? true,
      autoBackup: json['auto_backup'] as bool? ?? true,
      backupFrequency: json['backup_frequency'] as String? ?? 'daily',
      maxCacheSize: json['max_cache_size'] as int? ?? 500,
      autoCleanCache: json['auto_clean_cache'] as bool? ?? true,
    );
  }
}

class AppSettingsModelAppQy extends ChangeNotifier {
  LanguageVoiceSettings languageVoice;
  LearningSettings learning;
  DisplaySettings display;
  NotificationSettings notification;
  DataStorageSettings dataStorage;

  AppSettingsModelAppQy({
    LanguageVoiceSettings? languageVoice,
    LearningSettings? learning,
    DisplaySettings? display,
    NotificationSettings? notification,
    DataStorageSettings? dataStorage,
  })  : languageVoice = languageVoice ?? const LanguageVoiceSettings(),
        learning = learning ?? const LearningSettings(),
        display = display ?? const DisplaySettings(),
        notification = notification ?? const NotificationSettings(),
        dataStorage = dataStorage ?? const DataStorageSettings();

  Map<String, dynamic> toJson() => {
    'language_voice': languageVoice.toJson(),
    'learning': learning.toJson(),
    'display': display.toJson(),
    'notification': notification.toJson(),
    'data_storage': dataStorage.toJson(),
  };

  factory AppSettingsModelAppQy.fromJson(Map<String, dynamic> json) {
    return AppSettingsModelAppQy(
      languageVoice: json['language_voice'] != null
          ? LanguageVoiceSettings.fromJson(json['language_voice'])
          : const LanguageVoiceSettings(),
      learning: json['learning'] != null
          ? LearningSettings.fromJson(json['learning'])
          : const LearningSettings(),
      display: json['display'] != null
          ? DisplaySettings.fromJson(json['display'])
          : const DisplaySettings(),
      notification: json['notification'] != null
          ? NotificationSettings.fromJson(json['notification'])
          : const NotificationSettings(),
      dataStorage: json['data_storage'] != null
          ? DataStorageSettings.fromJson(json['data_storage'])
          : const DataStorageSettings(),
    );
  }

  static AppSettingsModelAppQy defaultSettings() {
    return AppSettingsModelAppQy();
  }

  void updateLanguageVoice(LanguageVoiceSettings newSettings) {
    languageVoice = newSettings;
    notifyListeners();
  }

  void updateLearning(LearningSettings newSettings) {
    learning = newSettings;
    notifyListeners();
  }

  void updateDisplay(DisplaySettings newSettings) {
    display = newSettings;
    notifyListeners();
  }

  void updateNotification(NotificationSettings newSettings) {
    notification = newSettings;
    notifyListeners();
  }

  void updateDataStorage(DataStorageSettings newSettings) {
    dataStorage = newSettings;
    notifyListeners();
  }
}
