// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

library;

import '../model/profile_model.dart';
import '../../../../services_app_qy/api_service_app_qy.dart';

class ProfileService {
  final ApiServiceAppQy _apiService;

  const ProfileService({required ApiServiceAppQy apiService})
      : _apiService = apiService;

  Future<UserProfileModel> getProfile() async {
    try {
      final response = await _apiService.get('/api/v1/profile');
      final data = response['data'] ?? response;
      return UserProfileModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return UserProfileModel.mock();
    }
  }

  Future<bool> updateProfile(UserProfileModel profile) async {
    try {
      await _apiService.put(
        '/api/v1/profile',
        data: profile.toJson(),
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<bool> updateAvatar(String avatarPath) async {
    try {
      await _apiService.post(
        '/api/v1/profile/avatar',
        data: {'avatar': avatarPath},
      );
      return true;
    } catch (e) {
      return false;
    }
  }

  Future<List<CertificateModel>> getCertificates() async {
    try {
      final response = await _apiService.get('/api/v1/profile/certificates');
      final responseData = response['data'] ?? response;
      final data = (responseData is List) ? responseData : (responseData['certificates'] ?? responseData['items'] ?? []);
      final dataList = data as List<dynamic>;
      return dataList
          .map((json) =>
              CertificateModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return _mockCertificates();
    }
  }

  Future<CertificateModel?> getCertificateById(String id) async {
    try {
      final response = await _apiService.get('/api/v1/profile/certificates/$id');
      final data = response['data'] ?? response;
      return CertificateModel.fromJson(data as Map<String, dynamic>);
    } catch (e) {
      return null;
    }
  }

  Future<List<AchievementModel>> getAchievements() async {
    try {
      final response = await _apiService.get('/api/v1/profile/achievements');
      final responseData = response['data'] ?? response;
      final data = (responseData is List) ? responseData : (responseData['achievements'] ?? responseData['items'] ?? []);
      final dataList = data as List<dynamic>;
      return dataList
          .map((json) =>
              AchievementModel.fromJson(json as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return _mockAchievements();
    }
  }

  Future<Map<String, dynamic>> getStats() async {
    try {
      final response = await _apiService.get('/api/v1/profile/stats');
      final data = response['data'] ?? response;
      return data as Map<String, dynamic>;
    } catch (e) {
      return {
        'total_study_time': 12345,
        'total_words': 5000,
        'learned_words': 1234,
        'study_days': 45,
        'check_in_days': 30,
        'average_daily_words': 27,
        'total_review_count': 890,
      };
    }
  }

  List<CertificateModel> _mockCertificates() {
    return [
      CertificateModel(
        id: '1',
        title: 'IELTS Vocabulary Master',
        description: 'Completed 3000 IELTS words',
        imageUrl: null,
        issuedAt: DateTime.now().subtract(const Duration(days: 30)),
        category: 'IELTS',
        score: 95,
        certificateNumber: 'CERT-2024-001',
      ),
      CertificateModel(
        id: '2',
        title: 'CET-6 Expert',
        description: 'Mastered CET-6 vocabulary',
        imageUrl: null,
        issuedAt: DateTime.now().subtract(const Duration(days: 60)),
        category: 'CET',
        score: 88,
        certificateNumber: 'CERT-2024-002',
      ),
      CertificateModel(
        id: '3',
        title: '30-Day Challenge Winner',
        description: 'Completed 30 consecutive days of learning',
        imageUrl: null,
        issuedAt: DateTime.now().subtract(const Duration(days: 10)),
        category: 'Challenge',
        score: 100,
        certificateNumber: 'CERT-2024-003',
      ),
    ];
  }

  List<AchievementModel> _mockAchievements() {
    return [
      AchievementModel(
        id: '1',
        title: 'First Step',
        description: 'Learn your first word',
        iconUrl: 'assets/achievements/first_step.png',
        isUnlocked: true,
        unlockedAt: DateTime.now().subtract(const Duration(days: 100)),
        progress: 1,
        target: 1,
      ),
      AchievementModel(
        id: '2',
        title: 'Century Club',
        description: 'Learn 100 words',
        iconUrl: 'assets/achievements/century.png',
        isUnlocked: true,
        unlockedAt: DateTime.now().subtract(const Duration(days: 80)),
        progress: 100,
        target: 100,
      ),
      AchievementModel(
        id: '3',
        title: 'Millennium Master',
        description: 'Learn 1000 words',
        iconUrl: 'assets/achievements/millennium.png',
        isUnlocked: true,
        unlockedAt: DateTime.now().subtract(const Duration(days: 40)),
        progress: 1000,
        target: 1000,
      ),
      AchievementModel(
        id: '4',
        title: 'Supreme Scholar',
        description: 'Learn 5000 words',
        iconUrl: 'assets/achievements/supreme.png',
        isUnlocked: false,
        progress: 1234,
        target: 5000,
      ),
      AchievementModel(
        id: '5',
        title: 'Weekly Warrior',
        description: 'Study for 7 consecutive days',
        iconUrl: 'assets/achievements/weekly.png',
        isUnlocked: true,
        unlockedAt: DateTime.now().subtract(const Duration(days: 50)),
        progress: 7,
        target: 7,
      ),
      AchievementModel(
        id: '6',
        title: 'Monthly Master',
        description: 'Study for 30 consecutive days',
        iconUrl: 'assets/achievements/monthly.png',
        isUnlocked: false,
        progress: 15,
        target: 30,
      ),
    ];
  }
}
