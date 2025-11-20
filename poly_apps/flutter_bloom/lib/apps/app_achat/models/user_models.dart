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


/// AChat User model
class AChatUser {
  final String id;
  final String username;
  final String email;
  final String fullName;
  final String? avatarUrl;
  final String? bio;
  final String? department;
  final String? position;
  final String? phone;
  final DateTime createdAt;
  final DateTime updatedAt;
  final bool isVerified;
  final bool isOnline;
  final DateTime? lastSeen;
  final String? statusMessage;
  final AChatUserPresence presence;
  final AChatPrivacySettings privacySettings;
  final AChatUserStatistics? statistics;
  final List<String> permissions;

  AChatUser({
    required this.id,
    required this.username,
    required this.email,
    required this.fullName,
    this.avatarUrl,
    this.bio,
    this.department,
    this.position,
    this.phone,
    required this.createdAt,
    required this.updatedAt,
    required this.isVerified,
    required this.isOnline,
    this.lastSeen,
    this.statusMessage,
    required this.presence,
    required this.privacySettings,
    this.statistics,
    required this.permissions,
  });

  factory AChatUser.fromJson(Map<String, dynamic> json) {
    return AChatUser(
      id: json['id'] as String,
      username: json['username'] as String,
      email: json['email'] as String,
      fullName: json['full_name'] as String,
      avatarUrl: json['avatar_url'] as String?,
      bio: json['bio'] as String?,
      department: json['department'] as String?,
      position: json['position'] as String?,
      phone: json['phone'] as String?,
      createdAt: DateTime.parse(json['created_at'] as String),
      updatedAt: DateTime.parse(json['updated_at'] as String),
      isVerified: json['is_verified'] as bool? ?? false,
      isOnline: json['is_online'] as bool? ?? false,
      lastSeen: json['last_seen'] != null
          ? DateTime.parse(json['last_seen'] as String)
          : null,
      statusMessage: json['status_message'] as String?,
      presence: AChatUserPresence.fromJson(json['presence'] as Map<String, dynamic>),
      privacySettings: AChatPrivacySettings.fromJson(
          json['privacy_settings'] as Map<String, dynamic>),
      statistics: json['statistics'] != null
          ? AChatUserStatistics.fromJson(json['statistics'] as Map<String, dynamic>)
          : null,
      permissions: List<String>.from(json['permissions'] as List? ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'email': email,
      'full_name': fullName,
      'avatar_url': avatarUrl,
      'bio': bio,
      'department': department,
      'position': position,
      'phone': phone,
      'created_at': createdAt.toIso8601String(),
      'updated_at': updatedAt.toIso8601String(),
      'is_verified': isVerified,
      'is_online': isOnline,
      'last_seen': lastSeen?.toIso8601String(),
      'status_message': statusMessage,
      'presence': presence.toJson(),
      'privacy_settings': privacySettings.toJson(),
      'statistics': statistics?.toJson(),
      'permissions': permissions,
    };
  }

  AChatUser copyWith({
    String? id,
    String? username,
    String? email,
    String? fullName,
    String? avatarUrl,
    String? bio,
    String? department,
    String? position,
    String? phone,
    DateTime? createdAt,
    DateTime? updatedAt,
    bool? isVerified,
    bool? isOnline,
    DateTime? lastSeen,
    String? statusMessage,
    AChatUserPresence? presence,
    AChatPrivacySettings? privacySettings,
    AChatUserStatistics? statistics,
    List<String>? permissions,
  }) {
    return AChatUser(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      fullName: fullName ?? this.fullName,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      bio: bio ?? this.bio,
      department: department ?? this.department,
      position: position ?? this.position,
      phone: phone ?? this.phone,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      isVerified: isVerified ?? this.isVerified,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
      statusMessage: statusMessage ?? this.statusMessage,
      presence: presence ?? this.presence,
      privacySettings: privacySettings ?? this.privacySettings,
      statistics: statistics ?? this.statistics,
      permissions: permissions ?? this.permissions,
    );
  }
}

/// User presence information
class AChatUserPresence {
  final String status;
  final String? message;
  final DateTime lastUpdated;
  bool isOnline;

  AChatUserPresence({
    required this.status,
    this.message,
    required this.lastUpdated,
    required this.isOnline,
  });

  factory AChatUserPresence.fromJson(Map<String, dynamic> json) {
    return AChatUserPresence(
      status: json['status'] as String,
      message: json['message'] as String?,
      lastUpdated: DateTime.parse(json['last_updated'] as String),
      isOnline: json['is_online'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'status': status,
      'message': message,
      'last_updated': lastUpdated.toIso8601String(),
      'is_online': isOnline,
    };
  }

  AChatUserPresence copyWith({
    String? status,
    String? message,
    DateTime? lastUpdated,
    bool? isOnline,
  }) {
    return AChatUserPresence(
      status: status ?? this.status,
      message: message ?? this.message,
      lastUpdated: lastUpdated ?? this.lastUpdated,
      isOnline: isOnline ?? this.isOnline,
    );
  }
}

/// User privacy settings
class AChatPrivacySettings {
  final String profileVisibility;
  final String lastSeenVisibility;
  final String phoneVisibility;
  final bool readReceipts;
  final bool typingIndicators;
  final bool onlineStatus;
  final bool messageForwardingAllowed;

  AChatPrivacySettings({
    required this.profileVisibility,
    required this.lastSeenVisibility,
    required this.phoneVisibility,
    required this.readReceipts,
    required this.typingIndicators,
    required this.onlineStatus,
    required this.messageForwardingAllowed,
  });

  factory AChatPrivacySettings.fromJson(Map<String, dynamic> json) {
    return AChatPrivacySettings(
      profileVisibility: json['profile_visibility'] as String,
      lastSeenVisibility: json['last_seen_visibility'] as String,
      phoneVisibility: json['phone_visibility'] as String,
      readReceipts: json['read_receipts'] as bool? ?? true,
      typingIndicators: json['typing_indicators'] as bool? ?? true,
      onlineStatus: json['online_status'] as bool? ?? true,
      messageForwardingAllowed: json['message_forwarding_allowed'] as bool? ?? true,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'profile_visibility': profileVisibility,
      'last_seen_visibility': lastSeenVisibility,
      'phone_visibility': phoneVisibility,
      'read_receipts': readReceipts,
      'typing_indicators': typingIndicators,
      'online_status': onlineStatus,
      'message_forwarding_allowed': messageForwardingAllowed,
    };
  }
}

/// User statistics
class AChatUserStatistics {
  final int totalMessagesSent;
  final int totalConversations;
  final int daysActive;

  AChatUserStatistics({
    required this.totalMessagesSent,
    required this.totalConversations,
    required this.daysActive,
  });

  factory AChatUserStatistics.fromJson(Map<String, dynamic> json) {
    return AChatUserStatistics(
      totalMessagesSent: json['total_messages_sent'] as int,
      totalConversations: json['total_conversations'] as int,
      daysActive: json['days_active'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'total_messages_sent': totalMessagesSent,
      'total_conversations': totalConversations,
      'days_active': daysActive,
    };
  }
}

/// Device information for authentication
class AChatDeviceInfo {
  final String deviceId;
  final String deviceName;
  final String platform;
  final String appVersion;
  final String? pushToken;

  AChatDeviceInfo({
    required this.deviceId,
    required this.deviceName,
    required this.platform,
    required this.appVersion,
    this.pushToken,
  });

  factory AChatDeviceInfo.fromJson(Map<String, dynamic> json) {
    return AChatDeviceInfo(
      deviceId: json['device_id'] as String,
      deviceName: json['device_name'] as String,
      platform: json['platform'] as String,
      appVersion: json['app_version'] as String,
      pushToken: json['push_token'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'device_id': deviceId,
      'device_name': deviceName,
      'platform': platform,
      'app_version': appVersion,
      'push_token': pushToken,
    };
  }
}

/// Authentication response
class AChatAuthResponse {
  final String accessToken;
  final String refreshToken;
  final String tokenType;
  final int expiresIn;
  final String websocketUrl;
  final AChatUser user;
  final AChatInitialData initialData;

  AChatAuthResponse({
    required this.accessToken,
    required this.refreshToken,
    required this.tokenType,
    required this.expiresIn,
    required this.websocketUrl,
    required this.user,
    required this.initialData,
  });

  factory AChatAuthResponse.fromJson(Map<String, dynamic> json) {
    return AChatAuthResponse(
      accessToken: json['access_token'] as String,
      refreshToken: json['refresh_token'] as String,
      tokenType: json['token_type'] as String,
      expiresIn: json['expires_in'] as int,
      websocketUrl: json['websocket_url'] as String,
      user: AChatUser.fromJson(json['user'] as Map<String, dynamic>),
      initialData: AChatInitialData.fromJson(json['initial_data'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'refresh_token': refreshToken,
      'token_type': tokenType,
      'expires_in': expiresIn,
      'websocket_url': websocketUrl,
      'user': user.toJson(),
      'initial_data': initialData.toJson(),
    };
  }
}

/// Token refresh response
class AChatTokenResponse {
  final String accessToken;
  final int expiresIn;
  final bool websocketReconnect;

  AChatTokenResponse({
    required this.accessToken,
    required this.expiresIn,
    required this.websocketReconnect,
  });

  factory AChatTokenResponse.fromJson(Map<String, dynamic> json) {
    return AChatTokenResponse(
      accessToken: json['access_token'] as String,
      expiresIn: json['expires_in'] as int,
      websocketReconnect: json['websocket_reconnect'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'access_token': accessToken,
      'expires_in': expiresIn,
      'websocket_reconnect': websocketReconnect,
    };
  }
}

/// Initial data received during authentication
class AChatInitialData {
  final int unreadConversationsCount;
  final int totalContacts;
  final int activeGroups;

  AChatInitialData({
    required this.unreadConversationsCount,
    required this.totalContacts,
    required this.activeGroups,
  });

  factory AChatInitialData.fromJson(Map<String, dynamic> json) {
    return AChatInitialData(
      unreadConversationsCount: json['unread_conversations_count'] as int,
      totalContacts: json['total_contacts'] as int,
      activeGroups: json['active_groups'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'unread_conversations_count': unreadConversationsCount,
      'total_contacts': totalContacts,
      'active_groups': activeGroups,
    };
  }
}

/// User preferences with settings sync
class AChatUserPreferences {
  final String userId;
  final AChatAppearanceSettings appearance;
  final AChatNotificationSettings notifications;
  final AChatPrivacySettings privacy;
  final AChatChatSettings chat;
  final AChatSecuritySettings security;
  final AChatAdvancedSettings advanced;
  final AChatSyncInfo syncInfo;

  AChatUserPreferences({
    required this.userId,
    required this.appearance,
    required this.notifications,
    required this.privacy,
    required this.chat,
    required this.security,
    required this.advanced,
    required this.syncInfo,
  });

  factory AChatUserPreferences.fromJson(Map<String, dynamic> json) {
    final preferences = json['preferences'] as Map<String, dynamic>;
    return AChatUserPreferences(
      userId: json['user_id'] as String,
      appearance: AChatAppearanceSettings.fromJson(preferences['appearance'] as Map<String, dynamic>),
      notifications: AChatNotificationSettings.fromJson(preferences['notifications'] as Map<String, dynamic>),
      privacy: AChatPrivacySettings.fromJson(preferences['privacy'] as Map<String, dynamic>),
      chat: AChatChatSettings.fromJson(preferences['chat'] as Map<String, dynamic>),
      security: AChatSecuritySettings.fromJson(preferences['security'] as Map<String, dynamic>),
      advanced: AChatAdvancedSettings.fromJson(preferences['advanced'] as Map<String, dynamic>),
      syncInfo: AChatSyncInfo.fromJson(json['sync_info'] as Map<String, dynamic>),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'user_id': userId,
      'preferences': {
        'appearance': appearance.toJson(),
        'notifications': notifications.toJson(),
        'privacy': privacy.toJson(),
        'chat': chat.toJson(),
        'security': security.toJson(),
        'advanced': advanced.toJson(),
      },
      'sync_info': syncInfo.toJson(),
    };
  }
}

/// Appearance settings
class AChatAppearanceSettings {
  final String theme;
  final String language;
  final String fontSize;
  final bool compactMode;
  final String chatBubbleStyle;

  AChatAppearanceSettings({
    required this.theme,
    required this.language,
    required this.fontSize,
    required this.compactMode,
    required this.chatBubbleStyle,
  });

  factory AChatAppearanceSettings.fromJson(Map<String, dynamic> json) {
    return AChatAppearanceSettings(
      theme: json['theme'] as String,
      language: json['language'] as String,
      fontSize: json['font_size'] as String,
      compactMode: json['compact_mode'] as bool,
      chatBubbleStyle: json['chat_bubble_style'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'theme': theme,
      'language': language,
      'font_size': fontSize,
      'compact_mode': compactMode,
      'chat_bubble_style': chatBubbleStyle,
    };
  }
}

/// Notification settings
class AChatNotificationSettings {
  final bool pushEnabled;
  final bool emailEnabled;
  final bool soundEnabled;
  final bool vibrationEnabled;
  final bool messagePreview;
  final AChatQuietHours quietHours;
  final Map<String, AChatChatNotificationSettings> perChatSettings;

  AChatNotificationSettings({
    required this.pushEnabled,
    required this.emailEnabled,
    required this.soundEnabled,
    required this.vibrationEnabled,
    required this.messagePreview,
    required this.quietHours,
    required this.perChatSettings,
  });

  factory AChatNotificationSettings.fromJson(Map<String, dynamic> json) {
    final perChatData = json['per_chat_settings'] as Map<String, dynamic>? ?? {};
    final perChatSettings = <String, AChatChatNotificationSettings>{};

    perChatData.forEach((key, value) {
      perChatSettings[key] = AChatChatNotificationSettings.fromJson(value as Map<String, dynamic>);
    });

    return AChatNotificationSettings(
      pushEnabled: json['push_enabled'] as bool,
      emailEnabled: json['email_enabled'] as bool,
      soundEnabled: json['sound_enabled'] as bool,
      vibrationEnabled: json['vibration_enabled'] as bool,
      messagePreview: json['message_preview'] as bool,
      quietHours: AChatQuietHours.fromJson(json['quiet_hours'] as Map<String, dynamic>),
      perChatSettings: perChatSettings,
    );
  }

  Map<String, dynamic> toJson() {
    final perChatData = <String, dynamic>{};
    perChatSettings.forEach((key, value) {
      perChatData[key] = value.toJson();
    });

    return {
      'push_enabled': pushEnabled,
      'email_enabled': emailEnabled,
      'sound_enabled': soundEnabled,
      'vibration_enabled': vibrationEnabled,
      'message_preview': messagePreview,
      'quiet_hours': quietHours.toJson(),
      'per_chat_settings': perChatData,
    };
  }
}

/// Quiet hours settings
class AChatQuietHours {
  final bool enabled;
  final String startTime;
  final String endTime;
  final String timezone;

  AChatQuietHours({
    required this.enabled,
    required this.startTime,
    required this.endTime,
    required this.timezone,
  });

  factory AChatQuietHours.fromJson(Map<String, dynamic> json) {
    return AChatQuietHours(
      enabled: json['enabled'] as bool,
      startTime: json['start_time'] as String,
      endTime: json['end_time'] as String,
      timezone: json['timezone'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'start_time': startTime,
      'end_time': endTime,
      'timezone': timezone,
    };
  }
}

/// Per-chat notification settings
class AChatChatNotificationSettings {
  final bool muted;
  final String sound;

  AChatChatNotificationSettings({
    required this.muted,
    required this.sound,
  });

  factory AChatChatNotificationSettings.fromJson(Map<String, dynamic> json) {
    return AChatChatNotificationSettings(
      muted: json['muted'] as bool,
      sound: json['sound'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'muted': muted,
      'sound': sound,
    };
  }
}

/// Chat settings
class AChatChatSettings {
  final bool autoDownloadPhotos;
  final bool autoDownloadVideos;
  final bool autoDownloadDocuments;
  final String compressionQuality;
  final int messageRetentionDays;
  final bool backupToCloud;

  AChatChatSettings({
    required this.autoDownloadPhotos,
    required this.autoDownloadVideos,
    required this.autoDownloadDocuments,
    required this.compressionQuality,
    required this.messageRetentionDays,
    required this.backupToCloud,
  });

  factory AChatChatSettings.fromJson(Map<String, dynamic> json) {
    return AChatChatSettings(
      autoDownloadPhotos: json['auto_download_photos'] as bool,
      autoDownloadVideos: json['auto_download_videos'] as bool,
      autoDownloadDocuments: json['auto_download_documents'] as bool,
      compressionQuality: json['compression_quality'] as String,
      messageRetentionDays: json['message_retention_days'] as int,
      backupToCloud: json['backup_to_cloud'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'auto_download_photos': autoDownloadPhotos,
      'auto_download_videos': autoDownloadVideos,
      'auto_download_documents': autoDownloadDocuments,
      'compression_quality': compressionQuality,
      'message_retention_days': messageRetentionDays,
      'backup_to_cloud': backupToCloud,
    };
  }
}

/// Security settings
class AChatSecuritySettings {
  final bool twoFactorEnabled;
  final bool biometricUnlock;
  final int appLockTimeout;
  final bool screenshotSecurity;
  final bool incognitoKeyboard;

  AChatSecuritySettings({
    required this.twoFactorEnabled,
    required this.biometricUnlock,
    required this.appLockTimeout,
    required this.screenshotSecurity,
    required this.incognitoKeyboard,
  });

  factory AChatSecuritySettings.fromJson(Map<String, dynamic> json) {
    return AChatSecuritySettings(
      twoFactorEnabled: json['two_factor_enabled'] as bool,
      biometricUnlock: json['biometric_unlock'] as bool,
      appLockTimeout: json['app_lock_timeout'] as int,
      screenshotSecurity: json['screenshot_security'] as bool,
      incognitoKeyboard: json['incognito_keyboard'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'two_factor_enabled': twoFactorEnabled,
      'biometric_unlock': biometricUnlock,
      'app_lock_timeout': appLockTimeout,
      'screenshot_security': screenshotSecurity,
      'incognito_keyboard': incognitoKeyboard,
    };
  }
}

/// Advanced settings
class AChatAdvancedSettings {
  final bool developerMode;
  final bool debugLogging;
  final bool betaFeatures;
  final bool dataUsageTracking;

  AChatAdvancedSettings({
    required this.developerMode,
    required this.debugLogging,
    required this.betaFeatures,
    required this.dataUsageTracking,
  });

  factory AChatAdvancedSettings.fromJson(Map<String, dynamic> json) {
    return AChatAdvancedSettings(
      developerMode: json['developer_mode'] as bool,
      debugLogging: json['debug_logging'] as bool,
      betaFeatures: json['beta_features'] as bool,
      dataUsageTracking: json['data_usage_tracking'] as bool,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'developer_mode': developerMode,
      'debug_logging': debugLogging,
      'beta_features': betaFeatures,
      'data_usage_tracking': dataUsageTracking,
    };
  }
}

/// Sync information for preferences
class AChatSyncInfo {
  final DateTime lastSynced;
  final int syncVersion;
  final List<String> conflicts;

  AChatSyncInfo({
    required this.lastSynced,
    required this.syncVersion,
    required this.conflicts,
  });

  factory AChatSyncInfo.fromJson(Map<String, dynamic> json) {
    return AChatSyncInfo(
      lastSynced: DateTime.parse(json['last_synced'] as String),
      syncVersion: json['sync_version'] as int,
      conflicts: List<String>.from(json['conflicts'] as List),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'last_synced': lastSynced.toIso8601String(),
      'sync_version': syncVersion,
      'conflicts': conflicts,
    };
  }
}