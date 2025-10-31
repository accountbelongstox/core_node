// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import '../../../models_app_travel/local_nav_model.dart';

class HomeLocalNav extends StatelessWidget {
  final List<LocalNavModel> localNavs;

  const HomeLocalNav({
    Key? key,
    required this.localNavs,
  }) : super(key: key);

  Widget _buildSpriteIcon(int index) {
    const spriteImagePath = 'assets/apps/app_travel/images/home-fivemain-sprite2x@v7.15.png';
    final yOffset = -40.0 * index;

    return Container(
      width: 40.0,
      height: 40.0,
      margin: const EdgeInsets.only(bottom: 0),
      child: ClipRect(
        child: OverflowBox(
          minHeight: 40.0,
          maxHeight: 200.0,
          alignment: Alignment.topCenter,
          child: Transform.translate(
            offset: Offset(0, yOffset),
            child: Image.asset(
              spriteImagePath,
              width: 40.0,
              fit: BoxFit.none,
              alignment: Alignment.topCenter,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  width: 40.0,
                  height: 40.0,
                  color: Colors.grey[300],
                  child: const Icon(
                    Icons.image_not_supported,
                    size: 20,
                    color: Colors.grey,
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (localNavs.isEmpty) {
      return const SizedBox.shrink();
    }

    final displayNavs = localNavs.length > 5 ? localNavs.sublist(0, 5) : localNavs;

    return Container(
      width: double.infinity,
      height: 22.0,
      margin: const EdgeInsets.only(bottom: 22.0),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: -52.0,
            left: 12.0,
            right: 12.0,
            child: Container(
              height: 52.0,
              padding: const EdgeInsets.symmetric(vertical: 6.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(8.0),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 2.0,
                    offset: const Offset(0, 2.0),
                  ),
                ],
              ),
              child: Row(
                children: List.generate(displayNavs.length, (index) {
                  final nav = displayNavs[index];
                  return Expanded(
                    child: GestureDetector(
                      onTap: () {
                        debugPrint('Local nav tapped: ${nav.title}');
                      },
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          _buildSpriteIcon(index),
                          Text(
                            nav.title,
                            style: const TextStyle(
                              fontSize: 12.0,
                              color: Colors.black87,
                            ),
                            textAlign: TextAlign.center,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
