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

/// Common image assets (shared across all apps)
/// Migrated from app_qy resources and standardized for common usage
class CommonAssetsImages {
  static const String _base = 'assets/common/images';

  static const String backgroundLight = '$_base/background_light.png';
  static const String backgroundDark = '$_base/background_dark.png';
  static const String splash = '$_base/splash.png';

  static const String avatarPlaceholder = '$_base/avatar_placeholder.png';
  static const String coverPlaceholder = '$_base/cover_placeholder.png';
  static const String user = '$_base/user.png';

  static const String feed = '$_base/Feed.jpg';
  static const String flood = '$_base/Flood.png';
  static const String baby = '$_base/baby.jpg';
  static const String bannerchild = '$_base/bannerchild.jpg';
  static const String child1 = '$_base/child1.jpeg';
  static const String child2 = '$_base/child2.jpg';
  static const String child3 = '$_base/child3.jpg';
  static const String child5 = '$_base/child5.jpg';
  static const String child6 = '$_base/child6.jpg';
  static const String education = '$_base/education.jpg';
  static const String fire = '$_base/fire.jpg';
  static const String food = '$_base/food.jpg';
  static const String funrasing1 = '$_base/funrasing1.jpeg';
  static const String gorom1 = '$_base/gorom1.jpg';
  static const String health = '$_base/health.jpg';
  static const String help1 = '$_base/help1.jpg';
  static const String helpchild = '$_base/helpchild.jpg';
  static const String hospital = '$_base/hospital.jpg';

  static const String poor1 = '$_base/poor1.jpg';
  static const String poor3 = '$_base/poor3.jpg';
  static const String poor4 = '$_base/poor4.png';
  static const String poor5 = '$_base/poor5.jpg';
  static const String poor6 = '$_base/poor6.jpg';

  static const String running = '$_base/running.jpg';
  static const String student = '$_base/student.jpg';
  static const String student2 = '$_base/student2.jpeg';

  static const String urgen4 = '$_base/urgen4.jpg';
  static const String urgent1 = '$_base/urgent1.jpg';
  static const String urgent2 = '$_base/urgent2.jpg';
  static const String urgent5 = '$_base/urgent5.jpg';
  static const String urgent6 = '$_base/urgent6.jpg';

  static const String user1 = '$_base/user1.jpg';
  static const String user2 = '$_base/user2.jpg';
  static const String user3 = '$_base/user3.jpg';

  static const String baby1 = '$_base/baby.jpg';
  static const String baby2 = '$_base/child2.jpg';
  static const String baby3 = '$_base/helpchild.jpg';
  static const String helpChild = '$_base/helpchild.jpg';
  static const String food2 = '$_base/student2.jpeg';
  static const String urgent3 = '$_base/urgen4.jpg';
  static const String urgent4 = '$_base/urgent5.jpg';


  // Background variations - using existing images as backgrounds
  static const String profileBackgroundDark = '$_base/user.png';
  static const String profileBackgroundLight = '$_base/user.png';
  static const String homeBackgroundDark = '$_base/child1.jpeg';
  static const String homeBackgroundLight = '$_base/child1.jpeg';
  static const String settingsBackgroundDark = '$_base/user.png';
  static const String settingsBackgroundLight = '$_base/user.png';
  
  // Wuy App specific backgrounds
  static const String wuyBackground1 = 'assets/apps/app_wuy/images/background1.jpg';
  static const String wuyBackground2 = 'assets/apps/app_wuy/images/background2.jpg';

  // UI state images - using actual existing files
  static const String placeholder = '$_base/user.png';
  static const String empty = '$_base/user.png';
  static const String error = '$_base/user.png';
  static const String noInternet = '$_base/user.png';
  static const String loading = '$_base/user.png';

  /// Get all images as a map for easy access
  static Map<String, String> getAllImages() {
    return {
      // Background Images
      'backgroundLight': backgroundLight,
      'backgroundDark': backgroundDark,
      'splash': splash,

      // Placeholder Images
      'avatarPlaceholder': avatarPlaceholder,
      'coverPlaceholder': coverPlaceholder,
      'user': user,

      // Content Images
      'feed': feed,
      'flood': flood,
      'baby': baby,
      'bannerchild': bannerchild,
      'child1': child1,
      'child2': child2,
      'child3': child3,
      'child5': child5,
      'child6': child6,
      'education': education,
      'fire': fire,
      'food': food,
      'funrasing1': funrasing1,
      'gorom1': gorom1,
      'health': health,
      'help1': help1,
      'helpchild': helpchild,
      'hospital': hospital,

      // Poverty & Help Images
      'poor1': poor1,
      'poor3': poor3,
      'poor4': poor4,
      'poor5': poor5,
      'poor6': poor6,

      // Activity Images
      'running': running,
      'student': student,
      'student2': student2,

      // Urgent & Emergency Images
      'urgen4': urgen4,
      'urgent1': urgent1,
      'urgent2': urgent2,
      'urgent5': urgent5,
      'urgent6': urgent6,

      // User Profile Images
      'user1': user1,
      'user2': user2,
      'user3': user3,

      // Alternative Names
      'baby1': baby1,
      'baby2': baby2,
      'baby3': baby3,
      'helpChild': helpChild,
      'food2': food2,
      'urgent3': urgent3,
      'urgent4': urgent4,
      
      // Wuy App specific backgrounds
      'wuyBackground1': wuyBackground1,
      'wuyBackground2': wuyBackground2,
    };
  }
}


