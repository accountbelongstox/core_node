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

/// Refactored Home Search Screen for QY App - with proper architecture
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';
import '../controllers/learning_controller_app_qy.dart';

class HomeSearchScreenRefactoredAppQy extends StatefulWidget {
  const HomeSearchScreenRefactoredAppQy({super.key});

  @override
  State<HomeSearchScreenRefactoredAppQy> createState() =>
      _HomeSearchScreenRefactoredAppQyState();
}

class _HomeSearchScreenRefactoredAppQyState
    extends State<HomeSearchScreenRefactoredAppQy> {
  final TextEditingController _searchController;

  _HomeSearchScreenRefactoredAppQyState()
      : _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LearningControllerAppQy>().loadLearningStats();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _handleSearch() {
    final query = _searchController.text;
    if (query.trim().isEmpty) return;

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('${QyAppLocalizationKeys.qySearching.tr(context)}: $query')),
    );
  }

  void _handleStartLearning() {
    context.read<LearningControllerAppQy>().startLearning();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      body: Consumer<LearningControllerAppQy>(
        builder: (context, controller, child) {
          return SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                _buildSearchBar(),
                Expanded(
                  child: controller.isLoading
                      ? Center(
                          child: CircularProgressIndicator(
                            color: ThemeColors.primary,
                          ),
                        )
                      : RefreshIndicator(
                          onRefresh: controller.refreshStats,
                          color: ThemeColors.primary,
                          child: SingleChildScrollView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: EdgeInsets.only(
                              left: ThemeDimensions.paddingMedium,
                              right: ThemeDimensions.paddingMedium,
                              top: ThemeDimensions.paddingMedium,
                              bottom: ThemeDimensions.paddingSmall,
                            ),
                            child: Column(
                              children: [
                                _buildCheckInCard(controller.learningStats),
                                SizedBox(height: ThemeDimensions.spacingLarge),
                                _buildWordBookCard(controller.learningStats),
                                SizedBox(height: ThemeDimensions.spacingLarge),
                                _buildLearningStats(controller.learningStats),
                                SizedBox(height: ThemeDimensions.spacingXLarge),
                                _buildStartButton(controller),
                              ],
                            ),
                          ),
                        ),
                ),
                const BottomNavigationAppQy(currentIndex: 0),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            DateTime.now().hour.toString().padLeft(2, '0') +
                ':' +
                DateTime.now().minute.toString().padLeft(2, '0'),
            style: ThemeTextStyles.h3.copyWith(color: ThemeColors.textPrimary),
          ),
          Icon(
            Icons.notifications_outlined,
            color: ThemeColors.textPrimary,
          ),
        ],
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      margin: EdgeInsets.all(ThemeDimensions.paddingMedium),
      padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.paddingMedium),
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
      child: Row(
        children: [
          Icon(
            Icons.search,
            color: ThemeColors.textSecondary,
          ),
          SizedBox(width: ThemeDimensions.spacingSmall),
          Expanded(
            child: TextField(
              controller: _searchController,
              decoration: InputDecoration(
                hintText: QyAppLocalizationKeys.qySearchPlaceholder.tr(context),
                hintStyle: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textTertiary,
                ),
                border: InputBorder.none,
              ),
              style: ThemeTextStyles.body1.copyWith(
                color: ThemeColors.textPrimary,
              ),
              onSubmitted: (_) => _handleSearch(),
            ),
          ),
          IconButton(
            onPressed: _handleSearch,
            icon: Icon(
              Icons.mic,
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCheckInCard(dynamic stats) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            ThemeColors.primary.withOpacity(0.1),
            ThemeColors.secondary.withOpacity(0.05),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        border: Border.all(color: ThemeColors.primary.withOpacity(0.2)),
      ),
      child: Column(
        children: [
          Text(
            QyAppLocalizationKeys.qyHomeCheckInDays.tr(context),
            style: ThemeTextStyles.body1.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingMedium),
          Text(
            stats.checkInDays.toString(),
            style: ThemeTextStyles.display1.copyWith(
              color: ThemeColors.primary,
              fontWeight: FontWeight.bold,
              fontSize: 72,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWordBookCard(dynamic stats) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'COCA ${QyAppLocalizationKeys.qyCorpus.tr(context)} 20000',
                style: ThemeTextStyles.h4.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              Text(
                QyAppLocalizationKeys.qyWordBook.tr(context),
                style: ThemeTextStyles.button.copyWith(
                  color: ThemeColors.primary,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingLarge),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${QyAppLocalizationKeys.qyHomeLearned.tr(context)} ${stats.learnedPercentage}%',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
              Text(
                '${stats.learnedWords}/${stats.totalWords}${QyAppLocalizationKeys.qyWords.tr(context)}',
                style: ThemeTextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: stats.learnedPercentage / 100,
              minHeight: 6,
              backgroundColor: ThemeColors.border,
              valueColor: AlwaysStoppedAnimation<Color>(ThemeColors.primary),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLearningStats(dynamic stats) {
    return Row(
      children: [
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeNewWords.tr(context),
            '${stats.newWordsToday}/${stats.newWordsTarget}',
            ThemeColors.primary,
          ),
        ),
        SizedBox(width: ThemeDimensions.spacingMedium),
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeReviewWords.tr(context),
            '${stats.reviewWordsToday}/${stats.reviewWordsTarget}',
            ThemeColors.secondary,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, Color color) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: ThemeTextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
          SizedBox(height: ThemeDimensions.spacingSmall),
          Text(
            value,
            style: ThemeTextStyles.h3.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStartButton(LearningControllerAppQy controller) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: controller.isLoading ? null : _handleStartLearning,
        style: ElevatedButton.styleFrom(
          backgroundColor: ThemeColors.primary,
          disabledBackgroundColor: ThemeColors.primary.withOpacity(0.5),
          padding: EdgeInsets.symmetric(vertical: ThemeDimensions.paddingLarge),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          ),
          elevation: 2,
        ),
        child: Text(
          QyAppLocalizationKeys.qyHomeStartLearning.tr(context),
          style: ThemeTextStyles.h3.copyWith(
            color: ThemeColors.surface,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

}
