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

/// Course Python 1 Screen for QY App - Refactored with centralized theme and common components
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/buttons/primary_button.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';

class CoursePython1ScreenRefactoredAppQy extends StatefulWidget {
  const CoursePython1ScreenRefactoredAppQy({super.key});

  @override
  State<CoursePython1ScreenRefactoredAppQy> createState() =>
      _CoursePython1ScreenRefactoredAppQyState();
}

class _CoursePython1ScreenRefactoredAppQyState
    extends State<CoursePython1ScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final List<String> _categoryKeys;
  final List<Map<String, String>> _courseItems;
  int _selectedCategoryIndex;

  _CoursePython1ScreenRefactoredAppQyState()
      : _categoryKeys = [
          QyAppLocalizationKeys.qyCourseCategoryPostgraduate,
          QyAppLocalizationKeys.qyCourseCategoryOral,
          QyAppLocalizationKeys.qyCourseCategoryPython,
          QyAppLocalizationKeys.qyCourseCategoryReading,
          QyAppLocalizationKeys.qyCourseCategoryCollege,
        ],
        _courseItems = [
          {
            'titleKey': QyAppLocalizationKeys.qyCoursePythonIntroTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCoursePythonIntroSubtitle,
            'price': '¥298',
            'tagKey': QyAppLocalizationKeys.qyCourseVipFreeTag,
            'badgeKey': QyAppLocalizationKeys.qyCourseBadgeIntro,
          },
          {
            'titleKey': QyAppLocalizationKeys.qyCoursePythonAdvanceTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCoursePythonAdvanceSubtitle,
            'price': '¥199',
            'tagKey': QyAppLocalizationKeys.qyCourseVipFreeTag,
            'badgeKey': QyAppLocalizationKeys.qyCourseBadgeIntermediate,
          },
          {
            'titleKey': QyAppLocalizationKeys.qyCoursePythonDataTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCoursePythonDataSubtitle,
            'price': '¥198',
            'tagKey': QyAppLocalizationKeys.qyCourseVipFreeTag,
            'badgeKey': QyAppLocalizationKeys.qyCourseBadgePopular,
          },
          {
            'titleKey': QyAppLocalizationKeys.qyCoursePythonCasesTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCoursePythonCasesSubtitle,
            'price': '¥188',
            'tagKey': QyAppLocalizationKeys.qyCourseVipFreeTag,
            'badgeKey': QyAppLocalizationKeys.qyCourseBadgePractical,
          },
        ],
        _selectedCategoryIndex = 2;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  void _handleCategoryTap(int index) {
    setState(() {
      _selectedCategoryIndex = index;
    });
  }

  void _handleCourseTap(Map<String, String> course) {
    final title = (course['titleKey'] ?? '').tr(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyCourseOpening.tr(context)} $title',
        ),
      ),
    );
  }

  void _handleVipTap() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyCourseVipSnackbar.tr(context)),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.all(ThemeDimensions.spacing16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        _buildCategoryList(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildHeroCard(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildBentoBoxCourseGrid(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildVipBanner(),
                      ],
                    ),
                  ),
                ),
              ],
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
            gradient:
                ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
          ),
        );
      },
    );
  }

  Widget _buildHeader() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: Colors.white.withOpacity(0.2),
                width: 1,
              ),
            ),
          ),
          child: Row(
            children: [
              IconButton(
                icon: Icon(Icons.arrow_back, color: ColorsAppQy.qyTextPrimary),
                onPressed: () => context.pop(),
              ),
              const SizedBox(width: ThemeDimensions.spacing8),
              Expanded(
                child: Text(
                  QyAppLocalizationKeys.qyCoursePythonZoneTitle.tr(context),
                  style: ThemeTextStyles.title1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
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

  Widget _buildCategoryList() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(_categoryKeys.length, (index) {
          final bool isSelected = _selectedCategoryIndex == index;
          return Padding(
            padding: const EdgeInsets.only(right: ThemeDimensions.spacing12),
            child: GestureDetector(
              onTap: () => _handleCategoryTap(index),
              child: GlassmorphismCard(
                borderRadius: ThemeDimensions.radiusFull,
                blur: 10,
                opacity: isSelected ? 0.3 : 0.15,
                padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacing16,
                  vertical: ThemeDimensions.spacing8,
                ),
                child: Container(
                  decoration: isSelected
                      ? BoxDecoration(
                          gradient: ColorsAppQy.qyPrimaryGradient,
                          borderRadius:
                              BorderRadius.circular(ThemeDimensions.radiusFull),
                        )
                      : null,
                  child: Text(
                    _categoryKeys[index].tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color:
                          isSelected ? Colors.white : ColorsAppQy.qyTextPrimary,
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.normal,
                    ),
                  ),
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildHeroCard() {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.25,
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Container(
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyPrimaryGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        ),
        padding: const EdgeInsets.all(ThemeDimensions.spacing24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              QyAppLocalizationKeys.qyCourseDigitalSkill.tr(context),
              style: ThemeTextStyles.caption.copyWith(
                color: Colors.white70,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Text(
              QyAppLocalizationKeys.qyCoursePythonPathTitle.tr(context),
              style: ThemeTextStyles.title1.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing8),
            Text(
              QyAppLocalizationKeys.qyCoursePythonPathDescription.tr(context),
              style: ThemeTextStyles.body2.copyWith(color: Colors.white70),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoBoxCourseGrid() {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: ThemeDimensions.spacing16,
        mainAxisSpacing: ThemeDimensions.spacing16,
        childAspectRatio: 0.85,
      ),
      itemCount: _courseItems.length,
      itemBuilder: (context, index) {
        final course = _courseItems[index];
        return _buildBentoCourseCard(course);
      },
    );
  }

  Widget _buildBentoCourseCard(Map<String, String> course) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: InkWell(
        onTap: () => _handleCourseTap(course),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.spacing8,
                      vertical: ThemeDimensions.spacing4,
                    ),
                    decoration: BoxDecoration(
                      gradient: ColorsAppQy.qySecondaryGradient,
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.radiusMedium),
                    ),
                    child: Text(
                      (course['badgeKey'] ?? '').tr(context),
                      style: ThemeTextStyles.caption.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    (course['titleKey'] ?? '').tr(context),
                    style: ThemeTextStyles.body1.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    (course['subtitleKey'] ?? '').tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.spacing8,
                    vertical: ThemeDimensions.spacing4,
                  ),
                  decoration: BoxDecoration(
                    color: ColorsAppQy.qySuccess.withOpacity(0.1),
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusMedium),
                  ),
                  child: Text(
                    (course['tagKey'] ?? '').tr(context),
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qySuccess,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                Text(
                  course['price'] ?? '',
                  style: ThemeTextStyles.body1.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildVipBanner() {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 20,
      opacity: 0.3,
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Container(
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyAccentGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        ),
        padding: const EdgeInsets.all(ThemeDimensions.spacing24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              QyAppLocalizationKeys.qyCourseExperienceZoneTitle.tr(context),
              style: ThemeTextStyles.caption.copyWith(
                color: Colors.white70,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Text(
              QyAppLocalizationKeys.qyCourseVipExperienceSubtitle.tr(context),
              style: ThemeTextStyles.title2.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing8),
            Text(
              QyAppLocalizationKeys.qyCourseVipCoverage.tr(context),
              style: ThemeTextStyles.body2.copyWith(color: Colors.white70),
            ),
            const SizedBox(height: ThemeDimensions.spacing20),
            SizedBox(
              width: double.infinity,
              child: PrimaryButton(
                text: QyAppLocalizationKeys.qyCourseVipCta.tr(context),
                onPressed: _handleVipTap,
                isFullWidth: true,
                backgroundColor: Colors.white,
                foregroundColor: ColorsAppQy.qyPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
