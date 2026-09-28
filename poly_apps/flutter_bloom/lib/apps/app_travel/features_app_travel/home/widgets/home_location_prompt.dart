import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';
import '../../../resources_app_travel/colors_app_travel.dart';

class HomeLocationPrompt extends StatefulWidget {
  const HomeLocationPrompt({super.key});

  @override
  State<HomeLocationPrompt> createState() => _HomeLocationPromptState();
}

class _HomeLocationPromptState extends State<HomeLocationPrompt> {
  static bool _hasBeenDismissedThisSession = false;

  void _closePrompt() {
    setState(() {
      _hasBeenDismissedThisSession = true;
    });
  }

  void _enableLocation() {
    debugPrint('Enable location clicked');
    _closePrompt();
  }

  @override
  Widget build(BuildContext context) {
    if (_hasBeenDismissedThisSession) {
      return const SizedBox.shrink();
    }

    return Positioned(
      left: 0,
      right: 0,
      bottom: 12.0,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        decoration: BoxDecoration(
          color: TravelColors.travelBackgroundDarkWithOpacity(0.95),
          borderRadius: BorderRadius.circular(8.0),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 8.0,
              offset: const Offset(0, 2.0),
            ),
          ],
        ),
        child: Row(
          children: [
            Expanded(
              child: Text(
                TravelLocalizationKeys.travelEnableLocation.tr(context),
                style: const TextStyle(
                  fontSize: 14.0,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 12.0),
            GestureDetector(
              onTap: _enableLocation,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20.0,
                  vertical: 8.0,
                ),
                decoration: BoxDecoration(
                  color: TravelColors.travelPrimary,
                  borderRadius: BorderRadius.circular(16.0),
                ),
                child: Text(
                  TravelLocalizationKeys.travelGoEnable.tr(context),
                  style: const TextStyle(
                    fontSize: 14.0,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8.0),
            GestureDetector(
              onTap: _closePrompt,
              child: Container(
                padding: const EdgeInsets.all(4.0),
                child: const Icon(
                  Icons.close,
                  size: 20.0,
                  color: Colors.white70,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
