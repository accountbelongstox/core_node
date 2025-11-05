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

/// Course Plans Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class CoursePlansScreenAppQy extends StatefulWidget {
  const CoursePlansScreenAppQy({super.key});

  @override
  State<CoursePlansScreenAppQy> createState() => _CoursePlansScreenAppQyState();
}

class _CoursePlansScreenAppQyState extends State<CoursePlansScreenAppQy> {
  final List<String> _categoryKeys;
  final Map<String, String> _allSkillPlan;
  final List<Map<String, String>> _focusPlans;
  final Map<String, String> _textbookPlan;
  int _selectedCategoryIndex;

  _CoursePlansScreenAppQyState()
      : _categoryKeys = [
          QyAppLocalizationKeys.qyCoursePlanCategoryIelts,
          QyAppLocalizationKeys.qyCoursePlanCategoryGaokao,
          QyAppLocalizationKeys.qyCoursePlanCategoryMiddle,
          QyAppLocalizationKeys.qyCourseCategoryCet,
          QyAppLocalizationKeys.qyCourseCategoryPostgraduate,
        ],
        _allSkillPlan = {
          'tagline': QyAppLocalizationKeys.qyCoursePlanAllSkillTagline,
          'description': QyAppLocalizationKeys.qyCoursePlanAllSkillDescription,
        },
        _focusPlans = [
          {
            'section': QyAppLocalizationKeys.qyCoursePlanClassicTitle,
            'name': QyAppLocalizationKeys.qyCoursePlanClassicName,
            'stats': QyAppLocalizationKeys.qyCoursePlanClassicStats,
          },
          {
            'section': QyAppLocalizationKeys.qyCoursePlanOralTitle,
            'name': QyAppLocalizationKeys.qyCoursePlanOralName,
            'stats': QyAppLocalizationKeys.qyCoursePlanOralStats,
          },
        ],
        _textbookPlan = {
          'tag': QyAppLocalizationKeys.qyCoursePlanTextbookSync,
          'title': QyAppLocalizationKeys.qyCoursePlanTextbookTitle,
          'brand': QyAppLocalizationKeys.qyCoursePlanReadingBrand,
          'subtitle': QyAppLocalizationKeys.qyCoursePlanFurtherStudy,
          'grade': QyAppLocalizationKeys.qyCoursePlanTextbookGrade,
        },
        _selectedCategoryIndex = 0;

  void _handleCategoryTap(int index) {
    setState(() {
      _selectedCategoryIndex = index;
    });
  }

  void _handlePlanTap(String titleKey) {
    final title = titleKey.tr(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyCourseOpening.tr(context)} $title',
        ),
      ),
    );
  }

  void _handleViewMore() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyCoursePlanMoreComing.tr(context)),
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
              _buildCategoryList(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildAllSkillCard(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildFocusPlans(),
              SizedBox(height: Dimensions.spacingLarge),
              _buildReadingSection(),
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

  Widget _buildAllSkillCard() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1B3B8B), Color(0xFF425FC7)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.18),
            blurRadius: 16,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _allSkillPlan['tagline']!.tr(context),
            style: TextStyles.h2.copyWith(
              color: Colors.white,
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: Dimensions.spacingSmall),
          Text(
            _allSkillPlan['description']!.tr(context),
            style: TextStyles.body1.copyWith(color: Colors.white70),
          ),
          SizedBox(height: Dimensions.spacingLarge),
          Row(
            children: [
              Icon(Icons.schedule, color: Colors.white70, size: 18),
              SizedBox(width: Dimensions.spacingXSmall),
              Text(
                QyAppLocalizationKeys.qyCoursePlanClassicStats.tr(context),
                style: TextStyles.caption.copyWith(color: Colors.white70),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () => _handlePlanTap(_allSkillPlan['tagline']!),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: ThemeColors.primary,
                padding: EdgeInsets.symmetric(vertical: Dimensions.paddingSmall),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                ),
              ),
              child: Text(QyAppLocalizationKeys.qyCoursePlanActionStart.tr(context)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFocusPlans() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: _focusPlans.map((plan) {
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
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    plan['section']!.tr(context),
                    style: TextStyles.subtitle1.copyWith(
                      color: ThemeColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    plan['stats']!.tr(context),
                    style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
                  ),
                ],
              ),
              SizedBox(height: Dimensions.spacingSmall),
              Text(
                plan['name']!.tr(context),
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              SizedBox(height: Dimensions.spacingMedium),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => _handlePlanTap(plan['name']!),
                  child: Text(
                    QyAppLocalizationKeys.qyCoursePlanActionExperience.tr(context),
                    style: TextStyles.button.copyWith(color: ThemeColors.primary),
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  Widget _buildReadingSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              QyAppLocalizationKeys.qyCoursePlanReadingTitle.tr(context),
              style: TextStyles.subtitle1.copyWith(
                color: ThemeColors.textPrimary,
                fontWeight: FontWeight.w600,
              ),
            ),
            TextButton(
              onPressed: _handleViewMore,
              child: Text(
                QyAppLocalizationKeys.qyCoursePlanViewMore.tr(context),
                style: TextStyles.button.copyWith(color: ThemeColors.primary),
              ),
            ),
          ],
        ),
        SizedBox(height: Dimensions.spacingSmall),
        Container(
          width: double.infinity,
          padding: EdgeInsets.all(Dimensions.paddingMedium),
          decoration: BoxDecoration(
            color: ThemeColors.surface,
            borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
            border: Border.all(color: ThemeColors.border),
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
                  color: ThemeColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
                ),
                child: Text(
                  _textbookPlan['tag']!.tr(context),
                  style: TextStyles.caption.copyWith(color: ThemeColors.primary),
                ),
              ),
              SizedBox(height: Dimensions.spacingSmall),
              Text(
                _textbookPlan['title']!.tr(context),
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textPrimary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              SizedBox(height: Dimensions.spacingXSmall),
              Text(
                '${_textbookPlan['brand']!.tr(context)} · ${_textbookPlan['subtitle']!.tr(context)}',
                style: TextStyles.caption.copyWith(color: ThemeColors.textSecondary),
              ),
              SizedBox(height: Dimensions.spacingMedium),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    _textbookPlan['grade']!.tr(context),
                    style: TextStyles.caption.copyWith(color: ThemeColors.textTertiary),
                  ),
                  TextButton(
                    onPressed: () => _handlePlanTap(_textbookPlan['title']!),
                    child: Text(
                      QyAppLocalizationKeys.qyCoursePlanActionDetails.tr(context),
                      style: TextStyles.button.copyWith(color: ThemeColors.primary),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildVipBanner() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF35325F), Color(0xFF5A51D9)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.shadow.withOpacity(0.18),
            blurRadius: 18,
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
