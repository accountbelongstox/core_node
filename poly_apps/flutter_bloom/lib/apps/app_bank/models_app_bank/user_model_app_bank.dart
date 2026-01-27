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

/// Bank User Model
/// Represents a bank user with authentication and profile information
class BankUser {
  final String id;
  final String email;
  final String firstName;
  final String lastName;
  final String? phoneNumber;
  final String? profileImageUrl;
  final DateTime createdAt;
  final DateTime? lastLoginAt;
  final bool isEmailVerified;
  final bool isPhoneVerified;
  final bool isBiometricEnabled;
  final String? customerNumber;
  final BankUserPreferences preferences;

  const BankUser({
    required this.id,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.phoneNumber,
    this.profileImageUrl,
    required this.createdAt,
    this.lastLoginAt,
    this.isEmailVerified = false,
    this.isPhoneVerified = false,
    this.isBiometricEnabled = false,
    this.customerNumber,
    required this.preferences,
  });

  String get fullName => '$firstName $lastName';
  String get initials => '${firstName.isNotEmpty ? firstName[0] : ''}${lastName.isNotEmpty ? lastName[0] : ''}';

  BankUser copyWith({
    String? id,
    String? email,
    String? firstName,
    String? lastName,
    String? phoneNumber,
    String? profileImageUrl,
    DateTime? createdAt,
    DateTime? lastLoginAt,
    bool? isEmailVerified,
    bool? isPhoneVerified,
    bool? isBiometricEnabled,
    String? customerNumber,
    BankUserPreferences? preferences,
  }) {
    return BankUser(
      id: id ?? this.id,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      profileImageUrl: profileImageUrl ?? this.profileImageUrl,
      createdAt: createdAt ?? this.createdAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      isEmailVerified: isEmailVerified ?? this.isEmailVerified,
      isPhoneVerified: isPhoneVerified ?? this.isPhoneVerified,
      isBiometricEnabled: isBiometricEnabled ?? this.isBiometricEnabled,
      customerNumber: customerNumber ?? this.customerNumber,
      preferences: preferences ?? this.preferences,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'email': email,
      'firstName': firstName,
      'lastName': lastName,
      'phoneNumber': phoneNumber,
      'profileImageUrl': profileImageUrl,
      'createdAt': createdAt.toIso8601String(),
      'lastLoginAt': lastLoginAt?.toIso8601String(),
      'isEmailVerified': isEmailVerified,
      'isPhoneVerified': isPhoneVerified,
      'isBiometricEnabled': isBiometricEnabled,
      'customerNumber': customerNumber,
      'preferences': preferences.toJson(),
    };
  }

  factory BankUser.fromJson(Map<String, dynamic> json) {
    return BankUser(
      id: json['id'],
      email: json['email'],
      firstName: json['firstName'],
      lastName: json['lastName'],
      phoneNumber: json['phoneNumber'],
      profileImageUrl: json['profileImageUrl'],
      createdAt: DateTime.parse(json['createdAt']),
      lastLoginAt: json['lastLoginAt'] != null ? DateTime.parse(json['lastLoginAt']) : null,
      isEmailVerified: json['isEmailVerified'] ?? false,
      isPhoneVerified: json['isPhoneVerified'] ?? false,
      isBiometricEnabled: json['isBiometricEnabled'] ?? false,
      customerNumber: json['customerNumber'],
      preferences: BankUserPreferences.fromJson(json['preferences']),
    );
  }

  /// Create BankUser from API response (UserDataAppBank format)
  /// FIX: Unified user model - convert from API response format
  factory BankUser.fromApiResponse(Map<String, dynamic> json) {
    // Parse full_name into firstName and lastName
    final fullName = json['full_name'] ?? json['username'] ?? '';
    final nameParts = fullName.split(' ');
    final firstName = nameParts.isNotEmpty ? nameParts.first : '';
    final lastName = nameParts.length > 1 ? nameParts.sublist(1).join(' ') : '';

    return BankUser(
      id: json['id']?.toString() ?? '',
      email: json['email'] ?? '',
      firstName: firstName,
      lastName: lastName,
      phoneNumber: json['phone'],
      profileImageUrl: null,
      createdAt: DateTime.tryParse(json['created_at'] ?? '') ?? DateTime.now(),
      lastLoginAt: DateTime.now(),
      isEmailVerified: true,
      isPhoneVerified: json['phone'] != null,
      isBiometricEnabled: false,
      customerNumber: json['id']?.toString(),
      preferences: const BankUserPreferences(),
    );
  }

  /// Additional fields for Bank app compatibility
  String? get username => email.split('@').first;
  double get balance => 0.0;
  String? get address => null;
}

/// Bank User Preferences
/// Contains user-specific app preferences and settings
class BankUserPreferences {
  final bool isDarkMode;
  final String language;
  final bool notificationsEnabled;
  final bool transactionAlertsEnabled;
  final bool marketingEmailsEnabled;
  final String currency;
  final bool biometricLoginEnabled;

  const BankUserPreferences({
    this.isDarkMode = false,
    this.language = 'en',
    this.notificationsEnabled = true,
    this.transactionAlertsEnabled = true,
    this.marketingEmailsEnabled = false,
    this.currency = 'USD',
    this.biometricLoginEnabled = false,
  });

  BankUserPreferences copyWith({
    bool? isDarkMode,
    String? language,
    bool? notificationsEnabled,
    bool? transactionAlertsEnabled,
    bool? marketingEmailsEnabled,
    String? currency,
    bool? biometricLoginEnabled,
  }) {
    return BankUserPreferences(
      isDarkMode: isDarkMode ?? this.isDarkMode,
      language: language ?? this.language,
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      transactionAlertsEnabled: transactionAlertsEnabled ?? this.transactionAlertsEnabled,
      marketingEmailsEnabled: marketingEmailsEnabled ?? this.marketingEmailsEnabled,
      currency: currency ?? this.currency,
      biometricLoginEnabled: biometricLoginEnabled ?? this.biometricLoginEnabled,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'isDarkMode': isDarkMode,
      'language': language,
      'notificationsEnabled': notificationsEnabled,
      'transactionAlertsEnabled': transactionAlertsEnabled,
      'marketingEmailsEnabled': marketingEmailsEnabled,
      'currency': currency,
      'biometricLoginEnabled': biometricLoginEnabled,
    };
  }

  factory BankUserPreferences.fromJson(Map<String, dynamic> json) {
    return BankUserPreferences(
      isDarkMode: json['isDarkMode'] ?? false,
      language: json['language'] ?? 'en',
      notificationsEnabled: json['notificationsEnabled'] ?? true,
      transactionAlertsEnabled: json['transactionAlertsEnabled'] ?? true,
      marketingEmailsEnabled: json['marketingEmailsEnabled'] ?? false,
      currency: json['currency'] ?? 'USD',
      biometricLoginEnabled: json['biometricLoginEnabled'] ?? false,
    );
  }
}

// FIX: Removed duplicate BankUserProvider class definition
// Use providers_app_bank/bank_user_provider.dart instead