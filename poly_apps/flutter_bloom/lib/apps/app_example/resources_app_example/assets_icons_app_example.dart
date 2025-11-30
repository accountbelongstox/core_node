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

/// Example app icon assets - 符合文档规范
/// Uses standardized paths: assets/apps/app_example/icons/
/// All asset keys have 'example' prefix as required by documentation
class AssetsIconsAppExample {
  static const String _base = 'assets/apps/app_example/icons';

  static const String exampleLogo = '$_base/logo.png';
  static const String exampleSplashLogo = '$_base/splash_logo.png';
  static const String exampleRawLogo = '$_base/raw-logo.png';
  static const String exampleIcLauncher = '$_base/ic_launcher.png';
  static const String exampleNotificationIcon = '$_base/notification_icon.png';

  static const String exampleApple = '$_base/apple.png';
  static const String exampleFacebook = '$_base/facebook.png';
  static const String exampleGithub = '$_base/github.png';
  static const String exampleGoogle = '$_base/google.png';
  static const String exampleTwitter = '$_base/twitter.png';
  static const String exampleWechat = '$_base/wechat.png';
  static const String exampleWeibo = '$_base/weibo-circle-fill.png';
  static const String exampleWebsite = '$_base/website.png';
  static const String exampleYoutube = '$_base/youtube.png';
  static const String exampleGmail = '$_base/gmail.png';

  static const String examplePerson = '$_base/person.png';
  static const String exampleGuest = '$_base/guest.png';
  static const String exampleBaby = '$_base/baby.png';
  static const String exampleGender = '$_base/gender.png';
  static const String exampleName = '$_base/name.png';
  static const String examplePhone = '$_base/phone.png';
  static const String exampleCall = '$_base/call.png';
  static const String exampleEmail = '$_base/gmail.png';
  static const String examplePassword = '$_base/password.png';
  static const String exampleUsername = '$_base/ic_username.png';
  static const String exampleIdentity = '$_base/identity.png';
  static const String exampleLocation = '$_base/location.png';

  static const String exampleChinese = '$_base/chinese.png';
  static const String exampleCity = '$_base/city.png';
  static const String exampleEmptyBox = '$_base/empty_box.png';
  static const String exampleError = '$_base/error.png';
  static const String exampleSuccess = '$_base/success.png';
  static const String exampleWarning = '$_base/warning.png';
  static const String exampleInfo = '$_base/info.png';
  static const String exampleLoading = '$_base/loading.png';
  static const String exampleMaintenance = '$_base/maintenance.png';

  static const String exampleHome = '$_base/home.png';
  static const String exampleBack = '$_base/back.png';
  static const String exampleNext = '$_base/next.png';
  static const String exampleMenu = '$_base/menu.png';
  static const String exampleSearch = '$_base/search.png';
  static const String exampleFilter = '$_base/filter.png';
  static const String exampleSort = '$_base/sort.png';
  static const String exampleSettings = '$_base/settings.png';

  static const String exampleAdd = '$_base/add.png';
  static const String exampleEdit = '$_base/edit.png';
  static const String exampleDelete = '$_base/delete.png';
  static const String exampleSave = '$_base/save.png';
  static const String exampleCancel = '$_base/cancel.png';
  static const String exampleConfirm = '$_base/confirm.png';
  static const String exampleShare = '$_base/share.png';
  static const String exampleDownload = '$_base/download.png';
  static const String exampleUpload = '$_base/upload.png';
  static const String exampleRefresh = '$_base/refresh.png';

  /// Get all icons as a map for easy access
  /// All keys use 'example' prefix as required by documentation
  static Map<String, String> getAllIcons() {
    return {
      // App Branding
      'exampleLogo': exampleLogo,
      'exampleSplashLogo': exampleSplashLogo,
      'exampleRawLogo': exampleRawLogo,
      'exampleIcLauncher': exampleIcLauncher,
      'exampleNotificationIcon': exampleNotificationIcon,

      // Social Media
      'exampleApple': exampleApple,
      'exampleFacebook': exampleFacebook,
      'exampleGithub': exampleGithub,
      'exampleGoogle': exampleGoogle,
      'exampleTwitter': exampleTwitter,
      'exampleWechat': exampleWechat,
      'exampleWeibo': exampleWeibo,
      'exampleWebsite': exampleWebsite,
      'exampleYoutube': exampleYoutube,
      'exampleGmail': exampleGmail,

      // Profile & Account
      'examplePerson': examplePerson,
      'exampleGuest': exampleGuest,
      'exampleBaby': exampleBaby,
      'exampleGender': exampleGender,
      'exampleName': exampleName,
      'examplePhone': examplePhone,
      'exampleCall': exampleCall,
      'exampleEmail': exampleEmail,
      'examplePassword': examplePassword,
      'exampleUsername': exampleUsername,
      'exampleIdentity': exampleIdentity,
      'exampleLocation': exampleLocation,

      // System & Status
      'exampleChinese': exampleChinese,
      'exampleCity': exampleCity,
      'exampleEmptyBox': exampleEmptyBox,
      'exampleError': exampleError,
      'exampleSuccess': exampleSuccess,
      'exampleWarning': exampleWarning,
      'exampleInfo': exampleInfo,
      'exampleLoading': exampleLoading,
      'exampleMaintenance': exampleMaintenance,

      // Navigation
      'exampleHome': exampleHome,
      'exampleBack': exampleBack,
      'exampleNext': exampleNext,
      'exampleMenu': exampleMenu,
      'exampleSearch': exampleSearch,
      'exampleFilter': exampleFilter,
      'exampleSort': exampleSort,
      'exampleSettings': exampleSettings,

      // Actions
      'exampleAdd': exampleAdd,
      'exampleEdit': exampleEdit,
      'exampleDelete': exampleDelete,
      'exampleSave': exampleSave,
      'exampleCancel': exampleCancel,
      'exampleConfirm': exampleConfirm,
      'exampleShare': exampleShare,
      'exampleDownload': exampleDownload,
      'exampleUpload': exampleUpload,
      'exampleRefresh': exampleRefresh,
    };
  }

  /// Get icon by key (with example prefix)
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
