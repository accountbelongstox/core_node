import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/user_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_auth_api_service.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_public_api_service.dart';

class VipClubHomeController extends ChangeNotifier {
  final VipClubAuthApiService _authApi;
  final VipClubPublicApiService _publicApi;

  VipClubUserModel? _currentUser;
  List<VipClubFacilityModel> _featuredFacilities = [];
  bool _isLoading = false;
  String? _errorMessage;

  VipClubHomeController(this._authApi, this._publicApi);

  VipClubUserModel? get currentUser => _currentUser;
  List<VipClubFacilityModel> get featuredFacilities => _featuredFacilities;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;
  bool get isLoggedIn => _currentUser != null;
  bool get isVipMember => _currentUser?.isVipMember ?? false;

  Future<void> initialize() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await Future.wait([
        _loadUserProfile(),
        _loadFeaturedFacilities(),
      ]);
    } catch (e) {
      _errorMessage = 'Failed to initialize: ${e.toString()}';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> _loadUserProfile() async {
    final isLoggedIn = await _authApi.isLoggedIn();
    if (isLoggedIn) {
      _currentUser = await _authApi.getUserInfo();

      if (_currentUser != null) {
        final result = await _authApi.refreshUserInfo();
        if (result['success']) {
          _currentUser = result['user'];
        }
      }
    }
  }

  Future<void> _loadFeaturedFacilities() async {
    final result = await _publicApi.getFacilities();
    if (result['success']) {
      final data = result['data'] as Map<String, dynamic>;
      final facilitiesList = data['facilities'] as List<dynamic>;

      _featuredFacilities = facilitiesList
          .take(6)
          .map((e) =>
              VipClubFacilityModel.fromJson(e as Map<String, dynamic>))
          .toList();
    }
  }

  Future<void> refresh() async {
    await initialize();
  }

  String getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good Morning';
    } else if (hour < 18) {
      return 'Good Afternoon';
    } else {
      return 'Good Evening';
    }
  }

  String getUserDisplayName() {
    return _currentUser?.name ?? 'Guest';
  }

  String getMembershipBadge() {
    if (_currentUser == null) return 'Guest';

    switch (_currentUser!.memberType) {
      case 'gold':
        return 'Gold Member';
      case 'platinum':
        return 'Platinum Member';
      case 'diamond':
        return 'Diamond Member';
      default:
        return 'Regular Member';
    }
  }

  int getUserPoints() {
    return _currentUser?.vipPoints ?? 0;
  }

  double getUserDiscount() {
    return _currentUser?.discountRate ?? 0.0;
  }
}
