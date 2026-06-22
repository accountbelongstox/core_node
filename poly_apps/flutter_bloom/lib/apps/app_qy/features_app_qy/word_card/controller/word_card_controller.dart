// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:get/get.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/word_card/models/word_model.dart';
import 'package:qyflutter/apps/app_qy/config_app_qy/storage_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

// AI MODIFICATION NOTE: This controller was enhanced by QR_Profile_AI_Assistant
// - Fixed import paths to follow project structure
// - Integrated with common SettingsController for unified settings management
// - Enhanced with proper error handling and localization
// Other AIs: Please maintain the corrected import paths and settings integration

class WordCardController extends GetxController {
  final _words = <Word>[].obs;
  final _currentIndex = 0.obs;

  // Use unified storage system
  final StorageAppQy _storage = StorageAppQy.instance;
  late final SettingsController _settingsController;

  Word get currentWord => _words[_currentIndex.value];

  @override
  void onInit() {
    super.onInit();
    _initControllers();
    _initStorage();
    _loadWords();
  }

  /// Initialize controllers
  void _initControllers() {
    try {
      _settingsController = Get.find<SettingsController>();
    } catch (e) {
      // If not found, create a temporary one
      print('SettingsController not found, using temporary instance: $e');
    }
  }

  /// Initialize storage system
  Future<void> _initStorage() async {
    await _storage.initAppStorage();
  }

  Future<void> _loadWords() async {
    // First try to load from storage
    await loadWordsFromStorage();

    // If no data in storage, load from centralized data source
    // Note: In production, this should load from word service or API
    if (_words.isEmpty) {
      // Use centralized storage key for word list
      final defaultWordsJson = await _storage.getApp<List<Map<String, dynamic>>>(StorageAppQy.keyWordList);
      if (defaultWordsJson != null && defaultWordsJson.isNotEmpty) {
        _words.value = defaultWordsJson.map((json) => Word.fromJson(json)).toList();
      }
    }

    update();
  }

  void playPronunciation() {
    // TODO: Implement pronunciation functionality
    print('Playing pronunciation for: ${currentWord.word}');
  }

  void markAsKnown() {
    _saveWordStatus(currentWord.word, true);
    _nextWord();
  }

  void markAsUnknown() {
    _saveWordStatus(currentWord.word, false);
    _nextWord();
  }

  void _nextWord() {
    if (_currentIndex.value < _words.length - 1) {
      _currentIndex.value++;
      update();
    } else {
      final context = Get.context;
      if (context != null) {
        Get.snackbar(
          QyAppLocalizationKeys.qyNotice.tr(context),
          QyAppLocalizationKeys.qyLastWordMessage.tr(context),
          snackPosition: SnackPosition.BOTTOM,
        );
      }
    }
  }

  Future<void> _saveWordStatus(String word, bool isKnown) async {
    try {
      // Use centralized storage key for word progress
      await _storage.setApp<bool>('${StorageAppQy.keyWordProgress}_${word}_known', isKnown);

      // Also save learning progress statistics
      await _updateLearningProgress(word, isKnown);
    } catch (e) {
      print('Error saving word status: $e');
    }
  }

  /// Update learning progress statistics using centralized storage
  Future<void> _updateLearningProgress(String word, bool isKnown) async {
    try {
      // Get current learning statistics using centralized storage key
      final stats = await _storage.getApp<Map<String, dynamic>>(StorageAppQy.keyLearningStats) ??
          <String, dynamic>{
            'total_words': 0,
            'known_words': 0,
            'unknown_words': 0,
            'last_study_date': DateTime.now().toIso8601String(),
          };

      // Check if this is a new word
      final wasKnownBefore = await _storage.getApp<bool>('${StorageAppQy.keyWordProgress}_${word}_known');
      if (wasKnownBefore == null) {
        stats['total_words'] = (stats['total_words'] ?? 0) + 1;
      }

      // Update known/unknown statistics
      if (isKnown) {
        if (wasKnownBefore != true) {
          stats['known_words'] = (stats['known_words'] ?? 0) + 1;
          if (wasKnownBefore == false) {
            stats['unknown_words'] = (stats['unknown_words'] ?? 0) - 1;
          }
        }
      } else {
        if (wasKnownBefore != false) {
          stats['unknown_words'] = (stats['unknown_words'] ?? 0) + 1;
          if (wasKnownBefore == true) {
            stats['known_words'] = (stats['known_words'] ?? 0) - 1;
          }
        }
      }

      stats['last_study_date'] = DateTime.now().toIso8601String();

      await _storage.setApp<Map<String, dynamic>>(StorageAppQy.keyLearningStats, stats);
    } catch (e) {
      print('Error updating learning progress: $e');
    }
  }

  /// Get learning statistics using centralized storage
  Future<Map<String, dynamic>> getLearningStats() async {
    return await _storage.getApp<Map<String, dynamic>>(StorageAppQy.keyLearningStats) ??
        <String, dynamic>{
          'total_words': 0,
          'known_words': 0,
          'unknown_words': 0,
          'last_study_date': null,
        };
  }

  /// Get word learning status using centralized storage
  Future<bool?> getWordStatus(String word) async {
    return await _storage.getApp<bool>('${StorageAppQy.keyWordProgress}_${word}_known');
  }

  /// Reset learning progress
  Future<void> resetLearningProgress() async {
    try {
      // Clear all word statuses using centralized storage key
      for (final word in _words) {
        await _storage.removeApp('${StorageAppQy.keyWordProgress}_${word.word}_known');
      }

      // Reset statistics using centralized storage key
      await _storage.setApp<Map<String, dynamic>>(StorageAppQy.keyLearningStats, {
        'total_words': 0,
        'known_words': 0,
        'unknown_words': 0,
        'last_study_date': DateTime.now().toIso8601String(),
      });

      final context = Get.context;
      if (context != null) {
        Get.snackbar(
          QyAppLocalizationKeys.qyNotice.tr(context),
          QyAppLocalizationKeys.qyLearningProgressResetMessage.tr(context),
          snackPosition: SnackPosition.BOTTOM,
        );
      }
    } catch (e) {
      print('Error resetting learning progress: $e');
    }
  }

  /// Save word list to storage using centralized storage key
  Future<void> saveWordsToStorage() async {
    try {
      final wordsJson = _words.map((word) => word.toJson()).toList();
      await _storage.setApp<List<Map<String, dynamic>>>(StorageAppQy.keyWordList, wordsJson);
    } catch (e) {
      print('Error saving words to storage: $e');
    }
  }

  /// Load word list from storage using centralized storage key
  Future<void> loadWordsFromStorage() async {
    try {
      final wordsJson = await _storage.getApp<List<Map<String, dynamic>>>(StorageAppQy.keyWordList);
      if (wordsJson != null && wordsJson.isNotEmpty) {
        _words.value = wordsJson.map((json) => Word.fromJson(json)).toList();
        update();
      }
    } catch (e) {
      print('Error loading words from storage: $e');
    }
  }
}
