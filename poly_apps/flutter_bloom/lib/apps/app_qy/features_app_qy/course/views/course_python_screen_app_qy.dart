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

/// Course Python Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class CoursePythonScreenAppQy extends StatefulWidget {
  const CoursePythonScreenAppQy({super.key});

  @override
  State<CoursePythonScreenAppQy> createState() => _CoursePythonScreenAppQyState();
}

class _CoursePythonScreenAppQyState extends State<CoursePythonScreenAppQy> {
  final List<String> _categoryKeys;
  final List<Map<String, String>> _focusTagKeys;
  final List<String> _membershipBenefitKeys;
  final List<Map<String, String>> _coursePlanKeys;
  int _selectedCategoryIndex;

  _CoursePythonScreenAppQyState()
      : _categoryKeys = [
          QyAppLocalizationKeys.qyCourseCategoryCet,
          QyAppLocalizationKeys.qyCourseCategoryPostgraduate,
          QyAppLocalizationKeys.qyCourseCategoryOral,
          QyAppLocalizationKeys.qyCourseCategoryPython,
          QyAppLocalizationKeys.qyCourseCategoryReading,
        ],
        _focusTagKeys = [
          {
            'titleKey': QyAppLocalizationKeys.qyCourseFocusEfficientTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCourseFocusEfficientSubtitle,
          },
          {
            'titleKey': QyAppLocalizationKeys.qyCourseFocusDailyTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCourseFocusDailySubtitle,
          },
          {
            'titleKey': QyAppLocalizationKeys.qyCourseFocusCareerTitle,
            'subtitleKey': QyAppLocalizationKeys.qyCourseFocusCareerSubtitle,
          },
        ],
        _membershipBenefitKeys = [
          QyAppLocalizationKeys.qyCourseVipBenefit1,
          QyAppLocalizationKeys.qyCourseVipBenefit2,
          QyAppLocalizationKeys.qyCourseVipBenefit3,
        ],
        _coursePlanKeys = [
          {
            'titleKey': QyAppLocalizationKeys.qyCoursePlanTitleCareerUpgrade,
            'descriptionKey': QyAppLocalizationKeys.qyCoursePlanDescriptionCareerUpgrade,
            'badgeKey': QyAppLocalizationKeys.qyCoursePlanBadgeAdvanced,
            'durationKey': QyAppLocalizationKeys.qyCoursePlanDuration12Weeks,
          },
          {
            'titleKey': QyAppLocalizationKeys.qyCoursePlanTitleBusinessCommunication,
            'descriptionKey': QyAppLocalizationKeys.qyCoursePlanDescriptionBusinessCommunication,
            'badgeKey': QyAppLocalizationKeys.qyCoursePlanBadgeFlagship,
            'durationKey': QyAppLocalizationKeys.qyCoursePlanDuration24Lessons,
          },
        ],
        _selectedCategoryIndex = 3;

  void _handleCategoryTap(int index) {
    setState(() {
      _selectedCategoryIndex = index;
    });
  }

  void _handleMembershipAction() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyCourseVipSnackbar.tr(context)),
      ),
    );
  }

  void _handleCoursePlanTap(Map<String, String> plan) {
    final title = (plan['titleKey'] ?? '').tr(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyCourseOpening.tr(context)} $title',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyCoursesTitle.tr(context),
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
              _buildCategoryChips(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildFocusRow(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildMembershipCard(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildCoursePlans(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCategoryChips() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCourseHotCategoriesTitle.tr(context),
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        SingleChildScrollView(
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
        ),
      ],
    );
  }

  Widget _buildFocusRow() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCourseLearningFocusTitle.tr(context),
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Row(
          children: _focusTagKeys.map((tag) {
            return Expanded(
              child: Container(
                margin: EdgeInsets.only(
                  right: tag == _focusTagKeys.last ? 0 : Dimensions.spacingSmall,
                ),
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
                      (tag['titleKey'] ?? '').tr(context),
                      style: TextStyles.body1.copyWith(
                        color: ThemeColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    SizedBox(height: Dimensions.spacingXSmall),
                    Text(
                      (tag['subtitleKey'] ?? '').tr(context),
                      style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
                    ),
                  ],
                ),
              ),
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildMembershipCard() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1D1D3B), Color(0xFF3F3C97)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.2),
            blurRadius: 18,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: EdgeInsets.symmetric(
              horizontal: Dimensions.paddingSmall,
              vertical: Dimensions.paddingSizeExtraSmall,
            ),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.12),
              borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
            ),
            child: Text(
              QyAppLocalizationKeys.qyCourseVipLabel.tr(context),
              style: TextStyles.caption.copyWith(color: Colors.white),
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyCourseVipHeadline.tr(context),
            style: TextStyles.h2.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            QyAppLocalizationKeys.qyCourseVipSubhead.tr(context),
            style: TextStyles.body1.copyWith(color: Colors.white70),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: _membershipBenefitKeys.map((benefitKey) {
              return Padding(
                padding: EdgeInsets.only(bottom: Dimensions.spacingXSmall),
                child: Row(
                  children: [
                    Icon(Icons.check_circle, color: Colors.amberAccent, size: 18),
                    SizedBox(width: Dimensions.spacingXSmall),
                    Expanded(
                      child: Text(
                        benefitKey.tr(context),
                        style: TextStyles.caption.copyWith(color: Colors.white70),
                      ),
                    ),
                  ],
                ),
              );
            }).toList(),
          ),
          SizedBox(height: Dimensions.spacingMedium),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: ThemeColors.primary,
                padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
              ),
              onPressed: _handleMembershipAction,
              child: Text(
                QyAppLocalizationKeys.qyCourseVipCta.tr(context),
                style: TextStyles.button.copyWith(color: ThemeColors.primary),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCoursePlans() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyCoursesFeatured.tr(context),
          style: TextStyles.subtitle1.copyWith(color: ThemeColors.textSecondary),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Column(
          children: _coursePlanKeys.map((plan) {
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
                    blurRadius: 4,
                    offset: const Offset(0, 2),
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
                        (plan['badgeKey'] ?? '').tr(context),
                        style: TextStyles.caption.copyWith(color: ThemeColors.primary),
                      ),
                    ),
                    const Spacer(),
                    Icon(Icons.timer, color: ThemeColors.textTertiary, size: 18),
                    SizedBox(width: Dimensions.spacingXSmall),
                    Text(
                      (plan['durationKey'] ?? '').tr(context),
                      style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
                    ),
                  ],
                ),
                SizedBox(height: Dimensions.spacingSmall),
                Text(
                  (plan['titleKey'] ?? '').tr(context),
                  style: TextStyles.body1.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  (plan['descriptionKey'] ?? '').tr(context),
                  style: TextStyles.body2.copyWith(color: ThemeColors.textSecondary),
                ),
                SizedBox(height: Dimensions.spacingMedium),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Icon(Icons.play_arrow, color: ThemeColors.primary, size: 20),
                          SizedBox(width: Dimensions.spacingXSmall),
                          Text(
                            QyAppLocalizationKeys.qyCoursePlanActionExperience.tr(context),
                            style: TextStyles.caption.copyWith(color: ThemeColors.primary),
                          ),
                        ],
                      ),
                      OutlinedButton(
                        onPressed: () => _handleCoursePlanTap(plan),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: ThemeColors.primary,
                          side: BorderSide(color: ThemeColors.primary),
                        ),
                        child: Text(QyAppLocalizationKeys.qyCoursePlanActionDetails.tr(context)),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }).toList(),
        ),
      ],
    );
  }
}
