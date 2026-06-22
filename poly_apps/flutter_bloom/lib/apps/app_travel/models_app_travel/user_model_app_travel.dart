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

import 'package:json_annotation/json_annotation.dart';

part 'user_model_app_travel.g.dart';

@JsonSerializable()
class UserModelAppTravel {
  final String? id;
  final String? username;
  final String? email;
  final String? avatarUrl;
  final bool isLoggedIn;
  final List<String>? favorites;
  final List<String>? bookmarks;
  final String? currentCity;
  final Map<String, dynamic>? preferences;
  final DateTime? lastLoginTime;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  UserModelAppTravel({
    this.id,
    this.username,
    this.email,
    this.avatarUrl,
    this.isLoggedIn = false,
    this.favorites,
    this.bookmarks,
    this.currentCity,
    this.preferences,
    this.lastLoginTime,
    this.createdAt,
    this.updatedAt,
  });

  factory UserModelAppTravel.fromJson(Map<String, dynamic> json) =>
      _$UserModelAppTravelFromJson(json);

  Map<String, dynamic> toJson() => _$UserModelAppTravelToJson(this);

  UserModelAppTravel copyWith({
    String? id,
    String? username,
    String? email,
    String? avatarUrl,
    bool? isLoggedIn,
    List<String>? favorites,
    List<String>? bookmarks,
    String? currentCity,
    Map<String, dynamic>? preferences,
    DateTime? lastLoginTime,
    DateTime? createdAt,
    DateTime? updatedAt,
  }) {
    return UserModelAppTravel(
      id: id ?? this.id,
      username: username ?? this.username,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      isLoggedIn: isLoggedIn ?? this.isLoggedIn,
      favorites: favorites ?? this.favorites,
      bookmarks: bookmarks ?? this.bookmarks,
      currentCity: currentCity ?? this.currentCity,
      preferences: preferences ?? this.preferences,
      lastLoginTime: lastLoginTime ?? this.lastLoginTime,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  static UserModelAppTravel empty() {
    return UserModelAppTravel(
      isLoggedIn: false,
      favorites: [],
      bookmarks: [],
    );
  }

  bool get hasProfile => id != null && username != null;

  bool get hasFavorites => favorites != null && favorites!.isNotEmpty;

  bool get hasBookmarks => bookmarks != null && bookmarks!.isNotEmpty;
}
