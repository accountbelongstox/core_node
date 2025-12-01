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

/// Discover Screen for QY App - Social and Community Features
library;

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';

class DiscoverScreenRefactoredAppQy extends StatefulWidget {
  const DiscoverScreenRefactoredAppQy({super.key});

  @override
  State<DiscoverScreenRefactoredAppQy> createState() =>
      _DiscoverScreenRefactoredAppQyState();
}

class _DiscoverScreenRefactoredAppQyState
    extends State<DiscoverScreenRefactoredAppQy> {
  final List<Map<String, dynamic>> _discoverItems;

  _DiscoverScreenRefactoredAppQyState()
      : _discoverItems = [];

  @override
  void initState() {
    super.initState();
    _initDiscoverItems();
  }

  void _initDiscoverItems() {
    _discoverItems.addAll([
      {
        'icon': Icons.check_circle_outline,
        'title': 'Check-in Challenge',
        'subtitle': 'Daily learning challenges',
        'color': ColorsAppQy.qyWarning,
        'route': '/qy/social/checkin-challenge',
      },
      {
        'icon': Icons.message_outlined,
        'title': 'Message Center',
        'subtitle': 'Community updates & notifications',
        'color': ColorsAppQy.qyInfo,
        'route': '/qy/social/message-center',
      },
      {
        'icon': Icons.people_outline,
        'title': 'Learning Community',
        'subtitle': 'Connect with learners',
        'color': ColorsAppQy.qySuccess,
        'route': null,
      },
      {
        'icon': Icons.trending_up,
        'title': 'Leaderboard',
        'subtitle': 'See top learners',
        'color': ColorsAppQy.qyAccent,
        'route': null,
      },
      {
        'icon': Icons.topic_outlined,
        'title': 'Topics',
        'subtitle': 'Join discussions',
        'color': ColorsAppQy.qyAccentLight,
        'route': null,
      },
      {
        'icon': Icons.card_giftcard,
        'title': 'Rewards',
        'subtitle': 'Claim your benefits',
        'color': ColorsAppQy.qyWarning,
        'route': null,
      },
    ]);
  }

  void _handleItemTap(Map<String, dynamic> item) {
    final String? route = item['route'];
    if (route != null) {
      context.go(route);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('${item['title']} ${QyAppLocalizationKeys.qyFeatureComingSoon.tr(context)}'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyHomeDiscover.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              children: [
                _buildFeaturedBanner(),
                SizedBox(height: ThemeDimensions.spacingLarge),
                _buildSectionHeader(
                  QyAppLocalizationKeys.qyCommunity.tr(context),
                  'Explore community features',
                ),
                SizedBox(height: ThemeDimensions.spacingMedium),
                _buildDiscoverGrid(),
              ],
            ),
          ),
          const BottomNavigationAppQy(currentIndex: 3),
        ],
      ),
    );
  }

  Widget _buildFeaturedBanner() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            ThemeColors.primary.withOpacity(0.8),
            ThemeColors.secondary.withOpacity(0.6),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.explore, color: ThemeColors.surface, size: 32),
              SizedBox(width: ThemeDimensions.spacingMedium),
              Expanded(
                child: Text(
                  'Discover Learning',
                  style: ThemeTextStyles.h3.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            'Connect with millions of learners worldwide',
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, String subtitle) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: ThemeTextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        SizedBox(height: ThemeDimensions.spacingXSmall),
        Text(
          subtitle,
          style: ThemeTextStyles.body2.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildDiscoverGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: ThemeDimensions.spacingMedium,
        mainAxisSpacing: ThemeDimensions.spacingMedium,
        childAspectRatio: 1.1,
      ),
      itemCount: _discoverItems.length,
      itemBuilder: (context, index) {
        final item = _discoverItems[index];
        return _buildDiscoverCard(item);
      },
    );
  }

  Widget _buildDiscoverCard(Map<String, dynamic> item) {
    return InkWell(
      onTap: () => _handleItemTap(item),
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          border: Border.all(color: ThemeColors.border),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.shadow.withOpacity(0.05),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              decoration: BoxDecoration(
                color: (item['color'] as Color).withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(
                item['icon'] as IconData,
                size: 32,
                color: item['color'] as Color,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              item['title'] as String,
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: ThemeDimensions.spacingXSmall),
            Text(
              item['subtitle'] as String,
              style: ThemeTextStyles.caption.copyWith(
                color: ThemeColors.textSecondary,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
    );
  }
}
