import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';
import 'package:qyflutter/apps/app_vipclub/controller_app_vipclub/splash_controller_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/controller_app_vipclub/settings_controller_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';

class VipClubSplashScreen extends StatefulWidget {
  const VipClubSplashScreen({super.key});

  @override
  State<VipClubSplashScreen> createState() => _VipClubSplashScreenState();
}

class _VipClubSplashScreenState extends State<VipClubSplashScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _fadeAnimation;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();

    _animationController = AnimationController(
      duration: const Duration(milliseconds: 1500),
      vsync: this,
    );

    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.0, 0.65, curve: Curves.easeOut),
      ),
    );

    _scaleAnimation = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(
        parent: _animationController,
        curve: const Interval(0.0, 0.65, curve: Curves.elasticOut),
      ),
    );

    _animationController.forward();

    _checkAuthAndNavigate();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  Future<void> _checkAuthAndNavigate() async {
    await Future.delayed(const Duration(seconds: 2));

    if (!mounted) return;

    try {
      final splashController = context.read<VipClubSplashController>();
      final settingsController = context.read<VipClubSettingsController>();

      await Future.delayed(const Duration(milliseconds: 100));

      if (!mounted) return;

      if (settingsController.showSplash && splashController.shouldShowSplash) {
        context.go(VipClubRoutes.splashIntro);
        return;
      }

      final authController = context.read<VipClubAuthController>();
      await authController.checkLoginStatus();

      if (!mounted) return;

      // Always go to home, whether logged in or not
      context.go(VipClubRoutes.home);
    } catch (e) {
      debugPrint('Error in splash navigation: $e');
      if (mounted) {
        // Go to home even if there's an error
        context.go(VipClubRoutes.home);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              ThemeColors.primaryBlue,
              ThemeColors.primaryBlue.withOpacity(0.8),
              ThemeColors.accentPurple.withOpacity(0.6),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Center(
          child: AnimatedBuilder(
            animation: _animationController,
            builder: (context, child) {
              return FadeTransition(
                opacity: _fadeAnimation,
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: EdgeInsets.all(ThemeDimensions.hugePadding),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: ThemeColors.neutralWhite.withOpacity(0.2),
                        ),
                        child: Icon(
                          Icons.stars,
                          size: 120,
                          color: ThemeColors.neutralWhite,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.hugePadding),
                      Text(
                        'VIP CLUB',
                        style: ThemeTextStyles.displayLarge.copyWith(
                          color: ThemeColors.neutralWhite,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 4,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.defaultPadding),
                      Text(
                        'Luxury Experience Awaits',
                        style: ThemeTextStyles.bodyLarge.copyWith(
                          color: ThemeColors.neutralWhite.withOpacity(0.9),
                          letterSpacing: 1.5,
                        ),
                      ),
                      SizedBox(height: ThemeDimensions.hugePadding * 2),
                      SizedBox(
                        width: 40,
                        height: 40,
                        child: CircularProgressIndicator(
                          valueColor: AlwaysStoppedAnimation<Color>(
                            ThemeColors.neutralWhite,
                          ),
                          strokeWidth: 3,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}
