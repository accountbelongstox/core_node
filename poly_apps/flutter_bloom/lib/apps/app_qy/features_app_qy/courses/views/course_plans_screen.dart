/// Course Plans screen with learning roadmap and schedules - Refactored with centralized theme and common components
library;

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import '../../../../../../common/theme/base/theme_dimensions.dart';
import '../../../../../../common/theme/base/theme_text_styles.dart';
import '../../../../../../common/localization/localization_manager.dart';
import '../../../../../../common/widgets/glassmorphism_card.dart';
import '../../../localization_app_qy/localization_keys_app_qy.dart';
import '../../../resources_app_qy/colors_app_qy.dart';
import '../../../config_app_qy/storage_app_qy.dart';
import '../../../services_app_qy/api_service_app_qy.dart';
import '../../course/domain/model/course_model.dart';
import '../../course/domain/service/course_service.dart';

class CoursePlansScreenRefactoredAppQy extends StatefulWidget {
  const CoursePlansScreenRefactoredAppQy({super.key});

  @override
  State<CoursePlansScreenRefactoredAppQy> createState() =>
      _CoursePlansScreenRefactoredAppQyState();
}

class _CoursePlansScreenRefactoredAppQyState
    extends State<CoursePlansScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;
  final StorageAppQy _storage = StorageAppQy.instance;
  late final CourseService _courseService;
  List<CoursePlanModel> _coursePlans = [];
  int _inProgressCount = 0;
  int _completedCount = 0;
  double _totalDuration = 0.0;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _courseService = CourseService(apiService: ApiServiceAppQy());
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
    _loadCoursePlans();
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  Future<void> _loadCoursePlans() async {
    setState(() => _isLoading = true);
    try {
      final cachedPlans = await _storage.getApp<List<dynamic>>(
        '${StorageAppQy.keyUserProgress}_course_plans',
      );
      if (cachedPlans != null) {
        _coursePlans = cachedPlans
            .map((json) =>
                CoursePlanModel.fromJson(json as Map<String, dynamic>))
            .toList();
      } else {
        _coursePlans = await _courseService.getCoursePlans('all');
        await _storage.setApp(
          '${StorageAppQy.keyUserProgress}_course_plans',
          _coursePlans.map((p) => p.toJson()).toList(),
        );
      }
      _calculateStats();
    } catch (e) {
      _coursePlans = await _courseService.getCoursePlans('all');
      _calculateStats();
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _calculateStats() {
    _inProgressCount = _coursePlans.where((p) => p.totalDays > 0).length;
    _completedCount = _coursePlans.length - _inProgressCount;
    _totalDuration = _coursePlans.fold(0.0, (sum, p) => sum + p.totalDays);
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
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
                _buildAppBar(),
                _buildBentoStatsHeader(),
                Expanded(
                  child: _buildBentoCoursePlans(),
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

  Widget _buildAppBar() {
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
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      QyAppLocalizationKeys.qyCoursesTitle.tr(context),
                      style: ThemeTextStyles.title1.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    Text(
                      QyAppLocalizationKeys.qyCourseLearningPath.tr(context),
                      style: ThemeTextStyles.body2.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(Icons.filter_list, color: ColorsAppQy.qyPrimary),
                onPressed: _showFilterDialog,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBentoStatsHeader() {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: GlassmorphismCard(
        borderRadius: ThemeDimensions.radiusLarge,
        blur: 20,
        opacity: 0.3,
        padding: const EdgeInsets.all(ThemeDimensions.spacing20),
        child: Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyAccentGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          ),
          padding: const EdgeInsets.all(ThemeDimensions.spacing20),
          child: Row(
            children: [
              Expanded(
                child: _buildBentoStatItem(
                  QyAppLocalizationKeys.qyCourseInProgress.tr(context),
                  '$_inProgressCount',
                  Icons.play_circle,
                ),
              ),
              Container(
                width: 1,
                height: 50,
                color: Colors.white.withOpacity(0.3),
              ),
              Expanded(
                child: _buildBentoStatItem(
                  QyAppLocalizationKeys.qyCourseCompleted.tr(context),
                  '$_completedCount',
                  Icons.check_circle,
                ),
              ),
              Container(
                width: 1,
                height: 50,
                color: Colors.white.withOpacity(0.3),
              ),
              Expanded(
                child: _buildBentoStatItem(
                  QyAppLocalizationKeys.qyCourseDuration.tr(context),
                  '${_totalDuration.toInt()}d',
                  Icons.access_time,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBentoStatItem(String label, String value, IconData icon) {
    return Column(
      children: [
        Icon(icon, color: Colors.white, size: 28),
        const SizedBox(height: ThemeDimensions.spacing8),
        Text(
          value,
          style: ThemeTextStyles.title2.copyWith(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: ThemeDimensions.spacing4),
        Text(
          label,
          style: ThemeTextStyles.caption.copyWith(
            color: Colors.white70,
          ),
          textAlign: TextAlign.center,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildBentoCoursePlans() {
    return GridView.builder(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 1,
        mainAxisSpacing: ThemeDimensions.spacing16,
        childAspectRatio: 2.2,
      ),
      itemCount: _coursePlans.length,
      itemBuilder: (context, index) {
        final plan = _coursePlans[index];
        return _buildBentoCoursePlanCard(plan, index);
      },
    );
  }

  Widget _buildBentoCoursePlanCard(CoursePlanModel plan, int index) {
    final gradients = [
      ColorsAppQy.qyPrimaryGradient,
      ColorsAppQy.qySecondaryGradient,
      ColorsAppQy.qyAccentGradient,
    ];
    final icons = [
      Icons.speed,
      Icons.business_center,
      Icons.code,
      Icons.record_voice_over,
      Icons.edit,
    ];
    final isLocked = plan.totalDays == 0;

    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing20),
      child: InkWell(
        onTap: isLocked ? _showLockedMessage : () => _openCoursePlan(plan),
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: Container(
          decoration: BoxDecoration(
            gradient: gradients[index % gradients.length],
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          ),
          padding: const EdgeInsets.all(ThemeDimensions.spacing20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 56,
                    height: 56,
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.25),
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.radiusMedium),
                    ),
                    child: Icon(
                      icons[index % icons.length],
                      color: Colors.white,
                      size: 28,
                    ),
                  ),
                  const SizedBox(width: ThemeDimensions.spacing16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          plan.title,
                          style: ThemeTextStyles.title3.copyWith(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: ThemeDimensions.spacing4),
                        Text(
                          plan.subtitle,
                          style: ThemeTextStyles.body2.copyWith(
                            color: Colors.white70,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  if (isLocked)
                    Icon(Icons.lock, color: Colors.white70, size: 24)
                  else
                    Icon(Icons.play_circle, color: Colors.white, size: 28),
                ],
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              Row(
                children: [
                  Icon(Icons.schedule, color: Colors.white70, size: 18),
                  const SizedBox(width: ThemeDimensions.spacing4),
                  Text(
                    '${plan.totalDays} ${QyAppLocalizationKeys.qyDays.tr(context)}',
                    style: ThemeTextStyles.body2.copyWith(
                      color: Colors.white70,
                    ),
                  ),
                  const SizedBox(width: ThemeDimensions.spacing16),
                  Icon(Icons.people, color: Colors.white70, size: 18),
                  const SizedBox(width: ThemeDimensions.spacing4),
                  Text(
                    '${plan.participants}',
                    style: ThemeTextStyles.body2.copyWith(
                      color: Colors.white70,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _openCoursePlan(CoursePlanModel plan) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          '${QyAppLocalizationKeys.qyCourseStart.tr(context)}: ${plan.title}',
        ),
        backgroundColor: ColorsAppQy.qyPrimary,
      ),
    );
  }

  void _showLockedMessage() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(QyAppLocalizationKeys.qyCourseLocked.tr(context)),
        backgroundColor: ColorsAppQy.qyWarning,
      ),
    );
  }

  void _showFilterDialog() {
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: GlassmorphismCard(
          borderRadius: ThemeDimensions.radiusLarge,
          blur: 20,
          opacity: 0.3,
          padding: const EdgeInsets.all(ThemeDimensions.spacing24),
          child: Container(
            decoration: BoxDecoration(
              gradient: ColorsAppQy.qyFrostedGlassGradient,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            ),
            padding: const EdgeInsets.all(ThemeDimensions.spacing24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  QyAppLocalizationKeys.qyCoursesCategories.tr(context),
                  style: ThemeTextStyles.title2.copyWith(
                    color: ColorsAppQy.qyTextPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: ThemeDimensions.spacing20),
                Text(
                  QyAppLocalizationKeys.qyComingSoon.tr(context),
                  style: ThemeTextStyles.body1.copyWith(
                    color: ColorsAppQy.qyTextSecondary,
                  ),
                ),
                const SizedBox(height: ThemeDimensions.spacing20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: ColorsAppQy.qyPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(
                        vertical: ThemeDimensions.spacing12,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius:
                            BorderRadius.circular(ThemeDimensions.radiusMedium),
                      ),
                    ),
                    child: Text(QyAppLocalizationKeys.qyCommonOk.tr(context)),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
