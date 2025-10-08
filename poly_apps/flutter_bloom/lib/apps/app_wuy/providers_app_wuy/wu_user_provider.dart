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

import '../../../common/provider_status/user_provider.dart';
import '../models_app_wuy/user_model_app_wuy.dart';

class WuUserProvider extends EnhancedUserProvider {
  static const String _namespace = 'app_wuy';
  static const String _appProfileKey = 'app_wuy_profile';

  WuUserProvider() : super(appNamespace: _namespace) {
    // Initialize with fake data for testing
    _initializeFakeUser();
  }

  /// Initialize fake user for testing
  void _initializeFakeUser() {
    // Check if user is already authenticated
    if (isAuthenticated) {
      return;
    }
    
    // Create a fake user for testing
    final fakeUser = UserModelAppWuy(
      id: 'test_user_001',
      username: 'testuser',
      nickname: '测试用户',
      email: 'test@anwuyou.test',
      phone: '13800138000',
      avatar: 'assets/common/icons/people.png',
      isOnline: true,
      lastSeen: DateTime.now(),
      createdAt: DateTime.now().subtract(const Duration(days: 30)),
      updatedAt: DateTime.now(),
    );
    
    setAppUser(profile: fakeUser);
  }

  UserModelAppWuy? get appProfile {
    // Fix: Cast BaseUserModel? to LaravelUserModel? since user getter returns BaseUserModel
    final LaravelUserModel? laravelUser = user as LaravelUserModel?;
    if (laravelUser == null) {
      return null;
    }
    final dynamic rawProfile = laravelUser.meta[_appProfileKey];
    if (rawProfile is Map<String, dynamic>) {
      return UserModelAppWuy.fromJson(rawProfile);
    }
    return _fallbackFromLaravel(laravelUser);
  }

  Map<String, dynamic> get permissionMetadata {
    return <String, dynamic>{
      'verifiedGroups': verifiedPermissionGroups.toList(),
      'claims': authMetadata.data['claims'] ?? const <String>[],
      'clientPermissionGranted': clientPermissionGranted,
      'authType': authMetadata.authType.name,
    };
  }

  void setAppUser({
    required UserModelAppWuy profile,
    AuthMetadata? metadata,
  }) {
    final LaravelUserModel mapped = LaravelUserModel(
      id: int.tryParse(profile.id),
      name: profile.nickname ?? profile.username,
      nickname: profile.nickname,
      username: profile.username,
      email: profile.email,
      avatar: profile.avatar,
      about: profile.bio,
      city: profile.preferences?['city'] as String?,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      emailVerifiedAt: profile.isVerified ? profile.updatedAt : null,
      phone: profile.phone,
      lastLoginAt: profile.lastSeen,
      permissions: const <String>[],
      permissionGroups: profile.roles ?? const <String>[],
      roles: profile.roles ?? const <String>[],
      preferences: profile.preferences ?? const <String, dynamic>{},
      meta: <String, dynamic>{
        _appProfileKey: profile.toJson(),
      },
    );
    setUser(mapped);
    if (metadata != null) {
      setAuthMetadata(metadata);
    }
  }

  void upsertPreference(String key, dynamic value) {
    // Fix: Cast BaseUserModel? to LaravelUserModel?
    final LaravelUserModel? laravelUser = user as LaravelUserModel?;
    if (laravelUser == null) {
      return;
    }
    final Map<String, dynamic> preferences =
        Map<String, dynamic>.from(laravelUser.preferences);
    preferences[key] = value;
    setUser(laravelUser.copyWith(preferences: preferences));
  }

  UserModelAppWuy? _fallbackFromLaravel(LaravelUserModel laravelUser) {
    if (laravelUser.username == null && laravelUser.email == null) {
      return null;
    }
    final DateTime created = laravelUser.createdAt ?? DateTime.now();
    final DateTime updated = laravelUser.updatedAt ?? created;
    final List<String> roles = <String>{
      if (laravelUser.roleName != null) laravelUser.roleName!,
      ...laravelUser.roles,
      ...laravelUser.permissionGroups,
    }.where((String value) => value.isNotEmpty).toList();

    return UserModelAppWuy(
      id: (laravelUser.id ?? laravelUser.username ?? created.millisecondsSinceEpoch)
          .toString(),
      username: laravelUser.username ?? laravelUser.email ?? 'user',
      email: laravelUser.email ?? '',
      avatar: laravelUser.avatar,
      nickname: laravelUser.nickname ?? laravelUser.name,
      phone: laravelUser.phone,
      bio: laravelUser.about,
      lastSeen: laravelUser.lastLoginAt,
      isOnline: false,
      isVerified: laravelUser.emailVerifiedAt != null,
      createdAt: created,
      updatedAt: updated,
      preferences: laravelUser.preferences,
      roles: roles,
    );
  }
}
