import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/settings_controller_refactored_app_qy.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/auth_service_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class SettingsScreenV2RefactoredAppQy extends StatefulWidget {
  const SettingsScreenV2RefactoredAppQy({super.key});

  @override
  State<SettingsScreenV2RefactoredAppQy> createState() => _SettingsScreenV2RefactoredAppQyState();
}

class _SettingsScreenV2RefactoredAppQyState extends State<SettingsScreenV2RefactoredAppQy>
    with TickerProviderStateMixin {
  late final AnimationController _shimmerController;

  @override
  void initState() {
    super.initState();
    _shimmerController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SettingsControllerRefactoredAppQy>().initialize();
    });
  }

  @override
  void dispose() {
    _shimmerController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final authService = context.watch<AuthServiceAppQy>();
    final isLoggedIn = authService.isAuthenticated;

    return Scaffold(
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(
                  child: Consumer<SettingsControllerRefactoredAppQy>(
                    builder: (context, controller, child) {
                      if (controller.isLoading) {
                        return const Center(
                          child: CircularProgressIndicator(
                            valueColor: AlwaysStoppedAnimation<Color>(ColorsAppQy.qyPrimary),
                          ),
                        );
                      }

                      return ListView(
                        padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
                        children: [
                          if (isLoggedIn) ...[
                            _buildUserSection(authService),
                            const SizedBox(height: ThemeDimensions.spacing24),
                          ] else ...[
                            _buildLoginPrompt(),
                            const SizedBox(height: ThemeDimensions.spacing24),
                          ],
                          _buildGeneralSettingsBento(controller, isLoggedIn),
                          const SizedBox(height: ThemeDimensions.spacing24),
                          if (isLoggedIn) ...[
                            _buildMyAccountSection(controller, authService),
                            const SizedBox(height: ThemeDimensions.spacing24),
                          ],
                          _buildQuickToggles(controller),
                          const SizedBox(height: ThemeDimensions.spacing24),
                          _buildDataSection(controller, isLoggedIn),
                          const SizedBox(height: ThemeDimensions.spacing24),
                          _buildAboutSection(isLoggedIn, authService),
                          const SizedBox(height: ThemeDimensions.spacing80),
                        ],
                      );
                    },
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
    return Padding(
      padding: const EdgeInsets.all(ThemeDimensions.spacing24),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back, color: ColorsAppQy.qyTextPrimary),
            onPressed: () => context.pop(),
          ),
          const SizedBox(width: ThemeDimensions.spacing8),
          Text(
            'Settings',
            style: ThemeTextStyles.title1.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoginPrompt() {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing24),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
          ),
          child: Column(
            children: [
              Container(
                width: 80,
                height: 80,
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: ColorsAppQy.qyPrimary.withOpacity(0.3),
                      blurRadius: 15,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.person_outline_rounded,
                  size: 40,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              Text(
                'Login to Unlock More Features',
                style: ThemeTextStyles.title3.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: ThemeDimensions.spacing8),
              Text(
                'Sync your data, track progress, and access personalized learning',
                style: ThemeTextStyles.caption.copyWith(
                  color: ColorsAppQy.qyTextSecondary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: ThemeDimensions.spacing20),
              Material(
                color: Colors.transparent,
                child: InkWell(
                  onTap: () => context.go('/login'),
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: ThemeDimensions.spacing14),
                    decoration: BoxDecoration(
                      gradient: ColorsAppQy.qyPrimaryGradient,
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                      boxShadow: [
                        BoxShadow(
                          color: ColorsAppQy.qyPrimary.withOpacity(0.4),
                          blurRadius: 12,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Text(
                      'Login / Sign Up',
                      style: ThemeTextStyles.button.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildUserSection(AuthServiceAppQy authService) {
    final user = authService.currentUser;

    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing20),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
          ),
          child: Row(
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyPrimaryGradient,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: ColorsAppQy.qyPrimary.withOpacity(0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Center(
                  child: Text(
                    user?.displayName?.substring(0, 1).toUpperCase() ?? 'U',
                    style: ThemeTextStyles.title1.copyWith(
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
                      user?.displayName ?? 'Guest',
                      style: ThemeTextStyles.title3.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: ThemeDimensions.spacing4),
                    Text(
                      user?.email ?? 'Not logged in',
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_rounded, color: ColorsAppQy.qyPrimary),
                onPressed: () {},
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildGeneralSettingsBento(
    SettingsControllerRefactoredAppQy controller,
    bool isLoggedIn,
  ) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: ThemeDimensions.spacing8, bottom: ThemeDimensions.spacing12),
          child: Text(
            'General Settings',
            style: ThemeTextStyles.title3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: ThemeDimensions.spacing16,
          crossAxisSpacing: ThemeDimensions.spacing16,
          childAspectRatio: 1.2,
          children: [
            _buildBentoCard(
              icon: Icons.language_rounded,
              title: 'App Language',
              subtitle: _getLanguageDisplayName(controller.languageVoice.appLanguage),
              gradient: ColorsAppQy.qyPrimaryGradient,
              onTap: () => _showAppLanguageDialog(controller),
            ),
            _buildBentoCard(
              icon: Icons.palette_rounded,
              title: 'Display',
              subtitle: controller.display.themeMode.capitalize(),
              gradient: LinearGradient(
                colors: [Colors.orange.shade400, Colors.orange.shade600],
              ),
              onTap: () {},
            ),
            _buildBentoCard(
              icon: Icons.volume_up_rounded,
              title: 'Audio & Voice',
              subtitle: 'TTS Settings',
              gradient: LinearGradient(
                colors: [Colors.green.shade400, Colors.green.shade600],
              ),
              onTap: () {},
            ),
            _buildBentoCard(
              icon: Icons.notifications_rounded,
              title: 'Notifications',
              subtitle: controller.notification.dailyStudyReminder ? 'Enabled' : 'Disabled',
              gradient: LinearGradient(
                colors: [Colors.pink.shade400, Colors.pink.shade600],
              ),
              onTap: () {},
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildMyAccountSection(
    SettingsControllerRefactoredAppQy controller,
    AuthServiceAppQy authService,
  ) {
    final user = authService.currentUser;
    final learningLanguages = user?.learningLanguages ?? ['en'];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: ThemeDimensions.spacing8, bottom: ThemeDimensions.spacing12),
          child: Text(
            'My Account',
            style: ThemeTextStyles.title3.copyWith(
              color: ColorsAppQy.qyTextPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
        ClipRRect(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
            child: Container(
              padding: const EdgeInsets.all(ThemeDimensions.spacing16),
              decoration: BoxDecoration(
                gradient: ColorsAppQy.qyFrostedGlassGradient,
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                border: Border.all(
                  color: Colors.white.withOpacity(0.2),
                  width: 1.5,
                ),
              ),
              child: Column(
                children: [
                  _buildAccountActionItem(
                    icon: Icons.school_rounded,
                    title: 'Learning Languages',
                    subtitle: learningLanguages.map((e) => e.toUpperCase()).join(', '),
                    onTap: () => context.push('/learning-languages'),
                    gradient: LinearGradient(
                      colors: [Colors.purple.shade400, Colors.purple.shade600],
                    ),
                  ),
                  _buildAccountActionItem(
                    icon: Icons.library_books_rounded,
                    title: 'Vocabulary Collections',
                    subtitle: 'Manage your word libraries',
                    onTap: () => context.push('/vocabulary-collections'),
                    gradient: LinearGradient(
                      colors: [Colors.blue.shade400, Colors.blue.shade600],
                    ),
                  ),
                  _buildAccountActionItem(
                    icon: Icons.bar_chart_rounded,
                    title: 'Learning Stats',
                    subtitle: '${user?.learnedWords ?? 0} words learned',
                    onTap: () {},
                    gradient: LinearGradient(
                      colors: [Colors.teal.shade400, Colors.teal.shade600],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildBentoCard({
    required IconData icon,
    required String title,
    required String subtitle,
    required Gradient gradient,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
            child: Container(
              padding: const EdgeInsets.all(ThemeDimensions.spacing16),
              decoration: BoxDecoration(
                gradient: ColorsAppQy.qyFrostedGlassGradient,
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                border: Border.all(
                  color: Colors.white.withOpacity(0.2),
                  width: 1.5,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      gradient: gradient,
                      borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.2),
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(icon, color: Colors.white, size: 24),
                  ),
                  const Spacer(),
                  Text(
                    title,
                    style: ThemeTextStyles.body.copyWith(
                      color: ColorsAppQy.qyTextPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  const SizedBox(height: ThemeDimensions.spacing4),
                  Text(
                    subtitle,
                    style: ThemeTextStyles.caption.copyWith(
                      color: ColorsAppQy.qyTextSecondary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAccountActionItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    required Gradient gradient,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          child: Container(
            padding: const EdgeInsets.all(ThemeDimensions.spacing12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    gradient: gradient,
                    borderRadius: BorderRadius.circular(ThemeDimensions.radiusSmall),
                  ),
                  child: Icon(icon, color: Colors.white, size: 20),
                ),
                const SizedBox(width: ThemeDimensions.spacing12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: ThemeTextStyles.body.copyWith(
                          color: ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: ThemeDimensions.spacing2),
                      Text(
                        subtitle,
                        style: ThemeTextStyles.caption.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 16,
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildQuickToggles(SettingsControllerRefactoredAppQy controller) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Quick Settings',
                style: ThemeTextStyles.title3.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              _buildToggleItem(
                icon: Icons.volume_up_rounded,
                title: 'Auto Play Audio',
                value: controller.languageVoice.autoPlayOnStudy,
                onChanged: (value) => controller.updateAutoPlayOnStudy(value),
              ),
              _buildToggleItem(
                icon: Icons.animation_rounded,
                title: 'Animations',
                value: controller.display.enableAnimations,
                onChanged: (value) => controller.updateEnableAnimations(value),
              ),
              _buildToggleItem(
                icon: Icons.vibration_rounded,
                title: 'Haptic Feedback',
                value: controller.display.hapticFeedback,
                onChanged: (value) => controller.updateHapticFeedback(value),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildToggleItem({
    required IconData icon,
    required String title,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing12),
      child: Row(
        children: [
          Icon(icon, color: ColorsAppQy.qyPrimary, size: 20),
          const SizedBox(width: ThemeDimensions.spacing12),
          Expanded(
            child: Text(
              title,
              style: ThemeTextStyles.body.copyWith(
                color: ColorsAppQy.qyTextPrimary,
              ),
            ),
          ),
          Switch(
            value: value,
            onChanged: onChanged,
            activeColor: ColorsAppQy.qyPrimary,
          ),
        ],
      ),
    );
  }

  Widget _buildDataSection(SettingsControllerRefactoredAppQy controller, bool isLoggedIn) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Data & Storage',
                style: ThemeTextStyles.title3.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              if (isLoggedIn) ...[
                _buildActionItem(
                  icon: Icons.cloud_sync_rounded,
                  title: 'Sync Data',
                  subtitle: 'Last synced: Just now',
                  onTap: () {},
                ),
              ],
              _buildActionItem(
                icon: Icons.delete_outline_rounded,
                title: 'Clear Cache',
                subtitle: '${controller.dataStorage.maxCacheSize} MB',
                onTap: () {},
              ),
              if (isLoggedIn) ...[
                _buildActionItem(
                  icon: Icons.file_download_rounded,
                  title: 'Export Data',
                  subtitle: 'Backup your learning data',
                  onTap: () {},
                ),
              ],
              _buildActionItem(
                icon: Icons.refresh_rounded,
                title: 'Reset Settings',
                subtitle: 'Restore default settings',
                onTap: () => _showResetDialog(controller),
                isDestructive: true,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildActionItem({
    required IconData icon,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: ThemeDimensions.spacing12),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          child: Container(
            padding: const EdgeInsets.all(ThemeDimensions.spacing12),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  color: isDestructive ? Colors.red.shade400 : ColorsAppQy.qyPrimary,
                  size: 20,
                ),
                const SizedBox(width: ThemeDimensions.spacing12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: ThemeTextStyles.body.copyWith(
                          color: isDestructive
                              ? Colors.red.shade400
                              : ColorsAppQy.qyTextPrimary,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: ThemeDimensions.spacing2),
                      Text(
                        subtitle,
                        style: ThemeTextStyles.caption.copyWith(
                          color: ColorsAppQy.qyTextSecondary,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(
                  Icons.arrow_forward_ios_rounded,
                  size: 16,
                  color: ColorsAppQy.qyTextSecondary,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAboutSection(bool isLoggedIn, AuthServiceAppQy authService) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 15, sigmaY: 15),
        child: Container(
          padding: const EdgeInsets.all(ThemeDimensions.spacing16),
          decoration: BoxDecoration(
            gradient: ColorsAppQy.qyFrostedGlassGradient,
            borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'About',
                style: ThemeTextStyles.title3.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              _buildActionItem(
                icon: Icons.help_outline_rounded,
                title: 'Help Center',
                subtitle: 'FAQs and support',
                onTap: () {},
              ),
              _buildActionItem(
                icon: Icons.privacy_tip_outlined,
                title: 'Privacy Policy',
                subtitle: 'How we protect your data',
                onTap: () {},
              ),
              _buildActionItem(
                icon: Icons.description_outlined,
                title: 'Terms of Service',
                subtitle: 'Terms and conditions',
                onTap: () {},
              ),
              _buildActionItem(
                icon: Icons.info_outline_rounded,
                title: 'App Version',
                subtitle: '1.0.0 (Build 1)',
                onTap: () {},
              ),
              if (isLoggedIn)
                _buildActionItem(
                  icon: Icons.logout_rounded,
                  title: 'Logout',
                  subtitle: 'Sign out from your account',
                  onTap: () => _handleLogout(authService),
                  isDestructive: true,
                ),
            ],
          ),
        ),
      ),
    );
  }

  void _showAppLanguageDialog(SettingsControllerRefactoredAppQy controller) {
    final languages = [
      {'code': QyAppLocalizationKeys.qyLanguageCodeZh, 'nameKey': QyAppLocalizationKeys.qyLanguageChinese},
      {'code': QyAppLocalizationKeys.qyLanguageCodeEn, 'nameKey': QyAppLocalizationKeys.qyLanguageEnglish},
    ];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('App Language'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: languages.map((lang) {
            final isSelected = controller.languageVoice.appLanguage == lang['code'];
            return ListTile(
              title: Text((lang['nameKey'] as String).tr(context)),
              trailing: isSelected ? const Icon(Icons.check, color: ColorsAppQy.qyPrimary) : null,
              onTap: () async {
                await controller.updateAppLanguage(lang['code']!);
                if (mounted) {
                  Navigator.pop(context);
                }
              },
            );
          }).toList(),
        ),
      ),
    );
  }

  void _showResetDialog(SettingsControllerRefactoredAppQy controller) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Reset Settings'),
        content: const Text('Are you sure you want to reset all settings to defaults?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await controller.resetToDefaults();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Settings reset to defaults')),
                );
              }
            },
            child: const Text('Reset', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  Future<void> _handleLogout(AuthServiceAppQy authService) async {
    await authService.logout();
    if (mounted) {
      context.go('/login');
    }
  }

  String _getLanguageDisplayName(String code) {
    final context = this.context;
    if (code == QyAppLocalizationKeys.qyLanguageCodeZh) {
      return QyAppLocalizationKeys.qyLanguageChinese.tr(context);
    } else if (code == QyAppLocalizationKeys.qyLanguageCodeEn) {
      return QyAppLocalizationKeys.qyLanguageEnglish.tr(context);
    }
    return code;
  }
}

extension StringExtension on String {
  String capitalize() {
    if (isEmpty) return this;
    return '${this[0].toUpperCase()}${substring(1)}';
  }
}
