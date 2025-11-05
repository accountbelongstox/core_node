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

/// Course Python 1 Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class CoursePython1ScreenAppQy extends StatefulWidget {
  const CoursePython1ScreenAppQy({super.key});

  @override
  State<CoursePython1ScreenAppQy> createState() => _CoursePython1ScreenAppQyState();
}

class _CoursePython1ScreenAppQyState extends State<CoursePython1ScreenAppQy> {
  final List<String> _categoryKeys;
  final List<Map<String, String>> _courseItems;
  int _selectedCategoryIndex;

  _CoursePython1ScreenAppQyState()
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
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyCoursePythonZoneTitle.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildCategoryList(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildHeroCard(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildCourseList(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildVipBanner(),
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
          return GestureDetector(
            onTap: () => _handleCategoryTap(index),
            child: Container(
              margin: EdgeInsets.only(right: Dimensions.spacingSmall),
              padding: EdgeInsets.symmetric(
                horizontal: Dimensions.paddingMedium,
                vertical: Dimensions.paddingSmall,
              ),
              decoration: BoxDecoration(
                color: isSelected ? ThemeColors.primary.withOpacity(0.1) : ThemeColors.surface,
                borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
                border: Border.all(
                  color: isSelected ? ThemeColors.primary : ThemeColors.border,
                ),
              ),
              child: Text(
                _categoryKeys[index].tr(context),
                style: TextStyles.body1.copyWith(
                  color: isSelected ? ThemeColors.primary : ThemeColors.textPrimary,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildHeroCard() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        border: Border.all(color: ThemeColors.border),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.06),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyCourseDigitalSkill.tr(context),
            style: TextStyles.caption.copyWith(
              color: ThemeColors.primary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyCoursePythonPathTitle.tr(context),
            style: TextStyles.h2.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingXSmall),
          Text(
            QyAppLocalizationKeys.qyCoursePythonPathDescription.tr(context),
            style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
          ),
        ],
      ),
    );
  }

  Widget _buildCourseList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: _courseItems.map((course) {
        return Container(
          margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            border: Border.all(color: ThemeColors.border),
            boxShadow: [
              BoxShadow(
                color: ThemeColors.shadow.withOpacity(0.05),
                blurRadius: 6,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: Dimensions.paddingSmall,
                      vertical: Dimensions.paddingSizeExtraSmall,
                    ),
                    decoration: BoxDecoration(
                      color: ThemeColors.primary.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
                    ),
                    child: Text(
                      (course['badgeKey'] ?? '').tr(context),
                      style: TextStyles.caption.copyWith(color: ThemeColors.primary),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    course['price'] ?? '',
                    style: TextStyles.body1.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              SizedBox(height: Dimensions.spacingSmall),
              Text(
                (course['titleKey'] ?? '').tr(context),
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              SizedBox(height: Dimensions.spacingXSmall),
              Text(
                (course['subtitleKey'] ?? '').tr(context),
                style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
              ),
              SizedBox(height: Dimensions.spacingSmall),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingSmall,
                  vertical: Dimensions.paddingSizeExtraSmall,
                ),
                decoration: BoxDecoration(
                  color: ThemeColors.success.withOpacity(0.08),
                  borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
                ),
                child: Text(
                  (course['tagKey'] ?? '').tr(context),
                  style: TextStyles.caption.copyWith(color: ThemeColors.success),
                ),
              ),
              SizedBox(height: Dimensions.spacingMedium),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton.icon(
                  onPressed: () => _handleCourseTap(course),
                  icon: const Icon(Icons.play_circle_outline),
                  label: Text(QyAppLocalizationKeys.qyCoursePlanActionStart.tr(context)),
                  style: TextButton.styleFrom(
                    foregroundColor: ThemeColors.primary,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildVipBanner() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF3E2B85), Color(0xFF7755FF)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.2),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyCourseExperienceZoneTitle.tr(context),
            style: TextStyles.caption.copyWith(
              color: Colors.white70,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyCourseVipExperienceSubtitle.tr(context),
            style: TextStyles.body1.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingXSmall),
          Text(
            QyAppLocalizationKeys.qyCourseVipCoverage.tr(context),
            style: TextStyles.caption.copyWith(color: Colors.white70),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _handleVipTap,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: ThemeColors.primary,
                padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
              ),
              child: Text(QyAppLocalizationKeys.qyCourseVipCta.tr(context)),
            ),
          ),
        ],
      ),
    );
  }
}
