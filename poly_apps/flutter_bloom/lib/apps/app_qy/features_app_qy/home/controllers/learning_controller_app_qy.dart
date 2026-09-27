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
