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

class BankSpriteIcon extends StatelessWidget {
  final String spritePath;
  final double x;
  final double y;
  final double width;
  final double height;
  final double? iconWidth;
  final double? iconHeight;
  final BoxFit fit;

  const BankSpriteIcon({
    super.key,
    required this.spritePath,
    required this.x,
    required this.y,
    required this.width,
    required this.height,
    this.iconWidth,
    this.iconHeight,
    this.fit = BoxFit.contain,
  });

  @override
  Widget build(BuildContext context) {
    final displayWidth = iconWidth ?? width;
    final displayHeight = iconHeight ?? height;
    
    return SizedBox(
      width: displayWidth,
      height: displayHeight,
      child: ClipRect(
        child: OverflowBox(
          minWidth: 0,
          minHeight: 0,
          maxWidth: double.infinity,
          maxHeight: double.infinity,
          child: Transform.translate(
            offset: Offset(-x, -y),
            child: Image.asset(
              spritePath,
              fit: BoxFit.none,
              alignment: Alignment.topLeft,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  width: displayWidth,
                  height: displayHeight,
                  color: Colors.grey[200],
                  child: const Icon(Icons.image, color: Colors.grey),
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}
