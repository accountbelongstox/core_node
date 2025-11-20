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
import '../../../resources_app_travel/assets_images_app_travel.dart';

class HomeLocalNav extends StatelessWidget {
  final List<LocalNavModel> localNavs;

  const HomeLocalNav({
    super.key,
    required this.localNavs,
  });

  Widget _buildIcon(int index) {
    const iconSize = 32.0;
    final iconPath = index < AssetsImagesAppTravel.travelLocalNavIcons.length
        ? AssetsImagesAppTravel.travelLocalNavIcons[index]
        : null;

    if (iconPath == null) {
      return SizedBox(
        width: iconSize,
        height: iconSize,
        child: Container(
          color: Colors.grey[300],
          child: const Icon(
            Icons.image_not_supported,
            size: 16,
            color: Colors.grey,
          ),
        ),
      );
    }

    return SizedBox(
      width: iconSize,
      height: iconSize,
      child: Image.asset(
        iconPath,
        width: iconSize,
        height: iconSize,
        fit: BoxFit.contain,
        errorBuilder: (context, error, stackTrace) {
          return Container(
            color: Colors.grey[300],
            child: const Icon(
              Icons.image_not_supported,
              size: 16,
              color: Colors.grey,
            ),
          );
        },
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
      height: 0.0,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(
            top: -95.0,
            left: 12.0,
            right: 12.0,
            child: Container(
              height: 68.0,
              padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 4.0),
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
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: List.generate(displayNavs.length, (index) {
                  final nav = displayNavs[index];
                  return GestureDetector(
                    onTap: () {
                      debugPrint('Local nav tapped: ${nav.title}');
                    },
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        _buildIcon(index),
                        const SizedBox(height: 3.0),
                        Text(
                          nav.title,
                          style: const TextStyle(
                            fontSize: 11.0,
                            color: Colors.black87,
                            height: 1.0,
                          ),
                          textAlign: TextAlign.center,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
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
