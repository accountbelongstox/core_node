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

import 'dart:convert';

import 'package:flutter/foundation.dart';

import '../cache_manager/cache_manager.dart';
import '../storage_tools/storage_manager.dart';
// Fix: Import AuthType from network_types.dart as single source of truth
import '../network/core/network_types.dart' show AuthType;

/// Permission status enumeration
enum PermissionStatus {
  unverified,
  pending,
  verified,
  failed,
}

/// Permission authenticator function type
typedef PermissionAuthenticator = Future<AuthMetadata> Function(
    AuthMetadata currentMetadata);

/// Permission record for tracking permission states
class PermissionRecord {
  final PermissionStatus status;
  final DateTime? lastVerifiedAt;
  final Map<String, dynamic> metadata;

  const PermissionRecord({
    this.status = PermissionStatus.unverified,
    this.lastVerifiedAt,
    this.metadata = const <String, dynamic>{},
  });

  PermissionRecord copyWith({
    PermissionStatus? status,
    DateTime? lastVerifiedAt,
    Map<String, dynamic>? metadata,
  }) {
    return PermissionRecord(
      status: status ?? this.status,
      lastVerifiedAt: lastVerifiedAt ?? this.lastVerifiedAt,
      metadata: metadata ?? this.metadata,
    );
  }

  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'status': status.name,
      'lastVerifiedAt': lastVerifiedAt?.toIso8601String(),
      'metadata': metadata,
    };
  }

  factory PermissionRecord.fromMap(Map<String, dynamic> map) {
    final String? statusValue = map['status'] as String?;
    final PermissionStatus parsedStatus = statusValue != null
        ? PermissionStatus.values.firstWhere(
            (PermissionStatus value) => value.name == statusValue,
            orElse: () => PermissionStatus.unverified,
          )
        : PermissionStatus.unverified;
    return PermissionRecord(
      status: parsedStatus,
      lastVerifiedAt: map['lastVerifiedAt'] != null
          ? DateTime.tryParse(map['lastVerifiedAt'] as String)
          : null,
      metadata: map['metadata'] != null
          ? Map<String, dynamic>.from(map['metadata'] as Map)
          : const <String, dynamic>{},
    );
  }
}

/// Authentication augmentation bundle for network requests
class AuthAugmentationBundle {
  final Map<String, String> headers;
  final Map<String, dynamic> metadata;
  final Map<String, dynamic> sessionUpdate;

  const AuthAugmentationBundle({
    this.headers = const <String, String>{},
    this.metadata = const <String, dynamic>{},
    this.sessionUpdate = const <String, dynamic>{},
  });
}

/// Authentication metadata for tracking auth state
class AuthMetadata {
  final AuthType authType;
  final Map<String, dynamic> data;
  final DateTime? authenticatedAt;
  final DateTime? expiresAt;
  final bool isAuthenticated;
  final String? clientId;
  final String? headerKey;
  final String? headerValue;
  final String? jwtToken;
  final String? refreshToken;
  final String? sessionId;
  final Map<String, String>? customHeaders;

  const AuthMetadata({
    this.authType = AuthType.none,
    this.data = const {},
    this.authenticatedAt,
    this.expiresAt,
    this.isAuthenticated = false,
    this.clientId,
    this.headerKey,
    this.headerValue,
    this.jwtToken,
    this.refreshToken,
    this.sessionId,
    this.customHeaders,
  });

  AuthMetadata copyWith({
    AuthType? authType,
    Map<String, dynamic>? data,
    DateTime? authenticatedAt,
    DateTime? expiresAt,
    bool? isAuthenticated,
    String? clientId,
    String? headerKey,
    String? headerValue,
    String? jwtToken,
    String? refreshToken,
    String? sessionId,
    Map<String, String>? customHeaders,
  }) {
    return AuthMetadata(
      authType: authType ?? this.authType,
      data: data ?? this.data,
      authenticatedAt: authenticatedAt ?? this.authenticatedAt,
      expiresAt: expiresAt ?? this.expiresAt,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      clientId: clientId ?? this.clientId,
      headerKey: headerKey ?? this.headerKey,
      headerValue: headerValue ?? this.headerValue,
      jwtToken: jwtToken ?? this.jwtToken,
      refreshToken: refreshToken ?? this.refreshToken,
      sessionId: sessionId ?? this.sessionId,
      customHeaders: customHeaders ?? this.customHeaders,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'authType': authType.name,
      'data': data,
      'authenticatedAt': authenticatedAt?.toIso8601String(),
      'expiresAt': expiresAt?.toIso8601String(),
      'isAuthenticated': isAuthenticated,
      'clientId': clientId,
      'headerKey': headerKey,
      'headerValue': headerValue,
      'jwtToken': jwtToken,
      'refreshToken': refreshToken,
      'sessionId': sessionId,
      'customHeaders': customHeaders,
    };
  }

  factory AuthMetadata.fromMap(Map<String, dynamic> map) {
    return AuthMetadata(
      authType: AuthType.values.firstWhere(
        (e) => e.name == map['authType'],
        orElse: () => AuthType.none,
      ),
      data: Map<String, dynamic>.from(map['data'] ?? {}),
      authenticatedAt: map['authenticatedAt'] != null
          ? DateTime.parse(map['authenticatedAt'])
          : null,
      expiresAt: map['expiresAt'] != null
          ? DateTime.parse(map['expiresAt'])
          : null,
      isAuthenticated: map['isAuthenticated'] ?? false,
      clientId: map['clientId'],
      headerKey: map['headerKey'],
      headerValue: map['headerValue'],
      jwtToken: map['jwtToken'],
      refreshToken: map['refreshToken'],
      sessionId: map['sessionId'],
      customHeaders: map['customHeaders'] != null
          ? Map<String, String>.from(map['customHeaders'])
          : null,
    );
  }

  /// Check if authentication needs refresh
  bool get needsRefresh {
    if (!isAuthenticated) return false;
    if (expiresAt == null) return false;

    // Check if expires within 5 minutes
    final threshold = DateTime.now().add(const Duration(minutes: 5));
    return expiresAt!.isBefore(threshold);
  }

  /// Get authentication headers for requests
  Map<String, String> getAuthHeaders() {
    final headers = <String, String>{};

    switch (authType) {
      case AuthType.clientId:
        if (clientId != null && headerKey != null) {
          headers[headerKey!] = clientId!;
        }
        break;
      case AuthType.headerKey:
        if (headerKey != null && headerValue != null) {
          headers[headerKey!] = headerValue!;
        }
        break;
      case AuthType.jwt:
        if (jwtToken != null) {
          headers['Authorization'] = 'Bearer $jwtToken';
        }
        break;
      case AuthType.session:
        if (sessionId != null) {
          headers['X-Session-ID'] = sessionId!;
        }
        break;
      case AuthType.custom:
        if (customHeaders != null) {
          headers.addAll(customHeaders!);
        }
        break;
      case AuthType.multiple:
        // Handle multiple auth strategies
        if (clientId != null && headerKey != null) {
          headers[headerKey!] = clientId!;
        }
        if (jwtToken != null) {
          headers['Authorization'] = 'Bearer $jwtToken';
        }
        if (customHeaders != null) {
          headers.addAll(customHeaders!);
        }
        break;
      case AuthType.clientKey:
        // Fix: Added missing case for clientKey
        if (clientId != null) {
          headers['X-Client-Key'] = clientId!;
        }
        break;
      case AuthType.none:
        break;
    }

    return headers;
  }
}

/// Base user model with common Laravel fields
abstract class BaseUserModel {
  // Core Laravel user fields
  final int? id;
  final String? name;
  final String? nickname;
  final String? username;
  final String? email;
  final DateTime? emailVerifiedAt;
  final String? avatar;
  final String? about;
  final String? followers;
  final String? website;
  final String? github;
  final String? wechat;
  final String? weibo;
  final String? qq;
  final String? age;
  final String? gender;
  final String? birthday;
  final String? city;
  final String? education;
  final String? occupation;
  final String? language;
  final String? religion;
  final int? roleLevel;
  final String? roleName;
  final String? userToken;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  // Authentication metadata
  final AuthMetadata authMetadata;

  const BaseUserModel({
    this.id,
    this.name,
    this.nickname,
    this.username,
    this.email,
    this.emailVerifiedAt,
    this.avatar,
    this.about,
    this.followers,
    this.website,
    this.github,
    this.wechat,
    this.weibo,
    this.qq,
    this.age,
    this.gender,
    this.birthday,
    this.city,
    this.education,
    this.occupation,
    this.language,
    this.religion,
    this.roleLevel,
    this.roleName,
    this.userToken,
    this.createdAt,
    this.updatedAt,
    this.authMetadata = const AuthMetadata(),
  });

  /// Convert to map for serialization
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'nickname': nickname,
      'username': username,
      'email': email,
      'email_verified_at': emailVerifiedAt?.toIso8601String(),
      'avatar': avatar,
      'about': about,
      'followers': followers,
      'website': website,
      'github': github,
      'wechat': wechat,
      'weibo': weibo,
      'qq': qq,
      'age': age,
      'gender': gender,
      'birthday': birthday,
      'city': city,
      'education': education,
      'occupation': occupation,
      'language': language,
      'religion': religion,
      'role_level': roleLevel,
      'role_name': roleName,
      'user_token': userToken,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'auth_metadata': authMetadata.toMap(),
    };
  }

  /// Create from map - to be overridden by subclasses
  static BaseUserModel fromMap(Map<String, dynamic> map) {
    throw UnimplementedError('Subclasses must implement fromMap');
  }
}

/// Base UserProvider class that apps should extend
/// This provides a common interface for user management with authentication metadata
abstract class BaseUserProvider with ChangeNotifier {
  /// Check if user is authenticated
  bool get isAuthenticated;

  /// Get authentication token
  String? get token;

  /// Get user token (alternative token field)
  String? get userToken;

  /// Get token type
  String? get tokenType;

  /// Get user data (to be implemented by each app)
  BaseUserModel? get user;

  /// Get authentication metadata
  AuthMetadata get authMetadata;

  /// Set user data (to be implemented by each app)
  void setUser(BaseUserModel user);

  /// Clear user data (to be implemented by each app)
  void clearUser();

  /// Update token
  void updateToken(String? token, {String? tokenType});

  /// Set authentication metadata
  void setAuthMetadata(AuthMetadata metadata);

  /// Update authentication metadata
  void updateAuthMetadata({
    AuthType? authType,
    Map<String, dynamic>? data,
    DateTime? authenticatedAt,
    DateTime? expiresAt,
    bool? isAuthenticated,
    String? clientId,
    String? headerKey,
    String? headerValue,
    String? jwtToken,
    String? refreshToken,
    String? sessionId,
    Map<String, String>? customHeaders,
  });

  /// Check if authentication needs refresh
  bool get needsAuthRefresh;

  /// Get authentication headers for network requests
  Map<String, String> getAuthHeaders();

  /// Check if user has specific permission
  bool hasPermission(String permission);

  /// Check if user has specific role
  bool hasRole(String role);
}

/// Laravel enhanced user model with extended features
class LaravelUserModel extends BaseUserModel {
  final String? phone;
  final String? mobile;
  final String? country;
  final String? province;
  final String? cityDistrict;
  final String? address;
  final String? postalCode;
  final String? timezone;
  final String? lastLoginIp;
  final DateTime? lastLoginAt;
  final bool isTwoFactorEnabled;
  final String? twoFactorSecret;
  final List<String> permissions;
  final List<String> permissionGroups;
  final List<String> roles;
  final List<String> teams;
  final Map<String, dynamic> preferences;
  final Map<String, dynamic> meta;

  const LaravelUserModel({
    super.id,
    super.name,
    super.nickname,
    super.username,
    super.email,
    super.emailVerifiedAt,
    super.avatar,
    super.about,
    super.followers,
    super.website,
    super.github,
    super.wechat,
    super.weibo,
    super.qq,
    super.age,
    super.gender,
    super.birthday,
    super.city,
    super.education,
    super.occupation,
    super.language,
    super.religion,
    super.roleLevel,
    super.roleName,
    super.userToken,
    super.createdAt,
    super.updatedAt,
    super.authMetadata = const AuthMetadata(),
    this.phone,
    this.mobile,
    this.country,
    this.province,
    this.cityDistrict,
    this.address,
    this.postalCode,
    this.timezone,
    this.lastLoginIp,
    this.lastLoginAt,
    this.isTwoFactorEnabled = false,
    this.twoFactorSecret,
    this.permissions = const <String>[],
    this.permissionGroups = const <String>[],
    this.roles = const <String>[],
    this.teams = const <String>[],
    this.preferences = const <String, dynamic>{},
    this.meta = const <String, dynamic>{},
  });

  LaravelUserModel copyWith({
    int? id,
    String? name,
    String? nickname,
    String? username,
    String? email,
    DateTime? emailVerifiedAt,
    String? avatar,
    String? about,
    String? followers,
    String? website,
    String? github,
    String? wechat,
    String? weibo,
    String? qq,
    String? age,
    String? gender,
    String? birthday,
    String? city,
    String? education,
    String? occupation,
    String? language,
    String? religion,
    int? roleLevel,
    String? roleName,
    String? userToken,
    DateTime? createdAt,
    DateTime? updatedAt,
    AuthMetadata? authMetadata,
    String? phone,
    String? mobile,
    String? country,
    String? province,
    String? cityDistrict,
    String? address,
    String? postalCode,
    String? timezone,
    String? lastLoginIp,
    DateTime? lastLoginAt,
    bool? isTwoFactorEnabled,
    String? twoFactorSecret,
    List<String>? permissions,
    List<String>? permissionGroups,
    List<String>? roles,
    List<String>? teams,
    Map<String, dynamic>? preferences,
    Map<String, dynamic>? meta,
  }) {
    return LaravelUserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      nickname: nickname ?? this.nickname,
      username: username ?? this.username,
      email: email ?? this.email,
      emailVerifiedAt: emailVerifiedAt ?? this.emailVerifiedAt,
      avatar: avatar ?? this.avatar,
      about: about ?? this.about,
      followers: followers ?? this.followers,
      website: website ?? this.website,
      github: github ?? this.github,
      wechat: wechat ?? this.wechat,
      weibo: weibo ?? this.weibo,
      qq: qq ?? this.qq,
      age: age ?? this.age,
      gender: gender ?? this.gender,
      birthday: birthday ?? this.birthday,
      city: city ?? this.city,
      education: education ?? this.education,
      occupation: occupation ?? this.occupation,
      language: language ?? this.language,
      religion: religion ?? this.religion,
      roleLevel: roleLevel ?? this.roleLevel,
      roleName: roleName ?? this.roleName,
      userToken: userToken ?? this.userToken,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      authMetadata: authMetadata ?? this.authMetadata,
      phone: phone ?? this.phone,
      mobile: mobile ?? this.mobile,
      country: country ?? this.country,
      province: province ?? this.province,
      cityDistrict: cityDistrict ?? this.cityDistrict,
      address: address ?? this.address,
      postalCode: postalCode ?? this.postalCode,
      timezone: timezone ?? this.timezone,
      lastLoginIp: lastLoginIp ?? this.lastLoginIp,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      isTwoFactorEnabled: isTwoFactorEnabled ?? this.isTwoFactorEnabled,
      twoFactorSecret: twoFactorSecret ?? this.twoFactorSecret,
      permissions: permissions ?? this.permissions,
      permissionGroups: permissionGroups ?? this.permissionGroups,
      roles: roles ?? this.roles,
      teams: teams ?? this.teams,
      preferences: preferences ?? this.preferences,
      meta: meta ?? this.meta,
    );
  }

  @override
  Map<String, dynamic> toMap() {
    return <String, dynamic>{
      'id': id,
      'name': name,
      'nickname': nickname,
      'username': username,
      'email': email,
      'email_verified_at': emailVerifiedAt?.toIso8601String(),
      'avatar': avatar,
      'about': about,
      'followers': followers,
      'website': website,
      'github': github,
      'wechat': wechat,
      'weibo': weibo,
      'qq': qq,
      'age': age,
      'gender': gender,
      'birthday': birthday,
      'city': city,
      'education': education,
      'occupation': occupation,
      'language': language,
      'religion': religion,
      'role_level': roleLevel,
      'role_name': roleName,
      'user_token': userToken,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'auth_metadata': authMetadata.toMap(),
      'phone': phone,
      'mobile': mobile,
      'country': country,
      'province': province,
      'city_district': cityDistrict,
      'address': address,
      'postal_code': postalCode,
      'timezone': timezone,
      'last_login_ip': lastLoginIp,
      'last_login_at': lastLoginAt?.toIso8601String(),
      'is_two_factor_enabled': isTwoFactorEnabled,
      'two_factor_secret': twoFactorSecret,
      'permissions': permissions,
      'permission_groups': permissionGroups,
      'roles': roles,
      'teams': teams,
      'preferences': preferences,
      'meta': meta,
    };
  }

  factory LaravelUserModel.fromMap(Map<String, dynamic> map) {
    final List<String> permissions = map['permissions'] != null
        ? List<String>.from(map['permissions'] as List)
        : const <String>[];
    final List<String> permissionGroups = map['permission_groups'] != null
        ? List<String>.from(map['permission_groups'] as List)
        : const <String>[];
    final List<String> roles = map['roles'] != null
        ? List<String>.from(map['roles'] as List)
        : const <String>[];
    final List<String> teams = map['teams'] != null
        ? List<String>.from(map['teams'] as List)
        : const <String>[];
    return LaravelUserModel(
      id: map['id'] as int?,
      name: map['name'] as String?,
      nickname: map['nickname'] as String?,
      username: map['username'] as String?,
      email: map['email'] as String?,
      emailVerifiedAt: map['email_verified_at'] != null
          ? DateTime.tryParse(map['email_verified_at'] as String)
          : null,
      avatar: map['avatar'] as String?,
      about: map['about'] as String?,
      followers: map['followers'] as String?,
      website: map['website'] as String?,
      github: map['github'] as String?,
      wechat: map['wechat'] as String?,
      weibo: map['weibo'] as String?,
      qq: map['qq'] as String?,
      age: map['age'] as String?,
      gender: map['gender'] as String?,
      birthday: map['birthday'] as String?,
      city: map['city'] as String?,
      education: map['education'] as String?,
      occupation: map['occupation'] as String?,
      language: map['language'] as String?,
      religion: map['religion'] as String?,
      roleLevel: map['role_level'] as int?,
      roleName: map['role_name'] as String?,
      userToken: map['user_token'] as String?,
      createdAt: map['created_at'] != null
          ? DateTime.tryParse(map['created_at'] as String)
          : null,
      updatedAt: map['updated_at'] != null
          ? DateTime.tryParse(map['updated_at'] as String)
          : null,
      authMetadata: map['auth_metadata'] != null
          ? AuthMetadata.fromMap(
              Map<String, dynamic>.from(map['auth_metadata'] as Map),
            )
          : const AuthMetadata(),
      phone: map['phone'] as String?,
      mobile: map['mobile'] as String?,
      country: map['country'] as String?,
      province: map['province'] as String?,
      cityDistrict: map['city_district'] as String?,
      address: map['address'] as String?,
      postalCode: map['postal_code'] as String?,
      timezone: map['timezone'] as String?,
      lastLoginIp: map['last_login_ip'] as String?,
      lastLoginAt: map['last_login_at'] != null
          ? DateTime.tryParse(map['last_login_at'] as String)
          : null,
      isTwoFactorEnabled:
          map['is_two_factor_enabled'] as bool? ?? false,
      twoFactorSecret: map['two_factor_secret'] as String?,
      permissions: permissions,
      permissionGroups: permissionGroups,
      roles: roles,
      teams: teams,
      preferences: map['preferences'] != null
          ? Map<String, dynamic>.from(map['preferences'] as Map)
          : const <String, dynamic>{},
      meta: map['meta'] != null
          ? Map<String, dynamic>.from(map['meta'] as Map)
          : const <String, dynamic>{},
    );
  }

  factory LaravelUserModel.empty() {
    return LaravelUserModel(
      id: null,
      name: null,
      nickname: null,
      username: null,
      email: null,
      avatar: null,
      createdAt: null,
      updatedAt: null,
      permissions: const <String>[],
      permissionGroups: const <String>[],
      roles: const <String>[],
      teams: const <String>[],
      preferences: const <String, dynamic>{},
      meta: const <String, dynamic>{},
    );
  }
}

/// Default user model implementation for basic usage
class DefaultUserModel extends BaseUserModel {
  const DefaultUserModel({
    super.id,
    super.name,
    super.nickname,
    super.username,
    super.email,
    super.emailVerifiedAt,
    super.avatar,
    super.about,
    super.followers,
    super.website,
    super.github,
    super.wechat,
    super.weibo,
    super.qq,
    super.age,
    super.gender,
    super.birthday,
    super.city,
    super.education,
    super.occupation,
    super.language,
    super.religion,
    super.roleLevel,
    super.roleName,
    super.userToken,
    super.createdAt,
    super.updatedAt,
    super.authMetadata = const AuthMetadata(),
  });

  @override
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'nickname': nickname,
      'username': username,
      'email': email,
      'email_verified_at': emailVerifiedAt?.toIso8601String(),
      'avatar': avatar,
      'about': about,
      'followers': followers,
      'website': website,
      'github': github,
      'wechat': wechat,
      'weibo': weibo,
      'qq': qq,
      'age': age,
      'gender': gender,
      'birthday': birthday,
      'city': city,
      'education': education,
      'occupation': occupation,
      'language': language,
      'religion': religion,
      'role_level': roleLevel,
      'role_name': roleName,
      'user_token': userToken,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      'auth_metadata': authMetadata.toMap(),
    };
  }

  factory DefaultUserModel.fromMap(Map<String, dynamic> map) {
    return DefaultUserModel(
      id: map['id'],
      name: map['name'],
      nickname: map['nickname'],
      username: map['username'],
      email: map['email'],
      emailVerifiedAt: map['email_verified_at'] != null
          ? DateTime.tryParse(map['email_verified_at'])
          : null,
      avatar: map['avatar'],
      about: map['about'],
      followers: map['followers'],
      website: map['website'],
      github: map['github'],
      wechat: map['wechat'],
      weibo: map['weibo'],
      qq: map['qq'],
      age: map['age'],
      gender: map['gender'],
      birthday: map['birthday'],
      city: map['city'],
      education: map['education'],
      occupation: map['occupation'],
      language: map['language'],
      religion: map['religion'],
      roleLevel: map['role_level'],
      roleName: map['role_name'],
      userToken: map['user_token'],
      createdAt: map['created_at'] != null
          ? DateTime.tryParse(map['created_at'])
          : null,
      updatedAt: map['updated_at'] != null
          ? DateTime.tryParse(map['updated_at'])
          : null,
      authMetadata: map['auth_metadata'] != null
          ? AuthMetadata.fromMap(map['auth_metadata'])
          : const AuthMetadata(),
    );
  }

  DefaultUserModel copyWith({
    int? id,
    String? name,
    String? nickname,
    String? username,
    String? email,
    DateTime? emailVerifiedAt,
    String? avatar,
    String? about,
    String? followers,
    String? website,
    String? github,
    String? wechat,
    String? weibo,
    String? qq,
    String? age,
    String? gender,
    String? birthday,
    String? city,
    String? education,
    String? occupation,
    String? language,
    String? religion,
    int? roleLevel,
    String? roleName,
    String? userToken,
    DateTime? createdAt,
    DateTime? updatedAt,
    AuthMetadata? authMetadata,
  }) {
    return DefaultUserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      nickname: nickname ?? this.nickname,
      username: username ?? this.username,
      email: email ?? this.email,
      emailVerifiedAt: emailVerifiedAt ?? this.emailVerifiedAt,
      avatar: avatar ?? this.avatar,
      about: about ?? this.about,
      followers: followers ?? this.followers,
      website: website ?? this.website,
      github: github ?? this.github,
      wechat: wechat ?? this.wechat,
      weibo: weibo ?? this.weibo,
      qq: qq ?? this.qq,
      age: age ?? this.age,
      gender: gender ?? this.gender,
      birthday: birthday ?? this.birthday,
      city: city ?? this.city,
      education: education ?? this.education,
      occupation: occupation ?? this.occupation,
      language: language ?? this.language,
      religion: religion ?? this.religion,
      roleLevel: roleLevel ?? this.roleLevel,
      roleName: roleName ?? this.roleName,
      userToken: userToken ?? this.userToken,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      authMetadata: authMetadata ?? this.authMetadata,
    );
  }
}

/// Enhanced UserProvider with advanced permission management and caching
/// This replaces both DefaultUserProvider and UserProviderV3
class EnhancedUserProvider extends BaseUserProvider {
  final StorageManager _storageManager;
  final CacheManager _cacheManager;
  final String appNamespace;
  final Map<String, PermissionAuthenticator> _permissionAuthenticators;
  final Map<String, PermissionRecord> _permissionRecords;
  final Set<String> _roles;
  final Set<String> _claims;

  static const String _storageBoxPrefix = 'user_provider_enhanced';
  static const String _userStorageKey = 'user_model';
  static const String _authStorageKey = 'auth_metadata';
  static const String _permissionStorageKey = 'permission_records';
  static const String _rolesStorageKey = 'role_claims';
  static const String _claimsStorageKey = 'auth_claims';
  static const String _clientFlagStorageKey = 'client_permission_flag';
  static const String _verificationTypeKey = 'verification_type';

  BaseUserModel? _user;
  String? _token;
  String? _userToken;
  String? _tokenType;
  AuthMetadata _authMetadata;
  bool _clientPermissionGranted;
  bool _initialized;
  String? _verificationType;

  EnhancedUserProvider({
    this.appNamespace = 'core',
    StorageManager? storageManager,
    CacheManager? cacheManager,
  })  : _storageManager = storageManager ?? StorageManager.instance,
        _cacheManager = cacheManager ?? CacheManager.instance,
        _permissionAuthenticators = <String, PermissionAuthenticator>{},
        _permissionRecords = <String, PermissionRecord>{},
        _roles = <String>{},
        _claims = <String>{},
        _user = null,
        _token = null,
        _userToken = null,
        _tokenType = null,
        _authMetadata = const AuthMetadata(),
        _clientPermissionGranted = false,
        _initialized = false,
        _verificationType = null;

  // Getters for enhanced functionality
  bool get clientPermissionGranted => _clientPermissionGranted;
  bool get isInitialized => _initialized;
  String? get verificationType => _verificationType;

  Set<String> get verifiedPermissionGroups {
    final Set<String> groups = <String>{};
    for (final MapEntry<String, PermissionRecord> entry
        in _permissionRecords.entries) {
      if (entry.value.status == PermissionStatus.verified) {
        groups.add(entry.key);
      }
    }
    return groups;
  }

  /// Initialize the provider
  Future<void> ensureInitialized() async {
    if (_initialized) {
      return;
    }
    await _storageManager.init(appName: appNamespace);
    await _storageManager.openBox(_boxName);
    await _loadUser();
    await _loadAuthMetadata();
    await _loadPermissionRecords();
    await _loadRoles();
    await _loadClaims();
    await _loadClientFlag();
    await _cacheManager.initialize();
    _initialized = true;
  }

  /// Register permission authenticator
  void registerPermissionAuthenticator(
    String group,
    PermissionAuthenticator authenticator,
  ) {
    _permissionAuthenticators[group] = authenticator;
  }

  /// Ensure permission claims are valid
  Future<void> ensurePermissionClaims(
    Iterable<String> claims, {
    String scope = 'user',
  }) async {
    await ensureInitialized();
    final Set<String> requested = claims.toSet();
    if (requested.isEmpty) {
      return;
    }

    final List<String> pendingClaims = requested
        .where((String claim) => !_isPermissionVerified(claim))
        .toList();
    if (pendingClaims.isEmpty) {
      _claims.addAll(requested);
      await _persistClaims();
      return;
    }

    if (_authMetadata.authType == AuthType.jwt) {
      for (final String claim in pendingClaims) {
        final PermissionAuthenticator? authenticator =
            _permissionAuthenticators[claim];
        if (authenticator == null) {
          _permissionRecords[claim] = _permissionRecords[claim]?.copyWith(
                status: PermissionStatus.pending,
              ) ??
              const PermissionRecord(status: PermissionStatus.pending);
          continue;
        }
        try {
          final AuthMetadata nextMetadata = await authenticator(_authMetadata);
          _authMetadata = nextMetadata;
          _claims.add(claim);
          _permissionRecords[claim] = PermissionRecord(
            status: PermissionStatus.verified,
            lastVerifiedAt: DateTime.now(),
            metadata: nextMetadata.data,
          );
        } catch (error) {
          _permissionRecords[claim] = PermissionRecord(
            status: PermissionStatus.failed,
            lastVerifiedAt: DateTime.now(),
            metadata: <String, dynamic>{'error': error.toString()},
          );
        }
      }
      await _persistAuthMetadata();
      await _persistPermissionRecords();
      await _persistClaims();
      notifyListeners();
      return;
    }

    if (_authMetadata.authType == AuthType.clientId ||
        _authMetadata.authType == AuthType.headerKey) {
      _clientPermissionGranted = true;
      _verificationType = _authMetadata.authType.name;
      for (final String claim in pendingClaims) {
        _permissionRecords[claim] = PermissionRecord(
          status: PermissionStatus.verified,
          lastVerifiedAt: DateTime.now(),
          metadata: <String, dynamic>{
            'strategy': _authMetadata.authType.name,
            'scope': scope,
          },
        );
      }
      _claims.addAll(requested);
      await _persistPermissionRecords();
      await _persistClaims();
      await _persistClientFlag();
      notifyListeners();
      return;
    }

    for (final String claim in pendingClaims) {
      _permissionRecords[claim] = const PermissionRecord(
        status: PermissionStatus.pending,
      );
    }
    await _persistPermissionRecords();
    notifyListeners();
  }

  /// Mark client permission as granted
  void markClientPermissionGranted({
    bool granted = true,
    String? verificationType,
  }) {
    _clientPermissionGranted = granted;
    if (verificationType != null && verificationType.isNotEmpty) {
      _verificationType = verificationType;
    }
    _persistClientFlag();
    notifyListeners();
  }

  /// Build network augmentation bundle
  AuthAugmentationBundle buildNetworkAugmentation({
    String scope = 'user',
    Iterable<String> claims = const <String>[],
  }) {
    final Map<String, String> headers = getAuthHeaders();
    if (claims.isNotEmpty) {
      headers['X-Permission-Groups'] = claims.join(',');
    }
    headers['X-Auth-Scope'] = scope;
    headers['X-Auth-Type'] = _authMetadata.authType.name;
    if (_verificationType != null && _verificationType!.isNotEmpty) {
      headers['X-Auth-Verification'] = _verificationType!;
    }
    if (_clientPermissionGranted) {
      headers['X-Client-Permission'] = 'granted';
    }

    final Map<String, dynamic> metadata = <String, dynamic>{
      'authType': _authMetadata.authType.name,
      'claims': _claims.toList(),
      'verifiedGroups': verifiedPermissionGroups.toList(),
      'scope': scope,
      'authData': _authMetadata.data,
      if (_verificationType != null) 'verificationType': _verificationType,
      if (_user?.id != null) 'userId': _user!.id,
      if (_user?.username != null) 'username': _user!.username,
    };

    final Map<String, dynamic> sessionUpdate = <String, dynamic>{
      'authType': _authMetadata.authType.name,
      if (_authMetadata.jwtToken != null) 'jwt': _authMetadata.jwtToken,
      if (_authMetadata.clientId != null) 'clientKey': _authMetadata.clientId,
      if (_authMetadata.sessionId != null) 'sessionId': _authMetadata.sessionId,
    };

    return AuthAugmentationBundle(
      headers: headers,
      metadata: metadata,
      sessionUpdate: sessionUpdate,
    );
  }

  @override
  bool get isAuthenticated {
    return _authMetadata.isAuthenticated ||
        _authMetadata.jwtToken != null ||
        _authMetadata.clientId != null ||
        (_user != null && _user!.userToken != null) ||
        (_token != null) ||
        (_userToken != null);
  }

  @override
  String? get token {
    if (_authMetadata.jwtToken != null &&
        _authMetadata.jwtToken!.isNotEmpty) {
      return _authMetadata.jwtToken;
    }
    return _token ?? _authMetadata.clientId ?? _user?.userToken;
  }

  @override
  String? get userToken {
    return _userToken ?? _user?.userToken ?? _authMetadata.sessionId ?? _authMetadata.jwtToken;
  }

  @override
  String? get tokenType {
    if (_tokenType != null) return _tokenType;
    if (_authMetadata.authType == AuthType.jwt) {
      return 'Bearer';
    }
    if (_authMetadata.authType == AuthType.clientId) {
      return 'Client';
    }
    if (_authMetadata.authType == AuthType.headerKey) {
      return _authMetadata.headerKey;
    }
    return null;
  }

  @override
  BaseUserModel? get user => _user;

  @override
  AuthMetadata get authMetadata => _authMetadata;

  @override
  bool get needsAuthRefresh => _authMetadata.needsRefresh;

  @override
  void setUser(BaseUserModel user) {
    _user = user;
    _authMetadata = user.authMetadata;

    // Update roles and claims if user is LaravelUserModel
    if (user is LaravelUserModel) {
      _roles
        ..clear()
        ..addAll(user.roles);
      _claims.addAll(user.permissions);
      _persistRoles();
      _persistClaims();
    }

    _persistUser();
    notifyListeners();
  }

  @override
  void clearUser() {
    _user = null;
    _token = null;
    _userToken = null;
    _tokenType = null;
    _authMetadata = const AuthMetadata();
    _roles.clear();
    _claims.clear();
    _clientPermissionGranted = false;
    _verificationType = null;
    _permissionRecords.clear();

    _persistUser();
    _persistRoles();
    _persistClaims();
    _persistClientFlag();
    _persistPermissionRecords();
    notifyListeners();
  }

  @override
  void updateToken(String? token, {String? tokenType}) {
    _token = token;
    _tokenType = tokenType ?? "Bearer";

    // Update auth metadata
    final AuthMetadata nextMetadata = _authMetadata.copyWith(
      jwtToken: token ?? _authMetadata.jwtToken,
      headerValue: tokenType ?? _authMetadata.headerValue,
      data: <String, dynamic>{
        ..._authMetadata.data,
        if (tokenType != null) 'tokenType': tokenType,
      },
    );

    if (token != null && (_tokenType?.toLowerCase().contains('bearer') ?? false)) {
      nextMetadata.copyWith(
        authType: AuthType.jwt,
        isAuthenticated: true,
        authenticatedAt: DateTime.now(),
      );
    }

    if (tokenType != null && tokenType.isNotEmpty) {
      _verificationType = tokenType;
    }

    setAuthMetadata(nextMetadata);
  }

  @override
  void setAuthMetadata(AuthMetadata metadata) {
    _authMetadata = metadata;

    // Extract claims and roles from metadata
    if (metadata.data.containsKey('claims')) {
      final dynamic rawClaims = metadata.data['claims'];
      if (rawClaims is Iterable) {
        _claims
          ..clear()
          ..addAll(rawClaims.cast<String>());
      }
    }
    if (metadata.data.containsKey('roles')) {
      final dynamic rawRoles = metadata.data['roles'];
      if (rawRoles is Iterable) {
        _roles
          ..clear()
          ..addAll(rawRoles.cast<String>());
      }
    }
    if (metadata.data.containsKey('clientPermissionGranted')) {
      _clientPermissionGranted =
          metadata.data['clientPermissionGranted'] as bool? ?? false;
    }
    if (metadata.data.containsKey('verificationType')) {
      final String? type = metadata.data['verificationType'] as String?;
      if (type != null && type.isNotEmpty) {
        _verificationType = type;
      }
    }

    _persistAuthMetadata();
    _persistClaims();
    _persistClientFlag();
    notifyListeners();
  }

  @override
  void updateAuthMetadata({
    AuthType? authType,
    Map<String, dynamic>? data,
    DateTime? authenticatedAt,
    DateTime? expiresAt,
    bool? isAuthenticated,
    String? clientId,
    String? headerKey,
    String? headerValue,
    String? jwtToken,
    String? refreshToken,
    String? sessionId,
    Map<String, String>? customHeaders,
  }) {
    final AuthMetadata next = _authMetadata.copyWith(
      authType: authType,
      data: data != null
          ? <String, dynamic>{
              ..._authMetadata.data,
              ...data,
            }
          : _authMetadata.data,
      authenticatedAt: authenticatedAt,
      expiresAt: expiresAt,
      isAuthenticated: isAuthenticated,
      clientId: clientId,
      headerKey: headerKey,
      headerValue: headerValue,
      jwtToken: jwtToken,
      refreshToken: refreshToken,
      sessionId: sessionId,
      customHeaders: customHeaders,
    );
    setAuthMetadata(next);
  }

  @override
  Map<String, String> getAuthHeaders() {
    final Map<String, String> headers = _authMetadata.getAuthHeaders();
    if (_clientPermissionGranted &&
        _authMetadata.authType != AuthType.jwt) {
      headers['X-Client-Permission'] = 'granted';
    }
    if (_verificationType != null && _verificationType!.isNotEmpty) {
      headers['X-Auth-Verification'] = _verificationType!;
    }
    return headers;
  }

  @override
  bool hasPermission(String permission) {
    // Check Laravel user permissions first
    if (_user is LaravelUserModel) {
      final LaravelUserModel laravelUser = _user as LaravelUserModel;
      if (laravelUser.permissions.contains(permission)) {
        return true;
      }
    }

    // Check permission records
    if (_permissionRecords.containsKey(permission)) {
      return _permissionRecords[permission]!.status ==
          PermissionStatus.verified;
    }

    // Check claims
    if (_claims.contains(permission)) {
      return true;
    }

    // Default implementation
    return _user?.roleLevel != null && _user!.roleLevel! > 0;
  }

  @override
  bool hasRole(String role) {
    // Check user role name
    if (_user?.roleName == role) {
      return true;
    }

    // Check Laravel user roles
    if (_user is LaravelUserModel) {
      final LaravelUserModel laravelUser = _user as LaravelUserModel;
      if (laravelUser.roles.contains(role)) {
        return true;
      }
    }

    // Check internal roles set
    return _roles.contains(role);
  }

  // Private helper methods
  String get _boxName => '${_storageBoxPrefix}_$appNamespace';

  bool _isPermissionVerified(String claim) {
    final PermissionRecord? record = _permissionRecords[claim];
    if (record == null) {
      return false;
    }
    return record.status == PermissionStatus.verified;
  }

  // Persistence methods
  Future<void> _loadUser() async {
    final String? rawUser = await _storageManager.getValue<String>(
      _boxName,
      _userStorageKey,
    );
    if (rawUser == null || rawUser.isEmpty) {
      _user = null;
      return;
    }
    try {
      final Map<String, dynamic> data =
          Map<String, dynamic>.from(jsonDecode(rawUser) as Map);

      // Try to create LaravelUserModel first, fallback to DefaultUserModel
      try {
        _user = LaravelUserModel.fromMap(data);
        final LaravelUserModel laravelUser = _user as LaravelUserModel;
        _roles
          ..clear()
          ..addAll(laravelUser.roles);
        _claims
          ..clear()
          ..addAll(laravelUser.permissions);
      } catch (e) {
        _user = DefaultUserModel.fromMap(data);
      }
    } catch (error) {
      if (kDebugMode) {
        debugPrint('Failed to decode stored user: ${error.toString()}');
      }
      _user = null;
    }
  }

  Future<void> _loadAuthMetadata() async {
    final Map<String, dynamic>? raw =
        await _storageManager.getValue<Map<String, dynamic>>(
      _boxName,
      _authStorageKey,
    );
    if (raw != null) {
      _authMetadata = AuthMetadata.fromMap(raw);
    }
    final String? storedVerification = await _storageManager.getValue<String>(
      _boxName,
      _verificationTypeKey,
    );
    if (storedVerification != null && storedVerification.isNotEmpty) {
      _verificationType = storedVerification;
    }
  }

  Future<void> _loadPermissionRecords() async {
    final Map<String, dynamic>? raw =
        await _storageManager.getValue<Map<String, dynamic>>(
      _boxName,
      _permissionStorageKey,
    );
    if (raw == null) {
      return;
    }
    _permissionRecords.clear();
    raw.forEach((String key, dynamic value) {
      if (value is Map) {
        _permissionRecords[key] =
            PermissionRecord.fromMap(Map<String, dynamic>.from(value));
      }
    });
  }

  Future<void> _loadRoles() async {
    final List<dynamic>? storedRoles =
        await _storageManager.getValue<List<dynamic>>(
      _boxName,
      _rolesStorageKey,
    );
    if (storedRoles == null) {
      return;
    }
    _roles
      ..clear()
      ..addAll(storedRoles.cast<String>());
  }

  Future<void> _loadClaims() async {
    final List<dynamic>? storedClaims =
        await _storageManager.getValue<List<dynamic>>(
      _boxName,
      _claimsStorageKey,
    );
    if (storedClaims == null) {
      return;
    }
    _claims
      ..clear()
      ..addAll(storedClaims.cast<String>());
  }

  Future<void> _loadClientFlag() async {
    final bool? flag = await _storageManager.getValue<bool>(
      _boxName,
      _clientFlagStorageKey,
    );
    _clientPermissionGranted = flag ?? false;
  }

  Future<void> _persistUser() async {
    if (_user == null) {
      await _storageManager.deleteKey(_boxName, _userStorageKey);
      return;
    }
    final String payload = jsonEncode(_user!.toMap());
    await _storageManager.putValue<String>(
      _boxName,
      _userStorageKey,
      payload,
    );

    // Cache user in cache manager
    if (_user is LaravelUserModel) {
      await _cacheManager.put<LaravelUserModel>(
        'user_provider_enhanced',
        'user_profile',
        _user as LaravelUserModel,
        ttl: const Duration(hours: 12),
      );
    }
  }

  Future<void> _persistAuthMetadata() async {
    await _storageManager.putValue<Map<String, dynamic>>(
      _boxName,
      _authStorageKey,
      _authMetadata.toMap(),
    );
    if (_verificationType != null && _verificationType!.isNotEmpty) {
      await _storageManager.putValue<String>(
        _boxName,
        _verificationTypeKey,
        _verificationType!,
      );
    }
  }

  Future<void> _persistPermissionRecords() async {
    final Map<String, dynamic> serialized = <String, dynamic>{};
    for (final MapEntry<String, PermissionRecord> entry
        in _permissionRecords.entries) {
      serialized[entry.key] = entry.value.toMap();
    }
    await _storageManager.putValue<Map<String, dynamic>>(
      _boxName,
      _permissionStorageKey,
      serialized,
    );
  }

  Future<void> _persistRoles() async {
    await _storageManager.putValue<List<String>>(
      _boxName,
      _rolesStorageKey,
      _roles.toList(),
    );
  }

  Future<void> _persistClaims() async {
    await _storageManager.putValue<List<String>>(
      _boxName,
      _claimsStorageKey,
      _claims.toList(),
    );
  }

  Future<void> _persistClientFlag() async {
    await _storageManager.putValue<bool>(
      _boxName,
      _clientFlagStorageKey,
      _clientPermissionGranted,
    );
  }
}

/// Simple implementation for basic use cases
class SimpleUserProvider extends BaseUserProvider {
  DefaultUserModel? _user;
  String? _token;
  String? _userToken;
  String? _tokenType;
  AuthMetadata _authMetadata = const AuthMetadata();

  @override
  bool get isAuthenticated => _authMetadata.isAuthenticated || (_token != null) || (_userToken != null);

  @override
  String? get token => _token ?? _authMetadata.jwtToken;

  @override
  String? get userToken => _userToken ?? _user?.userToken;

  @override
  String? get tokenType => _tokenType;

  @override
  DefaultUserModel? get user => _user;

  @override
  AuthMetadata get authMetadata => _authMetadata;

  @override
  bool get needsAuthRefresh => _authMetadata.needsRefresh;

  @override
  void setUser(BaseUserModel user) {
    if (user is DefaultUserModel) {
      _user = user;
      _authMetadata = user.authMetadata;
      notifyListeners();
    }
  }

  @override
  void clearUser() {
    _user = null;
    _token = null;
    _userToken = null;
    _tokenType = null;
    _authMetadata = const AuthMetadata();
    notifyListeners();
  }

  @override
  void updateToken(String? token, {String? tokenType}) {
    _token = token;
    _tokenType = tokenType ?? "Bearer";

    if (token != null && (_tokenType?.toLowerCase().contains('bearer') ?? false)) {
      _authMetadata = _authMetadata.copyWith(
        authType: AuthType.jwt,
        jwtToken: token,
        isAuthenticated: true,
        authenticatedAt: DateTime.now(),
      );
    }

    notifyListeners();
  }

  @override
  void setAuthMetadata(AuthMetadata metadata) {
    _authMetadata = metadata;
    notifyListeners();
  }

  @override
  void updateAuthMetadata({
    AuthType? authType,
    Map<String, dynamic>? data,
    DateTime? authenticatedAt,
    DateTime? expiresAt,
    bool? isAuthenticated,
    String? clientId,
    String? headerKey,
    String? headerValue,
    String? jwtToken,
    String? refreshToken,
    String? sessionId,
    Map<String, String>? customHeaders,
  }) {
    _authMetadata = _authMetadata.copyWith(
      authType: authType,
      data: data,
      authenticatedAt: authenticatedAt,
      expiresAt: expiresAt,
      isAuthenticated: isAuthenticated,
      clientId: clientId,
      headerKey: headerKey,
      headerValue: headerValue,
      jwtToken: jwtToken,
      refreshToken: refreshToken,
      sessionId: sessionId,
      customHeaders: customHeaders,
    );
    notifyListeners();
  }

  @override
  Map<String, String> getAuthHeaders() {
    return _authMetadata.getAuthHeaders();
  }

  @override
  bool hasPermission(String permission) {
    return _user?.roleLevel != null && _user!.roleLevel! > 0;
  }

  @override
  bool hasRole(String role) {
    return _user?.roleName == role;
  }
}
