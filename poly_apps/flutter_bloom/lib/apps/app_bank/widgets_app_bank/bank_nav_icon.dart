import 'package:flutter/material.dart';

class BankNavIcon extends StatelessWidget {
  final String imagePath;
  final String label;
  final IconData fallbackIcon;
  final VoidCallback? onTap;
  final bool showNotificationDot;

  const BankNavIcon({
    super.key,
    required this.imagePath,
    required this.label,
    required this.fallbackIcon,
    this.onTap,
    this.showNotificationDot = false,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Icon(
                fallbackIcon,
                size: 24,
                color: Colors.grey[600],
              ),
              if (showNotificationDot)
                Positioned(
                  right: -4,
                  top: -4,
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Color(0xFFFF6B35),
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.grey,
            ),
          ),
        ],
      ),
    );
  }
}
