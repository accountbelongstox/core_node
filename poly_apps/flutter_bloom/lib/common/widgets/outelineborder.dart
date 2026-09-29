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
