// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
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
import '../controllers/course_controller_app_qy.dart';
import '../domain/model/course_model.dart';

class CoursePlansScreenRefactoredAppQy extends StatefulWidget {
  const CoursePlansScreenRefactoredAppQy({super.key});

  @override
  State<CoursePlansScreenRefactoredAppQy> createState() =>
      _CoursePlansScreenRefactoredAppQyState();
}

class _CoursePlansScreenRefactoredAppQyState
    extends State<CoursePlansScreenRefactoredAppQy> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<CourseControllerAppQy>().loadCoursePlans();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyLearningPlans.tr(context),
          style: TextStyles.h3.copyWith(color: ThemeColors.textPrimary),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
        leading: IconButton(
          onPressed: () => Navigator.pop(context),
          icon: Icon(Icons.arrow_back, color: ThemeColors.textPrimary),
        ),
      ),
      body: Consumer<CourseControllerAppQy>(
        builder: (context, controller, child) {
          if (controller.isLoading && controller.coursePlans.isEmpty) {
            return Center(
              child: CircularProgressIndicator(color: ThemeColors.primary),
            );
          }

          return RefreshIndicator(
            onRefresh: controller.loadCoursePlans,
            color: ThemeColors.primary,
            child: ListView(
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              children: [
                _buildHeaderCard(),
                SizedBox(height: Dimensions.spacingLarge),
                _buildPlansSection(controller),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildHeaderCard() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingLarge),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            ThemeColors.primary,
            ThemeColors.primary.withOpacity(0.8),
          ],
        ),
        borderRadius: BorderRadius.circular(Dimensions.radiusLarge),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.primary.withOpacity(0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                Icons.explore,
                size: 40,
                color: ThemeColors.surface,
              ),
              SizedBox(width: Dimensions.spacingMedium),
              Expanded(
                child: Text(
                  QyAppLocalizationKeys.qyDiscoverPerfectPlan.tr(context),
                  style: TextStyles.h3.copyWith(
                    color: ThemeColors.surface,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            QyAppLocalizationKeys.qyPlanDescription.tr(context),
            style: TextStyles.body1.copyWith(
              color: ThemeColors.surface.withOpacity(0.9),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlansSection(CourseControllerAppQy controller) {
    final plans = controller.coursePlans;

    if (plans.isEmpty) {
      return Center(
        child: Padding(
          padding: EdgeInsets.all(Dimensions.paddingLarge),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.assignment_outlined,
                size: 80,
                color: ThemeColors.textTertiary.withOpacity(0.5),
              ),
              SizedBox(height: Dimensions.spacingMedium),
              Text(
                QyAppLocalizationKeys.qyNoPlans.tr(context),
                style: TextStyles.body1.copyWith(
                  color: ThemeColors.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyAllPlans.tr(context),
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        ...plans.map((plan) => _buildPlanCard(plan, controller)),
      ],
    );
  }

  Widget _buildPlanCard(CoursePlanModel plan, CourseControllerAppQy controller) {
    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
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
          Container(
            padding: EdgeInsets.all(Dimensions.paddingMedium),
            decoration: BoxDecoration(
              color: _getCategoryColor(plan.category).withOpacity(0.1),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(Dimensions.radiusMedium),
                topRight: Radius.circular(Dimensions.radiusMedium),
              ),
            ),
            child: Row(
              children: [
                Container(
                  padding: EdgeInsets.all(Dimensions.paddingSmall),
                  decoration: BoxDecoration(
                    color: _getCategoryColor(plan.category),
                    borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                  ),
                  child: Icon(
                    _getCategoryIcon(plan.category),
                    color: ThemeColors.surface,
                    size: 24,
                  ),
                ),
                SizedBox(width: Dimensions.spacingMedium),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        plan.title,
                        style: TextStyles.body1.copyWith(
                          color: ThemeColors.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      if (plan.subtitle != null) ...[
                        SizedBox(height: Dimensions.spacingXSmall),
                        Text(
                          plan.subtitle!,
                          style: TextStyles.caption.copyWith(
                            color: ThemeColors.textSecondary,
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(Dimensions.paddingMedium),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plan.description,
                  style: TextStyles.body2.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
                SizedBox(height: Dimensions.spacingMedium),
                Row(
                  children: [
                    _buildInfoChip(
                      Icons.event,
                      '${plan.totalDays} ${QyAppLocalizationKeys.qyDays.tr(context)}',
                    ),
                    SizedBox(width: Dimensions.spacingSmall),
                    _buildInfoChip(
                      Icons.people,
                      '${plan.participants}',
                    ),
                    SizedBox(width: Dimensions.spacingSmall),
                    Container(
                      padding: EdgeInsets.symmetric(
                        horizontal: Dimensions.paddingSmall,
                        vertical: Dimensions.paddingXSmall,
                      ),
                      decoration: BoxDecoration(
                        color: _getCategoryColor(plan.category).withOpacity(0.2),
                        borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                      ),
                      child: Text(
                        plan.category,
                        style: TextStyles.caption.copyWith(
                          color: _getCategoryColor(plan.category),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(height: Dimensions.spacingMedium),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(
                            '${QyAppLocalizationKeys.qyJoined.tr(context)} "${plan.title}"',
                          ),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ThemeColors.primary,
                      padding: EdgeInsets.symmetric(
                        vertical: Dimensions.paddingMedium,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
                      ),
                    ),
                    child: Text(
                      QyAppLocalizationKeys.qyJoinPlan.tr(context),
                      style: TextStyles.button.copyWith(
                        color: ThemeColors.surface,
                        fontWeight: FontWeight.bold,
                      ),
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

  Widget _buildInfoChip(IconData icon, String text) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: Dimensions.paddingSmall,
        vertical: Dimensions.paddingXSmall,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.background,
        borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: ThemeColors.textSecondary),
          SizedBox(width: Dimensions.spacingXSmall),
          Text(
            text,
            style: TextStyles.caption.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Color _getCategoryColor(String category) {
    switch (category.toLowerCase()) {
      case 'ielts':
        return Colors.blue;
      case 'toefl':
        return Colors.green;
      case 'cet':
        return Colors.orange;
      case 'business':
        return Colors.purple;
      case 'daily':
        return Colors.teal;
      default:
        return ThemeColors.primary;
    }
  }

  IconData _getCategoryIcon(String category) {
    switch (category.toLowerCase()) {
      case 'ielts':
      case 'toefl':
        return Icons.school;
      case 'cet':
        return Icons.assignment;
      case 'business':
        return Icons.business_center;
      case 'daily':
        return Icons.chat;
      default:
        return Icons.book;
    }
  }
}
