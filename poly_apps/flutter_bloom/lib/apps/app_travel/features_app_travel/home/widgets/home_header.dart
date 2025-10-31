import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:provider/provider.dart';
import '../../../router_app_travel/routes_provider_app_travel.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../widgets/travel_icons.dart';

class HomeHeader extends StatelessWidget {
  final double scrollTop;
  final String currentCity;
  final VoidCallback? onCityTap;
  final VoidCallback? onMenuTap;

  const HomeHeader({
    super.key,
    this.scrollTop = 0,
    this.currentCity = 'Luoyang',
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
      height: 44.0,
      decoration: BoxDecoration(
        color: headerBg,
        boxShadow: boxShadow != null ? [boxShadow] : null,
      ),
      child: Row(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10.5),
            child: GestureDetector(
              onTap: onCityTap ?? () async {
                final selectedCity = await context.push<String>(
                  TravelAppRoutesProvider.routeCity,
                );
                if (selectedCity != null && context.mounted) {
                  final userProvider = context.read<UserProviderAppTravel>();
                  await userProvider.updateProfile(currentCity: selectedCity);
                }
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 56.0),
                    child: Text(
                      currentCity,
                      style: TextStyle(
                        color: cityColor,
                        fontSize: 14.0,
                        overflow: TextOverflow.ellipsis,
                      ),
                      maxLines: 1,
                    ),
                  ),
                  Icon(
                    TravelIcons.arrowDown,
                    size: 12.0,
                    color: cityColor,
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: Container(
              height: 32.0,
              alignment: Alignment.center,
              child: Stack(
                children: [
                  Container(
                    height: 32.0,
                    decoration: BoxDecoration(
                      color: searchBg,
                      borderRadius: BorderRadius.circular(16.0),
                    ),
                    child: GestureDetector(
                      onTap: () {
                        context.push(TravelAppRoutesProvider.routeSearch);
                      },
                      child: AbsorbPointer(
                        child: TextField(
                          decoration: InputDecoration(
                            hintText: '$currentCity攻略·游记·精选酒店',
                            hintStyle: TextStyle(
                              fontSize: 12.0,
                              color: Colors.grey[400],
                            ),
                            border: InputBorder.none,
                            contentPadding: const EdgeInsets.only(
                              left: 28.0,
                              right: 14.0,
                            ),
                          ),
                          style: const TextStyle(fontSize: 12.0),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    left: 6.0,
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: Icon(
                        TravelIcons.search,
                        size: 14.0,
                        color: const Color(0xFF00BCD4),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10.0),
            child: GestureDetector(
              onTap: onMenuTap,
              child: Container(
                width: 30.0,
                height: 24.0,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24.0),
                  border: Border.all(
                    color: searchBg,
                    width: 0.5,
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    _buildDot(cityColor),
                    const SizedBox(width: 2.0),
                    _buildDot(cityColor),
                    const SizedBox(width: 2.0),
                    _buildDot(cityColor),
                  ],
                ),
              ),
            ),
          ),
        ],
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
