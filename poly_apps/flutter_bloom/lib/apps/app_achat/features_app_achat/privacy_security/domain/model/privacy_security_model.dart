class PrivacySecurityModel {
  final bool phoneVisibilityEnabled;
  final bool onlineStatusEnabled;
  final bool inviteControlEnabled;
  final bool deleteAccountEnabled;
  final bool messageEncryptionEnabled;
  final bool accountProtectionEnabled;
  final bool allowAddByPhone;
  final bool allowAddById;

  const PrivacySecurityModel({
    required this.phoneVisibilityEnabled,
    required this.onlineStatusEnabled,
    required this.inviteControlEnabled,
    required this.deleteAccountEnabled,
    required this.messageEncryptionEnabled,
    required this.accountProtectionEnabled,
    required this.allowAddByPhone,
    required this.allowAddById,
  });

  factory PrivacySecurityModel.defaultSettings() {
    return const PrivacySecurityModel(
      phoneVisibilityEnabled: true,
      onlineStatusEnabled: true,
      inviteControlEnabled: true,
      deleteAccountEnabled: false,
      messageEncryptionEnabled: true,
      accountProtectionEnabled: true,
      allowAddByPhone: true,
      allowAddById: true,
    );
  }

  PrivacySecurityModel copyWith({
    bool? phoneVisibilityEnabled,
    bool? onlineStatusEnabled,
    bool? inviteControlEnabled,
    bool? deleteAccountEnabled,
    bool? messageEncryptionEnabled,
    bool? accountProtectionEnabled,
    bool? allowAddByPhone,
    bool? allowAddById,
  }) {
    return PrivacySecurityModel(
      phoneVisibilityEnabled: phoneVisibilityEnabled ?? this.phoneVisibilityEnabled,
      onlineStatusEnabled: onlineStatusEnabled ?? this.onlineStatusEnabled,
      inviteControlEnabled: inviteControlEnabled ?? this.inviteControlEnabled,
      deleteAccountEnabled: deleteAccountEnabled ?? this.deleteAccountEnabled,
      messageEncryptionEnabled: messageEncryptionEnabled ?? this.messageEncryptionEnabled,
      accountProtectionEnabled: accountProtectionEnabled ?? this.accountProtectionEnabled,
      allowAddByPhone: allowAddByPhone ?? this.allowAddByPhone,
      allowAddById: allowAddById ?? this.allowAddById,
    );
  }
}
