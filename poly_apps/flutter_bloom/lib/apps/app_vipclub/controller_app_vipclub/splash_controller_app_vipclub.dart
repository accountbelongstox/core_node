import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_storage_service.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/splash_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/resources_app_vipclub/assets_images_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/localization_keys_app_vipclub.dart';

class VipClubSplashController extends ChangeNotifier {
  final VipClubStorageService _storageService = VipClubStorageService();
  static const String _splashStateKey = 'vipclub_splash_state';

  List<VipClubSplashModel> _splashPages = [];
  VipClubSplashStateModel _splashState = VipClubSplashStateModel(
    hasCompletedSplash: false,
    currentPage: 0,
  );

  List<VipClubSplashModel> get splashPages => _splashPages;
  VipClubSplashStateModel get splashState => _splashState;
  bool get shouldShowSplash => _splashState.shouldShowSplash();

  VipClubSplashController() {
    _init();
  }

  Future<void> _init() async {
    try {
      await _storageService.init();
      await _loadSplashState();
      _loadSplashPages();
    } catch (e) {
      debugPrint('Error initializing splash controller: $e');
    }
  }

  void _loadSplashPages() {
    _splashPages = [
      VipClubSplashModel(
        id: '1',
        imageUrl: VipClubAssetsImages.getPath(VipClubAssetsImages.vipclubSplash1),
        title: VipClubTextKeys.vipclubSplashTitle1,
        description: VipClubTextKeys.vipclubSplashDesc1,
        order: 1,
      ),
      VipClubSplashModel(
        id: '2',
        imageUrl: VipClubAssetsImages.getPath(VipClubAssetsImages.vipclubSplash2),
        title: VipClubTextKeys.vipclubSplashTitle2,
        description: VipClubTextKeys.vipclubSplashDesc2,
        order: 2,
      ),
      VipClubSplashModel(
        id: '3',
        imageUrl: VipClubAssetsImages.getPath(VipClubAssetsImages.vipclubSplash1),
        title: VipClubTextKeys.vipclubSplashTitle3,
        description: VipClubTextKeys.vipclubSplashDesc3,
        order: 3,
      ),
      VipClubSplashModel(
        id: '4',
        imageUrl: VipClubAssetsImages.getPath(VipClubAssetsImages.vipclubSplash2),
        title: VipClubTextKeys.vipclubSplashTitle4,
        description: VipClubTextKeys.vipclubSplashDesc4,
        order: 4,
      ),
      VipClubSplashModel(
        id: '5',
        imageUrl: VipClubAssetsImages.getPath(VipClubAssetsImages.vipclubSplash1),
        title: VipClubTextKeys.vipclubSplashTitle5,
        description: VipClubTextKeys.vipclubSplashDesc5,
        order: 5,
      ),
    ];
    notifyListeners();
  }

  Future<void> _loadSplashState() async {
    try {
      final stateJson = await _storageService.getString(_splashStateKey);
      if (stateJson != null) {
        final Map<String, dynamic> stateMap = json.decode(stateJson);
        _splashState = VipClubSplashStateModel.fromJson(stateMap);
      }
    } catch (e) {
      debugPrint('Error loading splash state: $e');
    }
  }

  Future<void> _saveSplashState() async {
    try {
      final stateJson = json.encode(_splashState.toJson());
      await _storageService.setString(_splashStateKey, stateJson);
    } catch (e) {
      debugPrint('Error saving splash state: $e');
    }
  }

  Future<void> updateCurrentPage(int page) async {
    _splashState = _splashState.copyWith(currentPage: page);
    await _saveSplashState();
    notifyListeners();
  }

  Future<void> completeSplash() async {
    _splashState = _splashState.copyWith(
      hasCompletedSplash: true,
      lastViewedDate: DateTime.now(),
      currentPage: 0,
    );
    await _saveSplashState();
    notifyListeners();
  }

  Future<void> resetSplash() async {
    _splashState = VipClubSplashStateModel(
      hasCompletedSplash: false,
      currentPage: 0,
    );
    await _saveSplashState();
    notifyListeners();
  }

  int get currentPage => _splashState.currentPage;
  int get totalPages => _splashPages.length;
  bool get isLastPage => currentPage >= totalPages - 1;
}
