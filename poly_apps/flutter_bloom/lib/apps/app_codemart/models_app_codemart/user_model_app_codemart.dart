import 'package:flutter/foundation.dart';
import 'codemart_types.dart';
import 'codemart_enums.dart';

class UserModelAppCodemart extends ChangeNotifier {
  UserProfile? _userProfile;
  DeveloperProfile? _developerProfile;
  ClientProfile? _clientProfile;
  bool _isLoggedIn = false;
  String? _token;

  UserProfile? get userProfile => _userProfile;
  DeveloperProfile? get developerProfile => _developerProfile;
  ClientProfile? get clientProfile => _clientProfile;
  bool get isLoggedIn => _isLoggedIn;
  String? get token => _token;

  bool get isDeveloper => _userProfile?.roles.contains(UserRoleType.developer) ?? false;
  bool get isClient => _userProfile?.roles.contains(UserRoleType.client) ?? false;
  bool get isArchitect => _userProfile?.roles.contains(UserRoleType.architect) ?? false;
  bool get isReviewer => _userProfile?.roles.contains(UserRoleType.reviewer) ?? false;
  bool get isAdmin => _userProfile?.roles.contains(UserRoleType.admin) ?? false;

  void setUserProfile(UserProfile profile) {
    _userProfile = profile;
    _isLoggedIn = true;
    notifyListeners();
  }

  void setDeveloperProfile(DeveloperProfile profile) {
    _developerProfile = profile;
    notifyListeners();
  }

  void setClientProfile(ClientProfile profile) {
    _clientProfile = profile;
    notifyListeners();
  }

  void setToken(String token) {
    _token = token;
    notifyListeners();
  }

  void login(UserProfile profile, String token) {
    _userProfile = profile;
    _token = token;
    _isLoggedIn = true;
    notifyListeners();
  }

  void logout() {
    _userProfile = null;
    _developerProfile = null;
    _clientProfile = null;
    _token = null;
    _isLoggedIn = false;
    notifyListeners();
  }

  void updateUserProfile(UserProfile profile) {
    _userProfile = profile;
    notifyListeners();
  }

  void updateDeveloperProfile(DeveloperProfile profile) {
    _developerProfile = profile;
    notifyListeners();
  }

  void updateClientProfile(ClientProfile profile) {
    _clientProfile = profile;
    notifyListeners();
  }

  Map<String, dynamic> toJson() {
    return {
      'userProfile': _userProfile?.toJson(),
      'developerProfile': _developerProfile?.toJson(),
      'clientProfile': _clientProfile?.toJson(),
      'isLoggedIn': _isLoggedIn,
      'token': _token,
    };
  }

  void fromJson(Map<String, dynamic> json) {
    if (json['userProfile'] != null) {
      _userProfile = UserProfile.fromJson(json['userProfile'] as Map<String, dynamic>);
    }
    if (json['developerProfile'] != null) {
      _developerProfile = DeveloperProfile.fromJson(json['developerProfile'] as Map<String, dynamic>);
    }
    if (json['clientProfile'] != null) {
      _clientProfile = ClientProfile.fromJson(json['clientProfile'] as Map<String, dynamic>);
    }
    _isLoggedIn = json['isLoggedIn'] as bool? ?? false;
    _token = json['token'] as String?;
    notifyListeners();
  }
}
