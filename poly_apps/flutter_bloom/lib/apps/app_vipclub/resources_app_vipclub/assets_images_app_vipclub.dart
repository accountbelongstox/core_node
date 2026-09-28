class VipClubAssetsImages {
  static const String vipclubLogo = 'assets/apps/app_vipclub/images/logo.png';
  static const String vipclubBanner1 = 'assets/apps/app_vipclub/images/banner_1.jpg';
  static const String vipclubBanner2 = 'assets/apps/app_vipclub/images/banner_2.jpg';
  static const String vipclubBanner3 = 'assets/apps/app_vipclub/images/banner_3.jpg';

  static const String vipclubSplash1 = 'vipclub_splash_1';
  static const String vipclubSplash2 = 'vipclub_splash_2';

  static const String vipclubLoginBg1 = 'vipclub_login_bg_1';
  static const String vipclubLoginBg2 = 'vipclub_login_bg_2';

  static const String vipclubBgShooting = 'vipclub_bg_shooting';
  static const String vipclubBgGolf = 'vipclub_bg_golf';
  static const String vipclubBgHotel = 'vipclub_bg_hotel';
  static const String vipclubBgVipLounge = 'vipclub_bg_vip_lounge';
  static const String vipclubBgCardGold = 'vipclub_bg_card_gold';
  static const String vipclubBgCardPlatinum = 'vipclub_bg_card_platinum';
  static const String vipclubBgCardDiamond = 'vipclub_bg_card_diamond';

  static const String vipclubFacilityShootingRange1 = 'vipclub_facility_shooting_range_1';
  static const String vipclubFacilityShootingRange2 = 'vipclub_facility_shooting_range_2';
  static const String vipclubFacilityGolfCourse1 = 'vipclub_facility_golf_course_1';
  static const String vipclubFacilityGolfCourse2 = 'vipclub_facility_golf_course_2';
  static const String vipclubFacilityHotelRoom1 = 'vipclub_facility_hotel_room_1';
  static const String vipclubFacilityHotelRoom2 = 'vipclub_facility_hotel_room_2';

  static const String vipclubPlaceholderFacility = 'vipclub_placeholder_facility';
  static const String vipclubPlaceholderAvatar = 'vipclub_placeholder_avatar';
  static const String vipclubPlaceholderImage = 'vipclub_placeholder_image';

  static const Map<String, String> imagePaths = {
    vipclubSplash1: 'assets/apps/app_vipclub/images/splash_1.png',
    vipclubSplash2: 'assets/apps/app_vipclub/images/splash_2.png',
    vipclubLoginBg1: 'assets/apps/app_vipclub/images/login_bg_1.png',
    vipclubLoginBg2: 'assets/apps/app_vipclub/images/login_bg_2.png',
    vipclubBgShooting: 'assets/apps/app_vipclub/images/bg_shooting.jpg',
    vipclubBgGolf: 'assets/apps/app_vipclub/images/bg_golf.jpg',
    vipclubBgHotel: 'assets/apps/app_vipclub/images/bg_hotel.jpg',
    vipclubBgVipLounge: 'assets/apps/app_vipclub/images/bg_vip_lounge.jpg',
    vipclubBgCardGold: 'assets/apps/app_vipclub/images/bg_card_gold.jpg',
    vipclubBgCardPlatinum: 'assets/apps/app_vipclub/images/bg_card_platinum.jpg',
    vipclubBgCardDiamond: 'assets/apps/app_vipclub/images/bg_card_diamond.jpg',
    vipclubFacilityShootingRange1: 'assets/apps/app_vipclub/images/facility_shooting_range_1.jpg',
    vipclubFacilityShootingRange2: 'assets/apps/app_vipclub/images/facility_shooting_range_2.jpg',
    vipclubFacilityGolfCourse1: 'assets/apps/app_vipclub/images/facility_golf_course_1.jpg',
    vipclubFacilityGolfCourse2: 'assets/apps/app_vipclub/images/facility_golf_course_2.jpg',
    vipclubFacilityHotelRoom1: 'assets/apps/app_vipclub/images/facility_hotel_room_1.jpg',
    vipclubFacilityHotelRoom2: 'assets/apps/app_vipclub/images/facility_hotel_room_2.jpg',
    vipclubPlaceholderFacility: 'assets/apps/app_vipclub/images/placeholder_facility.png',
    vipclubPlaceholderAvatar: 'assets/apps/app_vipclub/images/placeholder_avatar.png',
    vipclubPlaceholderImage: 'assets/apps/app_vipclub/images/placeholder_image.png',
  };

  static String getPath(String key) {
    return imagePaths[key] ?? '';
  }
}
