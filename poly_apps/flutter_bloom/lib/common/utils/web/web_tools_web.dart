import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:html' as html;
import 'dart:convert';
import 'webabs.dart';

class WebToolsImpl implements WebTools {
  bool _iframeListenerInitialized = false;
  Function(html.MessageEvent)? _messageHandler;

  @override
  Map<String, String> getQueryParams() {
    if (!kIsWeb) return {};
    return getWebQueryParams();
  }

  @override
  String getWindowHref() {
    if (!kIsWeb) return '';
    return html.window.location.href;
  }

  Map<String, String> getWebQueryParams() {
    if (!kIsWeb) return {};
    try {
      final uri = Uri.parse(html.window.location.href);
      return uri.queryParameters;
    } catch (e) {
      print('Error parsing query params: $e');
      return {};
    }
  }

  @override
  dynamic extractEventData(dynamic event) {
    if (!kIsWeb) return {};

    try {
      // Try direct property access
      try {
        return event.data;
      } catch (_) {}

      // Try indexing
      try {
        return event['data'];
      } catch (_) {}

      // Try detail for CustomEvent
      try {
        return event.detail ?? event['detail'];
      } catch (_) {}

      // Last resort - string parsing
      final str = event.toString();
      if (str.contains('data:')) {
        return str.substring(str.indexOf('data:') + 5).trim();
      }

      return {};
    } catch (e) {
      print('Error extracting event data: $e');
      return {};
    }
  }

  @override
  bool isInIframe() {
    if (!kIsWeb) return false;
    try {
      return html.window.self != html.window.top;
    } catch (e) {
      return true;
    }
  }

  @override
  bool sendMessageToParent([dynamic message]) {
    if (!isInIframe()) return false;

    try {
      final data = message ??
          {
            'type': 'default',
            'message': 'Message from Flutter iframe',
            'source': 'flutter_iframe',
            'timestamp': DateTime.now().toIso8601String(),
          };

      final jsonString = jsonEncode(data);
      html.window.parent?.postMessage(jsonString, '*');
      return true;
    } catch (e) {
      print('Error sending message to parent: $e');
      return false;
    }
  }

  @override
  void iframeListener(Function(dynamic, String) callback) {
    if (!kIsWeb || _iframeListenerInitialized) return;

    _messageHandler = (html.MessageEvent event) {
      try {
        final data = extractEventData(event);
        if (data != null) {
          final type = data['type'] ?? 'unknown';
          callback(data, type.toString());
        }
      } catch (e) {
        // Handle error silently
      }
    };

    html.window.onMessage.listen(_messageHandler!);

    _iframeListenerInitialized = true;
  }

  @override
  void disposeIframeListener() {
    if (!kIsWeb || !_iframeListenerInitialized) return;

    _messageHandler = null;
    _iframeListenerInitialized = false;
  }

  @override
  bool isWebAndInIframe() => kIsWeb && isInIframe();
}

WebTools getWebTools() => WebToolsImpl();
