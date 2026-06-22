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
import 'package:qyflutter/apps/app_qy/config_app_qy/default_language_config_app_qy.dart';

class SettingsScreenV2RefactoredAppQy extends StatefulWidget {
  const SettingsScreenV2RefactoredAppQy({super.key});

  @override
  State<SettingsScreenV2RefactoredAppQy> createState() =>
      _SettingsScreenV2RefactoredAppQyState();
}

class _SettingsScreenV2RefactoredAppQyState
    extends State<SettingsScreenV2RefactoredAppQy>
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
                            valueColor: AlwaysStoppedAnimation<Color>(
                                ColorsAppQy.qyPrimary),
                          ),
                        );
                      }

                      return ListView(
                        padding: const EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.spacing16),
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
            gradient:
                ColorsAppQy.qyDynamicShimmerGradient(_shimmerController.value),
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
            icon:
                const Icon(Icons.arrow_back, color: ColorsAppQy.qyTextPrimary),
            onPressed: () => context.pop(),
          ),
          const SizedBox(width: ThemeDimensions.spacing8),
          Text(
            QyAppLocalizationKeys.qySettings.tr(context),
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
              color: ColorsAppQy.qyFrostMedium,
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
                  color: ColorsAppQy.qyTextOnPrimary,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              Text(
                QyAppLocalizationKeys.qyLoginToUnlock.tr(context),
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
                color: ColorsAppQy.qyPageBackground.withOpacity(0),
                child: InkWell(
                  onTap: () => context.go('/login'),
                  borderRadius:
                      BorderRadius.circular(ThemeDimensions.radiusFull),
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(
                        vertical: ThemeDimensions.spacing14),
                    decoration: BoxDecoration(
                      gradient: ColorsAppQy.qyPrimaryGradient,
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.radiusFull),
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
                        color: ColorsAppQy.qyTextOnPrimary,
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
              color: ColorsAppQy.qyFrostMedium,
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
                      color: ColorsAppQy.qyTextOnPrimary,
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
                      user?.displayName ??
                          QyAppLocalizationKeys.qyGuest.tr(context),
                      style: ThemeTextStyles.title3.copyWith(
                        color: ColorsAppQy.qyTextPrimary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: ThemeDimensions.spacing4),
                    Text(
                      user?.email ??
                          QyAppLocalizationKeys.qyNotLoggedIn.tr(context),
                      style: ThemeTextStyles.caption.copyWith(
                        color: ColorsAppQy.qyTextSecondary,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.edit_rounded,
                    color: ColorsAppQy.qyPrimary),
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
          padding: const EdgeInsets.only(
              left: ThemeDimensions.spacing8,
              bottom: ThemeDimensions.spacing12),
          child: Text(
            QyAppLocalizationKeys.qySettingsGeneral.tr(context),
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
              title: QyAppLocalizationKeys.qySettingsLanguage.tr(context),
              subtitle:
                  _getLanguageDisplayName(controller.languageVoice.appLanguage),
              gradient: ColorsAppQy.qyPrimaryGradient,
              onTap: () => _showAppLanguageDialog(controller),
            ),
            _buildBentoCard(
              icon: Icons.palette_rounded,
              title: QyAppLocalizationKeys.qyDisplay.tr(context),
              subtitle: controller.display.themeMode.capitalize(),
              gradient: LinearGradient(
                colors: [ColorsAppQy.qyWarning, ColorsAppQy.qyWarning],
              ),
              onTap: () => _showThemeModeDialog(controller),
            ),
            _buildBentoCard(
              icon: Icons.volume_up_rounded,
              title: QyAppLocalizationKeys.qyAudioVoice.tr(context),
              subtitle: QyAppLocalizationKeys.qyTtsSettings.tr(context),
              gradient: LinearGradient(
                colors: [ColorsAppQy.qySuccess, ColorsAppQy.qySecondaryDark],
              ),
              onTap: () {},
            ),
            _buildBentoCard(
              icon: Icons.notifications_rounded,
              title: QyAppLocalizationKeys.qySettingsNotifications.tr(context),
              subtitle: controller.notification.dailyStudyReminder
                  ? QyAppLocalizationKeys.qyEnabled.tr(context)
                  : QyAppLocalizationKeys.qyDisabled.tr(context),
              gradient: LinearGradient(
                colors: [ColorsAppQy.qyAccent, ColorsAppQy.qyAccentDark],
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
    final learningLanguages = user?.learningLanguages ?? DefaultLanguageConfigAppQy.defaultLearningLanguages;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(
              left: ThemeDimensions.spacing8,
              bottom: ThemeDimensions.spacing12),
          child: Text(
            QyAppLocalizationKeys.qyMyAccount.tr(context),
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
                borderRadius:
                    BorderRadius.circular(ThemeDimensions.radiusLarge),
                border: Border.all(
                  color: ColorsAppQy.qyFrostMedium,
                  width: 1.5,
                ),
              ),
              child: Column(
                children: [
                  _buildAccountActionItem(
                    icon: Icons.school_rounded,
                    title:
                        QyAppLocalizationKeys.qyLearningLanguages.tr(context),
                    subtitle: learningLanguages
                        .map((e) => e.toUpperCase())
                        .join(', '),
                    onTap: () => context.push('/learning-languages'),
                    gradient: LinearGradient(
                      colors: [Colors.purple.shade400, Colors.purple.shade600],
                    ),
                  ),
                  _buildAccountActionItem(
                    icon: Icons.library_books_rounded,
                    title: QyAppLocalizationKeys.qyVocabularyCollections
                        .tr(context),
                    subtitle:
                        QyAppLocalizationKeys.qyManageWordLibraries.tr(context),
                    onTap: () => context.push('/vocabulary-collections'),
                    gradient: LinearGradient(
                      colors: [ColorsAppQy.qyInfo, ColorsAppQy.qyPrimaryDark],
                    ),
                  ),
                  _buildAccountActionItem(
                    icon: Icons.bar_chart_rounded,
                    title: QyAppLocalizationKeys.qyLearningStats.tr(context),
                    subtitle:
                        '${user?.learnedWords ?? 0} ${QyAppLocalizationKeys.qyWordsLearned.tr(context)}',
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
      color: ColorsAppQy.qyPageBackground.withOpacity(0),
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
                borderRadius:
                    BorderRadius.circular(ThemeDimensions.radiusLarge),
                border: Border.all(
                  color: ColorsAppQy.qyFrostMedium,
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
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.radiusMedium),
                      boxShadow: [
                        BoxShadow(
                          color: ColorsAppQy.qyShadowMedium,
                          blurRadius: 8,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Icon(icon, color: ColorsAppQy.qyTextOnPrimary, size: 24),
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
        color: ColorsAppQy.qyPageBackground.withOpacity(0),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          child: Container(
            padding: const EdgeInsets.all(ThemeDimensions.spacing12),
            decoration: BoxDecoration(
              color: ColorsAppQy.qyFrostLight,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    gradient: gradient,
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.radiusSmall),
                  ),
                  child: Icon(icon, color: ColorsAppQy.qyTextOnPrimary, size: 20),
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
              color: ColorsAppQy.qyFrostMedium,
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                QyAppLocalizationKeys.qyQuickSettings.tr(context),
                style: ThemeTextStyles.title3.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              _buildToggleItem(
                icon: Icons.volume_up_rounded,
                title: QyAppLocalizationKeys.qyAutoPlayAudio.tr(context),
                value: controller.languageVoice.autoPlayOnStudy,
                onChanged: (value) => controller.updateAutoPlayOnStudy(value),
              ),
              _buildToggleItem(
                icon: Icons.animation_rounded,
                title: QyAppLocalizationKeys.qyAnimations.tr(context),
                value: controller.display.enableAnimations,
                onChanged: (value) => controller.updateEnableAnimations(value),
              ),
              _buildToggleItem(
                icon: Icons.vibration_rounded,
                title: QyAppLocalizationKeys.qyHapticFeedback.tr(context),
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

  Widget _buildDataSection(
      SettingsControllerRefactoredAppQy controller, bool isLoggedIn) {
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
              color: ColorsAppQy.qyFrostMedium,
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                QyAppLocalizationKeys.qyDataStorage.tr(context),
                style: ThemeTextStyles.title3.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              if (isLoggedIn) ...[
                _buildActionItem(
                  icon: Icons.cloud_sync_rounded,
                  title: QyAppLocalizationKeys.qySyncData.tr(context),
                  subtitle: QyAppLocalizationKeys.qyLastSynced.tr(context),
                  onTap: () {},
                ),
              ],
              _buildActionItem(
                icon: Icons.delete_outline_rounded,
                title: QyAppLocalizationKeys.qyClearCache.tr(context),
                subtitle: '${controller.dataStorage.maxCacheSize} MB',
                onTap: () {},
              ),
              if (isLoggedIn) ...[
                _buildActionItem(
                  icon: Icons.file_download_rounded,
                  title: QyAppLocalizationKeys.qyExportData.tr(context),
                  subtitle:
                      QyAppLocalizationKeys.qyBackupLearningData.tr(context),
                  onTap: () {},
                ),
              ],
              _buildActionItem(
                icon: Icons.refresh_rounded,
                title: QyAppLocalizationKeys.qySettingsReset.tr(context),
                subtitle:
                    QyAppLocalizationKeys.qyRestoreDefaultSettings.tr(context),
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
        color: ColorsAppQy.qyPageBackground.withOpacity(0),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
          child: Container(
            padding: const EdgeInsets.all(ThemeDimensions.spacing12),
            decoration: BoxDecoration(
              color: ColorsAppQy.qyFrostLight,
              borderRadius: BorderRadius.circular(ThemeDimensions.radiusMedium),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  color: isDestructive
                      ? ColorsAppQy.qyError
                      : ColorsAppQy.qyPrimary,
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
                              ? ColorsAppQy.qyError
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
              color: ColorsAppQy.qyFrostMedium,
              width: 1.5,
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                QyAppLocalizationKeys.qySettingsAbout.tr(context),
                style: ThemeTextStyles.title3.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: ThemeDimensions.spacing16),
              _buildActionItem(
                icon: Icons.help_outline_rounded,
                title: QyAppLocalizationKeys.qyHelpCenter.tr(context),
                subtitle: QyAppLocalizationKeys.qyFaqsSupport.tr(context),
                onTap: () {},
              ),
              _buildActionItem(
                icon: Icons.privacy_tip_outlined,
                title: QyAppLocalizationKeys.qyPrivacyPolicy.tr(context),
                subtitle: QyAppLocalizationKeys.qyHowWeProtectData.tr(context),
                onTap: () {},
              ),
              _buildActionItem(
                icon: Icons.description_outlined,
                title: QyAppLocalizationKeys.qyTerms.tr(context),
                subtitle: QyAppLocalizationKeys.qyTermsConditions.tr(context),
                onTap: () {},
              ),
              _buildActionItem(
                icon: Icons.info_outline_rounded,
                title: QyAppLocalizationKeys.qyAppVersion.tr(context),
                subtitle: '1.0.0 (Build 1)',
                onTap: () {},
              ),
              if (isLoggedIn)
                _buildActionItem(
                  icon: Icons.logout_rounded,
                  title: QyAppLocalizationKeys.qyLogout.tr(context),
                  subtitle: QyAppLocalizationKeys.qySignOutAccount.tr(context),
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
      {
        'code': QyAppLocalizationKeys.qyLanguageCodeZh,
        'nameKey': QyAppLocalizationKeys.qyLanguageChinese
      },
      {
        'code': QyAppLocalizationKeys.qyLanguageCodeEn,
        'nameKey': QyAppLocalizationKeys.qyLanguageEnglish
      },
    ];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsLanguage.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: languages.map((lang) {
            final isSelected =
                controller.languageVoice.appLanguage == lang['code'];
            return ListTile(
              title: Text((lang['nameKey'] as String).tr(context)),
              trailing: isSelected
                  ? const Icon(Icons.check, color: ColorsAppQy.qyPrimary)
                  : null,
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

  void _showThemeModeDialog(SettingsControllerRefactoredAppQy controller) {
    final themeModes = [
      {'value': 'light', 'nameKey': QyAppLocalizationKeys.qyLightMode},
      {'value': 'dark', 'nameKey': QyAppLocalizationKeys.qyDarkMode},
      {'value': 'auto', 'nameKey': QyAppLocalizationKeys.qySettingsThemeAuto},
    ];

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(QyAppLocalizationKeys.qySettingsTheme.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: themeModes.map((theme) {
            final isSelected = controller.display.themeMode == theme['value'];
            return ListTile(
              title: Text((theme['nameKey'] as String).tr(context)),
              trailing: isSelected
                  ? const Icon(Icons.check, color: ColorsAppQy.qyPrimary)
                  : null,
              onTap: () async {
                await controller.updateThemeMode(theme['value']!);
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
        title: Text(QyAppLocalizationKeys.qySettingsReset.tr(context)),
        content: Text(QyAppLocalizationKeys.qyAreYouSureReset.tr(context)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(QyAppLocalizationKeys.qyCancel.tr(context)),
          ),
          TextButton(
            onPressed: () async {
              Navigator.pop(context);
              await controller.resetToDefaults();
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text(QyAppLocalizationKeys
                          .qySettingsResetDefaults
                          .tr(context))),
                );
              }
            },
            child: Text(QyAppLocalizationKeys.qyReset.tr(context),
                style: TextStyle(color: ColorsAppQy.qyError)),
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
