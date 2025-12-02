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

library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';

class SocialRankingScreenRefactoredAppQy extends StatefulWidget {
  const SocialRankingScreenRefactoredAppQy({super.key});

  @override
  State<SocialRankingScreenRefactoredAppQy> createState() =>
      _SocialRankingScreenRefactoredAppQyState();
}

class _SocialRankingScreenRefactoredAppQyState
    extends State<SocialRankingScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<Map<String, dynamic>> _weeklyRankings = [];
  final List<Map<String, dynamic>> _monthlyRankings = [];
  final List<Map<String, dynamic>> _allTimeRankings = [];
  int _myRank = 0;
  int _myPoints = 0;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _initRankings();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _initRankings() {
    _myRank = 15;
    _myPoints = 1250;

    _weeklyRankings.addAll([
      {
        'rank': 1,
        'name': 'Sarah Chen',
        'avatar': Icons.person,
        'points': 850,
        'level': 12,
        'badge': 'Gold',
      },
      {
        'rank': 2,
        'name': 'Mike Johnson',
        'avatar': Icons.person,
        'points': 780,
        'level': 11,
        'badge': 'Silver',
      },
      {
        'rank': 3,
        'name': 'Emma Wilson',
        'avatar': Icons.person,
        'points': 720,
        'level': 10,
        'badge': 'Bronze',
      },
      {
        'rank': 4,
        'name': 'David Lee',
        'avatar': Icons.person,
        'points': 680,
        'level': 10,
        'badge': null,
      },
      {
        'rank': 5,
        'name': 'Lisa Zhang',
        'avatar': Icons.person,
        'points': 650,
        'level': 9,
        'badge': null,
      },
    ]);

    _monthlyRankings.addAll([
      {
        'rank': 1,
        'name': 'Emma Wilson',
        'avatar': Icons.person,
        'points': 3200,
        'level': 15,
        'badge': 'Gold',
      },
      {
        'rank': 2,
        'name': 'Sarah Chen',
        'avatar': Icons.person,
        'points': 2950,
        'level': 14,
        'badge': 'Silver',
      },
      {
        'rank': 3,
        'name': 'David Lee',
        'avatar': Icons.person,
        'points': 2800,
        'level': 13,
        'badge': 'Bronze',
      },
    ]);

    _allTimeRankings.addAll([
      {
        'rank': 1,
        'name': 'Michael Zhang',
        'avatar': Icons.person,
        'points': 15000,
        'level': 25,
        'badge': 'Legend',
      },
      {
        'rank': 2,
        'name': 'Emily Brown',
        'avatar': Icons.person,
        'points': 12500,
        'level': 22,
        'badge': 'Master',
      },
      {
        'rank': 3,
        'name': 'Alex Kim',
        'avatar': Icons.person,
        'points': 10800,
        'level': 20,
        'badge': 'Expert',
      },
    ]);
  }

  List<Map<String, dynamic>> _getCurrentRankings() {
    switch (_tabController.index) {
      case 0:
        return _weeklyRankings;
      case 1:
        return _monthlyRankings;
      case 2:
        return _allTimeRankings;
      default:
        return _weeklyRankings;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyRankings.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
        bottom: TabBar(
          controller: _tabController,
          labelColor: ThemeColors.primary,
          unselectedLabelColor: ThemeColors.textSecondary,
          indicatorColor: ThemeColors.primary,
          labelStyle:
              ThemeTextStyles.body1.copyWith(fontWeight: FontWeight.w600),
          unselectedLabelStyle: ThemeTextStyles.body1,
          tabs: [
            Tab(text: QyAppLocalizationKeys.qyWeek.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyMonth.tr(context)),
            Tab(text: QyAppLocalizationKeys.qyAllTime.tr(context)),
          ],
        ),
      ),
      body: Column(
        children: [
          _buildMyRankCard(),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildRankingList(_weeklyRankings),
                _buildRankingList(_monthlyRankings),
                _buildRankingList(_allTimeRankings),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMyRankCard() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.paddingMedium),
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary,
            ThemeColors.primary.withOpacity(0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.primary.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              color: ThemeColors.surface.withOpacity(0.2),
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Text(
                '#$_myRank',
                style: ThemeTextStyles.h3.copyWith(
                  color: ThemeColors.surface,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  QyAppLocalizationKeys.qyYourRank.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.surface.withOpacity(0.9),
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Row(
                  children: [
                    Icon(Icons.star, size: 20, color: ThemeColors.surface),
                    SizedBox(width: ThemeDimensions.spacingXSmall),
                    Text(
                      '$_myPoints ${QyAppLocalizationKeys.qyPoints.tr(context)}',
                      style: ThemeTextStyles.h4.copyWith(
                        color: ThemeColors.surface,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Icon(Icons.emoji_events, size: 40, color: ThemeColors.surface),
        ],
      ),
    );
  }

  Widget _buildRankingList(List<Map<String, dynamic>> rankings) {
    return ListView.builder(
      padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.paddingMedium),
      itemCount: rankings.length,
      itemBuilder: (context, index) {
        return Padding(
          padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
          child: _buildRankingCard(rankings[index]),
        );
      },
    );
  }

  Widget _buildRankingCard(Map<String, dynamic> user) {
    final rank = user['rank'] as int;
    final isTopThree = rank <= 3;

    Color getRankColor() {
      switch (rank) {
        case 1:
          return ColorsAppQy.qyWarning;
        case 2:
          return ColorsAppQy.qyTextSecondary;
        case 3:
          return ColorsAppQy.qyTextTertiary;
        default:
          return ThemeColors.textSecondary;
      }
    }

    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(
          color:
              isTopThree ? getRankColor().withOpacity(0.3) : ThemeColors.border,
          width: isTopThree ? 2 : 1,
        ),
        boxShadow: isTopThree
            ? [
                BoxShadow(
                  color: getRankColor().withOpacity(0.2),
                  blurRadius: 8,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: Row(
        children: [
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: getRankColor().withOpacity(0.2),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
            child: Center(
              child: isTopThree
                  ? Icon(
                      Icons.workspace_premium,
                      color: getRankColor(),
                      size: 28,
                    )
                  : Text(
                      '#$rank',
                      style: ThemeTextStyles.h4.copyWith(
                        color: getRankColor(),
                        fontWeight: FontWeight.bold,
                      ),
                    ),
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Container(
            width: 50,
            height: 50,
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(
              user['avatar'] as IconData,
              color: ThemeColors.primary,
              size: 28,
            ),
          ),
          SizedBox(width: ThemeDimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  user['name'] as String,
                  style: ThemeTextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: ThemeDimensions.spacingXSmall),
                Row(
                  children: [
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: ThemeDimensions.paddingSmall,
                        vertical: ThemeDimensions.paddingXSmall,
                      ),
                      decoration: BoxDecoration(
                        color: ThemeColors.primary.withOpacity(0.1),
                        borderRadius:
                            BorderRadius.circular(ThemeDimensions.radiusSmall),
                      ),
                      child: Text(
                        'Lv ${user['level']}',
                        style: ThemeTextStyles.caption.copyWith(
                          color: ThemeColors.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    if (user['badge'] != null) ...{
                      SizedBox(width: ThemeDimensions.spacingSmall),
                      Container(
                        padding: EdgeInsets.symmetric(
                          horizontal: ThemeDimensions.paddingSmall,
                          vertical: ThemeDimensions.paddingXSmall,
                        ),
                        decoration: BoxDecoration(
                          color: getRankColor().withOpacity(0.1),
                          borderRadius: BorderRadius.circular(
                              ThemeDimensions.radiusSmall),
                        ),
                        child: Text(
                          user['badge'] as String,
                          style: ThemeTextStyles.caption.copyWith(
                            color: getRankColor(),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                    },
                  ],
                ),
              ],
            ),
          ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Row(
                children: [
                  Icon(Icons.star, size: 16, color: ColorsAppQy.qyWarning),
                  SizedBox(width: ThemeDimensions.spacingXSmall),
                  Text(
                    user['points'].toString(),
                    style: ThemeTextStyles.h4.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              SizedBox(height: ThemeDimensions.spacingXSmall),
              Text(
                QyAppLocalizationKeys.qyPoints.tr(context),
                style: ThemeTextStyles.caption.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
