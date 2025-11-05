import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';
import '../../../resources_app_travel/colors_app_travel.dart';

class ServiceScreen extends StatelessWidget {
  const ServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(TravelLocalizationKeys.travelCustomerService.tr(context)),
        backgroundColor: TravelColors.travelPrimary,
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.headset_mic,
              size: 80.0,
              color: TravelColors.travelPrimary,
            ),
            const SizedBox(height: 16.0),
            Text(
              TravelLocalizationKeys.travelServiceCenter.tr(context),
              style: const TextStyle(
                fontSize: 24.0,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 8.0),
            Text(
              TravelLocalizationKeys.travelOnlineServiceDev.tr(context),
              style: const TextStyle(
                fontSize: 14.0,
                color: Colors.grey,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
