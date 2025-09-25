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

class OuteLineBorder extends StatelessWidget {
  final Color? bottomColor;
  final double? height;
  final double? width;
  final Color? outlineColor;
  final Widget? widget;

  const OuteLineBorder(
      {super.key,
      this.bottomColor,
      this.outlineColor,
      this.height,
      this.width,
      this.widget});

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: double.infinity,
      decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultSize),
          border: Border.all(width: 1.5, color: Colors.grey.withOpacity(0.1))),
      child: widget,
    );
  }
}

class CustomCircular extends StatelessWidget {
  final Color? bottomColor;
  final double? height;
  final double? width;
  final double radius;
  final Color outlineColor;
  final Widget? widget;

  const CustomCircular({
    super.key,
    this.bottomColor,
    required this.outlineColor,
    this.height,
    this.width,
    this.widget,
    required this.radius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      width: width,
      decoration: BoxDecoration(
          border: Border.all(
            color: outlineColor,
          ),
          color: bottomColor,
          borderRadius: BorderRadius.circular(radius)),
      child: widget,
    );
  }
}
