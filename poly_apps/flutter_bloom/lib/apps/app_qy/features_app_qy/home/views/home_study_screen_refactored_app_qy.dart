import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/provider_status/user_provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/colors_app_qy.dart';
import 'package:qyflutter/apps/app_qy/resources_app_qy/theme_extensions_app_qy.dart';
import 'package:qyflutter/apps/app_qy/localization_app_qy/localization_keys_app_qy.dart';
import 'package:qyflutter/apps/app_qy/router_app_qy/routes_provider_app_qy.dart';

class HomeStudyScreenRefactoredAppQy extends StatefulWidget {
  const HomeStudyScreenRefactoredAppQy({super.key});

  @override
  State<HomeStudyScreenRefactoredAppQy> createState() => _HomeStudyScreenRefactoredAppQyState();
}

class _HomeStudyScreenRefactoredAppQyState extends State<HomeStudyScreenRefactoredAppQy> 
    with TickerProviderStateMixin {
  
  late final AnimationController _shimmerController;
  
  int _todayLearned = 0;
  int _totalWords = 0;
  int _reviewDue = 0;
  int _streakDays = 0;
  
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
    final userProvider = context.watch<BaseUserProvider>();
    
    return Scaffold(
      backgroundColor: ColorsAppQy.qyPageBackground,
      body: Stack(
        children: [
          _buildBackgroundGradient(),
          SafeArea(
            child: CustomScrollView(
              slivers: [
                _buildAppBar(userProvider),
                SliverPadding(
                  padding: const EdgeInsets.all(ThemeDimensions.spacing16),
                  sliver: SliverToBoxAdapter(
                    child: Column(
                      children: [
                        _buildStatsCard(),
                        const SizedBox(height: ThemeDimensions.spacing16),
                        _buildBentoGrid(),
                        const SizedBox(height: ThemeDimensions.spacing16),
                        _buildQuickActions(),
                        const SizedBox(height: ThemeDimensions.spacing80),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNav(),
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

  Widget _buildAppBar(BaseUserProvider userProvider) {
    return SliverAppBar(
      backgroundColor: Colors.transparent,
      elevation: 0,
      floating: true,
      pinned: false,
      expandedHeight: 80,
      flexibleSpace: ClipRRect(
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: ThemeDimensions.spacing16,
              vertical: ThemeDimensions.spacing8,
            ),
            child: SafeArea(
              child: Row(
                children: [
                  _buildUserAvatar(userProvider),
                  const SizedBox(width: ThemeDimensions.spacing12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          userProvider.isAuthenticated 
                              ? QyAppLocalizationKeys.qyWelcomeBack.tr(context)
                              : QyAppLocalizationKeys.qyGuestMode.tr(context),
                          style: ThemeTextStyles.caption.copyWith(
                            color: ColorsAppQy.qyTextSecondary,
                          ),
                        ),
                        Text(
                          userProvider.user?.name ?? QyAppLocalizationKeys.qyGuest.tr(context),
                          style: ThemeTextStyles.title3.copyWith(
                            color: ColorsAppQy.qyTextPrimary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  _buildAppBarActions(),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildUserAvatar(BaseUserProvider userProvider) {
    return GestureDetector(
      onTap: () => context.push(QyAppRoutesProvider.routeSettings),
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          gradient: ColorsAppQy.qyPrimaryGradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
          boxShadow: [
            BoxShadow(
              color: ColorsAppQy.qyPrimary.withOpacity(0.3),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Center(
          child: Text(
            userProvider.isAuthenticated 
                ? (userProvider.user?.name?.substring(0, 1).toUpperCase() ?? 'U')
                : 'G',
            style: ThemeTextStyles.title3.copyWith(
              color: ColorsAppQy.qyTextOnPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAppBarActions() {
    return Row(
      children: [
        _buildIconButton(
          icon: Icons.search_rounded,
          onTap: () => context.push(QyAppRoutesProvider.routeHomeSearch),
        ),
        const SizedBox(width: ThemeDimensions.spacing8),
        _buildIconButton(
          icon: Icons.notifications_none_rounded,
          onTap: () => context.push(QyAppRoutesProvider.routeMessageCenter),
        ),
      ],
    );
  }

  Widget _buildIconButton({
    required IconData icon,
    required VoidCallback onTap,
    int? badge,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: ThemeExtensionsAppQy.qyGlassmorphismCard,
        child: Stack(
          children: [
            Center(
              child: Icon(
                icon,
                color: ColorsAppQy.qyTextPrimary,
                size: 22,
              ),
            ),
            if (badge != null && badge > 0)
              Positioned(
                right: 4,
                top: 4,
                child: Container(
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: ColorsAppQy.qyError,
                    shape: BoxShape.circle,
                  ),
                  child: Text(
                    badge > 99 ? '99+' : badge.toString(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsCard() {
    return ThemeExtensionsAppQy.qyFrostedContainer(
      padding: const EdgeInsets.all(ThemeDimensions.spacing20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                QyAppLocalizationKeys.qyLearningProgress.tr(context),
                style: ThemeTextStyles.headline.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.spacing12,
                  vertical: ThemeDimensions.spacing4,
                ),
                decoration: BoxDecoration(
                  gradient: ColorsAppQy.qyTealGradient,
                  borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.local_fire_department, 
                      color: Colors.white, 
                      size: 16,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '$_streakDays ${QyAppLocalizationKeys.qyDays.tr(context)}',
                      style: ThemeTextStyles.caption.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Row(
            children: [
              _buildStatItem(
                value: _todayLearned.toString(),
                label: QyAppLocalizationKeys.qyHomeLearned.tr(context),
                color: ColorsAppQy.qyPrimary,
              ),
              _buildStatItem(
                value: _totalWords.toString(),
                label: QyAppLocalizationKeys.qyHomeWordsTotal.tr(context),
                color: ColorsAppQy.qySecondary,
              ),
              _buildStatItem(
                value: _reviewDue.toString(),
                label: QyAppLocalizationKeys.qyNeedReview.tr(context),
                color: ColorsAppQy.qyWarning,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildStatItem({
    required String value,
    required String label,
    required Color color,
  }) {
    return Expanded(
      child: Column(
        children: [
          Text(
            value,
            style: ThemeTextStyles.largeTitle.copyWith(
              color: color,
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
          ),
        ],
      ),
    );
  }

  Widget _buildBentoGrid() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              flex: 2,
              child: _buildBentoLargeCard(
                title: QyAppLocalizationKeys.qyHomeStartLearning.tr(context),
                subtitle: QyAppLocalizationKeys.qyWordLearning.tr(context),
                icon: Icons.school_rounded,
                gradient: ColorsAppQy.qyPrimaryGradient,
                onTap: () => context.push(QyAppRoutesProvider.routeWordBook),
              ),
            ),
            const SizedBox(width: ThemeDimensions.spacing12),
            Expanded(
              child: Column(
                children: [
                  _buildBentoSmallCard(
                    title: QyAppLocalizationKeys.qyWordListening.tr(context),
                    icon: Icons.headphones_rounded,
                    color: ColorsAppQy.qySecondary,
                    onTap: () => context.push(QyAppRoutesProvider.routeWordListening),
                  ),
                  const SizedBox(height: ThemeDimensions.spacing12),
                  _buildBentoSmallCard(
                    title: QyAppLocalizationKeys.qyWordReview.tr(context),
                    icon: Icons.refresh_rounded,
                    color: ColorsAppQy.qyAccent,
                    onTap: () => context.push(QyAppRoutesProvider.routeWordReview),
                  ),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: ThemeDimensions.spacing12),
        Row(
          children: [
            Expanded(
              child: _buildBentoMediumCard(
                title: QyAppLocalizationKeys.qyFlashcards.tr(context),
                icon: Icons.style_rounded,
                color: ColorsAppQy.qyInfo,
                onTap: () => context.push(QyAppRoutesProvider.routeWordFlashcard),
              ),
            ),
            const SizedBox(width: ThemeDimensions.spacing12),
            Expanded(
              child: _buildBentoMediumCard(
                title: QyAppLocalizationKeys.qyDictation.tr(context),
                icon: Icons.edit_note_rounded,
                color: ColorsAppQy.qyWarning,
                onTap: () => context.push(QyAppRoutesProvider.routeWordDictation),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildBentoLargeCard({
    required String title,
    required String subtitle,
    required IconData icon,
    required Gradient gradient,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 180,
        decoration: BoxDecoration(
          gradient: gradient,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusLg),
          boxShadow: [
            BoxShadow(
              color: ColorsAppQy.qyPrimary.withOpacity(0.3),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        padding: const EdgeInsets.all(ThemeDimensions.spacing20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(ThemeDimensions.spacing12),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.2),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusMd),
              ),
              child: Icon(icon, color: Colors.white, size: 28),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subtitle,
                  style: ThemeTextStyles.caption.copyWith(
                    color: Colors.white.withOpacity(0.8),
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  title,
                  style: ThemeTextStyles.title2.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoSmallCard({
    required String title,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 84,
        decoration: ThemeExtensionsAppQy.qyGlassmorphismCard,
        padding: const EdgeInsets.all(ThemeDimensions.spacing12),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(ThemeDimensions.spacing8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSm),
              ),
              child: Icon(icon, color: color, size: 20),
            ),
            const SizedBox(width: ThemeDimensions.spacing8),
            Expanded(
              child: Text(
                title,
                style: ThemeTextStyles.subhead.copyWith(
                  color: ColorsAppQy.qyTextPrimary,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBentoMediumCard({
    required String title,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 100,
        decoration: ThemeExtensionsAppQy.qyGlassmorphismCard,
        padding: const EdgeInsets.all(ThemeDimensions.spacing16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Container(
              padding: const EdgeInsets.all(ThemeDimensions.spacing8),
              decoration: BoxDecoration(
                color: color.withOpacity(0.1),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusSm),
              ),
              child: Icon(icon, color: color, size: 22),
            ),
            Text(
              title,
              style: ThemeTextStyles.subhead.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActions() {
    return Container(
      decoration: ThemeExtensionsAppQy.qyFrostedGlassCard,
      padding: const EdgeInsets.all(ThemeDimensions.spacing16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            QyAppLocalizationKeys.qyMoreFeatures.tr(context),
            style: ThemeTextStyles.headline.copyWith(
              color: ColorsAppQy.qyTextPrimary,
            ),
          ),
          const SizedBox(height: ThemeDimensions.spacing16),
          Wrap(
            spacing: ThemeDimensions.spacing12,
            runSpacing: ThemeDimensions.spacing12,
            children: [
              _buildQuickActionChip(
                label: QyAppLocalizationKeys.qyCoursesTitle.tr(context),
                icon: Icons.menu_book_rounded,
                onTap: () => context.push(QyAppRoutesProvider.routeCourseIelts),
              ),
              _buildQuickActionChip(
                label: 'AI Study',
                icon: Icons.psychology_rounded,
                onTap: () => context.push(QyAppRoutesProvider.routeAiStudy),
              ),
              _buildQuickActionChip(
                label: QyAppLocalizationKeys.qyCheckInChallenge.tr(context),
                icon: Icons.emoji_events_rounded,
                onTap: () => context.push(QyAppRoutesProvider.routeCheckinChallenge),
              ),
              _buildQuickActionChip(
                label: QyAppLocalizationKeys.qyCertificateCenter.tr(context),
                icon: Icons.workspace_premium_rounded,
                onTap: () => context.push(QyAppRoutesProvider.routeCertificateCenter),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionChip({
    required String label,
    required IconData icon,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: ThemeDimensions.spacing12,
          vertical: ThemeDimensions.spacing8,
        ),
        decoration: BoxDecoration(
          color: ColorsAppQy.qyHolographicLight,
          borderRadius: BorderRadius.circular(ThemeDimensions.radiusFull),
          border: Border.all(
            color: ColorsAppQy.qyBorderLight,
            width: 1,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: ColorsAppQy.qyPrimary),
            const SizedBox(width: ThemeDimensions.spacing6),
            Text(
              label,
              style: ThemeTextStyles.caption.copyWith(
                color: ColorsAppQy.qyTextPrimary,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNav() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          decoration: ThemeExtensionsAppQy.qyNavBarDecoration,
          child: SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: ThemeDimensions.spacing24,
                vertical: ThemeDimensions.spacing8,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildNavItem(
                    icon: Icons.home_rounded,
                    label: QyAppLocalizationKeys.qyHomeStudy.tr(context),
                    isSelected: true,
                    onTap: () {},
                  ),
                  _buildNavItem(
                    icon: Icons.menu_book_rounded,
                    label: QyAppLocalizationKeys.qyHomeCourse.tr(context),
                    onTap: () => context.push(QyAppRoutesProvider.routeCourseIelts),
                  ),
                  _buildNavItem(
                    icon: Icons.psychology_rounded,
                    label: QyAppLocalizationKeys.qyHomeAi.tr(context),
                    onTap: () => context.push(QyAppRoutesProvider.routeAiStudy),
                  ),
                  _buildNavItem(
                    icon: Icons.explore_rounded,
                    label: QyAppLocalizationKeys.qyHomeDiscover.tr(context),
                    onTap: () => context.push(QyAppRoutesProvider.routeDiscover),
                  ),
                  _buildNavItem(
                    icon: Icons.person_rounded,
                    label: QyAppLocalizationKeys.qyHomeProfile.tr(context),
                    onTap: () => context.push(QyAppRoutesProvider.routeSettings),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required IconData icon,
    required String label,
    bool isSelected = false,
    required VoidCallback onTap,
  }) {
    final color = isSelected ? ColorsAppQy.qyPrimary : ColorsAppQy.qyTextTertiary;
    
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: color, size: 24),
          const SizedBox(height: 4),
          Text(
            label,
            style: ThemeTextStyles.caption2.copyWith(
              color: color,
              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
            ),
          ),
        ],
      ),
    );
  }
}

