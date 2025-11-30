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

  Widget _buildRecommendCard(BuildContext context, Map<String, dynamic> card) {
    const iconSize = 86.4;
    return Container(
      width: iconSize + 8.0,
      margin: const EdgeInsets.only(right: 10.0),
      child: Column(
        mainAxisSize: MainAxisSize.max,
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          Padding(
            padding: const EdgeInsets.only(bottom: 20.0),
            child: SizedBox(
              width: iconSize,
              height: iconSize,
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
                        size: 43.2,
                      ),
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final recommendCards = _getRecommendCards(context);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12.0),
        child: Container(
          height: 216.0,
          child: Stack(
            children: [
              Positioned.fill(
                child: Transform.scale(
                  scale: 1.5,
                  child: Image.asset(
                    AssetsIconsAppTravel.travelRecommendBg1,
                    fit: BoxFit.cover,
                  ),
                ),
              ),
              ListView.builder(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.only(right: 4.0),
                itemCount: 5,
                itemBuilder: (context, index) {
                  return _buildRecommendCard(context, recommendCards[index]);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
