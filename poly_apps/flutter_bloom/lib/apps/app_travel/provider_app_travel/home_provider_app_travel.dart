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

import 'package:flutter/foundation.dart';
import '../models_app_travel/home_data_model.dart';
import '../repositories_app_travel/home_repository.dart';

class HomeProviderAppTravel extends ChangeNotifier {
  final HomeRepository _homeRepository;
  HomeDataResponse? _homeData;
  bool _isLoading = false;
  String? _errorMessage;

  HomeProviderAppTravel({
    HomeRepository? homeRepository,
  }) : _homeRepository = homeRepository ?? HomeRepository();

  HomeDataResponse? get homeData => _homeData;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get hasData => _homeData != null;
  bool get hasError => _errorMessage != null;

  Future<void> loadHomeData({bool forceRefresh = false}) async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      _homeData = await _homeRepository.getHomeData(forceRefresh: forceRefresh);

      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
      debugPrint('Load home data error: $e');
    }
  }

  Future<void> refresh() async {
    await loadHomeData(forceRefresh: true);
  }

  void clearError() {
    _errorMessage = null;
    notifyListeners();
  }
}
