import 'package:flutter/material.dart';
import '../../../models_app_travel/recommend_item_model.dart';
import '../../../widgets/travel_icons.dart';
import '../../../resources_app_travel/assets_icons_app_travel.dart';

class HomeRecommend extends StatelessWidget {
  final List<List<RecommendItemModel>> recommend;

  const HomeRecommend({
    Key? key,
    required this.recommend,
  }) : super(key: key);

  final List<Map<String, String>> recommendCards = const [
    {
      'icon': AssetsIconsAppTravel.travelRecommendIcon1,
      'title': '天天神券',
      'subtitle': '签到领券',
    },
    {
      'icon': AssetsIconsAppTravel.travelRecommendIcon2,
      'title': '低价机票',
      'subtitle': '30天低价',
    },
    {
      'icon': AssetsIconsAppTravel.travelRecommendIcon3,
      'title': '1折机票',
      'subtitle': '200元起',
    },
    {
      'icon': AssetsIconsAppTravel.travelRecommendIcon4,
      'title': '酒店囤货',
      'subtitle': '69元秒底',
    },
    {
      'icon': AssetsIconsAppTravel.travelRecommendIcon5,
      'title': 'AI行程',
      'subtitle': '智能规划',
    },
  ];

  Widget _buildRecommendCard(Map<String, String> card) {
    return Container(
      width: 100.0,
      margin: const EdgeInsets.only(right: 12.0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 100.0,
            height: 100.0,
            decoration: BoxDecoration(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(8.0),
            ),
            padding: const EdgeInsets.all(8.0),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8.0),
              child: Image.asset(
                card['icon']!,
                width: 84.0,
                height: 84.0,
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
          const SizedBox(height: 6.0),
          Text(
            card['title']!,
            style: const TextStyle(
              fontSize: 13.0,
              fontWeight: FontWeight.w600,
              color: Colors.black87,
              shadows: [
                Shadow(
                  color: Colors.white,
                  blurRadius: 4.0,
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 2.0),
          Text(
            card['subtitle']!,
            style: const TextStyle(
              fontSize: 11.0,
              color: Color(0xFF999999),
              shadows: [
                Shadow(
                  color: Colors.white,
                  blurRadius: 4.0,
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
      child: Column(
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8.0),
            child: Image.asset(
              'assets/apps/app_travel/images/recommend_banner.png',
              width: double.infinity,
              height: 120.0,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  width: double.infinity,
                  height: 120.0,
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFF4E6),
                    borderRadius: BorderRadius.circular(8.0),
                    gradient: const LinearGradient(
                      colors: [Color(0xFFFFE5CC), Color(0xFFFFF4E6)],
                    ),
                  ),
                  child: const Center(
                    child: Text(
                      '新用户三单礼',
                      style: TextStyle(
                        fontSize: 24.0,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFFF6600),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
          const SizedBox(height: 12.0),
          Container(
            height: 140.0,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8.0),
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
                return _buildRecommendCard(recommendCards[index]);
              },
            ),
          ),
        ],
      ),
    );
  }
}
