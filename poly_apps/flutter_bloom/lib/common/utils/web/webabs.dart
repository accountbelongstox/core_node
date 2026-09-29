// webabs.dart
abstract class WebTools {
  Map<String, String> getQueryParams();
  String getWindowHref();
  bool isInIframe();
  bool sendMessageToParent([dynamic message]);
  void iframeListener(Function(dynamic, String) callback);
  void disposeIframeListener();
  dynamic extractEventData(dynamic event);
  bool isWebAndInIframe();
}
