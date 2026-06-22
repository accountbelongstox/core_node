import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_gradients.dart';
import 'package:qyflutter/apps/app_vipclub/controller_app_vipclub/splash_controller_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/localization_app_vipclub/localization_keys_app_vipclub.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:smooth_page_indicator/smooth_page_indicator.dart';

class VipClubSplashIntroScreen extends StatefulWidget {
  const VipClubSplashIntroScreen({super.key});

  @override
  State<VipClubSplashIntroScreen> createState() =>
      _VipClubSplashIntroScreenState();
}

class _VipClubSplashIntroScreenState extends State<VipClubSplashIntroScreen> {
  final PageController _pageController = PageController();
  int _currentPage = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onPageChanged(int page) {
    setState(() {
      _currentPage = page;
    });
    context.read<VipClubSplashController>().updateCurrentPage(page);
  }

  Future<void> _completeSplash() async {
    await context.read<VipClubSplashController>().completeSplash();
    if (!mounted) return;
    // Always go to home, not login
    context.go(VipClubRoutes.home);
  }

  void _skip() {
    _completeSplash();
  }

  void _next() {
    final controller = context.read<VipClubSplashController>();
    if (controller.isLastPage) {
      _completeSplash();
    } else {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<VipClubSplashController>(
      builder: (context, splashController, child) {
        final pages = splashController.splashPages;

        if (pages.isEmpty) {
          return const Scaffold(
            body: Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        return Scaffold(
          body: Stack(
            children: [
              PageView.builder(
                controller: _pageController,
                onPageChanged: _onPageChanged,
                itemCount: pages.length,
                itemBuilder: (context, index) {
                  final page = pages[index];
                  return _SplashPage(
                    imageUrl: page.imageUrl,
                    title: page.title ?? '',
                    description: page.description ?? '',
                  );
                },
              ),
              Positioned(
                top: MediaQuery.of(context).padding.top + 16,
                right: 16,
                child: TextButton(
                  onPressed: _skip,
                  style: TextButton.styleFrom(
                    backgroundColor: Colors.black.withOpacity(0.3),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 20,
                      vertical: 10,
                    ),
                  ),
                  child: Text(
                    VipClubTextKeys.vipclubSplashSkip.tr(context),
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.neutralWhite,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: 100,
                left: 0,
                right: 0,
                child: Center(
                  child: SmoothPageIndicator(
                    controller: _pageController,
                    count: pages.length,
                    effect: ExpandingDotsEffect(
                      activeDotColor: ThemeColors.neutralWhite,
                      dotColor: ThemeColors.neutralWhite.withOpacity(0.4),
                      dotHeight: 8,
                      dotWidth: 8,
                      expansionFactor: 3,
                      spacing: 8,
                    ),
                  ),
                ),
              ),
              Positioned(
                bottom: 30,
                left: 24,
                right: 24,
                child: ElevatedButton(
                  onPressed: _next,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: ThemeColors.neutralWhite,
                    foregroundColor: ThemeColors.primaryBlue,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(ThemeDimensions.defaultRadius),
                    ),
                    elevation: 4,
                  ),
                  child: Text(
                    splashController.isLastPage
                        ? VipClubTextKeys.vipclubSplashGetStarted.tr(context)
                        : VipClubTextKeys.vipclubSplashNext.tr(context),
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      fontWeight: FontWeight.bold,
                      color: ThemeColors.primaryBlue,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _SplashPage extends StatelessWidget {
  final String imageUrl;
  final String title;
  final String description;

  const _SplashPage({
    required this.imageUrl,
    required this.title,
    required this.description,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          imageUrl,
          fit: BoxFit.cover,
          errorBuilder: (context, error, stackTrace) {
            return Container(
              decoration: BoxDecoration(
                gradient: ThemeGradients.primaryBlue,
              ),
              child: const Center(
                child: Icon(
                  Icons.image_not_supported,
                  size: 80,
                  color: Colors.white54,
                ),
              ),
            );
          },
        ),
        Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Colors.black.withOpacity(0.3),
                Colors.black.withOpacity(0.7),
              ],
            ),
          ),
        ),
        Positioned(
          bottom: 180,
          left: 24,
          right: 24,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Builder(
                builder: (context) => Text(
                  title.tr(context),
                  style: ThemeTextStyles.displayMedium.copyWith(
                    color: ThemeColors.neutralWhite,
                    fontWeight: FontWeight.bold,
                    shadows: [
                      Shadow(
                        color: Colors.black.withOpacity(0.5),
                        offset: const Offset(0, 2),
                        blurRadius: 4,
                      ),
                    ],
                  ),
                ),
              ),
              SizedBox(height: ThemeDimensions.defaultPadding),
              Builder(
                builder: (context) => Text(
                  description.tr(context),
                  style: ThemeTextStyles.bodyLarge.copyWith(
                    color: ThemeColors.neutralWhite.withOpacity(0.95),
                    height: 1.5,
                    shadows: [
                      Shadow(
                        color: Colors.black.withOpacity(0.5),
                        offset: const Offset(0, 1),
                        blurRadius: 3,
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
