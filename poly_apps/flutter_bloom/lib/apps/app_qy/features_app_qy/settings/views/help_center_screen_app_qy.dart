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
import '../controllers/settings_controller_app_qy.dart';

class HelpCenterScreenRefactoredAppQy extends StatefulWidget {
  const HelpCenterScreenRefactoredAppQy({super.key});

  @override
  State<HelpCenterScreenRefactoredAppQy> createState() =>
      _HelpCenterScreenRefactoredAppQyState();
}

class _HelpCenterScreenRefactoredAppQyState
    extends State<HelpCenterScreenRefactoredAppQy> {
  final List<Map<String, dynamic>> _faqCategories = [];
  final List<Map<String, dynamic>> _faqs = [];

  @override
  void initState() {
    super.initState();
    _initHelpData();
  }

  void _initHelpData() {
    _faqCategories.addAll([
      {
        'id': 'getting_started',
        'title': 'Getting Started',
        'icon': Icons.rocket_launch,
        'color': Colors.blue,
      },
      {
        'id': 'account',
        'title': 'Account & Settings',
        'icon': Icons.account_circle,
        'color': Colors.green,
      },
      {
        'id': 'learning',
        'title': 'Learning Features',
        'icon': Icons.school,
        'color': Colors.purple,
      },
      {
        'id': 'subscription',
        'title': 'Subscription & Billing',
        'icon': Icons.payment,
        'color': Colors.orange,
      },
    ]);

    _faqs.addAll([
      {
        'category': 'getting_started',
        'question': 'How do I start learning?',
        'answer':
            'To start learning, go to the Home screen and select your learning path. You can choose from various courses or start with daily vocabulary practice.',
      },
      {
        'category': 'getting_started',
        'question': 'How do I track my progress?',
        'answer':
            'Your progress is automatically tracked. Visit your Profile to see detailed statistics, achievements, and learning history.',
      },
      {
        'category': 'account',
        'question': 'How do I change my password?',
        'answer':
            'Go to Settings > Account > Change Password. Enter your current password and new password to update.',
      },
      {
        'category': 'account',
        'question': 'Can I use multiple devices?',
        'answer':
            'Yes! Your account syncs across all devices. Simply log in with the same account on any device.',
      },
      {
        'category': 'learning',
        'question': 'What is spaced repetition?',
        'answer':
            'Spaced repetition is a learning technique that schedules review of words at increasing intervals to optimize long-term retention.',
      },
      {
        'category': 'learning',
        'question': 'How do streaks work?',
        'answer':
            'Streaks track consecutive days of learning. Study for at least 10 minutes each day to maintain your streak.',
      },
    ]);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyHelpCenter.tr(context),
          style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: ListView(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        children: [
          _buildSearchBar(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          _buildQuickActions(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyBrowseTopics.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildCategoriesGrid(),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Text(
            QyAppLocalizationKeys.qyFrequentlyAsked.tr(context),
            style: ThemeTextStyles.h4.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          _buildFAQList(),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.paddingMedium,
        vertical: ThemeDimensions.paddingSmall,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        children: [
          Icon(Icons.search, color: ThemeColors.textSecondary),
          SizedBox(width: ThemeDimensions.spacingSmall),
          Expanded(
            child: TextField(
              style: ThemeTextStyles.body1.copyWith(color: ThemeColors.textPrimary),
              decoration: InputDecoration(
                hintText: QyAppLocalizationKeys.qySearchHelp.tr(context),
                hintStyle: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textTertiary,
                ),
                border: InputBorder.none,
                isDense: true,
                contentPadding: EdgeInsets.zero,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActions() {
    return Row(
      children: [
        Expanded(
          child: _buildActionButton(
            Icons.chat_bubble_outline,
            QyAppLocalizationKeys.qyLiveChat.tr(context),
            ThemeColors.primary,
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingMedium),
        Expanded(
          child: _buildActionButton(
            Icons.email_outlined,
            QyAppLocalizationKeys.qyEmailUs.tr(context),
            ThemeColors.success,
          ),
        ),
      ],
    );
  }

  Widget _buildActionButton(IconData icon, String label, Color color) {
    return InkWell(
      onTap: () {},
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          color: color.withOpacity(0.1),
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          border: Border.all(color: color.withOpacity(0.3)),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 32),
            SizedBox(height: ThemeDimensions.spacingSmall),
            Text(
              label,
              style: ThemeTextStyles.body2.copyWith(
                color: color,
                fontWeight: FontWeight.w600,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoriesGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: ThemeDimensions.spacingMedium,
        mainAxisSpacing: ThemeDimensions.spacingMedium,
        childAspectRatio: 1.3,
      ),
      itemCount: _faqCategories.length,
      itemBuilder: (context, index) {
        return _buildCategoryCard(_faqCategories[index]);
      },
    );
  }

  Widget _buildCategoryCard(Map<String, dynamic> category) {
    final color = category['color'] as Color;

    return InkWell(
      onTap: () {},
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.surface,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          border: Border.all(color: ThemeColors.border),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
              ),
              child: Icon(
                category['icon'] as IconData,
                color: color,
                size: 32,
              ),
            ),
            SizedBox(height: ThemeDimensions.spacingMedium),
            Text(
              category['title'] as String,
              style: ThemeTextStyles.body2.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
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

  Widget _buildFAQList() {
    return Column(
      children: _faqs.take(5).map((faq) {
        return Padding(
          padding: EdgeInsets.only(bottom: ThemeDimensions.spacingMedium),
          child: _buildFAQItem(faq),
        );
      }).toList(),
    );
  }

  Widget _buildFAQItem(Map<String, dynamic> faq) {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: EdgeInsets.symmetric(
            horizontal: ThemeDimensions.paddingMedium,
            vertical: ThemeDimensions.paddingSmall,
          ),
          childrenPadding: EdgeInsets.only(
            left: ThemeDimensions.paddingMedium,
            right: ThemeDimensions.paddingMedium,
            bottom: ThemeDimensions.paddingMedium,
          ),
          title: Text(
            faq['question'] as String,
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w500,
            ),
          ),
          children: [
            Text(
              faq['answer'] as String,
              style: ThemeTextStyles.body2.copyWith(
                color: ThemeColors.textSecondary,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
