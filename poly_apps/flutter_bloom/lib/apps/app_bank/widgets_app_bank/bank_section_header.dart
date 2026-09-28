import 'package:flutter/material.dart';

class BankSectionHeader extends StatelessWidget {
  final String title;
  final String? moreText;
  final VoidCallback? onMoreTap;
  final Color titleColor;
  final double titleFontSize;
  final FontWeight titleFontWeight;
  final Color moreTextColor;
  final double moreTextFontSize;

  const BankSectionHeader({
    super.key,
    required this.title,
    this.moreText,
    this.onMoreTap,
    this.titleColor = Colors.black87,
    this.titleFontSize = 20,
    this.titleFontWeight = FontWeight.bold,
    this.moreTextColor = Colors.grey,
    this.moreTextFontSize = 14,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: titleFontSize,
            fontWeight: titleFontWeight,
            color: titleColor,
          ),
        ),
        if (moreText != null)
          GestureDetector(
            onTap: onMoreTap,
            child: Text(
              moreText!,
              style: TextStyle(
                fontSize: moreTextFontSize,
                color: moreTextColor,
              ),
            ),
          ),
      ],
    );
  }
}
