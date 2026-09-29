import 'package:flutter/material.dart';

class CustomIconLabel extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback? onTap;
  final Color? backgroundColor;
  final Color? iconColor;
  final Color? labelColor;
  final double? height;
  final double? width;
  final double? labelSize;
  final double? iconHeight;
  final double? iconWidth;

  const CustomIconLabel({
    super.key,
    required this.icon,
    required this.label,
    required this.color,
    this.onTap,
    this.backgroundColor,
    this.iconColor,
    this.labelColor,
    this.height = 100,
    this.width = 100,
    this.labelSize = 10,
    this.iconHeight = 24,
    this.iconWidth = 24,
  });

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color:
                  backgroundColor ?? theme.colorScheme.surface.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              icon,
              color: iconColor ?? theme.colorScheme.primary,
              size: iconHeight ?? 24,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: theme.textTheme.bodySmall?.copyWith(
              color: labelColor ?? theme.colorScheme.onSurface,
              fontSize: labelSize,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}
