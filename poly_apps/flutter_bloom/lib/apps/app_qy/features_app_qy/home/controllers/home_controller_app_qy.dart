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

/// Home screen controller for QY App
library;

import 'package:flutter/material.dart';
import '../../../models_app_qy/user_model_app_qy.dart';

class HomeControllerAppQy extends ChangeNotifier {
  UserModelAppQy _currentUser;
  int _currentTabIndex;
  bool _isLoading;
  String? _errorMessage;

  HomeControllerAppQy({
    UserModelAppQy? user,
    int initialTab = 0,
  })  : _currentUser = user ?? UserModelAppQy.empty(),
        _currentTabIndex = initialTab,
        _isLoading = false;

  UserModelAppQy get currentUser => _currentUser;
  int get currentTabIndex => _currentTabIndex;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  void setCurrentTab(int index) {
    if (index >= 0 && index < 5) {
      _currentTabIndex = index;
      notifyListeners();
    }
  }

  void updateUser(UserModelAppQy user) {
    _currentUser = user;
    notifyListeners();
  }

  void setLoading(bool loading) {
    _isLoading = loading;
    notifyListeners();
  }

  void setError(String? error) {
    _errorMessage = error;
    notifyListeners();
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }

  Future<void> refreshUserData() async {
    setLoading(true);
    clearError();

    try {
      await Future.delayed(const Duration(seconds: 1));
      notifyListeners();
    } catch (e) {
      setError(e.toString());
    } finally {
      setLoading(false);
    }
  }

  Future<void> startLearning() async {
    if (_currentUser.todayNewWords == 0 && _currentUser.todayReviewWords == 0) {
      setError('No words to learn today');
      return;
    }

    setLoading(true);
    try {
      await Future.delayed(const Duration(milliseconds: 500));
    } finally {
      setLoading(false);
    }
  }

  @override
  void dispose() {
    super.dispose();
  }
}
