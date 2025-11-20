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
