import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import '../../../widgets_app_bank/bank_pagination_dots.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';

class LifeMainBanner extends StatefulWidget {
  final int currentBannerIndex;
  final ValueChanged<int>? onPageChanged;

  const LifeMainBanner({
    super.key,
    required this.currentBannerIndex,
    this.onPageChanged,
  });

  @override
  State<LifeMainBanner> createState() => _LifeMainBannerState();
}

class _LifeMainBannerState extends State<LifeMainBanner> {
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(
      initialPage: widget.currentBannerIndex,
      viewportFraction: 1.0,
    );
  }

  @override
  void didUpdateWidget(LifeMainBanner oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.currentBannerIndex != widget.currentBannerIndex) {
      _pageController.animateToPage(
        widget.currentBannerIndex,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
      );
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final bannerImages = [
      BankImages.lifeBanner1,
      BankImages.lifeBanner2,
    ];

    return Container(
      margin: const EdgeInsets.all(16),
      height: 160,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        child: Stack(
          children: [
            PageView.builder(
              controller: _pageController,
              itemCount: bannerImages.length,
              onPageChanged: widget.onPageChanged,
              padEnds: true,
              itemBuilder: (context, index) {
                return Center(
                  child: Image.asset(
                    bannerImages[index],
                    width: double.infinity,
                    height: 160,
                    fit: BoxFit.cover,
                    alignment: Alignment.center,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        width: double.infinity,
                        height: 160,
                        color: Colors.grey[300],
                        child: const Icon(Icons.image, color: Colors.grey),
                      );
                    },
                  ),
                );
              },
            ),
            Positioned(
              top: 12,
              left: 0,
              right: 0,
              child: Center(
                child: BankPaginationDots(
                  currentIndex: widget.currentBannerIndex,
                  totalCount: bannerImages.length,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
