/// 出行人信息模型
class TravelerModel {
  final String id;
  final String name;
  final String phone;
  final String email;
  final bool isDefault;

  TravelerModel({
    required this.id,
    required this.name,
    required this.phone,
    required this.email,
    this.isDefault = false,
  });

  /// 获取脱敏后的手机号（中间4位*号）
  /// 例如：18984121454 -> 189****1454
  String get maskedPhone {
    if (phone.length < 11) return phone;
    return '${phone.substring(0, 3)}****${phone.substring(7)}';
  }

  /// 获取脱敏后的邮箱（只显示前3位和后3位及邮箱后缀）
  /// 例如：cy00000000x@gmail.com -> cy0****00x@gmail.com
  String get maskedEmail {
    if (!email.contains('@')) return email;

    final parts = email.split('@');
    if (parts.length != 2) return email;

    final localPart = parts[0];
    final domain = parts[1];

    if (localPart.length <= 6) return email;

    final prefix = localPart.substring(0, 3);
    final suffix = localPart.substring(localPart.length - 3);

    return '$prefix****$suffix@$domain';
  }

  /// 从JSON创建对象
  factory TravelerModel.fromJson(Map<String, dynamic> json) {
    return TravelerModel(
      id: json['id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      email: json['email'] as String? ?? '',
      isDefault: json['isDefault'] as bool? ?? false,
    );
  }

  /// 转换为JSON
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'phone': phone,
      'email': email,
      'isDefault': isDefault,
    };
  }

  /// 复制并修改
  TravelerModel copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    bool? isDefault,
  }) {
    return TravelerModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      isDefault: isDefault ?? this.isDefault,
    );
  }

  @override
  String toString() {
    return 'TravelerModel(id: $id, name: $name, phone: $maskedPhone, email: $maskedEmail, isDefault: $isDefault)';
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is TravelerModel && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;
}
