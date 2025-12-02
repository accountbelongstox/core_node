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

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/buttons/primary_button.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../../../widgets_app_qy/bottom_navigation_app_qy.dart';
import '../controllers/learning_controller_app_qy.dart';

class HomeSearchScreenRefactoredAppQy extends StatefulWidget {
  const HomeSearchScreenRefactoredAppQy({super.key});

  @override
  State<HomeSearchScreenRefactoredAppQy> createState() =>
      _HomeSearchScreenRefactoredAppQyState();
}

class _HomeSearchScreenRefactoredAppQyState
    extends State<HomeSearchScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final StorageAppQy _storage = StorageAppQy.instance;
  final TextEditingController _searchController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    _loadLearningStatsFromStorage();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<LearningControllerAppQy>().loadLearningStats();
    });
  }

  Future<void> _loadLearningStatsFromStorage() async {
    try {
      final cachedStats = await _storage.getApp<Map<String, dynamic>>(
        '${StorageAppQy.keyUserProgress}_learning_stats',
      );
      if (cachedStats != null && mounted) {
        // Stats will be loaded by controller
      }
    } catch (e) {
      // Ignore errors
    }
  }

  @override
  void dispose() {
    _shimmerController.dispose();
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
      extendBodyBehindAppBar: true,
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Consumer<LearningControllerAppQy>(
              builder: (context, controller, child) {
                return Column(
                  children: [
                    _buildHeader(),
                    _buildSearchBar(),
                    Expanded(
                      child: controller.isLoading
                          ? Center(
                              child: CircularProgressIndicator(
                                color: ColorsAppQy.qyPrimary,
                              ),
                            )
                          : RefreshIndicator(
                              onRefresh: controller.refreshStats,
                              color: ColorsAppQy.qyPrimary,
                              child: SingleChildScrollView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.all(ThemeDimensions.spacing16),
                                child: Column(
                                  children: [
                                    _buildCheckInCard(controller.learningStats),
                                    const SizedBox(height: ThemeDimensions.spacing16),
                                    _buildWordBookCard(controller.learningStats),
                                    const SizedBox(height: ThemeDimensions.spacing16),
                                    _buildLearningStats(controller.learningStats),
                                    const SizedBox(height: ThemeDimensions.spacing24),
                                    _buildStartButton(controller),
                                  ],
                                ),
                              ),
                            ),
                    ),
                    const BottomNavigationAppQy(currentIndex: 0),
                  ],
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackgroundGradient() {
    return AnimatedBuilder(
      animation: _shimmerController,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: ColorsAppQy.qyFrostLight,
                width: 1,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                DateTime.now().hour.toString().padLeft(2, '0') +
                    ':' +
                    DateTime.now().minute.toString().padLeft(2, '0'),
                style: ThemeTextStyles.h3.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Icon(
                Icons.notifications_outlined,
                color: ColorsAppQy.qyTextPrimary,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: GlassmorphismCard(
        borderRadius: ThemeDimensions.radiusLarge,
        blur: 15,
        opacity: 0.2,
        padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
        child: Row(
          children: [
            Icon(
              Icons.search,
              color: ColorsAppQy.qyTextSecondary,
            ),
            const SizedBox(width: ThemeDimensions.spacing12),
            Expanded(
              child: TextField(
                controller: _searchController,
                style: ThemeTextStyles.body1.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                ),
                decoration: InputDecoration(
                  hintText: QyAppLocalizationKeys.qySearchPlaceholder.tr(context),
                  hintStyle: ThemeTextStyles.body1.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                  border: InputBorder.none,
                ),
                onSubmitted: (_) => _handleSearch(),
              ),
            ),
            IconButton(
              onPressed: _handleSearch,
              icon: Icon(
                Icons.mic,
                color: ColorsAppQy.qyTextSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCheckInCard(dynamic stats) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Container(
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyPrimaryGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        ),
        padding: const EdgeInsets.all(ThemeDimensions.spacing24),
        child: Column(
          children: [
            Text(
              QyAppLocalizationKeys.qyHomeCheckInDays.tr(context),
              style: ThemeTextStyles.body1.copyWith(
                color: ColorsAppQy.qyFrostWhite,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing16),
            Text(
              stats.checkInDays.toString(),
              style: ThemeTextStyles.display1.copyWith(
                color: ColorsAppQy.qyTextOnPrimary,
                fontWeight: FontWeight.bold,
                fontSize: 72,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildWordBookCard(dynamic stats) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  'COCA ${QyAppLocalizationKeys.qyCorpus.tr(context)} 20000',
                  style: ThemeTextStyles.h4.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                QyAppLocalizationKeys.qyWordBook.tr(context),
                style: ThemeTextStyles.button.copyWith(
                  color: ColorsAppQy.qyPrimary,
                ),
              ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '${QyAppLocalizationKeys.qyHomeLearned.tr(context)} ${stats.learnedPercentage}%',
                style: ThemeTextStyles.body1.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ),
              Text(
                '${stats.learnedWords}/${stats.totalWords}${QyAppLocalizationKeys.qyWords.tr(context)}',
                style: ThemeTextStyles.body1.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing12),
          ClipRRect(
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
            child: LinearProgressIndicator(
              value: stats.learnedPercentage / 100,
              minHeight: 6,
              backgroundColor: ColorsAppQy.qyFrostMedium,
              valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
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
            ColorsAppQy.qyPrimary,
          ),
        ),
        const SizedBox(width: ThemeDimensions.spacing12),
        Expanded(
          child: _buildStatCard(
            QyAppLocalizationKeys.qyHomeReviewWords.tr(context),
            '${stats.reviewWordsToday}/${stats.reviewWordsTarget}',
            ColorsAppQy.qySecondary,
          ),
        ),
      ],
    );
  }

  Widget _buildStatCard(String title, String value, Color color) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        children: [
          Text(
            title,
            style: ThemeTextStyles.body2.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: ThemeDimensions.spacing8),
          Text(
            value,
            style: ThemeTextStyles.h3.copyWith(
              color: color,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildStartButton(LearningControllerAppQy controller) {
    return PrimaryButton(
      text: QyAppLocalizationKeys.qyHomeStartLearning.tr(context),
      onPressed: controller.isLoading ? null : _handleStartLearning,
      backgroundColor: ColorsAppQy.qyPrimary,
      foregroundColor: ColorsAppQy.qyTextOnPrimary,
      isFullWidth: true,
      isLoading: controller.isLoading,
    );
  }

}
