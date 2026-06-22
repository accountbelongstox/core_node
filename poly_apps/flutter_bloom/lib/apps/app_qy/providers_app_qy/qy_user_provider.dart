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

import '../../../common/provider_status/user_provider.dart';
import '../model_app_qy/user_model.dart';

/// QY App User Provider
/// Extends EnhancedUserProvider to manage QY app-specific user data
/// Provides conversion between UserModel and LaravelUserModel
class QyUserProvider extends EnhancedUserProvider {
  static const String _namespace = 'app_qy';
  static const String _appProfileKey = 'app_qy_profile';

  QyUserProvider() : super(appNamespace: _namespace);

  /// Get QY app-specific user profile
  UserModel? get appProfile {
    // Fix: Cast BaseUserModel? to LaravelUserModel?
    final LaravelUserModel? laravelUser = user as LaravelUserModel?;
    if (laravelUser == null) {
      return null;
    }
    final dynamic rawProfile = laravelUser.meta[_appProfileKey];
    if (rawProfile is Map<String, dynamic>) {
      return UserModel.fromJson(rawProfile);
    }
    return _fallbackFromLaravel(laravelUser);
  }

  /// Get permission metadata
  Map<String, dynamic> get permissionMetadata {
    return <String, dynamic>{
      'verifiedGroups': verifiedPermissionGroups.toList(),
      'claims': authMetadata.data['claims'] ?? const <String>[],
      'clientPermissionGranted': clientPermissionGranted,
      'authType': authMetadata.authType.name,
    };
  }

  /// Set QY app user from UserModel
  void setAppUser({
    required UserModel profile,
    AuthMetadata? metadata,
  }) {
    // Convert UserModel to LaravelUserModel
    final LaravelUserModel mapped = LaravelUserModel(
      id: profile.id,
      name: profile.name,
      nickname: profile.nickname,
      username: profile.username,
      email: profile.email,
      avatar: profile.avatar,
      about: profile.about,
      city: profile.city,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      emailVerifiedAt: profile.emailVerifiedAt,
      phone: profile.phone,
      age: profile.age,
      gender: profile.gender,
      birthday: profile.birthday,
      education: profile.education,
      occupation: profile.occupation,
      language: profile.language,
      religion: profile.religion,
      roleLevel: profile.roleLevel,
      roleName: profile.roleName,
      userToken: profile.userToken ?? profile.token,
      permissions: const <String>[],
      permissionGroups: const <String>[],
      roles: profile.roleName != null ? <String>[profile.roleName!] : const <String>[],
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

  /// Update user preference
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

  /// Fallback conversion from LaravelUserModel to UserModel
  UserModel? _fallbackFromLaravel(LaravelUserModel laravelUser) {
    if (laravelUser.username == null && laravelUser.email == null) {
      return null;
    }

    return UserModel(
      id: laravelUser.id ?? (laravelUser.username != null ? int.tryParse(laravelUser.username!) : null) ?? DateTime.now().millisecondsSinceEpoch,
      name: laravelUser.name ?? laravelUser.username ?? laravelUser.email ?? 'User',
      nickname: laravelUser.nickname ?? laravelUser.name,
      username: laravelUser.username ?? laravelUser.email,
      email: laravelUser.email ?? '',
      avatar: laravelUser.avatar,
      about: laravelUser.about,
      phone: laravelUser.phone,
      city: laravelUser.city,
      age: laravelUser.age,
      gender: laravelUser.gender,
      birthday: laravelUser.birthday,
      education: laravelUser.education,
      occupation: laravelUser.occupation,
      language: laravelUser.language,
      religion: laravelUser.religion,
      roleLevel: laravelUser.roleLevel,
      roleName: laravelUser.roleName,
      emailVerifiedAt: laravelUser.emailVerifiedAt,
      createdAt: laravelUser.createdAt ?? DateTime.now(),
      updatedAt: laravelUser.updatedAt ?? DateTime.now(),
      userToken: laravelUser.userToken,
      preferences: laravelUser.preferences,
      // QY App specific fields with defaults
      interests: const <String>[],
      learningGoals: null,
      studyStreak: 0,
    );
  }
}

