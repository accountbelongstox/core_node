import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../router_app_travel/routes_provider_app_travel.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../resources_app_travel/assets_images_app_travel.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';
import '../../../resources_app_travel/colors_app_travel.dart';

class HomeHeader extends StatelessWidget {
  final double scrollTop;
  final String currentCity;
  final VoidCallback? onCityTap;
  final VoidCallback? onMenuTap;

  const HomeHeader({
    super.key,
    this.scrollTop = 0,
    this.currentCity = '塞班',
    this.onCityTap,
    this.onMenuTap,
  });

  Color _calculateHeaderBackground() {
    final opacity = (scrollTop / 90).clamp(0.0, 1.0);
    return Color.fromRGBO(255, 255, 255, opacity);
  }

  Color _calculateSearchBackground() {
    final value = scrollTop / 1350;
    final rgb = (255 - value * 255).clamp(0, 255).toInt();
    return Color.fromRGBO(rgb, rgb, rgb, 1.0);
  }

  Color _calculateCityColor() {
    final value = scrollTop / 150;
    final rgb = (255 - value * 255).clamp(0, 255).toInt();
    return Color.fromRGBO(rgb, rgb, rgb, 1.0);
  }

  BoxShadow? _calculateBoxShadow() {
    if (scrollTop >= 90) {
      return BoxShadow(
        color: Colors.black.withOpacity(0.1),
        blurRadius: 4.0,
        offset: const Offset(0, 4.0),
      );
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final headerBg = _calculateHeaderBackground();
    final searchBg = _calculateSearchBackground();
    final cityColor = _calculateCityColor();
    final boxShadow = _calculateBoxShadow();

    return Container(
      height: 48.0,
      decoration: BoxDecoration(
        color: Colors.transparent,
      ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(10.0, 6.0, 10.0, 6.0),
        child: Row(
          children: [
            Expanded(
              child: Container(
                height: 36.0,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18.0),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.15),
                      blurRadius: 8.0,
                      offset: const Offset(0, 2.0),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () {
                          context.push(TravelAppRoutesProvider.routeSearch);
                        },
                        child: Container(
                          padding: const EdgeInsets.only(left: 14.0),
                          alignment: Alignment.centerLeft,
                          child: Text(
                            TravelLocalizationKeys.travelNewUserGift.tr(context),
                            style: TextStyle(
                              fontSize: 11.0,
                              color: Colors.grey[600],
                            ),
                          ),
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () {
                        context.push(TravelAppRoutesProvider.routeSearch);
                      },
                      child: Container(
                        margin: const EdgeInsets.all(5.0),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16.0,
                          vertical: 6.0,
                        ),
                        decoration: BoxDecoration(
                          color: TravelColors.travelPrimary,
                          borderRadius: BorderRadius.circular(13.0),
                        ),
                        child: Text(
                          TravelLocalizationKeys.travelSearch.tr(context),
                          style: const TextStyle(
                            fontSize: 10.0,
                            color: Colors.white,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 8.0),
            _buildHotelLogo(context),
          ],
        ),
      ),
    );
  }

  Widget _buildHotelLogo(BuildContext context) {
    return GestureDetector(
      onTap: () {
        debugPrint('Hotel logo tapped');
      },
      child: SizedBox(
        height: 36.0,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            SizedBox(
              width: 26.0,
              height: 26.0,
              child: Image.asset(
                AssetsImagesAppTravel.travelHotelTitleLogo,
                fit: BoxFit.contain,
                color: Colors.white,
                errorBuilder: (context, error, stackTrace) {
                  return const Icon(
                    Icons.hotel,
                    size: 20.0,
                    color: Colors.white,
                  );
                },
              ),
            ),
            const SizedBox(height: 1.5),
            Text(
              '酒店比价',
              style: const TextStyle(
                fontSize: 7.0,
                color: Colors.white,
                fontWeight: FontWeight.w400,
                height: 1.0,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildUserAvatar(BuildContext context) {
    final userProvider = context.watch<UserProviderAppTravel>();
    final user = userProvider.user;

    return GestureDetector(
      onTap: () {
        context.go(TravelAppRoutesProvider.routeProfile);
      },
      child: Container(
        width: 40.0,
        height: 40.0,
        decoration: BoxDecoration(
          color: Colors.white,
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white,
            width: 1.0,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.15),
              blurRadius: 8.0,
              offset: const Offset(0, 2.0),
            ),
          ],
        ),
        child: ClipOval(
          child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
              ? Image.network(
                  user.avatarUrl!,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return _buildDefaultAvatar();
                  },
                )
              : Image.asset(
                  AssetsImagesAppTravel.travelUserAvatarDefault,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return _buildDefaultAvatar();
                  },
                ),
        ),
      ),
    );
  }

  Widget _buildDefaultAvatar() {
    return Container(
      color: TravelColors.travelPrimaryLight,
      child: const Icon(
        Icons.person,
        size: 24.0,
        color: TravelColors.travelPrimary,
      ),
    );
  }

  Widget _buildDot(Color color) {
    return Container(
      width: 4.0,
      height: 4.0,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(2.0),
      ),
    );
  }
}
