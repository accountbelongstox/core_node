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
import 'section_header.dart';

class SectionContainer extends StatelessWidget {
  final String? title;
  final String? moreText;
  final VoidCallback? onMoreTap;
  final List<Widget> children;
  final EdgeInsets? margin;

  const SectionContainer({
    super.key,
    this.title,
    this.moreText,
    this.onMoreTap,
    required this.children,
    this.margin,
  });

  @override
  Widget build(BuildContext context) {
    final List<Widget> sectionChildren = [];

    if (title != null) {
      sectionChildren.add(
        SectionHeader(
          title: title!,
          moreText: moreText,
          onMoreTap: onMoreTap,
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
