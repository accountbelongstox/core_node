import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';

class BankImageWidget extends StatelessWidget {
  final String imagePath;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Color? placeholderColor;
  final AlignmentGeometry alignment;

  const BankImageWidget({
    super.key,
    required this.imagePath,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.placeholderColor,
    this.alignment = Alignment.center,
  });

  @override
  Widget build(BuildContext context) {
    return Image.asset(
      imagePath,
      width: width,
      height: height,
      fit: fit,
      alignment: alignment,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          width: width,
          height: height,
          constraints: width != null || height != null
              ? null
              : const BoxConstraints(
                  maxWidth: double.infinity,
                ),
          decoration: BoxDecoration(
            color: placeholderColor ?? Colors.grey[200],
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          ),
          child: const Icon(Icons.image, color: Colors.grey),
        );
      },
    );
  }
}
