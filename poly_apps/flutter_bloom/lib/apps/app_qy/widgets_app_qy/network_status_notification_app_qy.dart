// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

/// Global Network Status Notification Widget for QY App
/// Displays at the top center of the screen when API endpoints are unavailable
library;

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../../../common/theme/base/theme_dimensions.dart';
import '../../../../common/theme/base/theme_text_styles.dart';
import '../../../../common/localization/localization_manager.dart';
import '../localization_app_qy/localization_keys_app_qy.dart';
import '../resources_app_qy/colors_app_qy.dart';
import '../controller_app_qy/endpoint_discovery_controller_app_qy.dart';

class NetworkStatusNotificationAppQy extends StatelessWidget {
  const NetworkStatusNotificationAppQy({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<EndpointDiscoveryControllerAppQy>(
      builder: (context, controller, child) {
        if (!controller.isNotificationVisible) {
          return const SizedBox.shrink();
        }

        return Positioned(
          top: 0,
          left: 0,
          right: 0,
          child: SafeArea(
            bottom: false,
            child: Container(
              margin: const EdgeInsets.symmetric(
                horizontal: ThemeDimensions.spacing16,
                vertical: ThemeDimensions.spacing8,
              ),
              padding: const EdgeInsets.symmetric(
                horizontal: ThemeDimensions.spacing16,
                vertical: ThemeDimensions.spacing12,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    ColorsAppQy.qyError.withOpacity(0.9),
                    ColorsAppQy.qyError.withOpacity(0.8),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(ThemeDimensions.radiusLarge),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 10,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (controller.isRetrying)
                    SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        valueColor: AlwaysStoppedAnimation<Color>(
                          Colors.white,
                        ),
                      ),
                    )
                  else
                    Icon(
                      Icons.wifi_off,
                      size: 16,
                      color: Colors.white,
                    ),
                  const SizedBox(width: ThemeDimensions.spacing8),
                  Expanded(
                    child: Text(
                      controller.isRetrying
                          ? QyAppLocalizationKeys.qyNetworkRetrying.tr(context)
                          : QyAppLocalizationKeys.qyNetworkUnavailableMessage.tr(context),
                      style: ThemeTextStyles.body2.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.w500,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(width: ThemeDimensions.spacing8),
                  IconButton(
                    icon: const Icon(
                      Icons.close,
                      size: 18,
                      color: Colors.white,
                    ),
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(
                      minWidth: 24,
                      minHeight: 24,
                    ),
                    onPressed: () {
                      controller.dismissNotification();
                    },
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

