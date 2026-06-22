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

/// Course Ielts 4 Screen for QY App - Refactored with centralized theme and common components
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

class CourseIelts4ScreenRefactoredAppQy extends StatefulWidget {
  const CourseIelts4ScreenRefactoredAppQy({super.key});

  @override
  State<CourseIelts4ScreenRefactoredAppQy> createState() =>
      _CourseIelts4ScreenRefactoredAppQyState();
}

class _CourseIelts4ScreenRefactoredAppQyState
    extends State<CourseIelts4ScreenRefactoredAppQy>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmerController;

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
                  child: _buildBentoBoxLayout(),
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
                  '${QyAppLocalizationKeys.qyCourse.tr(context)} IELTS 4',
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

  Widget _buildBentoBoxLayout() {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _buildBentoGrid(),
        ],
      ),
    );
  }

  Widget _buildBentoGrid() {
    return GridView.count(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      crossAxisCount: 2,
      crossAxisSpacing: ThemeDimensions.spacing16,
      mainAxisSpacing: ThemeDimensions.spacing16,
      childAspectRatio: 1.2,
      children: [
        _buildBentoCard(
          title: QyAppLocalizationKeys.qyPending.tr(context),
          icon: Icons.construction,
          gradient: ColorsAppQy.qyPrimaryGradient,
        ),
        _buildBentoCard(
          title: QyAppLocalizationKeys.qyLoading.tr(context),
          icon: Icons.build,
          gradient: ColorsAppQy.qySecondaryGradient,
        ),
      ],
    );
  }

  Widget _buildBentoCard({
    required String title,
    required IconData icon,
    required Gradient gradient,
  }) {
    return GlassmorphismCard(
      borderRadius: ThemeDimensions.radiusLarge,
      blur: 15,
      opacity: 0.2,
      padding: const EdgeInsets.all(ThemeDimensions.spacing20),
      child: Container(
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        ),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              icon,
              size: 48,
              color: Colors.white,
            ),
            const SizedBox(height: ThemeDimensions.spacing12),
            Text(
              title,
              style: ThemeTextStyles.body1.copyWith(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
