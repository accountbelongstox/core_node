import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/vipclub_storage_service.dart';

class VipClubSplashHelper {
  static Future<void> resetSplashState() async {
    final storageService = VipClubStorageService();
    await storageService.init();
    await storageService.remove('vipclub_splash_state');
  }

  static Future<void> clearAllAppData() async {
    final storageService = VipClubStorageService();
    await storageService.init();
    await storageService.clear();
  }

  static Future<bool> hasSplashBeenShown() async {
    final storageService = VipClubStorageService();
    await storageService.init();
    final state = await storageService.getString('vipclub_splash_state');
    return state != null;
  }
}
