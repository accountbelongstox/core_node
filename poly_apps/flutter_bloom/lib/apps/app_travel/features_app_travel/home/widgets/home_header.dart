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
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10.5),
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
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 4.0,
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
                          padding: const EdgeInsets.only(left: 16.0),
                          alignment: Alignment.centerLeft,
                          child: Text(
                            '新人大礼包',
                            style: TextStyle(
                              fontSize: 14.0,
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
                        margin: const EdgeInsets.all(4.0),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20.0,
                          vertical: 6.0,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFF00D0D8),
                          borderRadius: BorderRadius.circular(14.0),
                        ),
                        child: const Text(
                          '搜索',
                          style: TextStyle(
                            fontSize: 13.0,
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
            GestureDetector(
              onTap: onMenuTap,
              child: Container(
                width: 32.0,
                height: 32.0,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16.0),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.05),
                      blurRadius: 4.0,
                      offset: const Offset(0, 2.0),
                    ),
                  ],
                ),
                child: Icon(
                  TravelIcons.scan,
                  size: 18.0,
                  color: const Color(0xFF00D0D8),
                ),
              ),
            ),
          ],
        ),
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
