import '../../../common/provider_status/user_provider.dart';

/// Bank-specific user model extending the base user model
class BankUserModel extends BaseUserModel {
  // Bank-specific fields from bankv1_users table
  final String? fullName;
  final String? phone;
  final DateTime? dateOfBirth;
  final String? accountStatus; // active, inactive, suspended
  final bool isLocked;
  final String? lockReason;
  final DateTime? lockedAt;
  final DateTime? lastLoginAt;
  final int loginAttempts;

  // Bank-specific profile fields
  final String? bio;
  final Map<String, dynamic>? preferences;
  final Map<String, dynamic>? notificationSettings;

  // Bank-specific address fields
  final String? street;
  final String? state;
  final String? zipCode;
  final String? country;

  // Bank-specific account fields
  final String? accountNumber;
  final String? accountType; // checking, savings, credit
  final double balance;
  final String? currency;
  final DateTime? accountOpenedAt;

  // Additional bank app fields
  final int cardCount;
  final int points;
  final int coupons;
  final String? creditCardLevel;
  final String? location;

  const BankUserModel({
    // Base user fields
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

    // Bank-specific fields
    this.fullName,
    this.phone,
    this.dateOfBirth,
    this.accountStatus = 'active',
    this.isLocked = false,
    this.lockReason,
    this.lockedAt,
    this.lastLoginAt,
    this.loginAttempts = 0,
    this.bio,
    this.preferences,
    this.notificationSettings,
    this.street,
    this.state,
    this.zipCode,
    this.country,
    this.accountNumber,
    this.accountType = 'checking',
    this.balance = 0.0,
    this.currency = 'USD',
    this.accountOpenedAt,
    this.cardCount = 0,
    this.points = 0,
    this.coupons = 0,
    this.creditCardLevel,
    this.location,
  });

  @override
  Map<String, dynamic> toMap() {
    return {
      // Base user fields
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

      // Bank-specific fields
      'full_name': fullName,
      'phone': phone,
      'date_of_birth': dateOfBirth?.toIso8601String(),
      'account_status': accountStatus,
      'is_locked': isLocked,
      'lock_reason': lockReason,
      'locked_at': lockedAt?.toIso8601String(),
      'last_login_at': lastLoginAt?.toIso8601String(),
      'login_attempts': loginAttempts,
      'bio': bio,
      'preferences': preferences,
      'notification_settings': notificationSettings,
      'street': street,
      'state': state,
      'zip_code': zipCode,
      'country': country,
      'account_number': accountNumber,
      'account_type': accountType,
      'balance': balance,
      'currency': currency,
      'account_opened_at': accountOpenedAt?.toIso8601String(),
      'card_count': cardCount,
      'points': points,
      'coupons': coupons,
      'credit_card_level': creditCardLevel,
      'location': location,
    };
  }

  factory BankUserModel.fromMap(Map<String, dynamic> map) {
    return BankUserModel(
      // Base user fields
      id: map['id'],
      name: map['name'],
      nickname: map['nickname'],
      username: map['username'],
      email: map['email'],
      emailVerifiedAt: map['email_verified_at'] != null 
          ? DateTime.parse(map['email_verified_at']) 
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
          ? DateTime.parse(map['created_at']) 
          : null,
      updatedAt: map['updated_at'] != null 
          ? DateTime.parse(map['updated_at']) 
          : null,
      authMetadata: map['auth_metadata'] != null 
          ? AuthMetadata.fromMap(map['auth_metadata']) 
          : const AuthMetadata(),

      // Bank-specific fields
      fullName: map['full_name'],
      phone: map['phone'],
      dateOfBirth: map['date_of_birth'] != null 
          ? DateTime.parse(map['date_of_birth']) 
          : null,
      accountStatus: map['account_status'] ?? 'active',
      isLocked: map['is_locked'] ?? false,
      lockReason: map['lock_reason'],
      lockedAt: map['locked_at'] != null 
          ? DateTime.parse(map['locked_at']) 
          : null,
      lastLoginAt: map['last_login_at'] != null 
          ? DateTime.parse(map['last_login_at']) 
          : null,
      loginAttempts: map['login_attempts'] ?? 0,
      bio: map['bio'],
      preferences: map['preferences'],
      notificationSettings: map['notification_settings'],
      street: map['street'],
      state: map['state'],
      zipCode: map['zip_code'],
      country: map['country'],
      accountNumber: map['account_number'],
      accountType: map['account_type'] ?? 'checking',
      balance: (map['balance'] ?? 0.0).toDouble(),
      currency: map['currency'] ?? 'USD',
      accountOpenedAt: map['account_opened_at'] != null 
          ? DateTime.parse(map['account_opened_at']) 
          : null,
      cardCount: map['card_count'] ?? 0,
      points: map['points'] ?? 0,
      coupons: map['coupons'] ?? 0,
      creditCardLevel: map['credit_card_level'],
      location: map['location'],
    );
  }

  String toJsonString() {
    return toMap().toString();
  }

  factory BankUserModel.fromJsonString(String jsonString) {
    // This is a simplified implementation
    // In a real app, you'd use proper JSON parsing
    return BankUserModel.defaultUser();
  }

  factory BankUserModel.defaultUser() {
    return const BankUserModel();
  }

  BankUserModel copyWith({
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
    String? fullName,
    String? phone,
    DateTime? dateOfBirth,
    String? accountStatus,
    bool? isLocked,
    String? lockReason,
    DateTime? lockedAt,
    DateTime? lastLoginAt,
    int? loginAttempts,
    String? bio,
    Map<String, dynamic>? preferences,
    Map<String, dynamic>? notificationSettings,
    String? street,
    String? state,
    String? zipCode,
    String? country,
    String? accountNumber,
    String? accountType,
    double? balance,
    String? currency,
    DateTime? accountOpenedAt,
    int? cardCount,
    int? points,
    int? coupons,
    String? creditCardLevel,
    String? location,
  }) {
    return BankUserModel(
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
      fullName: fullName ?? this.fullName,
      phone: phone ?? this.phone,
      dateOfBirth: dateOfBirth ?? this.dateOfBirth,
      accountStatus: accountStatus ?? this.accountStatus,
      isLocked: isLocked ?? this.isLocked,
      lockReason: lockReason ?? this.lockReason,
      lockedAt: lockedAt ?? this.lockedAt,
      lastLoginAt: lastLoginAt ?? this.lastLoginAt,
      loginAttempts: loginAttempts ?? this.loginAttempts,
      bio: bio ?? this.bio,
      preferences: preferences ?? this.preferences,
      notificationSettings: notificationSettings ?? this.notificationSettings,
      street: street ?? this.street,
      state: state ?? this.state,
      zipCode: zipCode ?? this.zipCode,
      country: country ?? this.country,
      accountNumber: accountNumber ?? this.accountNumber,
      accountType: accountType ?? this.accountType,
      balance: balance ?? this.balance,
      currency: currency ?? this.currency,
      accountOpenedAt: accountOpenedAt ?? this.accountOpenedAt,
      cardCount: cardCount ?? this.cardCount,
      points: points ?? this.points,
      coupons: coupons ?? this.coupons,
      creditCardLevel: creditCardLevel ?? this.creditCardLevel,
      location: location ?? this.location,
    );
  }

  /// Get masked name (phone last 4 digits with * prefix)
  String get maskedName {
    if (phone != null && phone!.isNotEmpty) {
      if (phone!.length >= 4) {
        final last4 = phone!.substring(phone!.length - 4);
        return '*$last4';
      } else {
        return '*${phone!}';
      }
    }
    final displayName = name ?? fullName ?? 'User';
    if (displayName.isEmpty) return '';
    if (displayName.length == 1) return '*';
    return '*${displayName.substring(1)}';
  }

  /// Get formatted balance for display
  String get formattedBalance {
    return '¥ ${balance.toStringAsFixed(2)}';
  }

  /// Get exact formatted balance
  String get exactFormattedBalance {
    return '¥ ${balance.toStringAsFixed(2)}';
  }

  /// Check if account is active
  bool get isAccountActive {
    return accountStatus == 'active' && !isLocked;
  }

  /// Check if user can perform transactions
  bool get canTransact {
    return isAccountActive && loginAttempts < 5;
  }
}
