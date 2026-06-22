import 'dart:async';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/banner_model_app_vipclub.dart';

class VipClubBannerCarousel extends StatefulWidget {
  final List<VipClubBannerModel> banners;
  final Duration autoPlayDuration;
  final VoidCallback? onBannerTap;

  const VipClubBannerCarousel({
    super.key,
    required this.banners,
    this.autoPlayDuration = const Duration(seconds: 5),
    this.onBannerTap,
  });

  @override
  State<VipClubBannerCarousel> createState() => _VipClubBannerCarouselState();
}

class _VipClubBannerCarouselState extends State<VipClubBannerCarousel> {
  late PageController _pageController;
  int _currentPage = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _pageController = PageController();
    _startAutoPlay();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _pageController.dispose();
    super.dispose();
  }

  void _startAutoPlay() {
    _timer = Timer.periodic(widget.autoPlayDuration, (timer) {
      if (widget.banners.isEmpty) return;

      final nextPage = (_currentPage + 1) % widget.banners.length;
      _pageController.animateToPage(
        nextPage,
        duration: const Duration(milliseconds: 400),
        curve: Curves.easeInOut,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    if (widget.banners.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      height: 200,
      margin: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.smallPadding,
      ),
      child: Stack(
        children: [
          PageView.builder(
            controller: _pageController,
            onPageChanged: (index) {
              setState(() {
                _currentPage = index;
              });
            },
            itemCount: widget.banners.length,
            itemBuilder: (context, index) {
              final banner = widget.banners[index];
              return _buildBannerItem(banner);
            },
          ),
          Positioned(
            bottom: 16,
            left: 0,
            right: 0,
            child: _buildIndicators(),
          ),
        ],
      ),
    );
  }

  Widget _buildBannerItem(VipClubBannerModel banner) {
    return GestureDetector(
      onTap: widget.onBannerTap,
      child: Container(
        margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.tinyPadding),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.neutralBlack.withOpacity(0.1),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Image.network(
                banner.imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: ThemeColors.neutralLightGrey,
                    child: const Icon(
                      Icons.image_not_supported,
                      size: 48,
                      color: ThemeColors.neutralGrey,
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
                      Colors.transparent,
                      ThemeColors.neutralBlack.withOpacity(0.7),
                    ],
                  ),
                ),
              ),
              Positioned(
                bottom: 24,
                left: 20,
                right: 20,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      banner.title,
                      style: ThemeTextStyles.headingMedium.copyWith(
                        color: ThemeColors.neutralWhite,
                        fontWeight: FontWeight.bold,
                      ),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    if (banner.subtitle.isNotEmpty) ...[
                      SizedBox(height: ThemeDimensions.tinyPadding),
                      Text(
                        banner.subtitle,
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ThemeColors.neutralWhite.withOpacity(0.9),
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIndicators() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(
        widget.banners.length,
        (index) => Container(
          width: _currentPage == index ? 24 : 8,
          height: 8,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: _currentPage == index
                ? ThemeColors.neutralWhite
                : ThemeColors.neutralWhite.withOpacity(0.5),
          ),
        ),
      ),
    );
  }
}
