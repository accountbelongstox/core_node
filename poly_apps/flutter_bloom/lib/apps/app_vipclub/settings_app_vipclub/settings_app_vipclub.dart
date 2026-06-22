import 'package:qyflutter/common/settings/models/setting_item.dart';
import 'package:qyflutter/common/settings/configs/base_settings.dart';

class VipClubSettings {
  static const String categoryVipClub = 'vipclub';
  static const String categoryNotifications = 'notifications';
  static const String categoryDeveloper = 'developer';

  static List<SettingItem> getVipClubSettings() {
    final List<SettingItem> baseSettings = BaseSettings.getBaseSettings();

    final List<SettingItem> vipClubSpecificSettings = [
      SettingItem.toggle(
        key: 'vipclub_debug_mode',
        name: 'Debug Mode',
        description: 'Enable debug mode for testing with mock data (wtwsl credentials)',
        defaultValue: false,
        category: categoryDeveloper,
        isRequired: false,
      ),

      SettingItem.toggle(
        key: 'vipclub_notifications_enabled',
        name: 'Enable Notifications',
        description: 'Receive notifications about bookings and special offers',
        defaultValue: true,
        category: categoryNotifications,
        isRequired: false,
      ),

      SettingItem.toggle(
        key: 'vipclub_show_splash',
        name: 'Show Splash Screen',
        description: 'Display splash screen on app startup',
        defaultValue: true,
        category: categoryVipClub,
        isRequired: false,
      ),

      SettingItem.toggle(
        key: 'vipclub_auto_login',
        name: 'Auto Login',
        description: 'Automatically login with saved credentials',
        defaultValue: true,
        category: categoryVipClub,
        isRequired: false,
      ),

      SettingItem.select(
        key: 'vipclub_currency',
        name: 'Currency',
        description: 'Preferred currency for payments',
        options: ['USD', 'EUR', 'GBP', 'CNY', 'JPY'],
        defaultValue: 'USD',
        labels: {
          'USD': 'US Dollar (\$)',
          'EUR': 'Euro (€)',
          'GBP': 'British Pound (£)',
          'CNY': 'Chinese Yuan (¥)',
          'JPY': 'Japanese Yen (¥)',
        },
        category: categoryVipClub,
        isRequired: true,
      ),
    ];

    return [...baseSettings, ...vipClubSpecificSettings];
  }
}
