import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';

class BankImageWidget extends StatelessWidget {
  final String imagePath;
  final double? width;
  final double? height;
  final BoxFit fit;
  final Color? placeholderColor;

  const BankImageWidget({
    super.key,
    required this.imagePath,
    this.width,
    this.height,
    this.fit = BoxFit.contain,
    this.placeholderColor,
  });

  @override
  Widget build(BuildContext context) {
    Widget image = Image.asset(
      imagePath,
      width: width,
      height: height,
      fit: fit,
      errorBuilder: (context, error, stackTrace) {
        return Container(
          width: width,
          height: height,
          decoration: BoxDecoration(
            color: placeholderColor ?? Colors.grey[200],
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          ),
          child: const Icon(Icons.image, color: Colors.grey),
        );
      },
    );

    if (width == null && height == null) {
      image = SizedBox(
        width: double.infinity,
        height: double.infinity,
        child: image,
      );
    }

    return image;
  }
}
