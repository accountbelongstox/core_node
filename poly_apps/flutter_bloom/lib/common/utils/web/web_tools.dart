// web_tools.dart
import 'webabs.dart';
import 'web_tools_non_web.dart' if (dart.library.html) 'web_tools_web.dart';

WebTools getWebTools() => WebToolsImpl();
