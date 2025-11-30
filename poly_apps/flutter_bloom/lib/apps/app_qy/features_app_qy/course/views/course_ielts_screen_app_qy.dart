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

/// Course Ielts Screen for QY App
library;

import 'package:flutter/material.dart';
import '../../../../../../common/theme/base/theme_colors.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';

class CourseIeltsScreenAppQy extends StatefulWidget {
  const CourseIeltsScreenAppQy({super.key});

  @override
  State<CourseIeltsScreenAppQy> createState() => _CourseIeltsScreenAppQyState();
}

class _CourseIeltsScreenAppQyState extends State<CourseIeltsScreenAppQy>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final List<String> _tabs;

  _CourseIeltsScreenAppQyState()
      : _tabs = ['精选', '雅思', '高考', '初中/中考', '四六级'];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
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
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          indicatorColor: ThemeColors.primary,
          labelColor: ThemeColors.primary,
          unselectedLabelColor: ThemeColors.textSecondary,
          labelStyle: TextStyles.button,
          tabs: _tabs.map((tab) => Tab(text: tab)).toList(),
        ),
      ),
      body: SafeArea(
        child: TabBarView(
          controller: _tabController,
          children: _tabs.map((tab) => _buildTabContent(tab)).toList(),
        ),
      ),
    );
  }

  Widget _buildTabContent(String tab) {
    return SingleChildScrollView(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildDailyUpdateHeader(),
          SizedBox(height: Dimensions.spacingMedium),
          _buildCourseCard(
            '揭秘世界上最危险的披萨，活火山限定！',
            'The World\'s Most Dangerous Pizza',
            '02:51',
            '中阶（四级）',
          ),
          SizedBox(height: Dimensions.spacingMedium),
          _buildCourseCard(
            '苏超决赛，泰州战胜南通夺冠',
            'Taizhou stuns Nantong to win maid...',
            '02:32',
            '初阶 • 1152词',
          ),
          SizedBox(height: Dimensions.spacingMedium),
          _buildLearningPlansSection(),
        ],
      ),
    );
  }

  Widget _buildDailyUpdateHeader() {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingSmall),
      decoration: BoxDecoration(
        color: ThemeColors.primary.withOpacity(0.1),
        borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
      ),
      child: Row(
        children: [
          Icon(Icons.schedule, color: ThemeColors.primary, size: 20),
          SizedBox(width: Dimensions.spacingSmall),
          Text(
            '今日精选 每天6:00更新',
            style: TextStyles.caption.copyWith(color: ThemeColors.primary),
          ),
        ],
      ),
    );
  }

  Widget _buildCourseCard(
    String title,
    String subtitle,
    String duration,
    String level,
  ) {
    return Container(
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
                padding: EdgeInsets.all(Dimensions.paddingSmall),
                decoration: BoxDecoration(
                  color: ThemeColors.primary.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                ),
                child: Icon(
                  Icons.play_circle_outline,
                  color: ThemeColors.primary,
                  size: 24,
                ),
              ),
              SizedBox(width: Dimensions.spacingSmall),
              Text(
                duration,
                style: TextStyles.caption.copyWith(
                  color: ThemeColors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const Spacer(),
              Container(
                padding: EdgeInsets.symmetric(
                  horizontal: Dimensions.paddingSmall,
                  vertical: Dimensions.paddingXSmall,
                ),
                decoration: BoxDecoration(
                  color: ThemeColors.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
                ),
                child: Text(
                  level,
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.success,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: Dimensions.spacingMedium),
          Text(
            title,
            style: TextStyles.body1.copyWith(
              color: ThemeColors.textPrimary,
              fontWeight: FontWeight.w600,
            ),
          ),
          SizedBox(height: Dimensions.spacingXSmall),
          Text(
            subtitle,
            style: TextStyles.body2.copyWith(
              color: ThemeColors.textSecondary,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLearningPlansSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          '专属学习计划',
          style: TextStyles.h4.copyWith(
            color: ThemeColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
        ),
        SizedBox(height: Dimensions.spacingSmall),
        _buildLearningPlanCard('单句特训-雅思听力500...', '9天', '高阶'),
        SizedBox(height: Dimensions.spacingSmall),
        _buildLearningPlanCard('阅读计划-基础•英语突破', '30天', '初阶'),
      ],
    );
  }

  Widget _buildLearningPlanCard(String title, String duration, String level) {
    return Container(
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.primary.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          Container(
            padding: EdgeInsets.all(Dimensions.paddingSmall),
            decoration: BoxDecoration(
              color: ThemeColors.primary.withOpacity(0.1),
              borderRadius: BorderRadius.circular(Dimensions.radiusSmall),
            ),
            child: Icon(Icons.event_note, color: ThemeColors.primary, size: 20),
          ),
          SizedBox(width: Dimensions.spacingMedium),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: TextStyles.body2.copyWith(
                    color: ThemeColors.textPrimary,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(height: Dimensions.spacingXSmall),
                Text(
                  '$duration • $level',
                  style: TextStyles.caption.copyWith(
                    color: ThemeColors.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            Icons.arrow_forward_ios,
            color: ThemeColors.textTertiary,
            size: 16,
          ),
        ],
      ),
    );
  }
}
