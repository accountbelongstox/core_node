import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/controller_app_qy/settings_controller_refactored_app_qy.dart';
import 'package:qyflutter/apps/app_qy/services_app_qy/auth_service_app_qy.dart';

class SettingsScreenRefactoredAppQy extends StatefulWidget {
  const SettingsScreenRefactoredAppQy({super.key});

  @override
  State<SettingsScreenRefactoredAppQy> createState() => _SettingsScreenRefactoredAppQyState();
}

class _SettingsScreenRefactoredAppQyState extends State<SettingsScreenRefactoredAppQy>
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

                      return _buildSettingsContent(controller);
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

  Widget _buildSettingsContent(SettingsControllerRefactoredAppQy controller) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: ThemeDimensions.spacing16),
      children: [
        _buildUserSection(),
        const SizedBox(height: ThemeDimensions.spacing24),
        _buildBentoGrid(controller),
        const SizedBox(height: ThemeDimensions.spacing24),
        _buildQuickToggles(controller),
        const SizedBox(height: ThemeDimensions.spacing24),
        _buildDataSection(controller),
        const SizedBox(height: ThemeDimensions.spacing24),
        _buildAboutSection(),
        const SizedBox(height: ThemeDimensions.spacing80),
      ],
    );
  }

  Widget _buildUserSection() {
    final authService = context.watch<AuthServiceAppQy>();
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
                onPressed: () {
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBentoGrid(SettingsControllerRefactoredAppQy controller) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: ThemeDimensions.spacing16,
      crossAxisSpacing: ThemeDimensions.spacing16,
      childAspectRatio: 1.2,
      children: [
        _buildBentoCard(
          icon: Icons.language_rounded,
          title: 'Language & Voice',
          subtitle: controller.languageVoice.appLanguage == 'zh' ? 'Chinese' : 'English',
          gradient: ColorsAppQy.qyPrimaryGradient,
          onTap: () {
          },
        ),
        _buildBentoCard(
          icon: Icons.school_rounded,
          title: 'Learning',
          subtitle: '${controller.learning.dailyNewWords} words/day',
          gradient: LinearGradient(
            colors: [Colors.purple.shade400, Colors.purple.shade600],
          ),
          onTap: () {
          },
        ),
        _buildBentoCard(
          icon: Icons.palette_rounded,
          title: 'Display',
          subtitle: controller.display.themeMode.capitalize(),
          gradient: LinearGradient(
            colors: [Colors.orange.shade400, Colors.orange.shade600],
          ),
          onTap: () {
          },
        ),
        _buildBentoCard(
          icon: Icons.notifications_rounded,
          title: 'Notifications',
          subtitle: controller.notification.dailyStudyReminder ? 'Enabled' : 'Disabled',
          gradient: LinearGradient(
            colors: [Colors.pink.shade400, Colors.pink.shade600],
          ),
          onTap: () {
          },
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
              _buildToggleItem(
                icon: Icons.sync_rounded,
                title: 'Auto Sync',
                value: controller.dataStorage.autoSync,
                onChanged: (value) => controller.updateAutoSync(value),
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

  Widget _buildDataSection(SettingsControllerRefactoredAppQy controller) {
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
              _buildActionItem(
                icon: Icons.cloud_sync_rounded,
                title: 'Sync Data',
                subtitle: 'Last synced: Just now',
                onTap: () {},
              ),
              _buildActionItem(
                icon: Icons.delete_outline_rounded,
                title: 'Clear Cache',
                subtitle: '${controller.dataStorage.maxCacheSize} MB',
                onTap: () {},
              ),
              _buildActionItem(
                icon: Icons.file_download_rounded,
                title: 'Export Data',
                subtitle: 'Backup your learning data',
                onTap: () {},
              ),
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

  Widget _buildAboutSection() {
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
              _buildActionItem(
                icon: Icons.logout_rounded,
                title: 'Logout',
                subtitle: 'Sign out from your account',
                onTap: () => _handleLogout(),
                isDestructive: true,
              ),
            ],
          ),
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

  Future<void> _handleLogout() async {
    final authService = context.read<AuthServiceAppQy>();
    await authService.logout();
    if (mounted) {
      context.go('/login');
    }
  }
}

extension StringExtension on String {
  String capitalize() {
    if (isEmpty) return this;
    return '${this[0].toUpperCase()}${substring(1)}';
  }
}
