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

// CREATED BY: AI Assistant for AChat-specific UserModel
// NOTE FOR OTHER AIs: This is AChat-specific UserModel, not a common one
// Each app should have its own UserModel with app-specific fields

/// AChat specific User Model
/// Contains user data specific to AChat application
class UserModel {
  String? id;
  String name;
  String? nickname;
  String? username;
  String? avatar;
  String? about;
  String? followers;
  String? website;
  String? github;
  String? wechat;
  String? weibo;
  String? qq;
  String? age;
  String? gender;
  String? birthday;
  String? city;
  String? education;
  String? occupation;
  String? language;
  String? religion;
  int? roleLevel;
  String? roleName;
  String email;
  String? phone;
  String? bio;
  String? emailVerifiedAt;
  String? createdAt;
  String? updatedAt;
  String? token;
  String? userToken;
  String? tokenType;
  String? expiration;
  
  // AChat specific fields
  String? chatPreferences;
  String? aiPersonality;
  bool? voiceEnabled;
  bool? notificationsEnabled;
  String? preferredLanguage;
  Map<String, dynamic>? customSettings;

  UserModel({
    this.id,
    required this.name,
    this.nickname,
    this.username,
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
    required this.email,
    this.phone,
    this.bio,
    this.emailVerifiedAt,
    this.createdAt,
    this.updatedAt,
    this.token,
    this.userToken,
    this.tokenType,
    this.expiration,
    // AChat specific
    this.chatPreferences,
    this.aiPersonality,
    this.voiceEnabled,
    this.notificationsEnabled,
    this.preferredLanguage,
    this.customSettings,
  });

  UserModel.fromJson(Map<String, dynamic> json)
      : name = json['name'] ?? '',
        email = json['email'] ?? '' {
    id = json['id'];
    nickname = json['nickname'];
    username = json['username'];
    avatar = json['avatar'];
    about = json['about'];
    followers = json['followers'];
    website = json['website'];
    github = json['github'];
    wechat = json['wechat'];
    weibo = json['weibo'];
    qq = json['qq'];
    age = json['age'];
    gender = json['gender'];
    birthday = json['birthday'];
    city = json['city'];
    education = json['education'];
    occupation = json['occupation'];
    language = json['language'];
    religion = json['religion'];
    roleLevel = json['role_level'];
    roleName = json['role_name'];
    phone = json['phone'];
    bio = json['bio'];
    emailVerifiedAt = json['email_verified_at'];
    createdAt = json['created_at'];
    updatedAt = json['updated_at'];
    token = json['token'];
    userToken = json['user_token'];
    tokenType = json['token_type'];
    expiration = json['expiration'];
    
    // AChat specific fields
    chatPreferences = json['chat_preferences'];
    aiPersonality = json['ai_personality'];
    voiceEnabled = json['voice_enabled'];
    notificationsEnabled = json['notifications_enabled'];
    preferredLanguage = json['preferred_language'];
    customSettings = json['custom_settings'] != null 
        ? Map<String, dynamic>.from(json['custom_settings'])
        : null;
  }

  Map<String, dynamic> toJson() {
    final Map<String, dynamic> data = <String, dynamic>{};
    data['id'] = id;
    data['name'] = name;
    data['nickname'] = nickname;
    data['username'] = username;
    data['avatar'] = avatar;
    data['about'] = about;
    data['followers'] = followers;
    data['website'] = website;
    data['github'] = github;
    data['wechat'] = wechat;
    data['weibo'] = weibo;
    data['qq'] = qq;
    data['age'] = age;
    data['gender'] = gender;
    data['birthday'] = birthday;
    data['city'] = city;
    data['education'] = education;
    data['occupation'] = occupation;
    data['language'] = language;
    data['religion'] = religion;
    data['role_level'] = roleLevel;
    data['role_name'] = roleName;
    data['email'] = email;
    data['phone'] = phone;
    data['bio'] = bio;
    data['email_verified_at'] = emailVerifiedAt;
    data['created_at'] = createdAt;
    data['updated_at'] = updatedAt;
    data['token'] = token;
    data['user_token'] = userToken;
    data['token_type'] = tokenType;
    data['expiration'] = expiration;
    
    // AChat specific fields
    data['chat_preferences'] = chatPreferences;
    data['ai_personality'] = aiPersonality;
    data['voice_enabled'] = voiceEnabled;
    data['notifications_enabled'] = notificationsEnabled;
    data['preferred_language'] = preferredLanguage;
    data['custom_settings'] = customSettings;
    
    return data;
  }

  /// Create a copy of UserModel with updated fields
  UserModel copyWith({
    String? id,
    String? name,
    String? nickname,
    String? username,
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
    String? email,
    String? phone,
    String? bio,
    String? emailVerifiedAt,
    String? createdAt,
    String? updatedAt,
    String? token,
    String? userToken,
    String? tokenType,
    String? expiration,
    // AChat specific
    String? chatPreferences,
    String? aiPersonality,
    bool? voiceEnabled,
    bool? notificationsEnabled,
    String? preferredLanguage,
    Map<String, dynamic>? customSettings,
  }) {
    return UserModel(
      id: id ?? this.id,
      name: name ?? this.name,
      nickname: nickname ?? this.nickname,
      username: username ?? this.username,
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
      email: email ?? this.email,
      phone: phone ?? this.phone,
      bio: bio ?? this.bio,
      emailVerifiedAt: emailVerifiedAt ?? this.emailVerifiedAt,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      token: token ?? this.token,
      userToken: userToken ?? this.userToken,
      tokenType: tokenType ?? this.tokenType,
      expiration: expiration ?? this.expiration,
      // AChat specific
      chatPreferences: chatPreferences ?? this.chatPreferences,
      aiPersonality: aiPersonality ?? this.aiPersonality,
      voiceEnabled: voiceEnabled ?? this.voiceEnabled,
      notificationsEnabled: notificationsEnabled ?? this.notificationsEnabled,
      preferredLanguage: preferredLanguage ?? this.preferredLanguage,
      customSettings: customSettings ?? this.customSettings,
    );
  }

  /// Get display name
  String get displayName => name.isNotEmpty ? name : (nickname ?? email);

  /// Get user initials for avatar
  String get initials {
    if (name.isEmpty) return 'U';
    final names = name.split(' ');
    if (names.length >= 2) {
      return '${names[0][0]}${names[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  /// Check if user has complete profile
  bool get hasCompleteProfile {
    return name.isNotEmpty && 
           email.isNotEmpty && 
           phone?.isNotEmpty == true &&
           bio?.isNotEmpty == true;
  }

  /// Get profile completion percentage
  double get profileCompletionPercentage {
    int completedFields = 0;
    int totalFields = 5; // name, email, phone, bio, avatar
    
    if (name.isNotEmpty) completedFields++;
    if (email.isNotEmpty) completedFields++;
    if (phone?.isNotEmpty == true) completedFields++;
    if (bio?.isNotEmpty == true) completedFields++;
    if (avatar?.isNotEmpty == true) completedFields++;
    
    return completedFields / totalFields;
  }
}
