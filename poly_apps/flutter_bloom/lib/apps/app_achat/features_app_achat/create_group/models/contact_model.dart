class ContactModel {
  final String id;
  final String name;
  final String? phone;
  final String? email;
  final String? avatar;
  final bool isOnline;
  final DateTime? lastSeen;

  const ContactModel({
    required this.id,
    required this.name,
    this.phone,
    this.email,
    this.avatar,
    this.isOnline = false,
    this.lastSeen,
  });

  ContactModel copyWith({
    String? id,
    String? name,
    String? phone,
    String? email,
    String? avatar,
    bool? isOnline,
    DateTime? lastSeen,
  }) {
    return ContactModel(
      id: id ?? this.id,
      name: name ?? this.name,
      phone: phone ?? this.phone,
      email: email ?? this.email,
      avatar: avatar ?? this.avatar,
      isOnline: isOnline ?? this.isOnline,
      lastSeen: lastSeen ?? this.lastSeen,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ContactModel && other.id == id;
  }

  @override
  int get hashCode => id.hashCode;

  @override
  String toString() {
    return 'ContactModel(id: $id, name: $name, phone: $phone, email: $email, avatar: $avatar, isOnline: $isOnline, lastSeen: $lastSeen)';
  }
}
