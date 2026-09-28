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
