/// Beautiful gradient button widget
library gradient_button;

import 'package:flutter/material.dart';

class GradientButton extends StatelessWidget {
  final String text;
  final VoidCallback? onPressed;
  final Gradient? gradient;
  final double? width;
  final double height;
  final Widget? icon;
  final double borderRadius;
  final EdgeInsetsGeometry padding;
  final TextStyle? textStyle;

  const GradientButton({
    super.key,
    required this.text,
    this.onPressed,
    this.gradient,
    this.width,
    this.height = 50,
    this.icon,
    this.borderRadius = 12,
    this.padding = const EdgeInsets.symmetric(horizontal: 24),
    this.textStyle,
  });

  @override
  Widget build(BuildContext context) {
    final defaultGradient = LinearGradient(
      colors: [
        Theme.of(context).primaryColor,
        Theme.of(context).primaryColor.withOpacity(0.8),
      ],
    );

    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        gradient: onPressed != null ? (gradient ?? defaultGradient) : null,
        color: onPressed == null ? Colors.grey.shade300 : null,
        borderRadius: BorderRadius.circular(borderRadius),
        boxShadow: onPressed != null
            ? [
                BoxShadow(
                  color: Theme.of(context).primaryColor.withOpacity(0.3),
                  blurRadius: 8,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onPressed,
          borderRadius: BorderRadius.circular(borderRadius),
          child: Padding(
            padding: padding,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  icon!,
                  const SizedBox(width: 8),
                ],
                Text(
                  text,
                  style: textStyle ??
                      const TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}