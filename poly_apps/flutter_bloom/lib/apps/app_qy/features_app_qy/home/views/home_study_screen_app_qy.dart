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

/// Home Study Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class HomeStudyScreenAppQy extends StatefulWidget {
  const HomeStudyScreenAppQy({super.key});

  @override
  State<HomeStudyScreenAppQy> createState() => _HomeStudyScreenAppQyState();
}

class _HomeStudyScreenAppQyState extends State<HomeStudyScreenAppQy> {
  final String _username;
  final int _learnedWords;
  final int _totalWords;
  final double _learnedPercentage;
  final int _newWordsProgress;
  final int _newWordsTotal;
  final int _reviewWordsProgress;
  final int _reviewWordsTotal;
  bool _showMoreFeatures;

  _HomeStudyScreenAppQyState()
      : _username = '小留8',
        _learnedWords = 27,
        _totalWords = 16952,
        _learnedPercentage = 0.1,
        _newWordsProgress = 0,
        _newWordsTotal = 200,
        _reviewWordsProgress = 0,
        _reviewWordsTotal = 27,
        _showMoreFeatures = true;

  void _toggleMoreFeatures() {
    setState(() {
      _showMoreFeatures = !_showMoreFeatures;
    });
  }

  void _handleStartLearning() {
    // TODO: Navigate to learning session
  }

  void _handleFeatureTap(String feature) {
    // TODO: Handle feature navigation
  }

  void _handleSettingsTap() {
    // TODO: Navigate to settings
  }

  void _handleLearningSettings() {
    // TODO: Navigate to learning settings
  }

  void _handleLearningData() {
    // TODO: Navigate to learning data/statistics
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      body: SafeArea(
        child: Stack(
          children: [
            _buildMainContent(),
            if (_showMoreFeatures) _buildMoreFeaturesDrawer(),
          ],
        ),
      ),
    );
  }

  Widget _buildMainContent() {
    return Column(
      children: [
        _buildHeader(),
        Expanded(
          child: SingleChildScrollView(
            padding: EdgeInsets.all(Dimensions.paddingMedium),
            child: Column(
              children: [
                SizedBox(height: Dimensions.spacingLarge),
                _buildProgressSection(),
                SizedBox(height: Dimensions.spacingXLarge),
                _buildLearningStats(),
                SizedBox(height: Dimensions.spacingXLarge),
                _buildStartButton(),
              ],
            ),
          ),
        ),
        _buildBottomNavigation(),
      ],
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      color: ThemeColors.surface,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            '04:00',
            style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
          ),
          Text(
            _username,
            style: TextStyles.body1.copyWith(color: ThemeColors.textPrimary),
          ),
        ],
      ),
    );
  }

  Widget _buildProgressSection() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${QyAppLocalizationKeys.qyHomeLearned.tr(context)} ${_learnedPercentage}%',
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              Text(
                '$_learnedWords/$_totalWords${QyAppLocalizationKeys.qyWords.tr(context)}',
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingSmall),
          LinearProgressIndicator(
            value: _learnedPercentage / 100,
            backgroundColor: ThemeColors.border,
            valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
          ),
        ],
      ),
    );
  }

  Widget _buildLearningStats() {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeNewWords.tr(context),
            '$_newWordsProgress/$_newWordsTotal',
          ),
        ),
        SizedBox(width: Dimensions.spacingMedium),
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeReviewWords.tr(context),
            '$_reviewWordsProgress/$_reviewWordsTotal',
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            value,
            style: TextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStartButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _handleStartLearning,
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeColors.primary,
          padding: EdgeInsets.symmetric(vertical: Dimensions.paddingMedium),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          ),
        ),
        child: Text(
          QyAppLocalizationKeys.qyHomeStartLearning.tr(context),
          style: TextStyles.h3.copyWith(
            color: ThemeColors.surface,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Widget _buildBottomNavigation() {
    final items = [
      {'icon': Icons.book, 'label': QyAppLocalizationKeys.qyWords.tr(context)},
      {'icon': Icons.school, 'label': QyAppLocalizationKeys.qyHomeCourse.tr(context)},
      {'icon': Icons.psychology, 'label': QyAppLocalizationKeys.qyHomeAi.tr(context)},
      {'icon': Icons.explore, 'label': QyAppLocalizationKeys.qyHomeDiscover.tr(context)},
      {'icon': Icons.person, 'label': QyAppLocalizationKeys.qyHomeProfile.tr(context)},
    ];

    return Container(
      padding: EdgeInsets.symmetric(
        vertical: Dimensions.paddingSmall,
        horizontal: Dimensions.paddingMedium,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        border: Border(top: BorderSide(color: ThemeColors.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: items.map((item) {
          return InkWell(
            onTap: () {},
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  item['icon'] as IconData,
                  color: ThemeColors.textSecondary,
                  size: 24,
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  item['label'] as String,
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildMoreFeaturesDrawer() {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withOpacity(0.5),
        child: Align(
          alignment: Alignment.centerLeft,
          child: Container(
            width: MediaQuery.of(context).size.width * 0.75,
            decoration: BoxDecoration(
              color: ThemeColors.surface,
              borderRadius: BorderRadius.only(
                topRight: Radius.circular(Dimensions.radiusLarge),
                bottomRight: Radius.circular(Dimensions.radiusLarge),
              ),
            ),
            child: SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _buildDrawerHeader(),
                  Expanded(
                    child: SingleChildScrollView(
                      padding: EdgeInsets.all(Dimensions.paddingMedium),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildFeatureSection(
                            QyAppLocalizationKeys.qyHomeConsolidate.tr(context),
                            [
                              QyAppLocalizationKeys.qyHomeWordTest.tr(context),
                              QyAppLocalizationKeys.qyHomePortableListening.tr(context),
                              QyAppLocalizationKeys.qyHomePhrase.tr(context),
                              QyAppLocalizationKeys.qyHomeSpeedReview.tr(context),
                            ],
                          ),
                          SizedBox(height: Dimensions.spacingLarge),
                          _buildFeatureSection(
                            QyAppLocalizationKeys.qyHomeExtension.tr(context),
                            [
                              QyAppLocalizationKeys.qyHomeReading.tr(context),
                              QyAppLocalizationKeys.qyHomeListeningSpeaking.tr(context),
                            ],
                          ),
                          SizedBox(height: Dimensions.spacingLarge),
                          _buildSettingsSection(),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildDrawerHeader() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: ThemeColors.border)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            QyAppLocalizationKeys.qyHomeMoreFeatures.tr(context),
            style: TextStyles.h3.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          IconButton(
            onPressed: _toggleMoreFeatures,
            icon: Icon(Icons.close, color: ThemeColors.textPrimary),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureSection(String title, List<String> features) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: TextStyles.body1.copyWith(
            color: ThemeColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Wrap(
          spacing: Dimensions.spacingSmall,
          runSpacing: Dimensions.spacingSmall,
          children: features.map((feature) {
            return InkWell(
              onTap: () => _handleFeatureTap(feature),
              child: Container(
                padding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingMedium,
                  vertical: Dimensions.paddingSmall,
                ),
                decoration: BoxDecoration(
                  color: ThemeColors.background,
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                  border: Border.all(color: ThemeColors.border),
                ),
                child: Text(
                  feature,
                  style: TextStyles.body2.copyWith(
                    color: ThemeColors.textPrimary,
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildSettingsSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qySettings.tr(context),
          style: TextStyles.body1.copyWith(
            color: ThemeColors.textSecondary,
            fontWeight: FontWeight.w500,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        _buildSettingsItem(
          QyAppLocalizationKeys.qyHomeLearnSettings.tr(context),
          _handleLearningSettings,
        ),
        SizedBox(height: Dimensions.spacingSmall),
        _buildSettingsItem(
          QyAppLocalizationKeys.qyHomeLearnData.tr(context),
          _handleLearningData,
        ),
      ],
    );
  }

  Widget _buildSettingsItem(String title, VoidCallback onTap) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(Dimensions.paddingMedium),
        decoration: BoxDecoration(
          color: ThemeColors.background,
          borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          border: Border.all(color: ThemeColors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              title,
              style: TextStyles.body2.copyWith(
                color: ThemeColors.textPrimary,
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              color: ThemeColors.textTertiary,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }
}
