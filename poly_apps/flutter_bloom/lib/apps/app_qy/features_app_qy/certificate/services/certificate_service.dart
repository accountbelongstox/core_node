import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../models/certificate_model.dart';

class CertificateService {
  static final CertificateService _instance = CertificateService._internal();

  factory CertificateService() => _instance;

  CertificateService._internal();

  List<CertificateModel> getAllCertificates() {
    return [
      CertificateModel(
        id: 'cert_001',
        titleKey: 'qy_cert_basic_english_title',
        descriptionKey: 'qy_cert_basic_english_desc',
        earnedDate: DateTime(2024, 1, 15),
        level: CertificateLevel.beginner,
        color: AppTheme.newColor,
        icon: Icons.school,
        badge: CertificateBadge.newbie,
        locked: false,
        points: 100,
      ),
      CertificateModel(
        id: 'cert_002',
        titleKey: 'qy_cert_word_master_title',
        descriptionKey: 'qy_cert_word_master_desc',
        earnedDate: DateTime(2024, 2, 20),
        level: CertificateLevel.intermediate,
        color: AppTheme.learningColor,
        icon: Icons.menu_book,
        badge: CertificateBadge.diligent,
        locked: false,
        points: 250,
      ),
      CertificateModel(
        id: 'cert_003',
        titleKey: 'qy_cert_listening_master_title',
        descriptionKey: 'qy_cert_listening_master_desc',
        earnedDate: DateTime(2024, 3, 10),
        level: CertificateLevel.advanced,
        color: AppTheme.masteredColor,
        icon: Icons.headphones,
        badge: CertificateBadge.persistent,
        locked: false,
        points: 500,
      ),
      CertificateModel(
        id: 'cert_004',
        titleKey: 'qy_cert_perfect_attendance_title',
        descriptionKey: 'qy_cert_perfect_attendance_desc',
        earnedDate: DateTime(2024, 4, 5),
        level: CertificateLevel.advanced,
        color: AppTheme.primaryGreen,
        icon: Icons.emoji_events,
        badge: CertificateBadge.perfectAttendance,
        locked: false,
        points: 1000,
      ),
      CertificateModel(
        id: 'cert_005',
        titleKey: 'qy_cert_vocabulary_expert_title',
        descriptionKey: 'qy_cert_vocabulary_expert_desc',
        level: CertificateLevel.expert,
        color: AppTheme.darkGreen,
        icon: Icons.workspace_premium,
        badge: CertificateBadge.expert,
        locked: true,
        points: 2000,
      ),
      CertificateModel(
        id: 'cert_006',
        titleKey: 'qy_cert_ielts_high_score_title',
        descriptionKey: 'qy_cert_ielts_high_score_desc',
        level: CertificateLevel.expert,
        color: AppTheme.error,
        icon: Icons.star,
        badge: CertificateBadge.excellent,
        locked: true,
        points: 3000,
      ),
    ];
  }

  CertificateStats getCertificateStats() {
    final certificates = getAllCertificates();
    return CertificateStats.fromCertificates(certificates);
  }

  CertificateModel? getCertificateById(String id) {
    try {
      return getAllCertificates().firstWhere((cert) => cert.id == id);
    } catch (e) {
      return null;
    }
  }

  List<CertificateModel> getEarnedCertificates() {
    return getAllCertificates().where((cert) => !cert.locked).toList();
  }

  List<CertificateModel> getLockedCertificates() {
    return getAllCertificates().where((cert) => cert.locked).toList();
  }

  Future<void> unlockCertificate(String certificateId) async {
    await Future.delayed(const Duration(milliseconds: 500));
  }

  Future<bool> downloadCertificate(String certificateId) async {
    await Future.delayed(const Duration(seconds: 1));
    return true;
  }

  Future<bool> shareCertificate(String certificateId, String platform) async {
    await Future.delayed(const Duration(seconds: 1));
    return true;
  }
}
