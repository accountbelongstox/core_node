// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Learning controller for QY App - manages learning state
library;

import 'package:flutter/material.dart';
import '../domain/model/learning_stats_model.dart';
import '../domain/service/learning_service.dart';

class LearningControllerAppQy extends ChangeNotifier {
  final LearningService _learningService;
  LearningStatsModel _learningStats;
  bool _isLoading;
  bool _showMoreFeatures;
  String? _errorMessage;

  LearningControllerAppQy({
    required LearningService learningService,
    LearningStatsModel? initialStats,
  })  : _learningService = learningService,
        _learningStats = initialStats ?? LearningStatsModel.empty(),
        _isLoading = false,
        _showMoreFeatures = false;

  LearningStatsModel get learningStats => _learningStats;
  bool get isLoading => _isLoading;
  bool get showMoreFeatures => _showMoreFeatures;
  String? get errorMessage => _errorMessage;

  void toggleMoreFeatures() {
    _showMoreFeatures = !_showMoreFeatures;
    notifyListeners();
  }

  void closeMoreFeatures() {
    _showMoreFeatures = false;
    notifyListeners();
  }

  Future<void> loadLearningStats() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _learningStats = await _learningService.getLearningStats();
    } catch (e) {
      _errorMessage = e.toString();
      _learningStats = LearningStatsModel.empty();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> startLearning() async {
    if (_learningStats.newWordsToday >= _learningStats.newWordsTarget &&
        _learningStats.reviewWordsToday >= _learningStats.reviewWordsTarget) {
      _errorMessage = 'All tasks completed for today';
      notifyListeners();
      return;
    }

    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _learningService.startLearningSession();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> checkIn() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _learningService.checkIn();
      await loadLearningStats();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> refreshStats() async {
    await loadLearningStats();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  @override
  void dispose() {
    super.dispose();
  }
}
