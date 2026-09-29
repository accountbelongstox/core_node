import 'package:flutter/material.dart';

class ContactOptionModel {
  final String id;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color iconColor;
  final VoidCallback? onTap;

  const ContactOptionModel({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.iconColor,
    this.onTap,
  });

  ContactOptionModel copyWith({
    String? id,
    String? title,
    String? subtitle,
    IconData? icon,
    Color? iconColor,
    VoidCallback? onTap,
  }) {
    return ContactOptionModel(
      id: id ?? this.id,
      title: title ?? this.title,
      subtitle: subtitle ?? this.subtitle,
      icon: icon ?? this.icon,
      iconColor: iconColor ?? this.iconColor,
      onTap: onTap ?? this.onTap,
    );
  }

  @override
  bool operator ==(Object other) {
    if (identical(this, other)) return true;
    return other is ContactOptionModel &&
        other.id == id &&
        other.title == title &&
        other.subtitle == subtitle &&
        other.icon == icon &&
        other.iconColor == iconColor;
  }

  @override
  int get hashCode {
    return id.hashCode ^
        title.hashCode ^
        subtitle.hashCode ^
        icon.hashCode ^
        iconColor.hashCode;
  }

  @override
  String toString() {
    return 'ContactOptionModel(id: $id, title: $title, subtitle: $subtitle, icon: $icon, iconColor: $iconColor)';
  }
}
