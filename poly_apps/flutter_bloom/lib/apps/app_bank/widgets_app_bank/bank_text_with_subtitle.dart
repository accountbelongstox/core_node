import 'package:flutter/material.dart';

class BankTextWithSubtitle extends StatelessWidget {
  final String title;
  final String subtitle;
  final double titleFontSize;
  final double subtitleFontSize;
  final FontWeight titleFontWeight;
  final Color titleColor;
  final Color subtitleColor;
  final CrossAxisAlignment crossAxisAlignment;
  final int? maxLines;
  final TextOverflow overflow;

  const BankTextWithSubtitle({
    super.key,
    required this.title,
    required this.subtitle,
    this.titleFontSize = 16,
    this.subtitleFontSize = 12,
    this.titleFontWeight = FontWeight.w600,
    this.titleColor = Colors.black87,
    this.subtitleColor = Colors.black54,
    this.crossAxisAlignment = CrossAxisAlignment.start,
    this.maxLines,
    this.overflow = TextOverflow.ellipsis,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveMaxLines = maxLines;
    final useFittedBox =
        overflow == TextOverflow.visible && effectiveMaxLines == 1;

    final textAlign = crossAxisAlignment == CrossAxisAlignment.center
        ? TextAlign.center
        : TextAlign.left;

    Widget titleWidget = Text(
      title,
      style: TextStyle(
        fontSize: titleFontSize,
        fontWeight: titleFontWeight,
        color: titleColor,
      ),
      maxLines: effectiveMaxLines,
      overflow: overflow,
      softWrap: true,
      textAlign: textAlign,
    );

    Widget subtitleWidget = Text(
      subtitle,
      style: TextStyle(
        fontSize: subtitleFontSize,
        color: subtitleColor,
      ),
      maxLines: effectiveMaxLines,
      overflow: overflow,
      softWrap: true,
      textAlign: textAlign,
    );

    if (useFittedBox) {
      final alignment = crossAxisAlignment == CrossAxisAlignment.center
          ? Alignment.center
          : Alignment.centerLeft;
      titleWidget = FittedBox(
        fit: BoxFit.scaleDown,
        alignment: alignment,
        child: titleWidget,
      );
      subtitleWidget = FittedBox(
        fit: BoxFit.scaleDown,
        alignment: alignment,
        child: subtitleWidget,
      );
    }

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: 0),
      child: Column(
        crossAxisAlignment: crossAxisAlignment,
        mainAxisSize: MainAxisSize.min,
        children: [
          titleWidget,
          SizedBox(height: (effectiveMaxLines ?? 1) > 1 ? 2 : 1),
          subtitleWidget,
        ],
      ),
    );
  }
}
