import 'package:flutter/material.dart';
import '../../../models_app_travel/subnav_model.dart';

class HomeSubnav extends StatelessWidget {
  final List<SubnavModel> subnavs;

  const HomeSubnav({
    Key? key,
    required this.subnavs,
  }) : super(key: key);

  Widget _buildSubnavIcon(int index) {
    const spriteImagePath = 'assets/apps/app_travel/images/un_ico_subnav2x@v7.152.png';
    const iconSize = 48.0;
    final yOffset = -iconSize * index;

    return SizedBox(
      width: iconSize,
      height: iconSize,
      child: ClipRect(
        child: OverflowBox(
          minHeight: iconSize,
          maxHeight: iconSize * 10,
          alignment: Alignment.topCenter,
          child: Transform.translate(
            offset: Offset(0, yOffset),
            child: Image.asset(
              spriteImagePath,
              width: iconSize,
              height: iconSize * 10,
              fit: BoxFit.none,
              alignment: Alignment.topCenter,
              errorBuilder: (context, error, stackTrace) {
                return SizedBox(
                  width: iconSize,
                  height: iconSize,
                  child: Container(
                    color: Colors.grey[300],
                    child: const Icon(
                      Icons.image_not_supported,
                      size: 24,
                      color: Colors.grey,
                    ),
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
    final displaySubnavs = subnavs.length > 10 ? subnavs.sublist(0, 10) : subnavs;
    final screenWidth = MediaQuery.of(context).size.width;
    final horizontalMargin = 24.0;
    final availableWidth = screenWidth - (horizontalMargin * 2);
    final itemWidth = availableWidth / 5;

    return Container(
      margin: const EdgeInsets.fromLTRB(24.0, 0, 24.0, 24.0),
      child: Wrap(
        spacing: 0,
        runSpacing: 0,
        children: List.generate(displaySubnavs.length, (index) {
          final subnav = displaySubnavs[index];
          return SizedBox(
            width: itemWidth,
            child: GestureDetector(
              onTap: () {
                debugPrint('Subnav tapped: ${subnav.title}');
              },
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 8.0),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    _buildSubnavIcon(index),
                    const SizedBox(height: 6.0),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2.0),
                      child: Text(
                        subnav.title,
                        style: const TextStyle(
                          fontSize: 11.0,
                          color: Colors.black87,
                          height: 1.2,
                        ),
                        textAlign: TextAlign.center,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
