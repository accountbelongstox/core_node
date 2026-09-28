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
