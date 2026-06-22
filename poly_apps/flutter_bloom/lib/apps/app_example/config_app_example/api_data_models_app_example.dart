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

/// Data models and formats for app_example
/// Contains standardized request/response data structures
library;



class LoginRequestData {
  final String username;
  final String password;
  final bool remember;
  final String appId;
  final String deviceType;

  const LoginRequestData({
    required this.username,
    required this.password,
    this.remember = false,
    this.appId = 'app_example',
    this.deviceType = 'mobile',
  });

  Map<String, dynamic> toJson() => {
    'username': username,
    'password': password,
    'remember': remember,
    'app_id': appId,
    'device_type': deviceType,
  };
}

class RegisterRequestData {
  final String email;
  final String password;
  final String username;
  final String? firstName;
  final String? lastName;
  final String appId;
  final bool termsAccepted;

  const RegisterRequestData({
    required this.email,
    required this.password,
    required this.username,
    this.firstName,
    this.lastName,
    this.appId = 'app_example',
    this.termsAccepted = true,
  });

  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
    'username': username,
    'first_name': firstName,
    'last_name': lastName,
    'app_id': appId,
    'terms_accepted': termsAccepted,
  };
}

class AuthResponseData {
  final bool success;
  final String? message;
  final UserData? user;
  final String? token;
  final String? tokenType;
  final String? expiration;

  const AuthResponseData({
    required this.success,
    this.message,
    this.user,
    this.token,
    this.tokenType,
    this.expiration,
  });

  factory AuthResponseData.fromJson(Map<String, dynamic> json) {
    return AuthResponseData(
      success: json['success'] ?? false,
      message: json['message'],
      user: json['user'] != null ? UserData.fromJson(json['user']) : null,
      token: json['token'],
      tokenType: json['token_type'] ?? 'Bearer',
      expiration: json['expiration'],
    );
  }
}


class UserData {
  final String id;
  final String username;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? avatar;
  final String? phone;
  final UserRole role;
  final UserStatus status;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final Map<String, dynamic>? preferences;

  const UserData({
    required this.id,
    required this.username,
    required this.email,
    this.firstName,
    this.lastName,
    this.avatar,
    this.phone,
    this.role = UserRole.user,
    this.status = UserStatus.active,
    this.createdAt,
    this.updatedAt,
    this.preferences,
  });

  factory UserData.fromJson(Map<String, dynamic> json) {
    return UserData(
      id: json['id'].toString(),
      username: json['username'],
      email: json['email'],
      firstName: json['first_name'],
      lastName: json['last_name'],
      avatar: json['avatar'],
      phone: json['phone'],
      role: UserRole.fromString(json['role'] ?? 'user'),
      status: UserStatus.fromString(json['status'] ?? 'active'),
      createdAt: json['created_at'] != null ? DateTime.parse(json['created_at']) : null,
      updatedAt: json['updated_at'] != null ? DateTime.parse(json['updated_at']) : null,
      preferences: json['preferences'],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'email': email,
    'first_name': firstName,
    'last_name': lastName,
    'avatar': avatar,
    'phone': phone,
    'role': role.value,
    'status': status.value,
    'created_at': createdAt?.toIso8601String(),
    'updated_at': updatedAt?.toIso8601String(),
    'preferences': preferences,
  };

  String get fullName => '${firstName ?? ''} ${lastName ?? ''}'.trim();
  String get displayName => fullName.isNotEmpty ? fullName : username;
}

class UpdateUserRequestData {
  final String? firstName;
  final String? lastName;
  final String? phone;
  final String? avatar;
  final Map<String, dynamic>? preferences;

  const UpdateUserRequestData({
    this.firstName,
    this.lastName,
    this.phone,
    this.avatar,
    this.preferences,
  });

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = {};
    if (firstName != null) data['first_name'] = firstName;
    if (lastName != null) data['last_name'] = lastName;
    if (phone != null) data['phone'] = phone;
    if (avatar != null) data['avatar'] = avatar;
    if (preferences != null) data['preferences'] = preferences;
    return data;
  }
}


class ContentData {
  final String id;
  final String title;
  final String? description;
  final String? content;
  final ContentType type;
  final ContentStatus status;
  final String authorId;
  final String? authorName;
  final String? categoryId;
  final String? categoryName;
  final List<String> tags;
  final String? thumbnail;
  final int viewCount;
  final int likeCount;
  final bool isLiked;
  final bool isFavorite;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ContentData({
    required this.id,
    required this.title,
    this.description,
    this.content,
    required this.type,
    required this.status,
    required this.authorId,
    this.authorName,
    this.categoryId,
    this.categoryName,
    this.tags = const [],
    this.thumbnail,
    this.viewCount = 0,
    this.likeCount = 0,
    this.isLiked = false,
    this.isFavorite = false,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ContentData.fromJson(Map<String, dynamic> json) {
    return ContentData(
      id: json['id'].toString(),
      title: json['title'],
      description: json['description'],
      content: json['content'],
      type: ContentType.fromString(json['type'] ?? 'text'),
      status: ContentStatus.fromString(json['status'] ?? 'published'),
      authorId: json['author_id'].toString(),
      authorName: json['author_name'],
      categoryId: json['category_id']?.toString(),
      categoryName: json['category_name'],
      tags: List<String>.from(json['tags'] ?? []),
      thumbnail: json['thumbnail'],
      viewCount: json['view_count'] ?? 0,
      likeCount: json['like_count'] ?? 0,
      isLiked: json['is_liked'] ?? false,
      isFavorite: json['is_favorite'] ?? false,
      createdAt: DateTime.parse(json['created_at']),
      updatedAt: DateTime.parse(json['updated_at']),
    );
  }
}

class CreateContentRequestData {
  final String title;
  final String? description;
  final String? content;
  final ContentType type;
  final String? categoryId;
  final List<String> tags;
  final String? thumbnail;

  const CreateContentRequestData({
    required this.title,
    this.description,
    this.content,
    required this.type,
    this.categoryId,
    this.tags = const [],
    this.thumbnail,
  });

  Map<String, dynamic> toJson() => {
    'title': title,
    'description': description,
    'content': content,
    'type': type.value,
    'category_id': categoryId,
    'tags': tags,
    'thumbnail': thumbnail,
  };
}


class ApiResponse<T> {
  final bool success;
  final String? message;
  final T? data;
  final String? error;
  final int? statusCode;
  final Map<String, dynamic>? meta;

  const ApiResponse({
    required this.success,
    this.message,
    this.data,
    this.error,
    this.statusCode,
    this.meta,
  });

  factory ApiResponse.fromJson(Map<String, dynamic> json, T Function(dynamic)? fromJsonT) {
    return ApiResponse<T>(
      success: json['success'] ?? false,
      message: json['message'],
      data: json['data'] != null && fromJsonT != null ? fromJsonT(json['data']) : json['data'],
      error: json['error'],
      statusCode: json['status_code'],
      meta: json['meta'],
    );
  }

  factory ApiResponse.success({T? data, String? message, Map<String, dynamic>? meta}) {
    return ApiResponse<T>(
      success: true,
      data: data,
      message: message,
      meta: meta,
    );
  }

  factory ApiResponse.error({required String error, int? statusCode}) {
    return ApiResponse<T>(
      success: false,
      error: error,
      statusCode: statusCode,
    );
  }
}


enum UserRole {
  guest('guest'),
  user('user'),
  moderator('moderator'),
  admin('admin');

  const UserRole(this.value);
  final String value;

  static UserRole fromString(String value) {
    return UserRole.values.firstWhere(
      (role) => role.value == value,
      orElse: () => UserRole.user,
    );
  }
}

enum UserStatus {
  active('active'),
  inactive('inactive'),
  suspended('suspended'),
  banned('banned');

  const UserStatus(this.value);
  final String value;

  static UserStatus fromString(String value) {
    return UserStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () => UserStatus.active,
    );
  }
}

enum ContentType {
  text('text'),
  image('image'),
  video('video'),
  audio('audio'),
  document('document');

  const ContentType(this.value);
  final String value;

  static ContentType fromString(String value) {
    return ContentType.values.firstWhere(
      (type) => type.value == value,
      orElse: () => ContentType.text,
    );
  }
}

enum ContentStatus {
  draft('draft'),
  published('published'),
  archived('archived'),
  deleted('deleted');

  const ContentStatus(this.value);
  final String value;

  static ContentStatus fromString(String value) {
    return ContentStatus.values.firstWhere(
      (status) => status.value == value,
      orElse: () => ContentStatus.draft,
    );
  }
}
