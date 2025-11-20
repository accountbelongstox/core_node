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

/// Profile data model for App Example
/// Represents user profile information with support for API integration
class ProfileModelAppExample {
  final String? id;
  final String? name;
  final String? email;
  final String? phone;
  final String? bio;
  final String? location;
  final String? photoUrl;
  final DateTime? createdAt;
  final DateTime? updatedAt;
  
  // Extended profile fields
  final String? website;
  final String? company;
  final String? jobTitle;
  final List<String>? interests;
  final Map<String, dynamic>? socialLinks;
  final Map<String, dynamic>? preferences;
  final Map<String, dynamic>? privacySettings;
  
  const ProfileModelAppExample({
    this.id,
    this.name,
    this.email,
    this.phone,
    this.bio,
    this.location,
    this.photoUrl,
    this.createdAt,
    this.updatedAt,
    this.website,
    this.company,
    this.jobTitle,
    this.interests,
    this.socialLinks,
    this.preferences,
    this.privacySettings,
  });
  
  /// Create profile from user authentication data
  factory ProfileModelAppExample.fromUserData(Map<String, dynamic> userData) {
    return ProfileModelAppExample(
      id: userData['id']?.toString(),
      name: userData['name'] as String?,
      email: userData['email'] as String?,
      phone: userData['phone'] as String?,
      photoUrl: userData['avatar'] as String? ?? userData['photo_url'] as String?,
      createdAt: userData['created_at'] != null 
          ? DateTime.tryParse(userData['created_at'].toString())
          : null,
      updatedAt: userData['updated_at'] != null 
          ? DateTime.tryParse(userData['updated_at'].toString())
          : null,
    );
  }
  
  /// Create profile from API response
  factory ProfileModelAppExample.fromJson(Map<String, dynamic> json) {
    return ProfileModelAppExample(
      id: json['id']?.toString(),
      name: json['name'] as String?,
      email: json['email'] as String?,
      phone: json['phone'] as String?,
      bio: json['bio'] as String?,
      location: json['location'] as String?,
      photoUrl: json['photo_url'] as String?,
      website: json['website'] as String?,
      company: json['company'] as String?,
      jobTitle: json['job_title'] as String?,
      interests: (json['interests'] as List<dynamic>?)?.cast<String>(),
      socialLinks: json['social_links'] as Map<String, dynamic>?,
      preferences: json['preferences'] as Map<String, dynamic>?,
      privacySettings: json['privacy_settings'] as Map<String, dynamic>?,
      createdAt: json['created_at'] != null 
          ? DateTime.tryParse(json['created_at'].toString())
          : null,
      updatedAt: json['updated_at'] != null 
          ? DateTime.tryParse(json['updated_at'].toString())
          : null,
    );
  }
  
  /// Convert profile to JSON for API requests
  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (name != null) 'name': name,
      if (email != null) 'email': email,
      if (phone != null) 'phone': phone,
      if (bio != null) 'bio': bio,
      if (location != null) 'location': location,
      if (photoUrl != null) 'photo_url': photoUrl,
      if (website != null) 'website': website,
      if (company != null) 'company': company,
      if (jobTitle != null) 'job_title': jobTitle,
      if (interests != null) 'interests': interests,
      if (socialLinks != null) 'social_links': socialLinks,
      if (preferences != null) 'preferences': preferences,
      if (privacySettings != null) 'privacy_settings': privacySettings,
      if (createdAt != null) 'created_at': createdAt!.toIso8601String(),
      if (updatedAt != null) 'updated_at': updatedAt!.toIso8601String(),
    };
  }
  
  /// Create a copy with updated fields
  ProfileModelAppExample copyWith({
    String? id,
    String? name,
    String? email,
    String? phone,
    String? bio,
    String? location,
    String? photoUrl,
    String? website,
    String? company,
    String? jobTitle,
    List<String>? interests,
    Map<String, dynamic>? socialLinks,
    Map<String, dynamic>? preferences,
    Map<String, dynamic>? privacySettings,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return ProfileModelAppExample(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      bio: bio ?? this.bio,
      location: location ?? this.location,
      photoUrl: photoUrl ?? this.photoUrl,
      website: website ?? this.website,
      company: company ?? this.company,
      jobTitle: jobTitle ?? this.jobTitle,
      interests: interests ?? this.interests,
      socialLinks: socialLinks ?? this.socialLinks,
      preferences: preferences ?? this.preferences,
      privacySettings: privacySettings ?? this.privacySettings,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }
  
  /// Create a copy with extended data from API
  ProfileModelAppExample copyWithExtendedData(Map<String, dynamic> extendedData) {
    return copyWith(
      bio: extendedData['bio'] as String?,
      location: extendedData['location'] as String?,
      website: extendedData['website'] as String?,
      company: extendedData['company'] as String?,
      jobTitle: extendedData['job_title'] as String?,
      interests: (extendedData['interests'] as List<dynamic>?)?.cast<String>(),
      socialLinks: extendedData['social_links'] as Map<String, dynamic>?,
      preferences: extendedData['preferences'] as Map<String, dynamic>?,
      privacySettings: extendedData['privacy_settings'] as Map<String, dynamic>?,
    );
  }
  
  /// Get display name (fallback to email if name is empty)
  String get displayName {
    if (name != null && name!.isNotEmpty) {
      return name!;
    }
    if (email != null && email!.isNotEmpty) {
      return email!.split('@').first;
    }
    return 'User';
  }
  
  /// Get initials for avatar display
  String get initials {
    final displayName = this.displayName;
    final words = displayName.split(' ');
    
    if (words.length >= 2) {
      return '${words[0][0]}${words[1][0]}'.toUpperCase();
    } else if (words.isNotEmpty && words[0].isNotEmpty) {
      return words[0][0].toUpperCase();
    }
    
    return 'U';
  }
  
  /// Check if profile has basic required information
  bool get isComplete {
    return name != null && 
           name!.isNotEmpty && 
           email != null && 
           email!.isNotEmpty;
  }
  
  /// Check if profile has extended information
  bool get hasExtendedInfo {
    return bio != null && bio!.isNotEmpty ||
           location != null && location!.isNotEmpty ||
           website != null && website!.isNotEmpty ||
           company != null && company!.isNotEmpty;
  }
  
  /// Get profile completion percentage
  double get completionPercentage {
    int completedFields = 0;
    int totalFields = 7; // name, email, phone, bio, location, photo, company
    
    if (name != null && name!.isNotEmpty) completedFields++;
    if (email != null && email!.isNotEmpty) completedFields++;
    if (phone != null && phone!.isNotEmpty) completedFields++;
    if (bio != null && bio!.isNotEmpty) completedFields++;
    if (location != null && location!.isNotEmpty) completedFields++;
    if (photoUrl != null && photoUrl!.isNotEmpty) completedFields++;
    if (company != null && company!.isNotEmpty) completedFields++;
    
    return completedFields / totalFields;
  }
  
  /// Get privacy setting value
  T? getPrivacySetting<T>(String key) {
    return privacySettings?[key] as T?;
  }
  
  /// Get user preference value
  T? getPreference<T>(String key) {
    return preferences?[key] as T?;
  }
  
  /// Check if profile is public
  bool get isPublic {
    return getPrivacySetting<String>('profile_visibility') != 'private';
  }
  
  /// Check if contact info is visible
  bool get contactInfoVisible {
    return getPrivacySetting<bool>('show_contact_info') ?? false;
  }
  
  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    
    return other is ProfileModelAppExample &&
           other.id == id &&
           other.name == name &&
           other.email == email &&
           other.phone == phone &&
           other.bio == bio &&
           other.location == location &&
           other.photoUrl == photoUrl;
  }
  
  @override
  int get hashCode {
    return Object.hash(
      id,
      name,
      email,
      phone,
      bio,
      location,
      photoUrl,
    );
  }
  
  @override
  String toString() {
    return 'ProfileModelAppExample(id: $id, name: $name, email: $email, completion: ${(completionPercentage * 100).toStringAsFixed(1)}%)';
  }
}
