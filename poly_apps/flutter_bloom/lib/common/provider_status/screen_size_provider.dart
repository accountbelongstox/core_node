import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class ScreenSizeProvider extends ChangeNotifier {
  Size _screenSize = Size.zero;
  double _width = 0;
  double _height = 0;
  bool _isMobile = false;
  bool _isTablet = false;
  bool _isDesktop = false;

  Size get screenSize => _screenSize;
  double get width => _width;
  double get height => _height;
  bool get isMobile => _isMobile;
  bool get isTablet => _isTablet;
  bool get isDesktop => _isDesktop;
  double? beforeWidth = 0;
  double? beforeHeight = 0;

  void updateScreenSize(BuildContext context) {
    final newSize = MediaQuery.of(context).size;
    if (newSize == _screenSize) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _screenSize = newSize;
      _width = newSize.width;
      _height = newSize.height;

      _isMobile = _width < 650;
      _isTablet = _width >= 650 && _width < 1100;
      _isDesktop = _width >= 1100;

      ThemeDimensions.refresh(context);
      notifyListeners();
    });
  }
}
