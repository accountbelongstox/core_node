// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY FORBIDDEN
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../router_app_wuy/router_app_wuy.dart';
import '../localization_app_wuy/localization_keys_app_wuy.dart';

/// Wuy App Bottom Navigation Component
///
/// 1:1 implementation matching React version BottomNav component
/// Exact Tailwind CSS color values:
/// - bg-blue-100: #DBEAFE (rgb(219, 234, 254))
/// - text-blue-600: #2563EB (rgb(37, 99, 235))
/// - text-slate-400: #94A3B8 (rgb(148, 163, 184))
/// - bg-white/80: white with 80% opacity
/// - border-white/20: white with 20% opacity
class WuyBottomNavigation extends StatelessWidget {
  final String currentRoute;

  // Tailwind CSS exact color values
  static const Color _blue100 = Color(0xFFDBEAFE); // bg-blue-100
  static const Color _blue600 = Color(0xFF2563EB); // text-blue-600
  static const Color _slate400 = Color(0xFF94A3B8); // text-slate-400

  const WuyBottomNavigation({
    super.key,
    required this.currentRoute,
  });

  @override
  Widget build(BuildContext context) {
    // Match React: fixed bottom-0 left-0 right-0 max-w-md mx-auto h-[80px] z-50
    return Container(
      height: 80, // h-[80px]
      child: Stack(
        children: [
          // Match: absolute inset-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-t border-white/20
          Positioned.fill(
            child: ClipRect(
              child: BackdropFilter(
                filter: ImageFilter.blur(
                    sigmaX: 24, sigmaY: 24), // backdrop-blur-xl
                child: Container(
                  decoration: BoxDecoration(
                    color: ThemeColors.white.withOpacity(0.8), // bg-white/80
                    border: Border(
                      top: BorderSide(
                        color: ThemeColors.white
                            .withOpacity(0.2), // border-white/20
                        width: 1,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          // Match: relative z-10 flex items-center justify-between h-full pb-4 px-6
          SafeArea(
            top: false,
            child: Container(
              height: 80, // h-full
              padding: const EdgeInsets.only(
                  bottom: 16, left: 24, right: 24), // pb-4 px-6
              child: Row(
                mainAxisAlignment:
                    MainAxisAlignment.spaceBetween, // justify-between
                children: [
                  _buildNavItem(
                    context,
                    Icons.location_on,
                    LocalizationKeysAppWuy.wuyTabMap.tr(context),
                    WuyAppRouter.getMapRoute(),
                    currentRoute == WuyAppRouter.getMapRoute() ||
                        currentRoute.startsWith('/wuy/map'),
                  ),
                  _buildNavItem(
                    context,
                    Icons.people,
                    LocalizationKeysAppWuy.wuyTabFriends.tr(context),
                    WuyAppRouter.getFriendsRoute(),
                    currentRoute == WuyAppRouter.getFriendsRoute() ||
                        currentRoute.startsWith('/wuy/friends'),
                  ),
                  _buildNavItem(
                    context,
                    Icons.person,
                    LocalizationKeysAppWuy.wuyTabMe.tr(context),
                    WuyAppRouter.getProfileRoute(),
                    currentRoute == WuyAppRouter.getProfileRoute() ||
                        currentRoute.startsWith('/wuy/profile') ||
                        currentRoute.startsWith('/wuy/me'),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(
    BuildContext context,
    IconData icon,
    String label,
    String route,
    bool isActive,
  ) {
    // Match React: flex flex-col items-center justify-center flex-1 h-full gap-1
    return Expanded(
      child: GestureDetector(
        onTap: () => context.go(route),
        child: Container(
          height: double.infinity, // h-full
          child: Column(
            mainAxisAlignment:
                MainAxisAlignment.center, // items-center justify-center
            children: [
              // Match: p-1.5 rounded-full transition-all duration-300
              // Active: bg-blue-100 text-blue-600 translate-y-[-4px]
              // Inactive: text-slate-400
              AnimatedContainer(
                duration: const Duration(
                    milliseconds: 300), // transition-all duration-300
                curve: Curves.easeOut,
                padding: const EdgeInsets.all(6), // p-1.5 (6px)
                decoration: BoxDecoration(
                  color:
                      isActive ? _blue100 : Colors.transparent, // bg-blue-100
                  borderRadius: BorderRadius.circular(20), // rounded-full
                ),
                transform: Matrix4.identity()
                  ..translate(0.0, isActive ? -4.0 : 0.0), // translate-y-[-4px]
                child: Icon(
                  icon,
                  size: 24, // size={24}
                  color: isActive
                      ? _blue600
                      : _slate400, // text-blue-600 or text-slate-400
                ),
              ),
              const SizedBox(height: 4), // gap-1 (4px)
              // Match: text-[10px] font-medium transition-colors
              // Active: text-blue-600
              // Inactive: text-slate-400
              Text(
                label,
                style: ThemeTextStyles.caption2.copyWith(
                  fontSize: 10, // text-[10px]
                  fontWeight: FontWeight.w500, // font-medium
                  color: isActive
                      ? _blue600
                      : _slate400, // text-blue-600 or text-slate-400
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
