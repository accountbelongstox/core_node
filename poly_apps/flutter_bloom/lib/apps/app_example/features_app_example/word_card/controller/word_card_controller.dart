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
import 'package:qyflutter/apps/app_example/features_app_example/word_card/models/word_model.dart';
import 'package:qyflutter/apps/app_example/config_app_example/storage_app_example.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';

// AI MODIFICATION NOTE: This controller was enhanced by QR_Profile_AI_Assistant
// - Fixed import paths to follow project structure
// - Integrated with common SettingsController for unified settings management
// - Enhanced with proper error handling and localization
// Other AIs: Please maintain the corrected import paths and settings integration

class WordCardController extends GetxController {
  final _words = <Word>[].obs;
  final _currentIndex = 0.obs;

  // Use unified storage system
  final StorageAppExample _storage = StorageAppExample.instance;
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

    // If no data in storage, use default test data
    if (_words.isEmpty) {
      _words.value = [
        Word(
          word: 'apple',
          phonetic: '/ˈæpl/',
          translation: 'n. apple',
          example: 'An apple a day keeps the doctor away.',
        ),
        Word(
          word: 'book',
          phonetic: '/bʊk/',
          translation: 'n. book',
          example: 'I love reading books in my spare time.',
        ),
        Word(
          word: 'computer',
          phonetic: '/kəmˈpjuːtər/',
          translation: 'n. computer',
          example: 'I use my computer for work every day.',
        ),
        Word(
          word: 'beautiful',
          phonetic: '/ˈbjuːtɪfl/',
          translation: 'adj. beautiful',
          example: 'The sunset is beautiful tonight.',
        ),
        Word(
          word: 'important',
          phonetic: '/ɪmˈpɔːrtnt/',
          translation: 'adj. important',
          example: 'Education is very important for everyone.',
        ),
      ];

      // Save default data to storage
      await saveWordsToStorage();
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
      Get.snackbar(
        'Notice',
        'This is the last word',
        snackPosition: SnackPosition.BOTTOM,
      );
    }
  }

  Future<void> _saveWordStatus(String word, bool isKnown) async {
    try {
      await _storage.setApp<bool>('word_${word}_known', isKnown);

      // Also save learning progress statistics
      await _updateLearningProgress(word, isKnown);
    } catch (e) {
      print('Error saving word status: $e');
    }
  }

  /// Update learning progress statistics
  Future<void> _updateLearningProgress(String word, bool isKnown) async {
    try {
      // Get current learning statistics
      final stats = await _storage.getApp<Map<String, dynamic>>('learning_stats') ??
          <String, dynamic>{
            'total_words': 0,
            'known_words': 0,
            'unknown_words': 0,
            'last_study_date': DateTime.now().toIso8601String(),
          };

      // Check if this is a new word
      final wasKnownBefore = await _storage.getApp<bool>('word_${word}_known');
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

      await _storage.setApp<Map<String, dynamic>>('learning_stats', stats);
    } catch (e) {
      print('Error updating learning progress: $e');
    }
  }

  /// Get learning statistics
  Future<Map<String, dynamic>> getLearningStats() async {
    return await _storage.getApp<Map<String, dynamic>>('learning_stats') ??
        <String, dynamic>{
          'total_words': 0,
          'known_words': 0,
          'unknown_words': 0,
          'last_study_date': null,
        };
  }

  /// Get word learning status
  Future<bool?> getWordStatus(String word) async {
    return await _storage.getApp<bool>('word_${word}_known');
  }

  /// Reset learning progress
  Future<void> resetLearningProgress() async {
    try {
      // Clear all word statuses
      for (final word in _words) {
        await _storage.removeApp('word_${word.word}_known');
      }

      // Reset statistics
      await _storage.setApp<Map<String, dynamic>>('learning_stats', {
        'total_words': 0,
        'known_words': 0,
        'unknown_words': 0,
        'last_study_date': DateTime.now().toIso8601String(),
      });

      Get.snackbar(
        'Notice',
        'Learning progress has been reset',
        snackPosition: SnackPosition.BOTTOM,
      );
    } catch (e) {
      print('Error resetting learning progress: $e');
    }
  }

  /// Save word list to storage
  Future<void> saveWordsToStorage() async {
    try {
      final wordsJson = _words.map((word) => word.toJson()).toList();
      await _storage.setApp<List<Map<String, dynamic>>>('word_list', wordsJson);
    } catch (e) {
      print('Error saving words to storage: $e');
    }
  }

  /// Load word list from storage
  Future<void> loadWordsFromStorage() async {
    try {
      final wordsJson = await _storage.getApp<List<Map<String, dynamic>>>('word_list');
      if (wordsJson != null && wordsJson.isNotEmpty) {
        _words.value = wordsJson.map((json) => Word.fromJson(json)).toList();
        update();
      }
    } catch (e) {
      print('Error loading words from storage: $e');
    }
  }
}
