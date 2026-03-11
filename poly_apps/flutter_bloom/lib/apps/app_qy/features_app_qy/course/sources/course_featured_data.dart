library;

import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';

class CourseFeaturedItem {
  final String type;
  final String duration;
  final String titleKey;
  final String subtitleKey;
  final String levelKey;
  final String? categoryKey;
  final int wordCount;

  const CourseFeaturedItem({
    required this.type,
    required this.duration,
    required this.titleKey,
    required this.subtitleKey,
    required this.levelKey,
    this.categoryKey,
    this.wordCount = 0,
  });
}

class CourseFeaturedData {
  static List<CourseFeaturedItem> getFeaturedItems() {
    return [
      CourseFeaturedItem(
        type: 'reading',
        duration: '7 days',
        titleKey: QyAppLocalizationKeys.qyCoursePlanClassicTitle,
        subtitleKey: QyAppLocalizationKeys.qyCoursePlanClassicName,
        levelKey: QyAppLocalizationKeys.qyCoursePlanCategoryIelts,
        categoryKey: QyAppLocalizationKeys.qyCoursePlanCategoryIelts,
        wordCount: 1200,
      ),
      CourseFeaturedItem(
        type: 'speaking',
        duration: '7 days',
        titleKey: QyAppLocalizationKeys.qyCoursePlanOralTitle,
        subtitleKey: QyAppLocalizationKeys.qyCoursePlanOralName,
        levelKey: QyAppLocalizationKeys.qyCoursePlanCategoryIelts,
        categoryKey: QyAppLocalizationKeys.qyCoursePlanCategoryIelts,
        wordCount: 800,
      ),
    ];
  }
}
