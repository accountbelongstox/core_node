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

/// Endpoint Discovery Controller for QY App
/// Manages endpoint discovery state and retry logic
library;

import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:qyflutter/common/network/core/multi_endpoint_discovery.dart';
import '../config_app_qy/api_config_app_qy.dart';
import '../localization_app_qy/localization_keys_app_qy.dart';
import '../resources_app_qy/colors_app_qy.dart';
import '../../../../common/localization/localization_manager.dart';

class EndpointDiscoveryControllerAppQy extends ChangeNotifier {
  final MultiEndpointDiscovery _discovery = MultiEndpointDiscovery();
  Timer? _retryTimer;
  bool _isRetrying = false;
  bool _hasAvailableEndpoint = false;
  bool _isNotificationVisible = false;
  bool _isNotificationDismissed = false;
  bool _hasShownSuccessNotification = false;
  DateTime? _lastCheckTime;
  BuildContext? _context;

  bool get isRetrying => _isRetrying;
  bool get hasAvailableEndpoint => _hasAvailableEndpoint;
  bool get isNotificationVisible =>
      _isNotificationVisible && !_isNotificationDismissed;
  DateTime? get lastCheckTime => _lastCheckTime;

  EndpointDiscoveryControllerAppQy() {
    _initialize();
  }

  void setContext(BuildContext context) {
    _context = context;
  }

  void _initialize() {
    _discovery.configureEndpoints(ApiConfigAppQy.endpointConfigs);
    _checkEndpointAvailability();

    // Start initial delay of 10 seconds before showing notification
    Future.delayed(const Duration(seconds: 10), () {
      if (!_hasAvailableEndpoint && !_isNotificationDismissed) {
        _isNotificationVisible = true;
        notifyListeners();
      }
    });
  }

  Future<void> _checkEndpointAvailability() async {
    _lastCheckTime = DateTime.now();

    try {
      final selectedEndpoint = await _discovery.discoverAvailableEndpoint(
        healthCheckPath: '',
        timeout: const Duration(seconds: 2),
        parallelScan: true,
      );

      if (selectedEndpoint != null) {
        _hasAvailableEndpoint = true;
        _isRetrying = false;
        _isNotificationVisible = false;
        _isNotificationDismissed = false;
        // Stop retry timer once endpoint is found
        _cancelRetryTimer();

        // Show success notification once in debug mode
        // Use delayed check to ensure context is available
        if (kDebugMode && !_hasShownSuccessNotification) {
          _hasShownSuccessNotification = true;
          _showSuccessNotificationDelayed(selectedEndpoint);
        }

        notifyListeners();
      } else {
        _hasAvailableEndpoint = false;
        _ensureRetryTimer();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('⚠️ Endpoint discovery error: $e');
      _hasAvailableEndpoint = false;
      _ensureRetryTimer();
      notifyListeners();
    }
  }

  void _ensureRetryTimer() {
    // Only start retry timer if no endpoint is available
    if (_hasAvailableEndpoint) {
      return;
    }

    if (_retryTimer != null && _retryTimer!.isActive) {
      return;
    }

    _isRetrying = true;
    notifyListeners();

    _retryTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
      // Stop timer if endpoint is found
      if (_hasAvailableEndpoint) {
        _cancelRetryTimer();
        return;
      }
      _checkEndpointAvailability();
    });
  }

  void _cancelRetryTimer() {
    _retryTimer?.cancel();
    _retryTimer = null;
    _isRetrying = false;
  }

  void _showSuccessNotificationDelayed(EndpointConfig endpoint) {
    // Retry showing notification until context is available
    Future.delayed(const Duration(milliseconds: 500), () {
      if (_context != null && _context!.mounted) {
        _showSuccessNotification(_context!, endpoint);
      } else {
        // Retry after another delay if context is not ready
        Future.delayed(const Duration(milliseconds: 1000), () {
          if (_context != null && _context!.mounted) {
            _showSuccessNotification(_context!, endpoint);
          } else {
            // Final retry
            Future.delayed(const Duration(milliseconds: 2000), () {
              if (_context != null && _context!.mounted) {
                _showSuccessNotification(_context!, endpoint);
              } else {
                debugPrint(
                    '⚠️ Could not show success notification: context not available');
              }
            });
          }
        });
      }
    });
  }

  void _showSuccessNotification(BuildContext context, EndpointConfig endpoint) {
    final endpointUrl = endpoint.buildFullUrl();
    try {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            '${QyAppLocalizationKeys.qyNetworkStable.tr(context)}\n'
            'Endpoint: $endpointUrl\n'
            'Debug mode enabled. Set kDebugMode=false to disable.',
          ),
          duration: const Duration(seconds: 5),
          backgroundColor: ColorsAppQy.qySuccess,
          action: SnackBarAction(
            label: QyAppLocalizationKeys.qyClose.tr(context),
            textColor: ColorsAppQy.qyTextOnPrimary,
            onPressed: () {},
          ),
        ),
      );
    } catch (e) {
      debugPrint('⚠️ Error showing success notification: $e');
    }
  }

  void dismissNotification() {
    _isNotificationDismissed = true;
    _isNotificationVisible = false;
    notifyListeners();
  }

  void showNotification() {
    if (!_hasAvailableEndpoint) {
      _isNotificationDismissed = false;
      _isNotificationVisible = true;
      notifyListeners();
    }
  }

  Future<void> manualRetry() async {
    _isNotificationDismissed = false;
    _isNotificationVisible = true;
    await _checkEndpointAvailability();
  }

  @override
  void dispose() {
    _cancelRetryTimer();
    super.dispose();
  }
}
