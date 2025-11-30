// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/custom_search_input.dart';
import 'package:qyflutter/common/widgets/glassmorphism_card.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class HomeBar extends StatefulWidget implements PreferredSizeWidget {
  final VoidCallback onMenuTap;

  const HomeBar({
    super.key,
    required this.onMenuTap,
  });

  @override
  State<HomeBar> createState() => _HomeBarState();

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);
}

class _HomeBarState extends State<HomeBar> with SingleTickerProviderStateMixin {
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
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            border: Border(
              bottom: BorderSide(
                color: Colors.white.withOpacity(0.2),
                width: 1,
              ),
            ),
          ),
          child: AppBar(
            forceMaterialTransparency: true,
            backgroundColor: Colors.transparent,
            elevation: 0,
            leading: Padding(
              padding: const EdgeInsets.all(ThemeDimensions.spacing8),
              child: GestureDetector(
                onTap: widget.onMenuTap,
                child: GlassmorphismCard(
                  borderRadius: ThemeDimensions.radiusFull,
                  blur: 10,
                  opacity: 0.3,
                  padding: const EdgeInsets.all(ThemeDimensions.spacing8),
                  child: Icon(
                    Icons.dashboard,
                    color: ColorsAppQy.qyTextPrimary,
                    size: ThemeDimensions.iconSizeMedium,
                  ),
                ),
              ),
            ),
            titleSpacing: 0,
            title: Padding(
              padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacing8),
              child: SizedBox(
                height: 40,
                child: GlassmorphismCard(
                  borderRadius: ThemeDimensions.radiusMedium,
                  blur: 10,
                  opacity: 0.2,
                  padding: EdgeInsets.zero,
                  child: CustomSearchInput(
                    search_placeholder:
                        QyAppLocalizationKeys.qySearchPlaceholder.tr(context),
                    borderColor: ColorsAppQy.qyBorderLight.withOpacity(0.3),
                    textColor: ColorsAppQy.qyTextPrimary,
                    backgroundColor: Colors.transparent,
                    borderWidth: 0,
                    onTap: () {
                      showDialog(
                        context: context,
                        builder: (BuildContext context) {
                          return GlassmorphismCard(
                            borderRadius: ThemeDimensions.radiusLarge,
                            blur: 20,
                            opacity: 0.3,
                            padding:
                                const EdgeInsets.all(ThemeDimensions.spacing24),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  QyAppLocalizationKeys.qySearch.tr(context),
                                  style: ThemeTextStyles.title2.copyWith(
                                    color: ColorsAppQy.qyTextPrimary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(
                                    height: ThemeDimensions.spacing16),
                                CustomSearchInput(
                                  search_placeholder: QyAppLocalizationKeys
                                      .qyEnterSearchText
                                      .tr(context),
                                  borderColor: ColorsAppQy.qyBorderLight,
                                  textColor: ColorsAppQy.qyTextPrimary,
                                  backgroundColor: Colors.transparent,
                                  borderWidth: 1.0,
                                  onChanged: (value) {},
                                ),
                                const SizedBox(
                                    height: ThemeDimensions.spacing16),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.end,
                                  children: [
                                    TextButton(
                                      onPressed: () => context.pop(),
                                      child: Text(QyAppLocalizationKeys.qyCancel
                                          .tr(context)),
                                    ),
                                    const SizedBox(
                                        width: ThemeDimensions.spacing8),
                                    TextButton(
                                      onPressed: () {
                                        context.pop();
                                        context.push(QyAppRoutesProvider
                                            .routeHomeSearch);
                                      },
                                      child: Text(QyAppLocalizationKeys.qySearch
                                          .tr(context)),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      );
                    },
                  ),
                ),
              ),
            ),
            actions: [
              ActionWidget(
                onTap: () {
                  context.push(QyAppRoutesProvider.routeMessageCenter);
                },
                actionIcon: Icons.notifications,
              ),
              ActionWidget(
                onTap: () {
                  context.push(QyAppRoutesProvider.routeProfileAchievements);
                },
                actionIcon: Icons.bookmark,
              ),
              Padding(
                padding: const EdgeInsets.all(ThemeDimensions.spacing8),
                child: GlassmorphismCard(
                  borderRadius: ThemeDimensions.radiusFull,
                  blur: 10,
                  opacity: 0.3,
                  padding: const EdgeInsets.all(ThemeDimensions.spacing8),
                  child: IconButton(
                    icon: Icon(
                      Icons.more_vert,
                      color: ColorsAppQy.qyTextPrimary,
                    ),
                    onPressed: () {
                      context.push(QyAppRoutesProvider.routeSettings);
                    },
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class ActionWidget extends StatelessWidget {
  final VoidCallback onTap;
  final IconData actionIcon;

  const ActionWidget({
    super.key,
    required this.onTap,
    required this.actionIcon,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacing8),
      child: GestureDetector(
        onTap: onTap,
        child: GlassmorphismCard(
          borderRadius: ThemeDimensions.radiusFull,
          blur: 10,
          opacity: 0.3,
          padding: const EdgeInsets.all(ThemeDimensions.spacing8),
          child: Icon(
            actionIcon,
            color: ColorsAppQy.qyTextPrimary,
            size: ThemeDimensions.iconSizeMedium,
          ),
        ),
      ),
    );
  }
}
