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

/// QY app icon assets - 符合文档规范
/// Uses standardized paths: assets/apps/app_qy/icons/
/// All asset keys have 'example' prefix as required by documentation
class AssetsIconsAppQy {
  static const String _base = 'assets/apps/app_qy/icons';

  static const String qyLogo = '$_base/logo.png';
  static const String qySplashLogo = '$_base/splash_logo.png';
  static const String qyRawLogo = '$_base/raw-logo.png';
  static const String qyIcLauncher = '$_base/ic_launcher.png';
  static const String qyNotificationIcon = '$_base/notification_icon.png';

  static const String qyApple = '$_base/apple.png';
  static const String qyFacebook = '$_base/facebook.png';
  static const String qyGithub = '$_base/github.png';
  static const String qyGoogle = '$_base/google.png';
  static const String qyTwitter = '$_base/twitter.png';
  static const String qyWechat = '$_base/wechat.png';
  static const String qyWeibo = '$_base/weibo-circle-fill.png';
  static const String qyWebsite = '$_base/website.png';
  static const String qyYoutube = '$_base/youtube.png';
  static const String qyGmail = '$_base/gmail.png';

  static const String qyPerson = '$_base/person.png';
  static const String qyGuest = '$_base/guest.png';
  static const String qyBaby = '$_base/baby.png';
  static const String qyGender = '$_base/gender.png';
  static const String qyName = '$_base/name.png';
  static const String qyPhone = '$_base/phone.png';
  static const String qyCall = '$_base/call.png';
  static const String qyEmail = '$_base/gmail.png';
  static const String qyPassword = '$_base/password.png';
  static const String qyUsername = '$_base/ic_username.png';
  static const String qyIdentity = '$_base/identity.png';
  static const String qyLocation = '$_base/location.png';

  static const String qyChinese = '$_base/chinese.png';
  static const String qyCity = '$_base/city.png';
  static const String qyEmptyBox = '$_base/empty_box.png';
  static const String qyError = '$_base/error.png';
  static const String qySuccess = '$_base/success.png';
  static const String qyWarning = '$_base/warning.png';
  static const String qyInfo = '$_base/info.png';
  static const String qyLoading = '$_base/loading.png';
  static const String qyMaintenance = '$_base/maintenance.png';

  static const String qyHome = '$_base/home.png';
  static const String qyBack = '$_base/back.png';
  static const String qyNext = '$_base/next.png';
  static const String qyMenu = '$_base/menu.png';
  static const String qySearch = '$_base/search.png';
  static const String qyFilter = '$_base/filter.png';
  static const String qySort = '$_base/sort.png';
  static const String qySettings = '$_base/settings.png';

  static const String qyAdd = '$_base/add.png';
  static const String qyEdit = '$_base/edit.png';
  static const String qyDelete = '$_base/delete.png';
  static const String qySave = '$_base/save.png';
  static const String qyCancel = '$_base/cancel.png';
  static const String qyConfirm = '$_base/confirm.png';
  static const String qyShare = '$_base/share.png';
  static const String qyDownload = '$_base/download.png';
  static const String qyUpload = '$_base/upload.png';
  static const String qyRefresh = '$_base/refresh.png';

  /// Get all icons as a map for easy access
  /// All keys use 'example' prefix as required by documentation
  static Map<String, String> getAllIcons() {
    return {
      // App Branding
      'qyLogo': qyLogo,
      'qySplashLogo': qySplashLogo,
      'qyRawLogo': qyRawLogo,
      'qyIcLauncher': qyIcLauncher,
      'qyNotificationIcon': qyNotificationIcon,

      // Social Media
      'qyApple': qyApple,
      'qyFacebook': qyFacebook,
      'qyGithub': qyGithub,
      'qyGoogle': qyGoogle,
      'qyTwitter': qyTwitter,
      'qyWechat': qyWechat,
      'qyWeibo': qyWeibo,
      'qyWebsite': qyWebsite,
      'qyYoutube': qyYoutube,
      'qyGmail': qyGmail,

      // Profile & Account
      'qyPerson': qyPerson,
      'qyGuest': qyGuest,
      'qyBaby': qyBaby,
      'qyGender': qyGender,
      'qyName': qyName,
      'qyPhone': qyPhone,
      'qyCall': qyCall,
      'qyEmail': qyEmail,
      'qyPassword': qyPassword,
      'qyUsername': qyUsername,
      'qyIdentity': qyIdentity,
      'qyLocation': qyLocation,

      // System & Status
      'qyChinese': qyChinese,
      'qyCity': qyCity,
      'qyEmptyBox': qyEmptyBox,
      'qyError': qyError,
      'qySuccess': qySuccess,
      'qyWarning': qyWarning,
      'qyInfo': qyInfo,
      'qyLoading': qyLoading,
      'qyMaintenance': qyMaintenance,

      // Navigation
      'qyHome': qyHome,
      'qyBack': qyBack,
      'qyNext': qyNext,
      'qyMenu': qyMenu,
      'qySearch': qySearch,
      'qyFilter': qyFilter,
      'qySort': qySort,
      'qySettings': qySettings,

      // Actions
      'qyAdd': qyAdd,
      'qyEdit': qyEdit,
      'qyDelete': qyDelete,
      'qySave': qySave,
      'qyCancel': qyCancel,
      'qyConfirm': qyConfirm,
      'qyShare': qyShare,
      'qyDownload': qyDownload,
      'qyUpload': qyUpload,
      'qyRefresh': qyRefresh,
    };
  }

  /// Get icon by key (with qy prefix)
  static String? getIcon(String key) {
    return getAllIcons()[key];
  }

  /// Check if icon exists
  static bool hasIcon(String key) {
    return getAllIcons().containsKey(key);
  }

  /// Get all icon keys
  static List<String> getAllIconKeys() {
    return getAllIcons().keys.toList();
  }

  /// Get icons by category
  static Map<String, String> getIconsByCategory(String category) {
    final allIcons = getAllIcons();
    return Map.fromEntries(
      allIcons.entries.where((entry) => entry.key.toLowerCase().contains(category.toLowerCase()))
    );
  }
}
