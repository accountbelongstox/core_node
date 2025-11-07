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
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../controllers/profile_controller_app_qy.dart';

class ProfileAchievementsScreenRefactoredAppQy extends StatefulWidget {
  const ProfileAchievementsScreenRefactoredAppQy({super.key});

  @override
  State<ProfileAchievementsScreenRefactoredAppQy> createState() =>
      _ProfileAchievementsScreenRefactoredAppQyState();
}

class _ProfileAchievementsScreenRefactoredAppQyState
    extends State<ProfileAchievementsScreenRefactoredAppQy> {
  String _selectedCategory = 'all';
  final List<Map<String, dynamic>> _achievements = [];
  int _totalPoints = 0;
  int _unlockedCount = 0;

  @override
  void initState() {
    super.initState();
    _initAchievements();
  }

  void _initAchievements() {
    _totalPoints = 1250;
    _unlockedCount = 8;

    _achievements.addAll([
      {
        'id': 'first_word',
        'title': 'First Step',
        'description': 'Learn your first word',
        'icon': Icons.emoji_events,
        'color': Colors.amber,
        'points': 10,
        'unlocked': true,
        'category': 'learning',
        'unlockedDate': '2024-01-15',
      },
      {
        'id': 'word_100',
        'title': 'Vocabulary Builder',
        'description': 'Learn 100 words',
        'icon': Icons.library_books,
        'color': Colors.blue,
        'points': 100,
        'unlocked': true,
        'category': 'learning',
        'unlockedDate': '2024-02-10',
      },
      {
        'id': 'word_500',
        'title': 'Word Master',
        'description': 'Learn 500 words',
        'icon': Icons.school,
        'color': Colors.purple,
        'points': 500,
        'unlocked': false,
        'category': 'learning',
        'progress': 0.27,
      },
      {
        'id': 'streak_7',
        'title': 'Week Warrior',
        'description': 'Maintain a 7-day streak',
        'icon': Icons.local_fire_department,
        'color': Colors.orange,
        'points': 50,
        'unlocked': true,
        'category': 'streak',
        'unlockedDate': '2024-01-22',
      },
      {
        'id': 'streak_30',
        'title': 'Monthly Master',
        'description': 'Maintain a 30-day streak',
        'icon': Icons.whatshot,
        'color': Colors.deepOrange,
        'points': 200,
        'unlocked': false,
        'category': 'streak',
        'progress': 0.5,
      },
      {
        'id': 'quiz_perfect',
        'title': 'Perfect Score',
        'description': 'Get 100% on a quiz',
        'icon': Icons.stars,
        'color': Colors.yellow,
        'points': 30,
        'unlocked': true,
        'category': 'test',
        'unlockedDate': '2024-01-20',
      },
      {
        'id': 'quiz_10',
        'title': 'Quiz Master',
        'description': 'Complete 10 quizzes',
        'icon': Icons.quiz,
        'color': Colors.teal,
        'points': 80,
        'unlocked': true,
        'category': 'test',
        'unlockedDate': '2024-02-05',
      },
      {
        'id': 'course_complete',
        'title': 'Course Graduate',
        'description': 'Complete your first course',
        'icon': Icons.workspace_premium,
        'color': Colors.green,
        'points': 150,
        'unlocked': true,
        'category': 'course',
        'unlockedDate': '2024-02-15',
      },
      {
        'id': 'course_3',
        'title': 'Dedicated Learner',
        'description': 'Complete 3 courses',
        'icon': Icons.military_tech,
        'color': Colors.indigo,
        'points': 300,
        'unlocked': false,
        'category': 'course',
        'progress': 0.33,
      },
      {
        'id': 'social_friend',
        'title': 'Social Butterfly',
        'description': 'Add 5 friends',
        'icon': Icons.people,
        'color': Colors.pink,
        'points': 20,
        'unlocked': true,
        'category': 'social',
        'unlockedDate': '2024-01-25',
      },
      {
        'id': 'social_share',
        'title': 'Share Master',
        'description': 'Share 10 achievements',
        'icon': Icons.share,
        'color': Colors.cyan,
        'points': 40,
        'unlocked': false,
        'category': 'social',
        'progress': 0.4,
      },
      {
        'id': 'early_bird',
        'title': 'Early Bird',
        'description': 'Study before 8 AM',
        'icon': Icons.wb_sunny,
        'color': Colors.amber,
        'points': 15,
        'unlocked': true,
        'category': 'special',
        'unlockedDate': '2024-01-18',
      },
    ]);
  }

  List<Map<String, dynamic>> get _filteredAchievements {
    if (_selectedCategory == 'all') {
      return _achievements;
    }
    return _achievements
        .where((achievement) => achievement['category'] == _selectedCategory)
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyAchievements.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: Column(
        children: [
          _buildStatsHeader(),
          _buildCategoryTabs(),
          Expanded(
            child: _buildAchievementsList(),
          ),
        ],
      ),
    );
  }

  Widget _buildStatsHeader() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary,
            ThemeColors.primary.withOpacity(0.8),
          ],
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              children: [
                Icon(
                  Icons.emoji_events,
                  size: 40,
                  color: ThemeColors.surface,
                ),
                SizedBox(height: ThemeDimensions.spacingSmall),
                Text(
                  _unlockedCount.toString(),
                  style: ThemeTextStyles.h2.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyUnlocked.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.surface.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 1,
            height: 60,
            color: ThemeColors.surface.withOpacity(0.3),
          ),
          Expanded(
            child: Column(
              children: [
                Icon(
                  Icons.star,
                  size: 40,
                  color: ThemeColors.surface,
                ),
                SizedBox(height: ThemeDimensions.spacingSmall),
                Text(
                  _totalPoints.toString(),
                  style: ThemeTextStyles.h2.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyPoints.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.surface.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
          Container(
            width: 1,
            height: 60,
            color: ThemeColors.surface.withOpacity(0.3),
          ),
          Expanded(
            child: Column(
              children: [
                Icon(
                  Icons.lock_open,
                  size: 40,
                  color: ThemeColors.surface,
                ),
                SizedBox(height: ThemeDimensions.spacingSmall),
                Text(
                  '${((_unlockedCount / _achievements.length) * 100).toInt()}%',
                  style: ThemeTextStyles.h2.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  QyAppLocalizationKeys.qyComplete.tr(context),
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.surface.withOpacity(0.9),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategoryTabs() {
    final categories = [
      {'id': 'all', 'label': QyAppLocalizationKeys.qyAll.tr(context)},
      {'id': 'learning', 'label': QyAppLocalizationKeys.qyLearning.tr(context)},
      {'id': 'streak', 'label': QyAppLocalizationKeys.qyStreak.tr(context)},
      {'id': 'test', 'label': QyAppLocalizationKeys.qyTest.tr(context)},
      {'id': 'course', 'label': QyAppLocalizationKeys.qyCourse.tr(context)},
      {'id': 'social', 'label': QyAppLocalizationKeys.qySocial.tr(context)},
      {'id': 'special', 'label': QyAppLocalizationKeys.qySpecial.tr(context)},
    ];

    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingMedium,
        vertical: ThemeDimensions.paddingSmall,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(
          bottom: BorderSide(color: ThemeColors.border),
        ),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: categories.map((category) {
            final isSelected = _selectedCategory == category['id'];
            return Padding(
              padding: EdgeInsets.only(right: ThemeDimensions.spacingSmall),
              child: InkWell(
                onTap: () {
                  setState(() {
                    _selectedCategory = category['id'] as String;
                  });
                },
                child: Container(
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingMedium,
                    vertical: ThemeDimensions.paddingSmall,
                  ),
                  decoration: BoxDecoration(
                    color: isSelected
                        ? ThemeColors.primary.withOpacity(0.1)
                        : Colors.transparent,
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                    border: Border.all(
                      color: isSelected ? ThemeColors.primary : Colors.transparent,
                    ),
                  ),
                  child: Text(
                    category['label'] as String,
                    style: ThemeTextStyles.body2.copyWith(
                      color: isSelected ? ThemeColors.primary : ThemeColors.textSecondary,
                      fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildAchievementsList() {
    final achievements = _filteredAchievements;

    return GridView.builder(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: ThemeDimensions.spacingMedium,
        mainAxisSpacing: ThemeDimensions.spacingMedium,
        childAspectRatio: 0.85,
      ),
      itemCount: achievements.length,
      itemBuilder: (context, index) {
        return _buildAchievementCard(achievements[index]);
      },
    );
  }

  Widget _buildAchievementCard(Map<String, dynamic> achievement) {
    final unlocked = achievement['unlocked'] as bool;
    final color = achievement['color'] as Color;

    return InkWell(
      onTap: () => _showAchievementDetails(achievement),
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          border: Border.all(
            color: unlocked ? color.withOpacity(0.5) : ThemeColors.border,
            width: unlocked ? 2 : 1,
          ),
          boxShadow: unlocked
              ? [
                  BoxShadow(
                    color: color.withOpacity(0.2),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ]
              : null,
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              decoration: BoxDecoration(
                color: unlocked ? color.withOpacity(0.2) : ThemeColors.background,
                shape: BoxShape.circle,
              ),
              child: Icon(
                achievement['icon'] as IconData,
                size: 40,
                color: unlocked ? color : ThemeColors.textTertiary,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              achievement['title'] as String,
              style: ThemeTextStyles.body1.copyWith(
                color: unlocked ? ThemeColors.textPrimary : ThemeColors.textTertiary,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Text(
              achievement['description'] as String,
              style: ThemeTextStyles.caption.copyWith(
                color: unlocked ? ThemeColors.textSecondary : ThemeColors.textTertiary,
              ),
              textAlign: TextAlign.center,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            if (!unlocked && achievement.containsKey('progress')) ...{
              ClipRRect(
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                child: LinearProgressIndicator(
                  value: achievement['progress'] as double,
                  minHeight: 4,
                  backgroundColor: ThemeColors.border,
                  valueColor: AlwaysStoppedAnimation<Color>(color),
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingSmall),
            },
            Container(
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.paddingSmall,
                vertical: ThemeDimensions.paddingXSmall,
              ),
              decoration: BoxDecoration(
                color: unlocked ? color.withOpacity(0.1) : ThemeColors.background,
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.star,
                    size: 12,
                    color: unlocked ? color : ThemeColors.textTertiary,
                  ),
                  SizedBox(width: ThemeDimensions.spacingXSmall),
                  Text(
                    '${achievement['points']}',
                    style: ThemeTextStyles.caption.copyWith(
                      color: unlocked ? color : ThemeColors.textTertiary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showAchievementDetails(Map<String, dynamic> achievement) {
    final unlocked = achievement['unlocked'] as bool;
    final color = achievement['color'] as Color;

    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
                decoration: BoxDecoration(
                  color: color.withOpacity(0.2),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  achievement['icon'] as IconData,
                  size: 64,
                  color: color,
                ),
              ),
              SizedBox(height: ThemeDimensions.spacingLarge),
              Text(
                achievement['title'] as String,
                style: ThemeTextStyles.h3.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: ThemeDimensions.spacingMedium),
              Text(
                achievement['description'] as String,
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              SizedBox(height: ThemeDimensions.spacingLarge),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.star, color: color),
                  SizedBox(width: ThemeDimensions.spacingSmall),
                  Text(
                    '${achievement['points']} ${QyAppLocalizationKeys.qyPoints.tr(context)}',
                    style: ThemeTextStyles.h4.copyWith(
                      color: color,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              if (unlocked) ...{
                SizedBox(height: ThemeDimensions.spacingMedium),
                Text(
                  '${QyAppLocalizationKeys.qyUnlocked.tr(context)}: ${achievement['unlockedDate']}',
                  style: ThemeTextStyles.caption.copyWith(
                    color: ThemeColors.textTertiary,
                  ),
                ),
              },
              SizedBox(height: ThemeDimensions.spacingLarge),
              ElevatedButton(
                onPressed: () => Navigator.pop(context),
                style: ElevatedButton.styleFrom(
                  backgroundColor: ThemeColors.primary,
                  padding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.paddingLarge,
                    vertical: ThemeDimensions.paddingMedium,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                  ),
                ),
                child: Text(
                  QyAppLocalizationKeys.qyCommonOk.tr(context),
                  style: ThemeTextStyles.button.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
