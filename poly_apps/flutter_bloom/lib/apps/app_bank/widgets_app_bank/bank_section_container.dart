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
import 'bank_section_header.dart';

class BankSectionContainer extends StatelessWidget {
  final String? title;
  final String? moreText;
  final VoidCallback? onMoreTap;
  final List<Widget> children;
  final EdgeInsets? margin;
  final double titleFontSize;
  final FontWeight titleFontWeight;
  final Color titleColor;

  const BankSectionContainer({
    super.key,
    this.title,
    this.moreText,
    this.onMoreTap,
    required this.children,
    this.margin,
    this.titleFontSize = 20,
    this.titleFontWeight = FontWeight.bold,
    this.titleColor = Colors.black87,
  });

  @override
  Widget build(BuildContext context) {
    final List<Widget> sectionChildren = [];

    if (title != null) {
      sectionChildren.add(
        BankSectionHeader(
          title: title!,
          moreText: moreText,
          onMoreTap: onMoreTap,
          titleFontSize: titleFontSize,
          titleFontWeight: titleFontWeight,
          titleColor: titleColor,
        ),
      );
      sectionChildren.add(const SizedBox(height: 12));
    }

    sectionChildren.addAll(children);

    return Container(
      margin: margin ?? const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: sectionChildren,
      ),
    );
  }
}
