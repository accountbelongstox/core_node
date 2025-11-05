import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../models_app_travel/recommend_item_model.dart';
import '../../../resources_app_travel/assets_icons_app_travel.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';

class HomeRecommend extends StatelessWidget {
  final List<List<RecommendItemModel>> recommend;

  const HomeRecommend({
    super.key,
    required this.recommend,
  });

  List<Map<String, dynamic>> _getRecommendCards(BuildContext context) {
    return [
      {
        'icon': AssetsIconsAppTravel.travelRecommendIcon1,
        'titleKey': TravelLocalizationKeys.travelDailyCoupon,
        'subtitleKey': TravelLocalizationKeys.travelSignInCoupon,
      },
      {
        'icon': AssetsIconsAppTravel.travelRecommendIcon2,
        'titleKey': TravelLocalizationKeys.travelCheapFlights,
        'subtitleKey': TravelLocalizationKeys.travel30DayLowPrice,
      },
      {
        'icon': AssetsIconsAppTravel.travelRecommendIcon3,
        'titleKey': TravelLocalizationKeys.travelDiscountFlight,
        'subtitleKey': TravelLocalizationKeys.travelStartingPrice,
      },
      {
        'icon': AssetsIconsAppTravel.travelRecommendIcon4,
        'titleKey': TravelLocalizationKeys.travelHotelStock,
        'subtitleKey': TravelLocalizationKeys.travelFlashDeal,
      },
      {
        'icon': AssetsIconsAppTravel.travelRecommendIcon5,
        'titleKey': TravelLocalizationKeys.travelAIItinerary,
        'subtitleKey': TravelLocalizationKeys.travelSmartPlanning,
      },
    ];
  }

  Widget _buildRecommendCard(BuildContext context, Map<String, dynamic> card, double cardWidth) {
    return Container(
      width: cardWidth,
      margin: const EdgeInsets.only(right: 20.0),
      child: Container(
        width: cardWidth,
        height: cardWidth,
        decoration: BoxDecoration(
          color: Colors.transparent,
          borderRadius: BorderRadius.circular(12.0),
        ),
        padding: EdgeInsets.only(top: cardWidth * 0.6, left: 8.0, right: 8.0, bottom: 8.0),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(12.0),
          child: Image.asset(
            card['icon']!,
            fit: BoxFit.contain,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                color: const Color(0xFFF5F5F5),
                child: const Icon(
                  Icons.image,
                  color: Colors.grey,
                  size: 40.0,
                ),
              );
            },
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final cardWidth = (screenWidth - 12.0 * 2 - 20.0 * 3 - 8.0) / 4;
    final recommendCards = _getRecommendCards(context);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
      child: Container(
        height: cardWidth,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12.0),
          image: const DecorationImage(
            image: AssetImage(AssetsIconsAppTravel.travelRecommendBg1),
            fit: BoxFit.cover,
          ),
        ),
        child: ListView.builder(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.symmetric(horizontal: 4.0),
          itemCount: recommendCards.length,
          itemBuilder: (context, index) {
            return _buildRecommendCard(context, recommendCards[index], cardWidth);
          },
        ),
      ),
    );
  }
}
