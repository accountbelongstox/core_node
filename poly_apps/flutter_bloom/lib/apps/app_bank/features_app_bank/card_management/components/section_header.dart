import 'package:flutter/material.dart';

class SectionHeader extends StatelessWidget {
  final String title;
  final String? moreText;
  final VoidCallback? onMoreTap;

  const SectionHeader({
    super.key,
    required this.title,
    this.moreText,
    this.onMoreTap,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          title,
          style: const TextStyle(
            fontSize: 20,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        if (moreText != null)
          GestureDetector(
            onTap: onMoreTap,
            child: Text(
              moreText!,
              style: const TextStyle(
                fontSize: 14,
                color: Colors.grey,
              ),
            ),
          ),
      ],
    );
  }
}
