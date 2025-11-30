// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Home Search Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class HomeSearchScreenAppQy extends StatefulWidget {
  const HomeSearchScreenAppQy({super.key});

  @override
  State<HomeSearchScreenAppQy> createState() => _HomeSearchScreenAppQyState();
}

class _HomeSearchScreenAppQyState extends State<HomeSearchScreenAppQy> {
  final TextEditingController _searchController;
  int _checkInDays;
  int _newWordsProgress;
  int _newWordsTotal;
  int _reviewWordsProgress;
  int _reviewWordsTotal;
  int _learnedWords;
  int _totalWords;
  double _learningProgress;

  _HomeSearchScreenAppQyState()
      : _searchController = TextEditingController(),
        _checkInDays = 0,
        _newWordsProgress = 0,
        _newWordsTotal = 200,
        _reviewWordsProgress = 0,
        _reviewWordsTotal = 27,
        _learnedWords = 27,
        _totalWords = 16952,
        _learningProgress = 0.1;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _handleSearch(String query) {
    // TODO: Implement search functionality
  }

  void _handleStartLearning() {
    // TODO: Navigate to learning screen
  }

  void _handleWordBook() {
    // TODO: Navigate to word book
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      body: SafeArea(
        child: Column(
          children: [
            _buildSearchBar(),
            Expanded(
              child: SingleChildScrollView(
                padding: EdgeInsets.all(Dimensions.paddingMedium),
                child: Column(
                  children: [
                    _buildCheckInCard(),
                    SizedBox(height: Dimensions.spacingMedium),
                    _buildCourseProgressCard(),
                    SizedBox(height: Dimensions.spacingMedium),
                    _buildLearningStats(),
                    SizedBox(height: Dimensions.spacingLarge),
                    _buildStartLearningButton(),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.1),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TextField(
        controller: _searchController,
        onSubmitted: _handleSearch,
        style: TextStyles.body1.copyWith(color: ThemeColors.textPrimary),
        decoration: InputDecoration(
          hintText: QyAppLocalizationKeys.qySearchPlaceholder.tr(context),
          hintStyle: TextStyles.body2.copyWith(color: ThemeColors.textTertiary),
          prefixIcon: Icon(Icons.search, color: ThemeColors.textSecondary),
          suffixIcon: _searchController.text.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.clear, color: ThemeColors.textSecondary),
                  onPressed: () {
                    setState(() {
                      _searchController.clear();
                    });
                  },
                )
              : null,
          filled: true,
          fillColor: ThemeColors.background,
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            borderSide: BorderSide(color: ThemeColors.border),
          ),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            borderSide: BorderSide(color: ThemeColors.border),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            borderSide: BorderSide(color: ThemeColors.primary, width: 2),
          ),
          contentPadding: EdgeInsets.symmetric(
            horizontal: Dimensions.paddingMedium,
            vertical: Dimensions.paddingSmall,
          ),
        ),
      ),
    );
  }

  Widget _buildCheckInCard() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Text(
            QyAppLocalizationKeys.qyHomeCheckInDays.tr(context),
            style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            '$_checkInDays',
            style: TextStyles.h1.copyWith(
              color: ThemeColors.primary,
              fontSize: 72,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCourseProgressCard() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'COCA ${QyAppLocalizationKeys.qyCorpus.tr(context)} 20000',
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  '${QyAppLocalizationKeys.qyHomeLearned.tr(context)} $_learningProgress%',
                  style: TextStyles.body2.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          InkWell(
            onTap: _handleWordBook,
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: Dimensions.paddingSmall,
                vertical: Dimensions.paddingXSmall,
              ),
              decoration: BoxDecoration(
                color: ThemeColors.background,
                borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                border: Border.all(color: ThemeColors.border),
              ),
              child: Column(
                children: [
                  Text(
                    QyAppLocalizationKeys.qyWordBook.tr(context),
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textSecondary,
                    ),
                  ),
                  Text(
                    '$_learnedWords/$_totalWords${QyAppLocalizationKeys.qyWords.tr(context)}',
                    style: TextStyles.caption.copyWith(
                      color: ThemeColors.textPrimary,
                    ),
                  ),
                ],
              ),
            ),
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
            ThemeColors.success,
          ),
        ),
        SizedBox(width: Dimensions.spacingMedium),
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeReviewWords.tr(context),
            '$_reviewWordsProgress/$_reviewWordsTotal',
            ThemeColors.warning,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, Color accentColor) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            value,
            style: TextStyles.h3.copyWith(
              color: accentColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStartLearningButton() {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: _handleStartLearning,
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeColors.primary,
          foregroundColor: ThemeColors.onPrimary,
          padding: EdgeInsets.symmetric(vertical: Dimensions.paddingMedium),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
          ),
          elevation: 2,
        ),
        child: Text(
          QyAppLocalizationKeys.qyHomeStartLearning.tr(context),
          style: TextStyles.button.copyWith(
            color: ThemeColors.onPrimary,
            fontSize: 18,
          ),
        ),
      ),
    );
  }
}
