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
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import '../../../providers_app_wuy/wu_user_provider.dart';
import '../../../widgets_app_wuy/wuy_bottom_navigation.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../config_app_wuy/storage_app_wuy.dart';
import '../../../utils_app_wuy/auth_guard.dart';
import '../../../models_app_wuy/user_model_app_wuy.dart';

/// Profile Screen for Wuy App
///
/// 1:1 implementation matching React version Profile.tsx
/// Features:
/// - MobileLayout with background gradient orbs
/// - GlassCard for header and menu items
/// - Menu items with icons and values
/// - Theme and language toggle
/// - Logout button
class WuyProfileScreen extends StatelessWidget {
  const WuyProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<WuUserProvider>(
      builder: (context, userProvider, child) {
        final user = userProvider.user as UserModelAppWuy?;

        if (user == null) {
          return const SizedBox.shrink();
        }

        final storage = StorageAppWuy.instance;
        final isDarkMode = storage.isDarkMode();
        final currentLocale = Localizations.localeOf(context).languageCode;

        return Scaffold(
          backgroundColor:
              isDarkMode ? ThemeColors.grey900 : ThemeColors.grey50,
          body: Stack(
            children: [
              // Background gradient orbs (matching React version)
              Positioned(
                top: -MediaQuery.of(context).size.height * 0.2,
                left: -MediaQuery.of(context).size.width * 0.2,
                child: Container(
                  width: MediaQuery.of(context).size.width * 0.8,
                  height: MediaQuery.of(context).size.height * 0.5,
                  decoration: BoxDecoration(
                    color: ThemeColors.blue.withOpacity(0.2),
                    shape: BoxShape.circle,
                  ),
                  child: ClipOval(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 100, sigmaY: 100),
                      child: Container(),
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: -MediaQuery.of(context).size.height * 0.1,
                right: -MediaQuery.of(context).size.width * 0.1,
                child: Container(
                  width: MediaQuery.of(context).size.width * 0.8,
                  height: MediaQuery.of(context).size.height * 0.5,
                  decoration: BoxDecoration(
                    color: ThemeColors.purple.withOpacity(0.2),
                    shape: BoxShape.circle,
                  ),
                  child: ClipOval(
                    child: BackdropFilter(
                      filter: ImageFilter.blur(sigmaX: 100, sigmaY: 100),
                      child: Container(),
                    ),
                  ),
                ),
              ),
              // Content
              SafeArea(
                child: Column(
                  children: [
                    Expanded(
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 32),
                        child: Column(
                          children: [
                            // Header Card (matching React: GlassCard className="flex items-center gap-4 mb-6")
                            GlassCard(
                              padding: const EdgeInsets.all(16),
                              margin: const EdgeInsets.only(bottom: 24),
                              borderRadius: BorderRadius.circular(16),
                              child: Row(
                                children: [
                                  CircleAvatar(
                                    radius: 32, // w-16 h-16 (64px) -> radius 32
                                    backgroundImage: user
                                            .unifiedAvatarUrl.isNotEmpty
                                        ? NetworkImage(user.unifiedAvatarUrl)
                                        : null,
                                    backgroundColor: ThemeColors.grey300,
                                    child: user.unifiedAvatarUrl.isEmpty
                                        ? Icon(Icons.person,
                                            size: 32,
                                            color: ThemeColors.grey600)
                                        : null,
                                  ),
                                  const SizedBox(width: 16), // gap-4 (16px)
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          user.displayName,
                                          style: ThemeTextStyles.title2Bold
                                              .copyWith(
                                            fontSize: 20, // text-xl
                                            fontWeight:
                                                FontWeight.bold, // font-bold
                                            color: isDarkMode
                                                ? ThemeColors.white
                                                : ThemeColors.black,
                                          ),
                                        ),
                                        const SizedBox(height: 4), // mt-1 (4px)
                                        Text(
                                          user.unifiedPhoneNumber ?? '',
                                          style:
                                              ThemeTextStyles.caption2.copyWith(
                                            fontSize: 12, // text-xs
                                            color: ThemeColors
                                                .grey500, // text-slate-500
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  GestureDetector(
                                    onTap: () => context
                                        .go(WuyAppRouter.getEditProfileRoute()),
                                    child: Icon(
                                      Icons.qr_code,
                                      color:
                                          ThemeColors.grey400, // text-slate-400
                                      size: 24,
                                    ),
                                  ),
                                ],
                              ),
                            ),

                            // Settings Group (matching React: GlassCard className="p-0 mb-6 overflow-hidden")
                            GlassCard(
                              padding: EdgeInsets.zero,
                              margin: const EdgeInsets.only(bottom: 24),
                              borderRadius: BorderRadius.circular(16),
                              child: Column(
                                children: [
                                  _buildMenuItem(
                                    context,
                                    icon: Icons.person,
                                    label: LocalizationKeysAppWuy.wuyMeProfile
                                        .tr(context),
                                    onTap: () => context
                                        .go(WuyAppRouter.getEditProfileRoute()),
                                  ),
                                  _buildDivider(context, isDarkMode),
                                  _buildMenuItem(
                                    context,
                                    icon: Icons.dark_mode,
                                    label: LocalizationKeysAppWuy.wuyMeTheme
                                        .tr(context),
                                    value: isDarkMode
                                        ? LocalizationKeysAppWuy.wuyMeThemeDark
                                            .tr(context)
                                        : LocalizationKeysAppWuy.wuyMeThemeLight
                                            .tr(context),
                                    onTap: () {
                                      storage.toggleDarkMode();
                                      // Trigger rebuild
                                      userProvider.notifyListeners();
                                    },
                                  ),
                                  _buildDivider(context, isDarkMode),
                                  _buildMenuItem(
                                    context,
                                    icon: Icons.language,
                                    label: LocalizationKeysAppWuy.wuyMeLang
                                        .tr(context),
                                    value: currentLocale == 'en'
                                        ? LocalizationKeysAppWuy
                                            .wuyMeLangEnglish
                                            .tr(context)
                                        : LocalizationKeysAppWuy
                                            .wuyMeLangChinese
                                            .tr(context),
                                    onTap: () {
                                      final newLocale =
                                          currentLocale == 'en' ? 'zh' : 'en';
                                      storage.setLocale(newLocale);
                                      // Trigger rebuild
                                      userProvider.notifyListeners();
                                    },
                                  ),
                                ],
                              ),
                            ),

                            // About & Settings Group
                            GlassCard(
                              padding: EdgeInsets.zero,
                              margin: const EdgeInsets.only(bottom: 24),
                              borderRadius: BorderRadius.circular(16),
                              child: Column(
                                children: [
                                  _buildMenuItem(
                                    context,
                                    icon: Icons.info_outline,
                                    label: LocalizationKeysAppWuy.wuyMeAbout
                                        .tr(context),
                                    onTap: () => context
                                        .go(WuyAppRouter.getAboutRoute()),
                                  ),
                                  _buildDivider(context, isDarkMode),
                                  _buildMenuItem(
                                    context,
                                    icon: Icons.settings,
                                    label: LocalizationKeysAppWuy.wuyMeSettings
                                        .tr(context),
                                    onTap: () => context
                                        .go(WuyAppRouter.getSettingsRoute()),
                                  ),
                                ],
                              ),
                            ),

                            // Logout Button (matching React: className="w-full py-4 rounded-xl bg-red-50 text-red-500 font-bold text-sm")
                            GestureDetector(
                              onTap: () async {
                                final confirmed = await showDialog<bool>(
                                  context: context,
                                  builder: (context) => AlertDialog(
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(16),
                                    ),
                                    title: Text(LocalizationKeysAppWuy
                                        .wuyMeLogout
                                        .tr(context)),
                                    content: Text(LocalizationKeysAppWuy
                                        .wuyProfileLogout
                                        .tr(context)),
                                    actions: [
                                      TextButton(
                                        onPressed: () =>
                                            Navigator.pop(context, false),
                                        child: Text(LocalizationKeysAppWuy
                                            .wuyActionCancel
                                            .tr(context)),
                                      ),
                                      ElevatedButton(
                                        onPressed: () =>
                                            Navigator.pop(context, true),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: ThemeColors.red,
                                          foregroundColor: Colors.white,
                                        ),
                                        child: Text(LocalizationKeysAppWuy
                                            .wuyMeLogout
                                            .tr(context)),
                                      ),
                                    ],
                                  ),
                                );
                                if (confirmed == true) {
                                  await AuthGuard.onLogout(context);
                                }
                              },
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                    vertical: 16), // py-4
                                decoration: BoxDecoration(
                                  color: ThemeColors.red
                                      .withOpacity(0.1), // bg-red-50
                                  borderRadius:
                                      BorderRadius.circular(12), // rounded-xl
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Icon(
                                      Icons.logout,
                                      size: 18,
                                      color: ThemeColors.red, // text-red-500
                                    ),
                                    const SizedBox(width: 8), // gap-2
                                    Text(
                                      LocalizationKeysAppWuy.wuyMeLogout
                                          .tr(context),
                                      style: ThemeTextStyles.bodySmall.copyWith(
                                        color: ThemeColors.red, // text-red-500
                                        fontWeight:
                                            FontWeight.bold, // font-bold
                                        fontSize: 14, // text-sm
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    // Bottom Navigation
                    WuyBottomNavigation(
                      currentRoute: GoRouterState.of(context).uri.toString(),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    String? value,
    VoidCallback? onTap,
  }) {
    final storage = StorageAppWuy.instance;
    final isDarkMode = storage.isDarkMode();

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(16), // p-4
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isDarkMode
                    ? ThemeColors.white.withOpacity(0.1)
                    : ThemeColors.black.withOpacity(
                        0.05), // border-black/5 dark:border-white/5
                width: 1,
              ),
            ),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8), // p-2
                    decoration: BoxDecoration(
                      color: isDarkMode
                          ? ThemeColors.white.withOpacity(0.1)
                          : ThemeColors.blue
                              .withOpacity(0.1), // bg-blue-50 dark:bg-white/10
                      borderRadius: BorderRadius.circular(8), // rounded-lg
                    ),
                    child: Icon(
                      icon,
                      size: 18,
                      color: isDarkMode
                          ? ThemeColors.blue.withOpacity(0.8)
                          : ThemeColors
                              .blue, // text-blue-600 dark:text-blue-300
                    ),
                  ),
                  const SizedBox(width: 12), // gap-3
                  Text(
                    label,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      fontSize: 14, // text-sm
                      fontWeight: FontWeight.w500, // font-medium
                      color: isDarkMode
                          ? ThemeColors.grey200
                          : ThemeColors
                              .grey700, // text-slate-700 dark:text-slate-200
                    ),
                  ),
                ],
              ),
              Row(
                children: [
                  if (value != null) ...[
                    Text(
                      value,
                      style: ThemeTextStyles.caption2.copyWith(
                        fontSize: 12, // text-xs
                        color: ThemeColors.grey400, // text-slate-400
                      ),
                    ),
                    const SizedBox(width: 8), // gap-2
                  ],
                  if (onTap != null)
                    Icon(
                      Icons.chevron_right,
                      size: 16,
                      color: ThemeColors.grey300, // text-slate-300
                    ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildDivider(BuildContext context, bool isDarkMode) {
    return Container(
      height: 1,
      color: isDarkMode
          ? ThemeColors.white.withOpacity(0.1)
          : ThemeColors.black
              .withOpacity(0.05), // border-black/5 dark:border-white/5
    );
  }
}
