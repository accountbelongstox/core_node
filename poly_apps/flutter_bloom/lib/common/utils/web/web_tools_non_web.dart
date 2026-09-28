import 'webabs.dart';

class WebToolsImpl implements WebTools {
  @override
  Map<String, String> getQueryParams() => {};

  @override
  String getWindowHref() => '';

  @override
  bool isInIframe() => false;

  @override
  bool sendMessageToParent([dynamic message]) => false;

  @override
  void iframeListener(Function(dynamic, String) callback) {}

  @override
  void disposeIframeListener() {}

  @override
  dynamic extractEventData(dynamic event) => null;

  @override
  bool isWebAndInIframe() => false;
}

WebTools getWebTools() => WebToolsImpl();
