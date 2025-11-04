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

/// Travel app image assets
/// Uses standardized paths: assets/apps/app_travel/images/
/// All asset keys have 'travel' prefix as required by documentation
class AssetsImagesAppTravel {
  static const String _baseNav = 'assets/apps/app_travel/images/nav';
  static const String _baseUpload = 'assets/apps/app_travel/images/upload';

  // Navigation Icons
  static const String travelNavHotel = '$_baseNav/grid-nav-items-hotel@v7.15.png';
  static const String travelNavFlight = '$_baseNav/grid-nav-items-flight@v7.15.png';
  static const String travelNavTravel = '$_baseNav/grid-nav-items-travel@v7.15.png';
  static const String travelNavTrain = '$_baseNav/grid-nav-items-train.png';
  static const String travelNavMinsu = '$_baseNav/grid-nav-items-minsu@v7.15.png';
  static const String travelNavCustom = '$_baseNav/grid-nav-items-dingzhi@v7.15.png';
  static const String travelNavJhj = '$_baseNav/grid-nav-items-jhj@v7.15.png';
  static const String travelSubnav = '$_baseNav/un_ico_subnav2x@v7.152.png';
  static const String travelMainSprite = '$_baseNav/home-fivemain-sprite2x@v7.15.png';
  static const String travelNoResult = '$_baseNav/no-result.png';
  static const String travelAjaxLoader = '$_baseNav/ajax-loader.gif';

  // Local Navigation Icons (split from sprite sheet)
  static const String travelLocalNav0 = '$_baseNav/local_nav_0@2x.png';
  static const String travelLocalNav1 = '$_baseNav/local_nav_1@2x.png';
  static const String travelLocalNav2 = '$_baseNav/local_nav_2@2x.png';
  static const String travelLocalNav3 = '$_baseNav/local_nav_3@2x.png';
  static const String travelLocalNav4 = '$_baseNav/local_nav_4@2x.png';

  // Local Navigation Icons List
  static const List<String> travelLocalNavIcons = [
    travelLocalNav0,
    travelLocalNav1,
    travelLocalNav2,
    travelLocalNav3,
    travelLocalNav4,
  ];

  // Sub Navigation Icons (split from sprite sheet)
  static const String travelSubnav0 = '$_baseNav/subnav_0@2x.png';
  static const String travelSubnav1 = '$_baseNav/subnav_1@2x.png';
  static const String travelSubnav2 = '$_baseNav/subnav_2@2x.png';
  static const String travelSubnav3 = '$_baseNav/subnav_3@2x.png';
  static const String travelSubnav4 = '$_baseNav/subnav_4@2x.png';
  static const String travelSubnav5 = '$_baseNav/subnav_5@2x.png';
  static const String travelSubnav6 = '$_baseNav/subnav_6@2x.png';
  static const String travelSubnav7 = '$_baseNav/subnav_7@2x.png';
  static const String travelSubnav8 = '$_baseNav/subnav_8@2x.png';
  static const String travelSubnav9 = '$_baseNav/subnav_9@2x.png';

  // Sub Navigation Icons List
  static const List<String> travelSubnavIcons = [
    travelSubnav0,
    travelSubnav1,
    travelSubnav2,
    travelSubnav3,
    travelSubnav4,
    travelSubnav5,
    travelSubnav6,
    travelSubnav7,
    travelSubnav8,
    travelSubnav9,
  ];

  // Swiper Banner Images
  static const String travelSwiper1 = '$_baseUpload/zg0516000000zifq4FC3C.jpg';
  static const String travelSwiper2 = '$_baseUpload/zg0a15000000ypf1tBC70.jpg';
  static const String travelSwiper3 = '$_baseUpload/zg0e15000000yqzweE43E.jpg';
  static const String travelSwiper4 = '$_baseUpload/zg0r16000000yrvpo1109.jpg';
  static const String travelSwiper5 = '$_baseUpload/zg0r16000000zx6hb0CB8.jpg';

  // Sight & Attraction Images
  static const String travelSight1 = '$_baseUpload/100t10000000paws4EC47.jpg';
  static const String travelSight1Thumb = '$_baseUpload/100t10000000paws4EC47_C_250_250.jpg';
  static const String travelSight2 = '$_baseUpload/10020f0000007exdc99FE.jpg';
  static const String travelSight2Thumb = '$_baseUpload/10020f0000007exdc99FE_C_250_250.jpg';
  static const String travelSight3 = '$_baseUpload/10040m000000dxiffB127_C_250_250.jpg';
  static const String travelSight4 = '$_baseUpload/CggYHlXWwYCAWSf4AD7T3hxEde0314.jpg';
  static const String travelSight4Large = '$_baseUpload/CggYHlXWwYCAWSf4AD7T3hxEde0314_D_500_250.jpg';
  static const String travelSight5 = '$_baseUpload/CggYGVaMtQqAN2wTAAP7AxHB-nk418.jpg';
  static const String travelSight6 = '$_baseUpload/CggYHVXdfOSAVy69ABd4hFYdsMU359.jpg';
  static const String travelSight7 = '$_baseUpload/CghzfFWwxsuAHIL8ABLulITTChw397.jpg';

  // Local Hot Category Icons
  static const String travelHotSight = '$_baseUpload/100t0l000000d61ht687A.png';
  static const String travelHotHotel = '$_baseUpload/10020l000000ddw8hB633.png';
  static const String travelHotFood = '$_baseUpload/100c0l000000d9klbC07D.png';
  static const String travelHotShopping = '$_baseUpload/100u0l000000d6wtm2B89.png';

  // Popular & Recommended
  static const String travelPopularAttraction = '$_baseUpload/2dcda4e400ace9f993835fbb.jpg_250x250_d841fd57.jpg';
  static const String travelPopularHotel = '$_baseUpload/200u0j000000aw3xuE230_C_360_360_Q50.jpg_.webp';
  static const String travelFood = '$_baseUpload/d846f0a902264018b0bbf57410e6127a_D_250_250_Q90.jpg';

  // Additional Sights
  static const String travelSight8 = '$_baseUpload/10030f0000007ey067AAD.jpg';
  static const String travelSight9 = '$_baseUpload/10030v000000jvdhwAE46.jpg';
  static const String travelSight10 = '$_baseUpload/10060v000000ju9p8E776.jpg';
  static const String travelSight11 = '$_baseUpload/1009080000002zroc5DA7.jpg';
  static const String travelSight12 = '$_baseUpload/100a10000000pc62478FA.jpg';
  static const String travelSight13 = '$_baseUpload/100b0m000000dzead78F2.jpg';
  static const String travelSight14 = '$_baseUpload/100e11000000rhibf621B.jpg';
  static const String travelSight15 = '$_baseUpload/100m0v000000k30yv9102.jpg';
  static const String travelSight16 = '$_baseUpload/100o050000000nlyc5211.jpg';
  static const String travelSight17 = '$_baseUpload/100p0q000000g9x8xBE5C.jpg';
  static const String travelSight18 = '$_baseUpload/100r0700000020y2fDB0A.jpg';
  static const String travelSight19 = '$_baseUpload/100s0900000040wmiA99D.jpg';
  static const String travelSight20 = '$_baseUpload/100u10000000pau0s116D.jpg';
  static const String travelSight21 = '$_baseUpload/100v0g0000007to4oD551.jpg';

  /// Get all navigation icons
  static Map<String, String> getNavigationIcons() {
    return {
      'travelNavHotel': travelNavHotel,
      'travelNavFlight': travelNavFlight,
      'travelNavTravel': travelNavTravel,
      'travelNavTrain': travelNavTrain,
      'travelNavMinsu': travelNavMinsu,
      'travelNavCustom': travelNavCustom,
      'travelNavJhj': travelNavJhj,
      'travelSubnav': travelSubnav,
      'travelMainSprite': travelMainSprite,
    };
  }

  /// Get all swiper images
  static List<String> getSwiperImages() {
    return [
      travelSwiper1,
      travelSwiper2,
      travelSwiper3,
      travelSwiper4,
      travelSwiper5,
    ];
  }

  /// Get local hot category icons
  static Map<String, String> getLocalHotIcons() {
    return {
      'sight': travelHotSight,
      'hotel': travelHotHotel,
      'food': travelHotFood,
      'shopping': travelHotShopping,
    };
  }

  /// Get all sight images
  static List<String> getAllSightImages() {
    return [
      travelSight1,
      travelSight2,
      travelSight3,
      travelSight4,
      travelSight5,
      travelSight6,
      travelSight7,
      travelSight8,
      travelSight9,
      travelSight10,
      travelSight11,
      travelSight12,
      travelSight13,
      travelSight14,
      travelSight15,
      travelSight16,
      travelSight17,
      travelSight18,
      travelSight19,
      travelSight20,
      travelSight21,
    ];
  }

  /// Get image by key
  static String? getImage(String key) {
    return getAllImages()[key];
  }

  /// Get all images as a map
  static Map<String, String> getAllImages() {
    return {
      // Navigation
      ...getNavigationIcons(),

      // Swiper
      'travelSwiper1': travelSwiper1,
      'travelSwiper2': travelSwiper2,
      'travelSwiper3': travelSwiper3,
      'travelSwiper4': travelSwiper4,
      'travelSwiper5': travelSwiper5,

      // Local Hot
      'travelHotSight': travelHotSight,
      'travelHotHotel': travelHotHotel,
      'travelHotFood': travelHotFood,
      'travelHotShopping': travelHotShopping,

      // Popular
      'travelPopularAttraction': travelPopularAttraction,
      'travelPopularHotel': travelPopularHotel,
      'travelFood': travelFood,

      // Utilities
      'travelNoResult': travelNoResult,
      'travelAjaxLoader': travelAjaxLoader,
    };
  }

  /// Check if image exists
  static bool hasImage(String key) {
    return getAllImages().containsKey(key);
  }
}
