/// Reusable bottom navigation widget for QY App
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../common/theme/base/theme_colors.dart';
import '../../../../common/theme/base/theme_dimensions.dart';
import '../../../../common/theme/base/theme_text_styles.dart';
import '../../../../common/localization/localization_manager.dart';
import '../localization_app_qy/localization_keys_app_qy.dart';
import '../router_app_qy/routes_provider_app_qy.dart';

class BottomNavigationAppQy extends StatelessWidget {
  final int currentIndex;

  const BottomNavigationAppQy({
    super.key,
    required this.currentIndex,
  });

  void _handleNavigation(BuildContext context, int index) {
    if (index == currentIndex) return;

    switch (index) {
      case 0:
        context.go(QyAppRoutesProvider.routeHome);
        break;
      case 1:
        context.go(QyAppRoutesProvider.routeCourseIelts);
        break;
      case 2:
        context.go(QyAppRoutesProvider.routeAiStudy);
        break;
      case 3:
        context.go(QyAppRoutesProvider.routeDiscover);
        break;
      case 4:
        context.go(QyAppRoutesProvider.routeMoreFeatures);
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final items = [
      {
        'icon': Icons.book,
        'label': QyAppLocalizationKeys.qyWords.tr(context),
      },
      {
        'icon': Icons.school,
        'label': QyAppLocalizationKeys.qyHomeCourse.tr(context),
      },
      {
        'icon': Icons.psychology,
        'label': QyAppLocalizationKeys.qyHomeAi.tr(context),
      },
      {
        'icon': Icons.explore,
        'label': QyAppLocalizationKeys.qyHomeDiscover.tr(context),
      },
      {
        'icon': Icons.person,
        'label': QyAppLocalizationKeys.qyHomeProfile.tr(context),
      },
    ];

    return Container(
      padding: EdgeInsets.only(
        top: ThemeDimensions.paddingSmall,
        bottom: ThemeDimensions.paddingXSmall,
        left: ThemeDimensions.paddingMedium,
        right: ThemeDimensions.paddingMedium,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          top: BorderSide(color: ThemeColors.border, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.05),
            blurRadius: 8,
            offset: const Offset(0, -2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: items.asMap().entries.map((entry) {
          final index = entry.key;
          final item = entry.value;
          final isSelected = index == currentIndex;
          return InkWell(
            onTap: () => _handleNavigation(context, index),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  item['icon'] as IconData,
                  color: isSelected
                      ? ThemeColors.primary
                      : ThemeColors.textSecondary,
                  size: 24,
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Text(
                  item['label'] as String,
                  style: ThemeTextStyles.caption.copyWith(
                    color: isSelected
                        ? ThemeColors.primary
                        : ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }
}
