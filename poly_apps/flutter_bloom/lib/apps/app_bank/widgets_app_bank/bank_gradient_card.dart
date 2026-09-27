import 'package:flutter/material.dart';
import '../config_app_bank/constants.dart';

class BankGradientCard extends StatelessWidget {
  final Widget child;
  final LinearGradient? gradient;
  final String? backgroundImagePath;
  final BoxFit? backgroundImageFit;
  final EdgeInsets? padding;
  final double borderRadius;
  final List<BoxShadow>? boxShadow;
  final Border? border;
  final VoidCallback? onTap;

  const BankGradientCard({
    super.key,
    required this.child,
    this.gradient,
    this.backgroundImagePath,
    this.backgroundImageFit,
    this.padding,
    this.borderRadius = BankConstants.borderRadius,
    this.boxShadow,
    this.border,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    Widget card = Container(
      decoration: BoxDecoration(
        gradient: gradient,
        image: backgroundImagePath != null
            ? DecorationImage(
                image: AssetImage(backgroundImagePath!),
                fit: backgroundImageFit ?? BoxFit.cover,
              )
            : null,
        borderRadius: BorderRadius.circular(borderRadius),
        border: border,
        boxShadow: boxShadow ??
            [
              BoxShadow(
                color: Colors.black.withOpacity(0.1),
                blurRadius: 12,
                spreadRadius: 0,
                offset: const Offset(0, 4),
              ),
            ],
      ),
      child: padding != null
          ? Padding(
              padding: padding!,
              child: child,
            )
          : child,
    );

    if (onTap != null) {
      card = InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(borderRadius),
        child: card,
      );
    }

    return card;
  }
}
