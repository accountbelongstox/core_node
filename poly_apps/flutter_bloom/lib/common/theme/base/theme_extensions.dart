import 'package:flutter/material.dart';
import 'theme_colors.dart';
import 'theme_text_styles.dart';
import 'theme_dimensions.dart';
import 'theme_shadow.dart';

class ThemeExtensions {
  static BoxDecoration cardDecoration({
    Color? backgroundColor,
    BorderRadius? borderRadius,
    List<BoxShadow>? boxShadow,
    Border? border,
  }) {
    return BoxDecoration(
      color: backgroundColor ?? ThemeColors.neutralWhite,
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusM,
      boxShadow: boxShadow ?? ThemeShadow.card,
      border: border,
    );
  }

  static BoxDecoration outlinedDecoration({
    Color? borderColor,
    double borderWidth = 1.0,
    BorderRadius? borderRadius,
    Color? backgroundColor,
  }) {
    return BoxDecoration(
      color: backgroundColor ?? Colors.transparent,
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusM,
      border: Border.all(
        color: borderColor ?? ThemeColors.neutralGrey,
        width: borderWidth,
      ),
    );
  }

  static BoxDecoration filledDecoration({
    Color? backgroundColor,
    BorderRadius? borderRadius,
  }) {
    return BoxDecoration(
      color: backgroundColor ?? ThemeColors.primaryBlue.withOpacity(0.1),
      borderRadius: borderRadius ?? ThemeDimensions.borderRadiusM,
    );
  }

  static BoxDecoration dividerDecoration({
    Color? color,
    double thickness = 1.0,
  }) {
    return BoxDecoration(
      border: Border(
        bottom: BorderSide(
          color: color ?? ThemeColors.separator,
          width: thickness,
        ),
      ),
    );
  }

  static InputDecoration textFieldDecoration({
    String? hintText,
    String? labelText,
    IconData? prefixIcon,
    IconData? suffixIcon,
    Widget? prefix,
    Widget? suffix,
    Color? fillColor,
    bool filled = true,
    bool outlined = false,
  }) {
    return InputDecoration(
      hintText: hintText,
      labelText: labelText,
      prefixIcon: prefixIcon != null ? Icon(prefixIcon) : null,
      suffixIcon: suffixIcon != null ? Icon(suffixIcon) : null,
      prefix: prefix,
      suffix: suffix,
      filled: filled,
      fillColor: fillColor ?? ThemeColors.systemGray6,
      border: outlined
          ? OutlineInputBorder(
              borderRadius: ThemeDimensions.borderRadiusM,
              borderSide: BorderSide(color: ThemeColors.separator),
            )
          : UnderlineInputBorder(
              borderSide: BorderSide(color: ThemeColors.separator),
            ),
      enabledBorder: outlined
          ? OutlineInputBorder(
              borderRadius: ThemeDimensions.borderRadiusM,
              borderSide: BorderSide(color: ThemeColors.separator),
            )
          : UnderlineInputBorder(
              borderSide: BorderSide(color: ThemeColors.separator),
            ),
      focusedBorder: outlined
          ? OutlineInputBorder(
              borderRadius: ThemeDimensions.borderRadiusM,
              borderSide: BorderSide(
                color: ThemeColors.primaryBlue,
                width: 2.0,
              ),
            )
          : UnderlineInputBorder(
              borderSide: BorderSide(
                color: ThemeColors.primaryBlue,
                width: 2.0,
              ),
            ),
      errorBorder: outlined
          ? OutlineInputBorder(
              borderRadius: ThemeDimensions.borderRadiusM,
              borderSide: BorderSide(color: ThemeColors.errorRed),
            )
          : UnderlineInputBorder(
              borderSide: BorderSide(color: ThemeColors.errorRed),
            ),
      contentPadding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.defaultPadding,
        vertical: ThemeDimensions.smallPadding,
      ),
    );
  }

  static ButtonStyle elevatedButtonStyle({
    Color? backgroundColor,
    Color? foregroundColor,
    double? elevation,
    EdgeInsetsGeometry? padding,
    BorderRadius? borderRadius,
  }) {
    return ElevatedButton.styleFrom(
      backgroundColor: backgroundColor ?? ThemeColors.primaryBlue,
      foregroundColor: foregroundColor ?? ThemeColors.neutralWhite,
      elevation: elevation ?? 2.0,
      padding: padding ??
          EdgeInsets.symmetric(
            horizontal: ThemeDimensions.defaultPadding,
            vertical: ThemeDimensions.smallPadding,
          ),
      shape: RoundedRectangleBorder(
        borderRadius: borderRadius ?? ThemeDimensions.borderRadiusM,
      ),
    );
  }

  static ButtonStyle outlinedButtonStyle({
    Color? borderColor,
    Color? foregroundColor,
    double borderWidth = 1.5,
    EdgeInsetsGeometry? padding,
    BorderRadius? borderRadius,
  }) {
    return OutlinedButton.styleFrom(
      foregroundColor: foregroundColor ?? ThemeColors.primaryBlue,
      side: BorderSide(
        color: borderColor ?? ThemeColors.primaryBlue,
        width: borderWidth,
      ),
      padding: padding ??
          EdgeInsets.symmetric(
            horizontal: ThemeDimensions.defaultPadding,
            vertical: ThemeDimensions.smallPadding,
          ),
      shape: RoundedRectangleBorder(
        borderRadius: borderRadius ?? ThemeDimensions.borderRadiusM,
      ),
    );
  }

  static ButtonStyle textButtonStyle({
    Color? foregroundColor,
    EdgeInsetsGeometry? padding,
  }) {
    return TextButton.styleFrom(
      foregroundColor: foregroundColor ?? ThemeColors.primaryBlue,
      padding: padding ??
          EdgeInsets.symmetric(
            horizontal: ThemeDimensions.defaultPadding,
            vertical: ThemeDimensions.smallPadding,
          ),
    );
  }

  static Widget verticalSpace(double height) => SizedBox(height: height);
  static Widget horizontalSpace(double width) => SizedBox(width: width);

  static Widget tinyVerticalSpace() =>
      SizedBox(height: ThemeDimensions.tinyPadding);
  static Widget smallVerticalSpace() =>
      SizedBox(height: ThemeDimensions.smallPadding);
  static Widget defaultVerticalSpace() =>
      SizedBox(height: ThemeDimensions.defaultPadding);
  static Widget largeVerticalSpace() =>
      SizedBox(height: ThemeDimensions.spacingLarge);
  static Widget hugeVerticalSpace() =>
      SizedBox(height: ThemeDimensions.hugePadding);

  static Widget tinyHorizontalSpace() =>
      SizedBox(width: ThemeDimensions.tinyPadding);
  static Widget smallHorizontalSpace() =>
      SizedBox(width: ThemeDimensions.smallPadding);
  static Widget defaultHorizontalSpace() =>
      SizedBox(width: ThemeDimensions.defaultPadding);
  static Widget largeHorizontalSpace() =>
      SizedBox(width: ThemeDimensions.spacingLarge);

  static Divider divider({
    Color? color,
    double? thickness,
    double? height,
    double? indent,
    double? endIndent,
  }) {
    return Divider(
      color: color ?? ThemeColors.separator,
      thickness: thickness ?? 1.0,
      height: height,
      indent: indent,
      endIndent: endIndent,
    );
  }

  static VerticalDivider verticalDivider({
    Color? color,
    double? thickness,
    double? width,
    double? indent,
    double? endIndent,
  }) {
    return VerticalDivider(
      color: color ?? ThemeColors.separator,
      thickness: thickness ?? 1.0,
      width: width,
      indent: indent,
      endIndent: endIndent,
    );
  }

  static Widget circularProgress({
    Color? color,
    double size = 24.0,
    double strokeWidth = 2.0,
  }) {
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: strokeWidth,
        valueColor: AlwaysStoppedAnimation<Color>(
          color ?? ThemeColors.primaryBlue,
        ),
      ),
    );
  }

  static Widget linearProgress({
    Color? color,
    Color? backgroundColor,
    double? value,
  }) {
    return LinearProgressIndicator(
      value: value,
      backgroundColor: backgroundColor ?? ThemeColors.systemGray6,
      valueColor: AlwaysStoppedAnimation<Color>(
        color ?? ThemeColors.primaryBlue,
      ),
    );
  }

  static EdgeInsets pagePadding() => EdgeInsets.all(ThemeDimensions.defaultPadding);
  static EdgeInsets cardPadding() => EdgeInsets.all(ThemeDimensions.defaultPadding);
  static EdgeInsets itemPadding() => EdgeInsets.all(ThemeDimensions.smallPadding);

  static EdgeInsets horizontalPadding({double? value}) =>
      EdgeInsets.symmetric(horizontal: value ?? ThemeDimensions.defaultPadding);

  static EdgeInsets verticalPadding({double? value}) =>
      EdgeInsets.symmetric(vertical: value ?? ThemeDimensions.smallPadding);

  static Widget errorMessage(String message) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.smallPadding),
      decoration: BoxDecoration(
        color: ThemeColors.errorRed.withOpacity(0.1),
        borderRadius: ThemeDimensions.borderRadiusM,
        border: Border.all(
          color: ThemeColors.errorRed,
          width: 1.0,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.error_outline,
            color: ThemeColors.errorRed,
            size: 20,
          ),
          SizedBox(width: ThemeDimensions.smallPadding),
          Expanded(
            child: Text(
              message,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.errorRed,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget successMessage(String message) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.smallPadding),
      decoration: BoxDecoration(
        color: ThemeColors.successGreen.withOpacity(0.1),
        borderRadius: ThemeDimensions.borderRadiusM,
        border: Border.all(
          color: ThemeColors.successGreen,
          width: 1.0,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.check_circle_outline,
            color: ThemeColors.successGreen,
            size: 20,
          ),
          SizedBox(width: ThemeDimensions.smallPadding),
          Expanded(
            child: Text(
              message,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.successGreen,
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget warningMessage(String message) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.smallPadding),
      decoration: BoxDecoration(
        color: ThemeColors.warningYellow.withOpacity(0.1),
        borderRadius: ThemeDimensions.borderRadiusM,
        border: Border.all(
          color: ThemeColors.warningYellow,
          width: 1.0,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.warning_amber_outlined,
            color: ThemeColors.warningYellow,
            size: 20,
          ),
          SizedBox(width: ThemeDimensions.smallPadding),
          Expanded(
            child: Text(
              message,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: Color(0xFF8B6F00),
              ),
            ),
          ),
        ],
      ),
    );
  }

  static Widget infoMessage(String message) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.smallPadding),
      decoration: BoxDecoration(
        color: ThemeColors.primaryBlue.withOpacity(0.1),
        borderRadius: ThemeDimensions.borderRadiusM,
        border: Border.all(
          color: ThemeColors.primaryBlue,
          width: 1.0,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.info_outline,
            color: ThemeColors.primaryBlue,
            size: 20,
          ),
          SizedBox(width: ThemeDimensions.smallPadding),
          Expanded(
            child: Text(
              message,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.primaryBlue,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
