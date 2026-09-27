import 'package:flutter/material.dart';

class TextWithSubtitle extends StatelessWidget {
  final String title;
  final String subtitle;
  final double titleFontSize;
  final double subtitleFontSize;
  final FontWeight titleFontWeight;
  final int? maxLines;

  const TextWithSubtitle({
    super.key,
    required this.title,
    required this.subtitle,
    this.titleFontSize = 16,
    this.subtitleFontSize = 12,
    this.titleFontWeight = FontWeight.w600,
    this.maxLines,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          title,
          style: TextStyle(
            fontSize: titleFontSize,
            fontWeight: titleFontWeight,
            color: Colors.black87,
          ),
          maxLines: maxLines,
          overflow: maxLines != null ? TextOverflow.ellipsis : null,
        ),
        const SizedBox(height: 4),
        Text(
          subtitle,
          style: TextStyle(
            fontSize: subtitleFontSize,
            color: Colors.black54,
          ),
          maxLines: maxLines,
          overflow: maxLines != null ? TextOverflow.ellipsis : null,
        ),
      ],
    );
  }
}
