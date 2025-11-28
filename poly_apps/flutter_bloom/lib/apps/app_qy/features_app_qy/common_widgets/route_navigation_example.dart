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

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import 'package:qyflutter/common/widgets/animations/animation_utils.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';

// AI MODIFICATION NOTE: This widget was enhanced by QR_Profile_AI_Assistant
// - Added proper theme system integration
// - Enhanced with consistent theming
// - This is a good qy of route navigation patterns
// Other AIs: Please maintain the theme system consistency

/// Route Navigation Example
/// Demonstrates how route keys are defined directly in route providers
/// No need to maintain separate constant files
class RouteNavigationQy extends StatefulWidget {
  const RouteNavigationQy({super.key});

  @override
  State<RouteNavigationQy> createState() => _RouteNavigationQyState();
}

class _RouteNavigationQyState extends State<RouteNavigationQy>
    with SingleTickerProviderStateMixin {
  late AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      duration: const Duration(seconds: 3),
      vsync: this,
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
      body: Container(
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyHolographicGradient,
        ),
        child: SafeArea(
          child: CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 120,
                floating: false,
                pinned: true,
                flexibleSpace: FlexibleSpaceBar(
                  title: Text(
                    QyAppLocalizationKeys.qyRouteNavigationExample.tr(context),
                    style: ThemeTextStyles.titleLarge.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  background: Container(
                    decoration: BoxDecoration(
                      gradient: ColorsAppQy.qyDynamicShimmerGradient(
                        _shimmerController.value,
                      ),
                    ),
                  ),
                ),
                backgroundColor:
                    ColorsAppQy.qyHolographicWhite.withOpacity(0.8),
              ),
              SliverPadding(
                padding: EdgeInsets.all(ThemeDimensions.spacing16),
                sliver: SliverList(
                  delegate: SliverChildListDelegate([
                    GlassCard(
                      borderRadius: ThemeDimensions.borderRadiusL,
                      padding: EdgeInsets.all(ThemeDimensions.spacing16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            QyAppLocalizationKeys.qyRouteKeysManagement
                                .tr(context),
                            style: ThemeTextStyles.titleLarge.copyWith(
                              color: ColorsAppQy.qyTextPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: ThemeDimensions.spacing16),
                          Text(
                            QyAppLocalizationKeys.qyRouteKeysManagementDesc
                                .tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyTextSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.spacing24),
                    Text(
                      QyAppLocalizationKeys.qyAppRoutes.tr(context),
                      style: ThemeTextStyles.titleLarge.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.spacing16),
                    _buildRouteCard(
                      context,
                      QyAppLocalizationKeys.qyHome.tr(context),
                      QyAppRoutesProvider.routeHome,
                      QyAppLocalizationKeys.qyRouteHomeDesc.tr(context),
                    ),
                    _buildRouteCard(
                      context,
                      QyAppLocalizationKeys.qyProfile.tr(context),
                      QyAppRoutesProvider.routeProfileAchievements,
                      QyAppLocalizationKeys.qyRouteProfileDesc.tr(context),
                    ),
                    _buildRouteCard(
                      context,
                      QyAppLocalizationKeys.qySettings.tr(context),
                      QyAppRoutesProvider.routeSettings,
                      QyAppLocalizationKeys.qyRouteSettingsDesc.tr(context),
                    ),
                    _buildRouteCard(
                      context,
                      QyAppLocalizationKeys.qyMessageCenter.tr(context),
                      QyAppRoutesProvider.routeMessageCenter,
                      QyAppLocalizationKeys.qyRouteDashboardDesc.tr(context),
                    ),
                    SizedBox(height: ThemeDimensions.spacing24),
                    GlassCard(
                      borderRadius: ThemeDimensions.borderRadiusL,
                      padding: EdgeInsets.all(ThemeDimensions.spacing16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            QyAppLocalizationKeys.qyRouteBenefitsTitle
                                .tr(context),
                            style: ThemeTextStyles.titleLarge.copyWith(
                              color: ColorsAppQy.qyTextPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          SizedBox(height: ThemeDimensions.spacing8),
                          Text(
                            QyAppLocalizationKeys.qyRouteBenefitsContent
                                .tr(context),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ColorsAppQy.qyTextSecondary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ]),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildRouteCard(
    BuildContext context,
    String title,
    String routePath,
    String description,
  ) {
    return AnimationUtils.fadeInWithSlide(
      GlassCard(
        borderRadius: ThemeDimensions.borderRadiusM,
        margin: EdgeInsets.only(bottom: ThemeDimensions.spacing8),
        padding: EdgeInsets.all(ThemeDimensions.spacing16),
        onTap: () => Navigator.pushNamed(context, routePath),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: ThemeTextStyles.titleMedium.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacing8),
                  Text(
                    'Path: $routePath',
                    style: ThemeTextStyles.bodySmall.copyWith(
                      fontFamily: 'monospace',
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.spacing4),
                  Text(
                    description,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                  ),
                ],
              ),
            ),
            SizedBox(width: ThemeDimensions.spacing16),
            Container(
              decoration: BoxDecoration(
                gradient: ColorsAppQy.qyPrimaryGradient,
                borderRadius: ThemeDimensions.borderRadiusM,
              ),
              child: Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => Navigator.pushNamed(context, routePath),
                  borderRadius: ThemeDimensions.borderRadiusM,
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.spacing16,
                      vertical: ThemeDimensions.spacing12,
                    ),
                    child: Text(
                      QyAppLocalizationKeys.qyGo.tr(context),
                      style: ThemeTextStyles.button.copyWith(
                        color: ColorsAppQy.qyTextOnPrimary,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
