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

class PaginationDots extends StatelessWidget {
  final int currentIndex;
  final int totalCount;
  final double dotSize;
  final double spacing;

  const PaginationDots({
    super.key,
    this.currentIndex = 1,
    this.totalCount = 3,
    this.dotSize = 6,
    this.spacing = 4,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(
        totalCount,
        (index) => Container(
          width: dotSize,
          height: dotSize,
          margin: EdgeInsets.only(
            right: index < totalCount - 1 ? spacing : 0,
          ),
          decoration: BoxDecoration(
            color: Colors.grey.withOpacity(
              index == currentIndex ? 0.6 : 0.3,
            ),
            shape: BoxShape.circle,
          ),
        ),
      ),
    );
  }
}
