import 'package:flutter/material.dart';

enum CertificateLevel {
  beginner,
  intermediate,
  advanced,
  expert,
}

enum CertificateBadge {
  newbie,
  diligent,
  persistent,
  perfectAttendance,
  expert,
  excellent,
}

class CertificateModel {
  final String id;
  final String titleKey;
  final String descriptionKey;
  final DateTime? earnedDate;
  final CertificateLevel level;
  final Color color;
  final IconData icon;
  final CertificateBadge? badge;
  final bool locked;
  final int points;

  const CertificateModel({
    required this.id,
    required this.titleKey,
    required this.descriptionKey,
    this.earnedDate,
    required this.level,
    required this.color,
    required this.icon,
    this.badge,
    this.locked = false,
    this.points = 0,
  });

  CertificateModel copyWith({
    String? id,
    String? titleKey,
    String? descriptionKey,
    DateTime? earnedDate,
    CertificateLevel? level,
    Color? color,
    IconData? icon,
    CertificateBadge? badge,
    bool? locked,
    int? points,
  }) {
    return CertificateModel(
      id: id ?? this.id,
      titleKey: titleKey ?? this.titleKey,
      descriptionKey: descriptionKey ?? this.descriptionKey,
      earnedDate: earnedDate ?? this.earnedDate,
      level: level ?? this.level,
      color: color ?? this.color,
      icon: icon ?? this.icon,
      badge: badge ?? this.badge,
      locked: locked ?? this.locked,
      points: points ?? this.points,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'titleKey': titleKey,
      'descriptionKey': descriptionKey,
      'earnedDate': earnedDate?.toIso8601String(),
      'level': level.index,
      'colorValue': color.value,
      'iconCodePoint': icon.codePoint,
      'iconFontFamily': icon.fontFamily,
      'iconFontPackage': icon.fontPackage,
      'badge': badge?.index,
      'locked': locked,
      'points': points,
    };
  }

  factory CertificateModel.fromJson(Map<String, dynamic> json) {
    return CertificateModel(
      id: json['id'] as String,
      titleKey: json['titleKey'] as String,
      descriptionKey: json['descriptionKey'] as String,
      earnedDate: json['earnedDate'] != null
          ? DateTime.parse(json['earnedDate'] as String)
          : null,
      level: CertificateLevel.values[json['level'] as int],
      color: json['colorValue'] != null
          ? Color(json['colorValue'] as int)
          : const Color(0xFF000000),
      icon: json['iconCodePoint'] != null
          ? IconData(
              json['iconCodePoint'] as int,
              fontFamily: json['iconFontFamily'] as String?,
              fontPackage: json['iconFontPackage'] as String?,
            )
          : Icons.school,
      badge: json['badge'] != null
          ? CertificateBadge.values[json['badge'] as int]
          : null,
      locked: json['locked'] as bool? ?? false,
      points: json['points'] as int? ?? 0,
    );
  }
}

class CertificateStats {
  final int earnedCount;
  final int inProgressCount;
  final int totalPoints;
  final int totalCertificates;

  const CertificateStats({
    required this.earnedCount,
    required this.inProgressCount,
    required this.totalPoints,
    required this.totalCertificates,
  });

  factory CertificateStats.fromCertificates(List<CertificateModel> certificates) {
    final earnedCount = certificates.where((c) => !c.locked).length;
    final totalPoints = certificates
        .where((c) => !c.locked)
        .fold<int>(0, (sum, cert) => sum + cert.points);

    return CertificateStats(
      earnedCount: earnedCount,
      inProgressCount: 2,
      totalPoints: totalPoints,
      totalCertificates: certificates.length,
    );
  }
}
