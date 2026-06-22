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
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class CustomButton extends StatelessWidget {
  final Function()? onPressed;
  final String buttonText;
  final bool transparent;
  final EdgeInsets margin;
  final double height;
  final double width;
  final double? fontSize;
  final double radius;
  final IconData? icon;
  final bool showBorder;
  final double borderWidth;
  final Color? borderColor;
  final bool isLoading;
  final Color? textColor;
  final Color? backgroundColor;
  const CustomButton(
      {super.key,
      this.onPressed,
      required this.buttonText,
      this.transparent = false,
      this.margin = EdgeInsets.zero,
      this.width = ThemeDimensions.webMaxWidth,
      this.height = 45,
      this.fontSize,
      this.radius = 5,
      this.icon,
      this.showBorder = false,
      this.borderWidth = 1,
      this.borderColor,
      this.textColor,
      this.backgroundColor,
      this.isLoading = false});

  @override
  Widget build(BuildContext context) {
    ThemeDimensions.refresh(context);
    final ButtonStyle flatButtonStyle = TextButton.styleFrom(
      backgroundColor: backgroundColor ??
          (onPressed == null
              ? Theme.of(context).disabledColor
              : (transparent
                  ? Colors.transparent
                  : Theme.of(context).primaryColor)),
      minimumSize: Size(width, height),
      padding: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(radius),
          side: showBorder
              ? BorderSide(
                  color: borderColor ?? Theme.of(context).primaryColor,
                  width: borderWidth)
              : const BorderSide(color: Colors.transparent)),
    );

    return Center(
        child: SizedBox(
            width: width,
            child: Padding(
              padding: margin,
              child: TextButton(
                onPressed: onPressed,
                style: flatButtonStyle,
                child:
                    Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  icon != null
                      ? Padding(
                          padding: const EdgeInsets.only(
                              right: ThemeDimensions.paddingSizeExtraSmall),
                          child: Icon(icon,
                              color: transparent
                                  ? Theme.of(context).primaryColor
                                  : Colors.white),
                        )
                      : const SizedBox(),
                  Text(buttonText,
                      textAlign: TextAlign.center,
                      style: ThemeTextStyles.textBold.copyWith(
                        color: textColor ??
                            (transparent
                                ? Theme.of(context).primaryColor
                                : Colors.white),
                        fontSize: fontSize ?? ThemeDimensions.fontSizeLarge,
                      )),
                ]),
              ),
            )));
  }
}
