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

enum SearchType {
  name,
  signature,
  gender,
  phone,
  location,
  age,
  interests,
}

class SearchFilterModelAppWuy {
  final String? name;
  final String? signature;
  final String? gender;
  final String? phone;
  final String? location;
  final int? minAge;
  final int? maxAge;
  final List<String>? interests;
  final bool isOnline;
  final DateTime? lastSeenAfter;
  final DateTime? lastSeenBefore;

  const SearchFilterModelAppWuy({
    this.name,
    this.signature,
    this.gender,
    this.phone,
    this.location,
    this.minAge,
    this.maxAge,
    this.interests,
    this.isOnline = false,
    this.lastSeenAfter,
    this.lastSeenBefore,
  });

  factory SearchFilterModelAppWuy.fromJson(Map<String, dynamic> json) {
    return SearchFilterModelAppWuy(
      name: json['name'] as String?,
      signature: json['signature'] as String?,
      gender: json['gender'] as String?,
      phone: json['phone'] as String?,
      location: json['location'] as String?,
      minAge: json['minAge'] as int?,
      maxAge: json['maxAge'] as int?,
      interests: json['interests'] != null 
          ? List<String>.from(json['interests'] as List)
          : null,
      isOnline: json['isOnline'] as bool? ?? false,
      lastSeenAfter: json['lastSeenAfter'] != null 
          ? DateTime.parse(json['lastSeenAfter'] as String)
          : null,
      lastSeenBefore: json['lastSeenBefore'] != null 
          ? DateTime.parse(json['lastSeenBefore'] as String)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'signature': signature,
      'gender': gender,
      'phone': phone,
      'location': location,
      'minAge': minAge,
      'maxAge': maxAge,
      'interests': interests,
      'isOnline': isOnline,
      'lastSeenAfter': lastSeenAfter?.toIso8601String(),
      'lastSeenBefore': lastSeenBefore?.toIso8601String(),
    };
  }

  SearchFilterModelAppWuy copyWith({
    String? name,
    String? signature,
    String? gender,
    String? phone,
    String? location,
    int? minAge,
    int? maxAge,
    List<String>? interests,
    bool? isOnline,
    DateTime? lastSeenAfter,
    DateTime? lastSeenBefore,
  }) {
    return SearchFilterModelAppWuy(
      name: name ?? this.name,
      signature: signature ?? this.signature,
      gender: gender ?? this.gender,
      phone: phone ?? this.phone,
      location: location ?? this.location,
      minAge: minAge ?? this.minAge,
      maxAge: maxAge ?? this.maxAge,
      interests: interests ?? this.interests,
      isOnline: isOnline ?? this.isOnline,
      lastSeenAfter: lastSeenAfter ?? this.lastSeenAfter,
      lastSeenBefore: lastSeenBefore ?? this.lastSeenBefore,
    );
  }

  bool get hasActiveFilters {
    return name != null ||
        signature != null ||
        gender != null ||
        phone != null ||
        location != null ||
        minAge != null ||
        maxAge != null ||
        (interests != null && interests!.isNotEmpty) ||
        isOnline ||
        lastSeenAfter != null ||
        lastSeenBefore != null;
  }

  SearchFilterModelAppWuy clear() {
    return const SearchFilterModelAppWuy();
  }

  SearchFilterModelAppWuy clearField(SearchType type) {
    switch (type) {
      case SearchType.name:
        return copyWith(name: null);
      case SearchType.signature:
        return copyWith(signature: null);
      case SearchType.gender:
        return copyWith(gender: null);
      case SearchType.phone:
        return copyWith(phone: null);
      case SearchType.location:
        return copyWith(location: null);
      case SearchType.age:
        return copyWith(minAge: null, maxAge: null);
      case SearchType.interests:
        return copyWith(interests: null);
    }
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is SearchFilterModelAppWuy &&
        other.name == name &&
        other.signature == signature &&
        other.gender == gender &&
        other.phone == phone &&
        other.location == location &&
        other.minAge == minAge &&
        other.maxAge == maxAge &&
        other.interests == interests &&
        other.isOnline == isOnline &&
        other.lastSeenAfter == lastSeenAfter &&
        other.lastSeenBefore == lastSeenBefore;
  }

  @override
  int get hashCode {
    return Object.hash(
      name,
      signature,
      gender,
      phone,
      location,
      minAge,
      maxAge,
      interests,
      isOnline,
      lastSeenAfter,
      lastSeenBefore,
    );
  }

  @override
  String toString() {
    return 'SearchFilterModelAppWuy(name: $name, signature: $signature, gender: $gender, phone: $phone)';
  }
}
