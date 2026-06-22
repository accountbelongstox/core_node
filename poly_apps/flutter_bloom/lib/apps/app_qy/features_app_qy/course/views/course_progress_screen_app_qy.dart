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

library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../../../../common/widgets/progress/progress_indicators.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../../courses/domain/models/course_model.dart';

class CourseProgressScreenRefactoredAppQy extends StatefulWidget {
  final String courseId;

  const CourseProgressScreenRefactoredAppQy({
    super.key,
    required this.courseId,
  });

  @override
  State<CourseProgressScreenRefactoredAppQy> createState() =>
      _CourseProgressScreenRefactoredAppQyState();
}

class _CourseProgressScreenRefactoredAppQyState
    extends State<CourseProgressScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final StorageAppQy _storage = StorageAppQy.instance;
  CourseProgress? _courseProgress;
  List<CourseModule> _modules = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    _loadCourseProgress();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadCourseProgress() async {
    setState(() => _isLoading = true);
    try {
      final progressData = await _storage.getApp<Map<String, dynamic>>(
        '${StorageAppQy.keyUserProgress}_${widget.courseId}',
      );
      if (progressData != null) {
        _courseProgress = CourseProgress.fromJson(progressData);
      } else {
        _courseProgress = CourseProgress(
          id: 'progress_${widget.courseId}',
          courseId: widget.courseId,
          userId: 'current_user',
          overallProgress: 0.65,
          completedLessons: 13,
          totalLessons: 20,
          completedProjects: 1,
          totalProjects: 2,
        );
      }
      _modules = await _loadModules();
    } catch (e) {
      _courseProgress = CourseProgress(
        id: 'progress_${widget.courseId}',
        courseId: widget.courseId,
        userId: 'current_user',
        overallProgress: 0.0,
        completedLessons: 0,
        totalLessons: 0,
        completedProjects: 0,
        totalProjects: 0,
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<List<CourseModule>> _loadModules() async {
    final modulesData = await _storage.getApp<List<dynamic>>(
      '${StorageAppQy.keyUserProgress}_${widget.courseId}_modules',
    );
    if (modulesData != null) {
      return modulesData
          .map((json) => CourseModule.fromJson(json as Map<String, dynamic>))
          .toList();
    }
    return [];
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading || _courseProgress == null) {
      return Scaffold(
        body: Center(
          child: CircularProgressIndicator(
            valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
          ),
        ),
      );
    }

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
                      children: [
                        _buildOverviewCard(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildBentoBoxStats(),
                        const SizedBox(height: ThemeDimensions.spacing24),
                        _buildModulesList(),
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
            gradient: ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
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
                  QyAppLocalizationKeys.qyCourseProgress.tr(context),
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

  Widget _buildOverviewCard() {
    final progress = _courseProgress!;
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 20,
      opacity: 0.3,
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
              QyAppLocalizationKeys.qyCourseProgress.tr(context),
              style: ThemeTextStyles.title1.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing16),
            Text(
              '${QyAppLocalizationKeys.qyOverallProgress.tr(context)}: ${(progress.overallProgress * 100).toInt()}%',
              style: ThemeTextStyles.body1.copyWith(
                color: Colors.white70,
              ),
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            LabeledLinearProgress(
              value: progress.overallProgress,
              label: '',
              showPercentage: false,
              progressColor: Colors.white,
            ),
            const SizedBox(height: ThemeDimensions.spacing16),
            Text(
              '${progress.completedLessons} / ${progress.totalLessons} ${QyAppLocalizationKeys.qyLessonsCompleted.tr(context)}',
              style: ThemeTextStyles.body2.copyWith(
                color: Colors.white70,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoBoxStats() {
    final progress = _courseProgress!;
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 3,
      crossAxisSpacing: ThemeDimensions.spacing12,
      mainAxisSpacing: ThemeDimensions.spacing12,
      childAspectRatio: 1.1,
      children: [
        _buildBentoStatCard(
          Icons.check_circle,
          QyAppLocalizationKeys.qyCompleted.tr(context),
          progress.completedLessons.toString(),
          ColorsAppQy.qySuccess,
        ),
        _buildBentoStatCard(
          Icons.pending,
          QyAppLocalizationKeys.qyRemaining.tr(context),
          (progress.totalLessons - progress.completedLessons).toString(),
          ColorsAppQy.qyWarning,
        ),
        _buildBentoStatCard(
          Icons.star,
          QyAppLocalizationKeys.qyAvgScore.tr(context),
          '89%',
          ColorsAppQy.qyPrimary,
        ),
      ],
    );
  }

  Widget _buildBentoStatCard(IconData icon, String label, String value, Color color) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 32),
          const SizedBox(height: ThemeDimensions.spacing8),
          Text(
            value,
            style: ThemeTextStyles.title3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing4),
          Text(
            label,
            style: ThemeTextStyles.caption.copyWith(
              color: ColorsAppQy.qyTextSecondary,
            ),
            textAlign: TextAlign.center,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }

  Widget _buildModulesList() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          QyAppLocalizationKeys.qyChapters.tr(context),
          style: ThemeTextStyles.title2.copyWith(
            color: ColorsAppQy.qyTextPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing16),
        ...List.generate(
          _modules.length,
          (index) => Padding(
            padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing16),
            child: _buildModuleCard(_modules[index], index),
          ),
        ),
      ],
    );
  }

  Widget _buildModuleCard(CourseModule module, int index) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: module.isCompleted
                      ? ColorsAppQy.qySecondaryGradient
                      : ColorsAppQy.qyPrimaryGradient,
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                ),
                child: Center(
                  child: Text(
                    '${index + 1}',
                    style: ThemeTextStyles.title3.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: ThemeDimensions.spacing16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      module.title,
                      style: ThemeTextStyles.body1.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: ThemeDimensions.spacing4),
                    Text(
                      '${module.totalLessons} ${QyAppLocalizationKeys.qyLessons.tr(context)}',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacing12,
                  vertical: ThemeDimensions.spacing6,
                ),
                decoration: BoxDecoration(
                  gradient: module.isCompleted
                      ? ColorsAppQy.qySecondaryGradient
                      : ColorsAppQy.qyPrimaryGradient,
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                ),
                child: Text(
                  '${(module.progress * 100).toInt()}%',
                  style: ThemeTextStyles.caption.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing12),
          LabeledLinearProgress(
            value: module.progress,
            label: '',
            showPercentage: false,
            progressColor: module.isCompleted ? ColorsAppQy.qySuccess : ColorsAppQy.qyPrimary,
          ),
        ],
      ),
    );
  }
}
