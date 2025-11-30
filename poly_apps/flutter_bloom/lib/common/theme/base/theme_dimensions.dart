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

import 'package:flutter/material.dart';
import 'theme_colors.dart';

class ThemeDimensions {
  // Spacing constants
  static const double spacing0 = 0.0;
  static const double spacing2 = 2.0;
  static const double spacing4 = 4.0;
  static const double spacing6 = 6.0;
  static const double spacing8 = 8.0;
  static const double spacing10 = 10.0;
  static const double spacing12 = 12.0;
  static const double spacing14 = 14.0;
  static const double spacing15 = 15.0;
  static const double spacing16 = 16.0;
  static const double spacing18 = 18.0;
  static const double spacing20 = 20.0;
  static const double spacing24 = 24.0;
  static const double spacing25 = 25.0;
  static const double spacing28 = 28.0;
  static const double spacing32 = 32.0;
  static const double spacing36 = 36.0;
  static const double spacing40 = 40.0;
  static const double spacing48 = 48.0;
  static const double spacing56 = 56.0;
  static const double spacing64 = 64.0;
  static const double spacing72 = 72.0;
  static const double spacing80 = 80.0;
  static const double spacing96 = 96.0;
  
  // Semantic spacing aliases
  static const double spacingTiny = spacing4;
  static const double spacingSmall = spacing8;
  static const double spacingMedium = spacing16;
  static const double spacingLarge = spacing24;
  static const double spacingXLarge = spacing32;
  static const double spacingHuge = spacing48;
  static const double defaultPadding = spacing16;

  // Common padding values
  static const double tinyPadding = spacing4;
  static const double smallPadding = spacing8;
  static const double mediumPadding = spacing16;
  static const double largePadding = spacing24;
  static const double hugePadding = spacing48;

  // Common radius values
  static const double smallRadius = radiusS;
  static const double defaultRadius = radiusM;
  static const double largeRadius = radiusL;

  // Legacy compatibility aliases (for migration from old Dimensions class)
  static const double defaultSize = spacing16;
  static const double sizeFifteen = spacing15;
  static const double sizeTwenty = spacing20;
  static const double sizeTwentyFive = spacing25;
  static const double mediumSize = spacing24;
  static const double largeExtraSize = spacing32;
  static const double bigMediumSize = spacing48;
  static const double bigSize = spacing56;
  static const double bigExtraSize = spacing64;
  static const double sizeEighty = spacing80;
  static const double largeSixtySize = spacing64;
  static const double fortySize = spacing40;
  static const double sizeOneTwenty = 120.0;

  // Padding constants
  static const EdgeInsets paddingXS = EdgeInsets.all(spacing4);
  static const EdgeInsets paddingS = EdgeInsets.all(spacing8);
  static const EdgeInsets paddingM = EdgeInsets.all(spacing16);
  static const EdgeInsets paddingL = EdgeInsets.all(spacing24);
  static const EdgeInsets paddingXL = EdgeInsets.all(spacing32);
  static const EdgeInsets paddingXXL = EdgeInsets.all(spacing48);

  // Legacy compatibility padding aliases
  static const double paddingSizeDefault = spacing16;
  static const double paddingSize = spacing8;
  static const double paddingSizeSmall = spacing8;
  static const double paddingSizeLarge = spacing24;
  static const double paddingSizeOverLarge = spacing32;
  static const double paddingSizeSeven = 7.0;
  static const double paddingSizeExtraSmall = 5.0;

  // Semantic padding constants for const usage (double values)
  static const double paddingSmall = spacing8;
  static const double paddingMedium = spacing16;
  static const double paddingLarge = spacing24;

  // Semantic EdgeInsets padding constants
  static const EdgeInsets paddingSmallInsets = paddingS;
  static const EdgeInsets paddingMediumInsets = paddingM;
  static const EdgeInsets paddingLargeInsets = paddingL;

  // Horizontal padding
  static const EdgeInsets paddingHorizontalXS = EdgeInsets.symmetric(horizontal: spacing4);
  static const EdgeInsets paddingHorizontalS = EdgeInsets.symmetric(horizontal: spacing8);
  static const EdgeInsets paddingHorizontalM = EdgeInsets.symmetric(horizontal: spacing16);
  static const EdgeInsets paddingHorizontalL = EdgeInsets.symmetric(horizontal: spacing24);
  static const EdgeInsets paddingHorizontalXL = EdgeInsets.symmetric(horizontal: spacing32);

  // Vertical padding
  static const EdgeInsets paddingVerticalXS = EdgeInsets.symmetric(vertical: spacing4);
  static const EdgeInsets paddingVerticalS = EdgeInsets.symmetric(vertical: spacing8);
  static const EdgeInsets paddingVerticalM = EdgeInsets.symmetric(vertical: spacing16);
  static const EdgeInsets paddingVerticalL = EdgeInsets.symmetric(vertical: spacing24);
  static const EdgeInsets paddingVerticalXL = EdgeInsets.symmetric(vertical: spacing32);

  // Margin constants
  static const EdgeInsets marginXS = EdgeInsets.all(spacing4);
  static const EdgeInsets marginS = EdgeInsets.all(spacing8);
  static const EdgeInsets marginM = EdgeInsets.all(spacing16);
  static const EdgeInsets marginL = EdgeInsets.all(spacing24);
  static const EdgeInsets marginXL = EdgeInsets.all(spacing32);
  static const EdgeInsets marginXXL = EdgeInsets.all(spacing48);

  // Border radius constants
  static const double radiusXS = 2.0;
  static const double radiusS = 4.0;
  static const double radiusM = 8.0;
  static const double radiusL = 12.0;
  static const double radiusXL = 16.0;
  static const double radiusXXL = 24.0;
  static const double radiusRound = 50.0;

  // Legacy compatibility radius aliases
  static const double radiusBig = radiusXL;
  static const double radiusDefault = radiusM;
  static const double radiusLarge = radiusL;
  static const double borderRadius = radiusM;
  static const double borderRadiusMedium = radiusM;
  static const double borderRadiusLarge = radiusL;

  // Additional radius aliases for app_qy
  static const double radiusSm = radiusS;
  static const double radiusMd = radiusM;
  static const double radiusLg = radiusL;
  static const double radiusFull = radiusRound;

  // Circle and avatar sizes
  static const double circleMedium = 20.0;
  static const double circleSmall = 16.0;
  static const double circleLarge = 32.0;

  // Border radius objects
  static const BorderRadius borderRadiusXS = BorderRadius.all(Radius.circular(radiusXS));
  static const BorderRadius borderRadiusS = BorderRadius.all(Radius.circular(radiusS));
  static const BorderRadius borderRadiusM = BorderRadius.all(Radius.circular(radiusM));
  static const BorderRadius borderRadiusL = BorderRadius.all(Radius.circular(radiusL));
  static const BorderRadius borderRadiusXL = BorderRadius.all(Radius.circular(radiusXL));
  static const BorderRadius borderRadiusXXL = BorderRadius.all(Radius.circular(radiusXXL));
  static const BorderRadius borderRadiusRound = BorderRadius.all(Radius.circular(radiusRound));

  // Component dimensions
  static const double buttonHeightS = 32.0;
  static const double buttonHeightM = 44.0;
  static const double buttonHeightL = 56.0;
  static const double buttonHeightXL = 64.0;

  static const double inputHeightS = 32.0;
  static const double inputHeightM = 44.0;
  static const double inputHeightL = 56.0;

  static const double iconSizeXS = 12.0;
  static const double iconSizeS = 16.0;
  static const double iconSizeM = 20.0;
  static const double iconSizeL = 24.0;
  static const double iconSizeXL = 32.0;
  static const double iconSizeXXL = 48.0;

  // Legacy compatibility icon aliases
  static const double iconSizeOffline = iconSizeXL;
  static const double iconSizeDialog = 60.0;
  static const double identityImageHeight = 200.0;

  // Font sizes
  static const double fontSizeExtraLarge = 18.0;
  static const double fontSizeOverLarge = 24.0;

  static const double avatarSizeXS = 24.0;
  static const double avatarSizeS = 32.0;
  static const double avatarSizeM = 40.0;
  static const double avatarSizeL = 56.0;
  static const double avatarSizeXL = 80.0;
  static const double avatarSizeXXL = 120.0;

  // Layout dimensions
  static const double appBarHeight = 56.0;
  static const double tabBarHeight = 48.0;
  static const double bottomNavigationHeight = 56.0;
  static const double toolbarHeight = 56.0;

  static const double cardElevation = 2.0;
  static const double modalElevation = 8.0;
  static const double drawerElevation = 16.0;

  // Screen breakpoints
  static const double mobileBreakpoint = 600.0;
  static const double tabletBreakpoint = 900.0;
  static const double desktopBreakpoint = 1200.0;

  // Container constraints
  static const double maxContentWidth = 1200.0;
  static const double minTouchTarget = 44.0;

  // Animation durations (in milliseconds)
  static const int animationDurationFast = 150;
  static const int animationDurationNormal = 300;
  static const int animationDurationSlow = 500;

  // Animation curves
  static const Curve animationCurveDefault = Curves.easeInOut;
  static const Curve animationCurveEaseIn = Curves.easeIn;
  static const Curve animationCurveEaseOut = Curves.easeOut;
  static const Curve animationCurveBounce = Curves.bounceOut;

  // Platform-specific dimensions
  static double getAppBarHeight(TargetPlatform platform) {
    switch (platform) {
      case TargetPlatform.iOS:
        return 44.0;
      case TargetPlatform.android:
        return 56.0;
      default:
        return appBarHeight;
    }
  }

  static double getTabBarHeight(TargetPlatform platform) {
    switch (platform) {
      case TargetPlatform.iOS:
        return 49.0;
      case TargetPlatform.android:
        return 48.0;
      default:
        return tabBarHeight;
    }
  }

  static EdgeInsets getSystemPadding(TargetPlatform platform) {
    switch (platform) {
      case TargetPlatform.iOS:
        return const EdgeInsets.symmetric(horizontal: spacing16);
      case TargetPlatform.android:
        return const EdgeInsets.symmetric(horizontal: spacing16);
      default:
        return paddingHorizontalM;
    }
  }



  static double getResponsiveSpacing(double screenWidth) {
    if (screenWidth < mobileBreakpoint) {
      return spacing8;
    } else if (screenWidth < tabletBreakpoint) {
      return spacing12;
    } else {
      return spacing16;
    }
  }

  static int getResponsiveColumns(double screenWidth) {
    if (screenWidth < mobileBreakpoint) {
      return 1;
    } else if (screenWidth < tabletBreakpoint) {
      return 2;
    } else if (screenWidth < desktopBreakpoint) {
      return 3;
    } else {
      return 4;
    }
  }

  // Utility methods
  static EdgeInsets symmetric({double? horizontal, double? vertical}) {
    return EdgeInsets.symmetric(
      horizontal: horizontal ?? 0.0,
      vertical: vertical ?? 0.0,
    );
  }

  static EdgeInsets only({
    double? left,
    double? top,
    double? right,
    double? bottom,
  }) {
    return EdgeInsets.only(
      left: left ?? 0.0,
      top: top ?? 0.0,
      right: right ?? 0.0,
      bottom: bottom ?? 0.0,
    );
  }

  static BorderRadius circular(double radius) {
    return BorderRadius.circular(radius);
  }

  static BorderRadius borderRadiusOnly({
    double? topLeft,
    double? topRight,
    double? bottomLeft,
    double? bottomRight,
  }) {
    return BorderRadius.only(
      topLeft: Radius.circular(topLeft ?? 0.0),
      topRight: Radius.circular(topRight ?? 0.0),
      bottomLeft: Radius.circular(bottomLeft ?? 0.0),
      bottomRight: Radius.circular(bottomRight ?? 0.0),
    );
  }

  // Size utilities
  static Size buttonSize(String size) {
    switch (size.toLowerCase()) {
      case 'small':
        return const Size(double.infinity, buttonHeightS);
      case 'medium':
        return const Size(double.infinity, buttonHeightM);
      case 'large':
        return const Size(double.infinity, buttonHeightL);
      case 'xlarge':
        return const Size(double.infinity, buttonHeightXL);
      default:
        return const Size(double.infinity, buttonHeightM);
    }
  }

  static double getIconSize(String size) {
    switch (size.toLowerCase()) {
      case 'xs':
        return iconSizeXS;
      case 'small':
        return iconSizeS;
      case 'medium':
        return iconSizeM;
      case 'large':
        return iconSizeL;
      case 'xl':
        return iconSizeXL;
      case 'xxl':
        return iconSizeXXL;
      default:
        return iconSizeM;
    }
  }

  
  /// Primary button style that apps can customize
  static ButtonStyle get primaryButtonStyle => ElevatedButton.styleFrom(
    backgroundColor: ThemeColors.blue,
    foregroundColor: Colors.white,
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radiusM),
    ),
    elevation: 2,
    textStyle: const TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
    ),
  );
  
  /// Secondary button style
  static ButtonStyle get secondaryButtonStyle => OutlinedButton.styleFrom(
    foregroundColor: ThemeColors.blue,
    side: const BorderSide(color: ThemeColors.blue, width: 1.5),
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radiusM),
    ),
    textStyle: const TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
    ),
  );
  
  /// Danger/warning button style
  static ButtonStyle get dangerButtonStyle => ElevatedButton.styleFrom(
    backgroundColor: ThemeColors.red,
    foregroundColor: Colors.white,
    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(radiusM),
    ),
    elevation: 2,
    textStyle: const TextStyle(
      fontSize: 16,
      fontWeight: FontWeight.w600,
    ),
  );
  
  
  /// Default card decoration
  static BoxDecoration get defaultCardDecoration => BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(radiusM),
    boxShadow: [
      BoxShadow(
        color: ThemeColors.black.withOpacity(0.1),
        blurRadius: 8,
        offset: const Offset(0, 4),
      ),
    ],
    border: Border.all(
      color: ThemeColors.separator.withOpacity(0.2),
      width: 1,
    ),
  );
  
  /// Elevated card decoration
  static BoxDecoration get elevatedCardDecoration => BoxDecoration(
    color: Colors.white,
    borderRadius: BorderRadius.circular(radiusLarge),
    boxShadow: [
      BoxShadow(
        color: ThemeColors.black.withOpacity(0.15),
        blurRadius: 12,
        offset: const Offset(0, 6),
      ),
    ],
  );
  
  
  /// Primary gradient
  static LinearGradient get primaryGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.blue,
      ThemeColors.blue80,
    ],
  );
  
  /// Secondary gradient
  static LinearGradient get secondaryGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.green,
      ThemeColors.green80,
    ],
  );
  
  /// Success gradient
  static LinearGradient get successGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.green,
      Color(0xFF66BB6A),
    ],
  );
  
  /// Warning gradient
  static LinearGradient get warningGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.orange,
      Color(0xFFE57373),
    ],
  );
  
  /// Error gradient
  static LinearGradient get errorGradient => const LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [
      ThemeColors.red,
      Color(0xFFEF5350),
    ],
  );
  
  
  /// Get responsive padding based on screen size
  static EdgeInsets getResponsivePadding(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    
    if (screenWidth < 360) {
      return paddingS;
    } else if (screenWidth > 768) {
      return paddingL;
    } else {
      return paddingM;
    }
  }
  
  /// Get adaptive border radius based on screen size
  static BorderRadius getAdaptiveBorderRadius(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    
    if (screenWidth < 360) {
      return BorderRadius.circular(radiusS);
    } else if (screenWidth > 768) {
      return BorderRadius.circular(radiusL);
    } else {
      return BorderRadius.circular(radiusM);
    }
  }
  
  /// Get screen size category
  static String getScreenSizeCategory(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    
    if (screenWidth < 360) {
      return 'small';
    } else if (screenWidth > 768) {
      return 'large';
    } else {
      return 'medium';
    }
  }
  
  /// Check if current theme is dark
  static bool isDarkTheme(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark;
  }

  // These provide backward compatibility with the old Dimensions class

  // Responsive font sizes (from old Dimensions class)
  static late double fontSizeExtraSmall;
  static late double fontSizeSmall;
  static late double fontSizeDefault;
  static late double fontSizeMedium;
  static late double fontSizeLarge;
  static late double fontSizeOverExtraLarge;
  static late double fontSizeOverOverExtraLarge;
  static late double fontSizeOverOverOverExtraLarge;

  // Screen dimensions
  static double splashLogoWidth = 150.0;
  static late double screenThirdWidth;
  static late double screenHalfWidth;
  static late double screenTwoThirdWidth;
  static late double seventyFivePercentWidth;
  static late double onePointFiveWidth;

  // Additional padding sizes
  static const double paddingSizeTiny = 3.0;
  static const double paddingSizeExtraLarge = 25.0;
  static const double paddingSizeSignUp = 35.0;
  static const double paddingSizeOver = 50.0;

  // Additional radius sizes
  static const double radiusSmall = 5.0;
  static const double radiusExtraLarge = 20.0;

  // Additional size constants
  static const double sizeOneEighty = 180.0;

  // Web and layout dimensions
  static const double webMaxWidth = 1170;
  static const double identityImageWidth = 130;
  static const double androidAppBarHeight = 200;

  // Additional icon sizes
  static const double iconSizeSmall = 15;
  static const double iconSizeMedium = 20;
  static const double rewardImageSize = 70;
  static const double rewardImageSizeOfferPage = 150;
  static const double customerReactionSize = 100;
  static const double iconSizeOnline = 100;
  static const double iconSizeDoubleExtraLarge = 40;
  static const double roadArrowHeight = 50;
  static const double weatherIconSize = 60;
  static const double dropDownWidth = 140;
  static const double compassPadding = 50;
  static const double topSpace = 100;
  static const double topBelowSpace = 40;

  // Bottom spacing
  static const double bottomMedium = 50;
  static const double bottomLarge = 100;

  // Outline dimensions
  static const double outlineHeight = 50;
  static const double outlineWidth = 50;

  // Order status icon
  static const double orderStatusIconHeight = 70;


  /// Initialize responsive dimensions (from old Dimensions class)
  static void refresh(BuildContext context) {
    final width = MediaQuery.of(context).size.width;
    
    // Responsive font sizes
    fontSizeExtraSmall = width >= 1300 ? 14 : 10;
    fontSizeSmall = width >= 1300 ? 16 : 12;
    fontSizeDefault = width >= 1300 ? 18 : 14;
    fontSizeMedium = width >= 1300 ? 20 : 16;
    fontSizeLarge = width >= 1300 ? 20 : 16;
    fontSizeOverExtraLarge = width >= 1300 ? 32 : 28;
    fontSizeOverOverExtraLarge = width >= 1300 ? 36 : 32;
    fontSizeOverOverOverExtraLarge = width >= 1300 ? 40 : 36;
    
    // Responsive screen dimensions
    splashLogoWidth = width <= 400 ? 120 : 150.0;
    screenThirdWidth = width / 3;
    screenHalfWidth = width / 2;
    screenTwoThirdWidth = width * 2 / 3;
    seventyFivePercentWidth = width * 0.75;
    onePointFiveWidth = width * 1.5;
  }

  // These provide direct access to old Dimensions class constants

  /// Legacy alias for backward compatibility
  static const double menuIconSize = iconSizeL;

  // Backward compatibility aliases for app_qy
  static const double radiusMedium = radiusM;
  static const double spacingXSmall = spacing4;
  static const double paddingXSmall = spacing4;
  static const double paddingXLarge = spacing32;
  static const double radiusXLarge = radiusXL;
}
