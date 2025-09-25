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

/// Data Models for Wuy App API
/// Contains request and response data models


/// Login request data model
class LoginRequestDataWuy {
  final String username;
  final String password;
  final bool remember;
  final String? deviceId;
  final String? deviceName;

  const LoginRequestDataWuy({
    required this.username,
    required this.password,
    this.remember = false,
    this.deviceId,
    this.deviceName,
  });

  Map<String, dynamic> toJson() => {
    'username': username,
    'password': password,
    'remember': remember,
    if (deviceId != null) 'device_id': deviceId,
    if (deviceName != null) 'device_name': deviceName,
  };
}

/// Registration request data model
class RegisterRequestDataWuy {
  final String email;
  final String password;
  final String username;
  final String? firstName;
  final String? lastName;
  final String? phoneNumber;
  final Map<String, dynamic>? additionalData;

  const RegisterRequestDataWuy({
    required this.email,
    required this.password,
    required this.username,
    this.firstName,
    this.lastName,
    this.phoneNumber,
    this.additionalData,
  });

  Map<String, dynamic> toJson() => {
    'email': email,
    'password': password,
    'username': username,
    if (firstName != null) 'first_name': firstName,
    if (lastName != null) 'last_name': lastName,
    if (phoneNumber != null) 'phone_number': phoneNumber,
    if (additionalData != null) ...additionalData!,
  };
}

/// Password reset request data model
class PasswordResetRequestDataWuy {
  final String email;
  final String? callbackUrl;

  const PasswordResetRequestDataWuy({
    required this.email,
    this.callbackUrl,
  });

  Map<String, dynamic> toJson() => {
    'email': email,
    if (callbackUrl != null) 'callback_url': callbackUrl,
  };
}

/// Change password request data model
class ChangePasswordRequestDataWuy {
  final String currentPassword;
  final String newPassword;
  final String confirmPassword;

  const ChangePasswordRequestDataWuy({
    required this.currentPassword,
    required this.newPassword,
    required this.confirmPassword,
  });

  Map<String, dynamic> toJson() => {
    'current_password': currentPassword,
    'new_password': newPassword,
    'confirm_password': confirmPassword,
  };
}


/// User data model
class UserDataWuy {
  final String id;
  final String username;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? phoneNumber;
  final String? avatarUrl;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  final Map<String, dynamic>? preferences;
  final bool isActive;
  final bool isVerified;

  const UserDataWuy({
    required this.id,
    required this.username,
    required this.email,
    this.firstName,
    this.lastName,
    this.phoneNumber,
    this.avatarUrl,
    this.createdAt,
    this.updatedAt,
    this.preferences,
    this.isActive = true,
    this.isVerified = false,
  });

  factory UserDataWuy.fromJson(Map<String, dynamic> json) {
    return UserDataWuy(
      id: json['id']?.toString() ?? '',
      username: json['username']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      firstName: json['first_name']?.toString(),
      lastName: json['last_name']?.toString(),
      phoneNumber: json['phone_number']?.toString(),
      avatarUrl: json['avatar_url']?.toString(),
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      updatedAt: json['updated_at'] != null 
          ? DateTime.tryParse(json['updated_at'].toString())
          : null,
      preferences: json['preferences'] as Map<String, dynamic>?,
      isActive: json['is_active'] as bool? ?? true,
      isVerified: json['is_verified'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'username': username,
    'email': email,
    if (firstName != null) 'first_name': firstName,
    if (lastName != null) 'last_name': lastName,
    if (phoneNumber != null) 'phone_number': phoneNumber,
    if (avatarUrl != null) 'avatar_url': avatarUrl,
    if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
    if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    if (preferences != null) 'preferences': preferences,
    'is_active': isActive,
    'is_verified': isVerified,
  };

  String get displayName {
    if (firstName != null && lastName != null) {
      return '$firstName $lastName';
    } else if (firstName != null) {
      return firstName!;
    } else if (lastName != null) {
      return lastName!;
    }
    return username;
  }

  UserDataWuy copyWith({
    String? id,
    String? username,
    String? email,
    String? firstName,
    String? lastName,
    String? phoneNumber,
    String? avatarUrl,
    DateTime? createdAt,
    DateTime? updatedAt,
    Map<String, dynamic>? preferences,
    bool? isActive,
    bool? isVerified,
  }) {
    return UserDataWuy(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      preferences: preferences ?? this.preferences,
      isActive: isActive ?? this.isActive,
      isVerified: isVerified ?? this.isVerified,
    );
  }
}

/// Update user request data model
class UpdateUserRequestDataWuy {
  final String? firstName;
  final String? lastName;
  final String? phoneNumber;
  final String? bio;
  final Map<String, dynamic>? preferences;

  const UpdateUserRequestDataWuy({
    this.firstName,
    this.lastName,
    this.phoneNumber,
    this.bio,
    this.preferences,
  });

  Map<String, dynamic> toJson() => {
    if (firstName != null) 'first_name': firstName,
    if (lastName != null) 'last_name': lastName,
    if (phoneNumber != null) 'phone_number': phoneNumber,
    if (bio != null) 'bio': bio,
    if (preferences != null) 'preferences': preferences,
  };
}


/// Content data model
class ContentDataWuy {
  final String id;
  final String title;
  final String? description;
  final String? content;
  final String? category;
  final String? imageUrl;
  final String authorId;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isPublished;
  final int viewCount;
  final List<String> tags;

  const ContentDataWuy({
    required this.id,
    required this.title,
    this.description,
    this.content,
    this.category,
    this.imageUrl,
    required this.authorId,
    required this.createdAt,
    required this.updatedAt,
    this.isPublished = false,
    this.viewCount = 0,
    this.tags = const [],
  });

  factory ContentDataWuy.fromJson(Map<String, dynamic> json) {
    return ContentDataWuy(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      description: json['description']?.toString(),
      content: json['content']?.toString(),
      category: json['category']?.toString(),
      imageUrl: json['image_url']?.toString(),
      authorId: json['author_id']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ?? DateTime.now(),
      updatedAt: DateTime.tryParse(json['updated_at']?.toString() ?? '') ?? DateTime.now(),
      isPublished: json['is_published'] as bool? ?? false,
      viewCount: json['view_count'] as int? ?? 0,
      tags: (json['tags'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'title': title,
    if (description != null) 'description': description,
    if (content != null) 'content': content,
    if (category != null) 'category': category,
    if (imageUrl != null) 'image_url': imageUrl,
    'author_id': authorId,
    'created_at': createdAt.toIso8601String(),
    'updated_at': updatedAt.toIso8601String(),
    'is_published': isPublished,
    'view_count': viewCount,
    'tags': tags,
  };
}

/// Create content request data model
class CreateContentRequestDataWuy {
  final String title;
  final String? description;
  final String? content;
  final String? category;
  final String? imageUrl;
  final bool isPublished;
  final List<String> tags;

  const CreateContentRequestDataWuy({
    required this.title,
    this.description,
    this.content,
    this.category,
    this.imageUrl,
    this.isPublished = false,
    this.tags = const [],
  });

  Map<String, dynamic> toJson() => {
    'title': title,
    if (description != null) 'description': description,
    if (content != null) 'content': content,
    if (category != null) 'category': category,
    if (imageUrl != null) 'image_url': imageUrl,
    'is_published': isPublished,
    'tags': tags,
  };
}


/// Search request data model
class SearchRequestDataWuy {
  final String query;
  final String? category;
  final List<String>? tags;
  final int page;
  final int limit;
  final String? sortBy;
  final String? sortOrder;

  const SearchRequestDataWuy({
    required this.query,
    this.category,
    this.tags,
    this.page = 1,
    this.limit = 20,
    this.sortBy,
    this.sortOrder = 'desc',
  });

  Map<String, dynamic> toJson() => {
    'query': query,
    if (category != null) 'category': category,
    if (tags != null) 'tags': tags,
    'page': page,
    'limit': limit,
    if (sortBy != null) 'sort_by': sortBy,
    if (sortOrder != null) 'sort_order': sortOrder,
  };
}


/// File upload request data model
class FileUploadRequestDataWuy {
  final String fileName;
  final String? category;
  final String? description;
  final bool isPublic;

  const FileUploadRequestDataWuy({
    required this.fileName,
    this.category,
    this.description,
    this.isPublic = false,
  });

  Map<String, dynamic> toJson() => {
    'file_name': fileName,
    if (category != null) 'category': category,
    if (description != null) 'description': description,
    'is_public': isPublic,
  };
}

/// File data model
class FileDataWuy {
  final String id;
  final String fileName;
  final String originalName;
  final String mimeType;
  final int size;
  final String url;
  final String? category;
  final String? description;
  final String uploaderId;
  final DateTime createdAt;
  final bool isPublic;

  const FileDataWuy({
    required this.id,
    required this.fileName,
    required this.originalName,
    required this.mimeType,
    required this.size,
    required this.url,
    this.category,
    this.description,
    required this.uploaderId,
    required this.createdAt,
    this.isPublic = false,
  });

  factory FileDataWuy.fromJson(Map<String, dynamic> json) {
    return FileDataWuy(
      id: json['id']?.toString() ?? '',
      fileName: json['file_name']?.toString() ?? '',
      originalName: json['original_name']?.toString() ?? '',
      mimeType: json['mime_type']?.toString() ?? '',
      size: json['size'] as int? ?? 0,
      url: json['url']?.toString() ?? '',
      category: json['category']?.toString(),
      description: json['description']?.toString(),
      uploaderId: json['uploader_id']?.toString() ?? '',
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? '') ?? DateTime.now(),
      isPublic: json['is_public'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'file_name': fileName,
    'original_name': originalName,
    'mime_type': mimeType,
    'size': size,
    'url': url,
    if (category != null) 'category': category,
    if (description != null) 'description': description,
    'uploader_id': uploaderId,
    'created_at': createdAt.toIso8601String(),
    'is_public': isPublic,
  };

  String get formattedSize {
    if (size < 1024) return '${size}B';
    if (size < 1024 * 1024) return '${(size / 1024).toStringAsFixed(1)}KB';
    if (size < 1024 * 1024 * 1024) return '${(size / (1024 * 1024)).toStringAsFixed(1)}MB';
    return '${(size / (1024 * 1024 * 1024)).toStringAsFixed(1)}GB';
  }
}