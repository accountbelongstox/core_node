import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'text_with_subtitle.dart';
import 'bank_image_widget.dart';

class ActivityCard extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? imagePath;
  final LinearGradient? iconGradient;
  final VoidCallback? onTap;

  const ActivityCard({
    super.key,
    required this.title,
    required this.subtitle,
    this.imagePath,
    this.iconGradient,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFF0F0F0)),
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
      ),
      child: Row(
        children: [
          Container(
            width: 60,
            height: 60,
            decoration: BoxDecoration(
              gradient: iconGradient ??
                  const LinearGradient(
                    colors: [Color(0xFFFF9A9E), Color(0xFFFECFEF)],
                  ),
              borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            ),
            child: Center(
              child: imagePath != null
                  ? BankImageWidget(
                      imagePath: imagePath!,
                      width: 24,
                      height: 24,
                    )
                  : const Text('🎊', style: TextStyle(fontSize: 24)),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: TextWithSubtitle(
              title: title,
              subtitle: subtitle,
              titleFontSize: 16,
              subtitleFontSize: 14,
              titleFontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
