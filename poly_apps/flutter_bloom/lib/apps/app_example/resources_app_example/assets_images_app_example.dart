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

/// Example app image assets - 符合文档规范
/// Uses standardized paths: assets/apps/app_example/images/
/// All asset keys have 'example' prefix as required by documentation
class AssetsImagesAppExample {
  static const String _base = 'assets/apps/app_example/images';

  static const String exampleLogo = '$_base/logo.jpg';
  static const String exampleBanner = '$_base/banner.jpg';
  static const String exampleSplash = '$_base/splash.jpg';
  static const String exampleBackground = '$_base/background.jpg';

  static const String exampleUser = '$_base/user.png';
  static const String exampleUser1 = '$_base/user1.jpg';
  static const String exampleUser2 = '$_base/user2.jpg';
  static const String exampleUser3 = '$_base/user3.jpg';
  static const String exampleAvatar = '$_base/avatar.png';
  static const String exampleDefaultAvatar = '$_base/default_avatar.png';

  static const String exampleFeed = '$_base/Feed.jpg';
  static const String exampleBaby = '$_base/baby.jpg';
  static const String exampleBaby1 = '$_base/baby.jpg';
  static const String exampleBaby2 = '$_base/child2.jpg';
  static const String exampleBannerChild = '$_base/bannerchild.jpg';

  static const String exampleChild1 = '$_base/child1.jpeg';
  static const String exampleChild2 = '$_base/child2.jpg';
  static const String exampleChild3 = '$_base/child3.jpg';
  static const String exampleChild5 = '$_base/child5.jpg';
  static const String exampleChild6 = '$_base/child6.jpg';
  static const String exampleHelpChild = '$_base/helpchild.jpg';

  static const String exampleEducation = '$_base/education.jpg';
  static const String exampleStudent = '$_base/student.jpg';
  static const String exampleStudent2 = '$_base/student2.jpeg';
  static const String exampleRunning = '$_base/running.jpg';

  static const String exampleHealth = '$_base/health.jpg';
  static const String exampleHospital = '$_base/hospital.jpg';
  static const String exampleHelp1 = '$_base/help1.jpg';

  static const String exampleFlood = '$_base/Flood.png';
  static const String exampleFire = '$_base/fire.jpg';
  static const String exampleUrgent1 = '$_base/urgent1.jpg';
  static const String exampleUrgent2 = '$_base/urgent2.jpg';
  static const String exampleUrgen4 = '$_base/urgen4.jpg';
  static const String exampleUrgent5 = '$_base/urgent5.jpg';
  static const String exampleUrgent6 = '$_base/urgent6.jpg';

  static const String exampleFood = '$_base/food.jpg';
  static const String examplePoor1 = '$_base/poor1.jpg';
  static const String examplePoor3 = '$_base/poor3.jpg';
  static const String examplePoor4 = '$_base/poor4.png';
  static const String examplePoor5 = '$_base/poor5.jpg';
  static const String examplePoor6 = '$_base/poor6.jpg';

  static const String exampleFundrasing1 = '$_base/funrasing1.jpeg';
  static const String exampleGorom1 = '$_base/gorom1.jpg';

  static const String examplePlaceholder = '$_base/placeholder.png';
  static const String exampleNoImage = '$_base/no_image.png';
  static const String exampleLoading = '$_base/loading.gif';

  /// Get all images as a map for easy access
  /// All keys use 'example' prefix as required by documentation
  static Map<String, String> getAllImages() {
    return {
      // App Branding
      'exampleLogo': exampleLogo,
      'exampleBanner': exampleBanner,
      'exampleSplash': exampleSplash,
      'exampleBackground': exampleBackground,

      // User & Profile
      'exampleUser': exampleUser,
      'exampleUser1': exampleUser1,
      'exampleUser2': exampleUser2,
      'exampleUser3': exampleUser3,
      'exampleAvatar': exampleAvatar,
      'exampleDefaultAvatar': exampleDefaultAvatar,

      // Content
      'exampleFeed': exampleFeed,
      'exampleBaby': exampleBaby,
      'exampleBaby1': exampleBaby1,
      'exampleBaby2': exampleBaby2,
      'exampleBannerChild': exampleBannerChild,

      // Children & Family
      'exampleChild1': exampleChild1,
      'exampleChild2': exampleChild2,
      'exampleChild3': exampleChild3,
      'exampleChild5': exampleChild5,
      'exampleChild6': exampleChild6,
      'exampleHelpChild': exampleHelpChild,

      // Education
      'exampleEducation': exampleEducation,
      'exampleStudent': exampleStudent,
      'exampleStudent2': exampleStudent2,
      'exampleRunning': exampleRunning,

      // Health & Medical
      'exampleHealth': exampleHealth,
      'exampleHospital': exampleHospital,
      'exampleHelp1': exampleHelp1,

      // Emergency & Urgent
      'exampleFlood': exampleFlood,
      'exampleFire': exampleFire,
      'exampleUrgent1': exampleUrgent1,
      'exampleUrgent2': exampleUrgent2,
      'exampleUrgen4': exampleUrgen4,
      'exampleUrgent5': exampleUrgent5,
      'exampleUrgent6': exampleUrgent6,

      // Social & Community
      'exampleFood': exampleFood,
      'examplePoor1': examplePoor1,
      'examplePoor3': examplePoor3,
      'examplePoor4': examplePoor4,
      'examplePoor5': examplePoor5,
      'examplePoor6': examplePoor6,

      // Fundraising
      'exampleFundrasing1': exampleFundrasing1,
      'exampleGorom1': exampleGorom1,

      // Placeholder
      'examplePlaceholder': examplePlaceholder,
      'exampleNoImage': exampleNoImage,
      'exampleLoading': exampleLoading,
    };
  }

  /// Get image by key (with example prefix)
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
