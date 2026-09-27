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
