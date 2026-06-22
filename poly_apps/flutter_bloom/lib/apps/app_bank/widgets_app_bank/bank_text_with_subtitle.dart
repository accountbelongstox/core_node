// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\" instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

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
