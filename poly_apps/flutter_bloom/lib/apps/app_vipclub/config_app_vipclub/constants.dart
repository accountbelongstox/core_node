class VipClubConstants {
  static const String memberTypeGuest = 'guest';
  static const String memberTypeRegular = 'regular';
  static const String memberTypeGold = 'gold';
  static const String memberTypePlatinum = 'platinum';
  static const String memberTypeDiamond = 'diamond';

  static const String facilityTypeShooting = 'shooting';
  static const String facilityTypeGolf = 'golf';
  static const String facilityTypeHotel = 'hotel';

  static const String bookingStatusPending = 'pending';
  static const String bookingStatusConfirmed = 'confirmed';
  static const String bookingStatusCancelled = 'cancelled';
  static const String bookingStatusCompleted = 'completed';

  static const String paymentMethodCash = 'cash';
  static const String paymentMethodCard = 'card';
  static const String paymentMethodPoints = 'points';
  static const String paymentMethodMixed = 'mixed';

  static const int shootingRangeLanes = 20;
  static const int golfHoles18 = 18;
  static const int golfHoles9 = 9;
  static const int hotelRoomTypes = 5;

  static const double shootingHourlyRate = 50.0;
  static const double golfRoundRate = 100.0;
  static const double hotelBaseRate = 200.0;

  static const double vipGoldDiscount = 0.10;
  static const double vipPlatinumDiscount = 0.20;
  static const double vipDiamondDiscount = 0.30;

  static const String storageKeyAuthToken = 'vipclub_auth_token';
  static const String storageKeyUserProfile = 'vipclub_user_profile';
  static const String storageKeyMemberCard = 'vipclub_member_card';
  static const String storageKeyBookingHistory = 'vipclub_booking_history';
}
