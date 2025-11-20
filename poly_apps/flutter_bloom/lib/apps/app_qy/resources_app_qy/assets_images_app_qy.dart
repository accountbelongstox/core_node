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

/// QY app image assets - 符合文档规范
/// Uses standardized paths: assets/apps/app_qy/images/
/// All asset keys have 'example' prefix as required by documentation
class AssetsImagesAppQy {
  static const String _base = 'assets/apps/app_qy/images';

  static const String qyLogo = '$_base/logo.jpg';
  static const String qyBanner = '$_base/banner.jpg';
  static const String qySplash = '$_base/splash.jpg';
  static const String qyBackground = '$_base/background.jpg';

  static const String qyUser = '$_base/user.png';
  static const String qyUser1 = '$_base/user1.jpg';
  static const String qyUser2 = '$_base/user2.jpg';
  static const String qyUser3 = '$_base/user3.jpg';
  static const String qyAvatar = '$_base/avatar.png';
  static const String qyDefaultAvatar = '$_base/default_avatar.png';

  static const String qyFeed = '$_base/Feed.jpg';
  static const String qyBaby = '$_base/baby.jpg';
  static const String qyBaby1 = '$_base/baby.jpg';
  static const String qyBaby2 = '$_base/child2.jpg';
  static const String qyBannerChild = '$_base/bannerchild.jpg';

  static const String qyChild1 = '$_base/child1.jpeg';
  static const String qyChild2 = '$_base/child2.jpg';
  static const String qyChild3 = '$_base/child3.jpg';
  static const String qyChild5 = '$_base/child5.jpg';
  static const String qyChild6 = '$_base/child6.jpg';
  static const String qyHelpChild = '$_base/helpchild.jpg';

  static const String qyEducation = '$_base/education.jpg';
  static const String qyStudent = '$_base/student.jpg';
  static const String qyStudent2 = '$_base/student2.jpeg';
  static const String qyRunning = '$_base/running.jpg';

  static const String qyHealth = '$_base/health.jpg';
  static const String qyHospital = '$_base/hospital.jpg';
  static const String qyHelp1 = '$_base/help1.jpg';

  static const String qyFlood = '$_base/Flood.png';
  static const String qyFire = '$_base/fire.jpg';
  static const String qyUrgent1 = '$_base/urgent1.jpg';
  static const String qyUrgent2 = '$_base/urgent2.jpg';
  static const String qyUrgen4 = '$_base/urgen4.jpg';
  static const String qyUrgent5 = '$_base/urgent5.jpg';
  static const String qyUrgent6 = '$_base/urgent6.jpg';

  static const String qyFood = '$_base/food.jpg';
  static const String qyPoor1 = '$_base/poor1.jpg';
  static const String qyPoor3 = '$_base/poor3.jpg';
  static const String qyPoor4 = '$_base/poor4.png';
  static const String qyPoor5 = '$_base/poor5.jpg';
  static const String qyPoor6 = '$_base/poor6.jpg';

  static const String qyFundrasing1 = '$_base/funrasing1.jpeg';
  static const String qyGorom1 = '$_base/gorom1.jpg';

  static const String qyPlaceholder = '$_base/placeholder.png';
  static const String qyNoImage = '$_base/no_image.png';
  static const String qyLoading = '$_base/loading.gif';

  /// Get all images as a map for easy access
  /// All keys use 'example' prefix as required by documentation
  static Map<String, String> getAllImages() {
    return {
      // App Branding
      'qyLogo': qyLogo,
      'qyBanner': qyBanner,
      'qySplash': qySplash,
      'qyBackground': qyBackground,

      // User & Profile
      'qyUser': qyUser,
      'qyUser1': qyUser1,
      'qyUser2': qyUser2,
      'qyUser3': qyUser3,
      'qyAvatar': qyAvatar,
      'qyDefaultAvatar': qyDefaultAvatar,

      // Content
      'qyFeed': qyFeed,
      'qyBaby': qyBaby,
      'qyBaby1': qyBaby1,
      'qyBaby2': qyBaby2,
      'qyBannerChild': qyBannerChild,

      // Children & Family
      'qyChild1': qyChild1,
      'qyChild2': qyChild2,
      'qyChild3': qyChild3,
      'qyChild5': qyChild5,
      'qyChild6': qyChild6,
      'qyHelpChild': qyHelpChild,

      // Education
      'qyEducation': qyEducation,
      'qyStudent': qyStudent,
      'qyStudent2': qyStudent2,
      'qyRunning': qyRunning,

      // Health & Medical
      'qyHealth': qyHealth,
      'qyHospital': qyHospital,
      'qyHelp1': qyHelp1,

      // Emergency & Urgent
      'qyFlood': qyFlood,
      'qyFire': qyFire,
      'qyUrgent1': qyUrgent1,
      'qyUrgent2': qyUrgent2,
      'qyUrgen4': qyUrgen4,
      'qyUrgent5': qyUrgent5,
      'qyUrgent6': qyUrgent6,

      // Social & Community
      'qyFood': qyFood,
      'qyPoor1': qyPoor1,
      'qyPoor3': qyPoor3,
      'qyPoor4': qyPoor4,
      'qyPoor5': qyPoor5,
      'qyPoor6': qyPoor6,

      // Fundraising
      'qyFundrasing1': qyFundrasing1,
      'qyGorom1': qyGorom1,

      // Placeholder
      'qyPlaceholder': qyPlaceholder,
      'qyNoImage': qyNoImage,
      'qyLoading': qyLoading,
    };
  }

  /// Get image by key (with qy prefix)
  static String? getImage(String key) {
    return getAllImages()[key];
  }

  /// Check if image exists
  static bool hasImage(String key) {
    return getAllImages().containsKey(key);
  }

  /// Get all image keys
  static List<String> getAllImageKeys() {
    return getAllImages().keys.toList();
  }

  /// Get images by category
  static Map<String, String> getImagesByCategory(String category) {
    final allImages = getAllImages();
    return Map.fromEntries(
      allImages.entries.where((entry) => entry.key.toLowerCase().contains(category.toLowerCase()))
    );
  }
}
