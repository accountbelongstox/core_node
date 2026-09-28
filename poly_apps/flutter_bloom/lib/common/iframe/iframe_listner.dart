import 'package:qyflutter/common/utils/web/web_tools.dart';

final webTools = getWebTools();
void initIframeListenerIfWeb() {
  if (!webTools.isWebAndInIframe()) return;
  webTools.iframeListener((data, type) {
    print('Received iframe message: type=$type');

    switch (type) {
      case 'unselect':
        handleUnselectMessage(data);
        break;
      case 'navigate':
        handleNavigationMessage(data);
        break;
      default:
        print('Unknown message type: $type');
        break;
    }
  });
}

void handleUnselectMessage(dynamic data) {
  print('Handling unselect message: $data');
}

void handleNavigationMessage(dynamic data) {
  print('Handling navigation message: $data');
}
