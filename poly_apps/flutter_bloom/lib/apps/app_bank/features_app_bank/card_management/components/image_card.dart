import 'package:flutter/material.dart';
import 'simple_card.dart';
import 'bank_image_widget.dart';
import 'text_with_subtitle.dart';

class ImageCard extends StatelessWidget {
  final String imagePath;
  final String? title;
  final String? subtitle;
  final double? imageWidth;
  final double? imageHeight;
  final BoxFit imageFit;
  final EdgeInsets? padding;
  final Color? backgroundColor;
  final Axis layoutDirection;
  final VoidCallback? onTap;

  const ImageCard({
    super.key,
    required this.imagePath,
    this.title,
    this.subtitle,
    this.imageWidth,
    this.imageHeight,
    this.imageFit = BoxFit.contain,
    this.padding,
    this.backgroundColor,
    this.layoutDirection = Axis.vertical,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final bool isHorizontal = layoutDirection == Axis.horizontal;

    return SimpleCard(
      padding: padding ?? const EdgeInsets.all(8),
      backgroundColor: backgroundColor,
      onTap: onTap,
      child: isHorizontal ? _buildHorizontalLayout() : _buildVerticalLayout(),
    );
  }

  Widget _buildHorizontalLayout() {
    return Row(
      children: [
        if (title != null || subtitle != null)
          Expanded(
            child: TextWithSubtitle(
              title: title ?? '',
              subtitle: subtitle ?? '',
              titleFontSize: 16,
              subtitleFontSize: 12,
            ),
          ),
        if (title != null || subtitle != null) const SizedBox(width: 8),
        BankImageWidget(
          imagePath: imagePath,
          width: imageWidth ?? 60,
          height: imageHeight ?? 60,
          fit: imageFit,
        ),
      ],
    );
  }

  Widget _buildVerticalLayout() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Center(
            child: BankImageWidget(
              imagePath: imagePath,
              width: imageWidth,
              height: imageHeight,
              fit: imageFit,
            ),
          ),
        ),
        if (title != null || subtitle != null) ...[
          const SizedBox(height: 8),
          if (title != null)
            Text(
              title!,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Colors.black87,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          if (subtitle != null) ...[
            const SizedBox(height: 4),
            Text(
              subtitle!,
              style: const TextStyle(
                fontSize: 10,
                color: Colors.black54,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ],
      ],
    );
  }
}
