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

import '../interfaces/database_interface.dart';

abstract class BaseModel implements DatabaseModelInterface {
  int? id;
  DateTime? createdAt;
  DateTime? updatedAt;

  BaseModel({
    this.id,
    this.createdAt,
    this.updatedAt,
  });

  @override
  dynamic get primaryKey => id;

  @override
  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'created_at': createdAt?.toIso8601String(),
      'updated_at': updatedAt?.toIso8601String(),
      ...toMapExtended(),
    };
  }

  @override
  void fromMap(Map<String, dynamic> map) {
    id = map['id'] as int?;
    createdAt = map['created_at'] != null 
        ? DateTime.parse(map['created_at'] as String)
        : null;
    updatedAt = map['updated_at'] != null 
        ? DateTime.parse(map['updated_at'] as String)
        : null;
    fromMapExtended(map);
  }

  /// Override this method to add model-specific fields to the map
  Map<String, dynamic> toMapExtended();

  /// Override this method to read model-specific fields from the map
  void fromMapExtended(Map<String, dynamic> map);

  @override
  Map<String, String> get columnDefinitions {
    return {
      'id': 'INTEGER PRIMARY KEY AUTOINCREMENT',
      'created_at': 'TEXT',
      'updated_at': 'TEXT',
      ...columnDefinitionsExtended,
    };
  }

  /// Override this method to add model-specific column definitions
  Map<String, String> get columnDefinitionsExtended;

  @override
  List<String> get indexes => indexesExtended;

  /// Override this method to add model-specific indexes
  List<String> get indexesExtended => [];

  @override
  Map<String, String> get foreignKeys => foreignKeysExtended;

  /// Override this method to add model-specific foreign keys
  Map<String, String> get foreignKeysExtended => {};

  /// Update the updatedAt timestamp
  void touch() {
    updatedAt = DateTime.now();
  }

  /// Set createdAt and updatedAt timestamps for new records
  void setTimestamps() {
    final now = DateTime.now();
    createdAt ??= now;
    updatedAt = now;
  }

  /// Check if this is a new record (no ID assigned)
  bool get isNew => id == null;

  /// Check if this is an existing record (has ID)
  bool get isExisting => id != null;

  /// Create a copy of this model
  BaseModel copyWith();

  /// Convert to JSON string
  String toJson() {
    return toMap().toString();
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is BaseModel &&
        other.runtimeType == runtimeType &&
        other.id == id;
  }

  @override
  int get hashCode => id.hashCode ^ runtimeType.hashCode;

  @override
  String toString() {
    return '${runtimeType.toString()}(id: $id, createdAt: $createdAt, updatedAt: $updatedAt)';
  }
}

/// Example implementation of BaseModel
class User extends BaseModel {
  String? username;
  String? email;
  String? firstName;
  String? lastName;
  bool isActive;

  User({
    super.id,
    super.createdAt,
    super.updatedAt,
    this.username,
    this.email,
    this.firstName,
    this.lastName,
    this.isActive = true,
  });

  @override
  String get tableName => 'users';

  @override
  Map<String, dynamic> toMapExtended() {
    return {
      'username': username,
      'email': email,
      'first_name': firstName,
      'last_name': lastName,
      'is_active': isActive ? 1 : 0,
    };
  }

  @override
  void fromMapExtended(Map<String, dynamic> map) {
    username = map['username'] as String?;
    email = map['email'] as String?;
    firstName = map['first_name'] as String?;
    lastName = map['last_name'] as String?;
    isActive = (map['is_active'] as int?) == 1;
  }

  @override
  Map<String, String> get columnDefinitionsExtended {
    return {
      'username': 'TEXT UNIQUE NOT NULL',
      'email': 'TEXT UNIQUE NOT NULL',
      'first_name': 'TEXT',
      'last_name': 'TEXT',
      'is_active': 'INTEGER DEFAULT 1',
    };
  }

  @override
  List<String> get indexesExtended => ['username', 'email'];

  String get fullName => '${firstName ?? ''} ${lastName ?? ''}'.trim();

  @override
  User copyWith({
    int? id,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? username,
    String? email,
    String? firstName,
    String? lastName,
    bool? isActive,
  }) {
    return User(
      id: id ?? this.id,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      username: username ?? this.username,
      email: email ?? this.email,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      isActive: isActive ?? this.isActive,
    );
  }

  @override
  String toString() {
    return 'User(id: $id, username: $username, email: $email, fullName: $fullName, isActive: $isActive)';
  }
}

/// Example implementation for a Post model with foreign key
class Post extends BaseModel {
  String? title;
  String? content;
  int? authorId;
  bool isPublished;

  Post({
    super.id,
    super.createdAt,
    super.updatedAt,
    this.title,
    this.content,
    this.authorId,
    this.isPublished = false,
  });

  @override
  String get tableName => 'posts';

  @override
  Map<String, dynamic> toMapExtended() {
    return {
      'title': title,
      'content': content,
      'author_id': authorId,
      'is_published': isPublished ? 1 : 0,
    };
  }

  @override
  void fromMapExtended(Map<String, dynamic> map) {
    title = map['title'] as String?;
    content = map['content'] as String?;
    authorId = map['author_id'] as int?;
    isPublished = (map['is_published'] as int?) == 1;
  }

  @override
  Map<String, String> get columnDefinitionsExtended {
    return {
      'title': 'TEXT NOT NULL',
      'content': 'TEXT',
      'author_id': 'INTEGER NOT NULL',
      'is_published': 'INTEGER DEFAULT 0',
    };
  }

  @override
  List<String> get indexesExtended => ['author_id', 'is_published'];

  @override
  Map<String, String> get foreignKeysExtended {
    return {
      'author_id': 'users(id)',
    };
  }

  @override
  Post copyWith({
    int? id,
    DateTime? createdAt,
    DateTime? updatedAt,
    String? title,
    String? content,
    int? authorId,
    bool? isPublished,
  }) {
    return Post(
      id: id ?? this.id,
      createdAt: createdAt ?? this.createdAt,
      updatedAt: updatedAt ?? this.updatedAt,
      title: title ?? this.title,
      content: content ?? this.content,
      authorId: authorId ?? this.authorId,
      isPublished: isPublished ?? this.isPublished,
    );
  }

  @override
  String toString() {
    return 'Post(id: $id, title: $title, authorId: $authorId, isPublished: $isPublished)';
  }
}

/// Utility class for model validation
class ModelValidator {
  static List<String> validateUser(User user) {
    final errors = <String>[];
    
    if (user.username == null || user.username!.isEmpty) {
      errors.add('Username is required');
    } else if (user.username!.length < 3) {
      errors.add('Username must be at least 3 characters long');
    }
    
    if (user.email == null || user.email!.isEmpty) {
      errors.add('Email is required');
    } else if (!_isValidEmail(user.email!)) {
      errors.add('Invalid email format');
    }
    
    return errors;
  }
  
  static List<String> validatePost(Post post) {
    final errors = <String>[];
    
    if (post.title == null || post.title!.isEmpty) {
      errors.add('Title is required');
    } else if (post.title!.length > 255) {
      errors.add('Title must be less than 255 characters');
    }
    
    if (post.authorId == null) {
      errors.add('Author ID is required');
    }
    
    return errors;
  }
  
  static bool _isValidEmail(String email) {
    return RegExp(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$').hasMatch(email);
  }
}
