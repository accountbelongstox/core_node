import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../widgets/travel_icons.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';

class HomeWelcome extends StatelessWidget {
  final String cityName;
  final String temperature;

  const HomeWelcome({
    super.key,
    required this.cityName,
    this.temperature = '32',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: EdgeInsets.zero,
      height: 32.0,
      alignment: Alignment.center,
      child: Stack(
        children: [
          Positioned(
            left: 12.0,
            top: 0,
            bottom: 0,
            child: Row(
              children: [
                Icon(
                  TravelIcons.cloud,
                  size: 25.0,
                  color: Colors.black87,
                ),
                const SizedBox(width: 2.0),
                Text(
                  '$temperature℃',
                  style: const TextStyle(
                    fontSize: 12.0,
                    color: Colors.black87,
                  ),
                ),
              ],
            ),
          ),
          Center(
            child: Text(
              '${TravelLocalizationKeys.travelWelcomeToCity.tr(context)}$cityName',
              style: const TextStyle(
                fontSize: 16.0,
                height: 1.0,
                color: Colors.black87,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ],
      ),
    );
  }
}
