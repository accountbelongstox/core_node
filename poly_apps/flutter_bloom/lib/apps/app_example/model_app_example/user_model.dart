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

import 'package:qyflutter/common/provider_status/user_provider.dart';

// CREATED BY: AI Assistant for Example App-specific UserModel
// NOTE FOR OTHER AIs: This is Example App-specific UserModel, not a common one
// Each app should have its own UserModel with app-specific fields

/// Example App specific User Model
/// Contains user data specific to Example application
class UserModel extends BaseUserModel {
  @override
  int? id;
  @override
  String name;
  @override
  String? nickname;
  @override
  String? username;
  @override
  String? avatar;
  @override
  String? about;
  @override
  String? followers;
  @override
  String? website;
  @override
  String? github;
  @override
  String? wechat;
  @override
  String? weibo;
  @override
  String? qq;
  @override
  String? age;
  @override
  String? gender;
  @override
  String? birthday;
  @override
  String? city;
  @override
  String? education;
  @override
  String? occupation;
  @override
  String? language;
  @override
  String? religion;
  @override
  int? roleLevel;
  @override
  String? roleName;
  @override
  String email;
  String? phone;
  String? bio;
  @override
  DateTime? emailVerifiedAt;
  @override
  DateTime? createdAt;
  @override
  DateTime? updatedAt;
  String? token;
  @override
  String? userToken;
  String? tokenType;
  String? expiration;
  
  // Example App specific fields
  List<String>? interests;
  String? learningGoals;
  int? studyStreak;
  Map<String, dynamic>? preferences;

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
    // Example App specific
    this.interests,
    this.learningGoals,
    this.studyStreak,
    this.preferences,
  }) : super(
          id: id,
          name: name,
          nickname: nickname,
          username: username,
          email: email,
          emailVerifiedAt: emailVerifiedAt,
          avatar: avatar,
          about: about,
          followers: followers,
          website: website,
          github: github,
          wechat: wechat,
          weibo: weibo,
          qq: qq,
          age: age,
          gender: gender,
          birthday: birthday,
          city: city,
          education: education,
          occupation: occupation,
          language: language,
          religion: religion,
          roleLevel: roleLevel,
          roleName: roleName,
          userToken: userToken,
          createdAt: createdAt,
          updatedAt: updatedAt,
        );

  UserModel.fromJson(Map<String, dynamic> json)
      : name = json['name'] ?? '',
        email = json['email'] ?? '',
        super(
          id: json['id'] != null ? int.tryParse(json['id'].toString()) : null,
          name: json['name'] ?? '',
          nickname: json['nickname'],
          username: json['username'],
          email: json['email'] ?? '',
          emailVerifiedAt: json['email_verified_at'] != null 
              ? DateTime.tryParse(json['email_verified_at']) 
              : null,
          avatar: json['avatar'],
          about: json['about'],
          followers: json['followers'],
          website: json['website'],
          github: json['github'],
          wechat: json['wechat'],
          weibo: json['weibo'],
          qq: json['qq'],
          age: json['age'],
          gender: json['gender'],
          birthday: json['birthday'],
          city: json['city'],
          education: json['education'],
          occupation: json['occupation'],
          language: json['language'],
          religion: json['religion'],
          roleLevel: json['role_level'],
          roleName: json['role_name'],
          userToken: json['user_token'],
          createdAt: json['created_at'] != null 
              ? DateTime.tryParse(json['created_at']) 
              : null,
          updatedAt: json['updated_at'] != null 
              ? DateTime.tryParse(json['updated_at']) 
              : null,
        ) {
    phone = json['phone'];
    bio = json['bio'];
    token = json['token'];
    tokenType = json['token_type'];
    expiration = json['expiration'];
    
    // Example App specific fields
    interests = json['interests'] != null
        ? List<String>.from(json['interests'])
        : null;
    learningGoals = json['learning_goals'];
    studyStreak = json['study_streak'];
    preferences = json['preferences'] != null
        ? Map<String, dynamic>.from(json['preferences'])
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
    
    // Example App specific fields
    data['interests'] = interests;
    data['learning_goals'] = learningGoals;
    data['study_streak'] = studyStreak;
    data['preferences'] = preferences;
    
    return data;
  }

  /// Create a copy of UserModel with updated fields
  UserModel copyWith({
    int? id,
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
    DateTime? emailVerifiedAt,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? token,
    String? userToken,
    String? tokenType,
    String? expiration,
    // Example App specific
    List<String>? interests,
    String? learningGoals,
    int? studyStreak,
    Map<String, dynamic>? preferences,
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
      // Example App specific
      interests: interests ?? this.interests,
      learningGoals: learningGoals ?? this.learningGoals,
      studyStreak: studyStreak ?? this.studyStreak,
      preferences: preferences ?? this.preferences,
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
