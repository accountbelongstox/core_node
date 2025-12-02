import 'package:flutter/material.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../config_app_qy/storage_app_qy.dart';
import '../models/certificate_model.dart';

class CertificateService {
  static final CertificateService _instance = CertificateService._internal();
  final StorageAppQy _storage = StorageAppQy.instance;

  factory CertificateService() => _instance;

  CertificateService._internal();

  /// Get all certificates from centralized storage
  /// Falls back to default certificates if storage is empty
  Future<List<CertificateModel>> getAllCertificates() async {
    try {
      await _storage.initAppStorage();
      final storedCertificates =
          await _storage.getApp<List<dynamic>>(StorageAppQy.keyCertificates);

      if (storedCertificates != null && storedCertificates.isNotEmpty) {
        try {
          return storedCertificates
              .map((json) =>
                  CertificateModel.fromJson(json as Map<String, dynamic>))
              .toList();
        } catch (e) {
          // If deserialization fails, use default certificates
          final defaultCertificates = _getDefaultCertificates();
          await _saveCertificatesToStorage(defaultCertificates);
          return defaultCertificates;
        }
      }

      // Initialize with default certificates if storage is empty
      final defaultCertificates = _getDefaultCertificates();
      await _saveCertificatesToStorage(defaultCertificates);
      return defaultCertificates;
    } catch (e) {
      // Return default certificates on error
      return _getDefaultCertificates();
    }
  }

  /// Get default certificates (used for initialization)
  List<CertificateModel> _getDefaultCertificates() {
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

  /// Save certificates to centralized storage
  Future<void> _saveCertificatesToStorage(
      List<CertificateModel> certificates) async {
    try {
      final certificatesJson =
          certificates.map((cert) => cert.toJson()).toList();
      await _storage.setApp<List<dynamic>>(
          StorageAppQy.keyCertificates, certificatesJson);
    } catch (e) {
      // Silently fail - storage might not be initialized
    }
  }

  Future<CertificateStats> getCertificateStats() async {
    final certificates = await getAllCertificates();
    return CertificateStats.fromCertificates(certificates);
  }

  Future<CertificateModel?> getCertificateById(String id) async {
    try {
      final certificates = await getAllCertificates();
      return certificates.firstWhere((cert) => cert.id == id);
    } catch (e) {
      return null;
    }
  }

  Future<List<CertificateModel>> getEarnedCertificates() async {
    final certificates = await getAllCertificates();
    return certificates.where((cert) => !cert.locked).toList();
  }

  Future<List<CertificateModel>> getLockedCertificates() async {
    final certificates = await getAllCertificates();
    return certificates.where((cert) => cert.locked).toList();
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
