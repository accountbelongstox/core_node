import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'text_with_subtitle.dart';
import 'bank_image_widget.dart';
import 'gradient_card.dart';

class BannerCard extends StatelessWidget {
  final String? title;
  final String? subtitle;
  final String? imagePath;
  final LinearGradient? gradient;
  final Color? textColor;
  final VoidCallback? onTap;

  const BannerCard({
    super.key,
    this.title,
    this.subtitle,
    this.imagePath,
    this.gradient,
    this.textColor,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GradientCard(
      gradient: gradient,
      padding: const EdgeInsets.all(20),
      borderRadius: BankConstants.borderRadius,
      onTap: onTap,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          if (title != null || subtitle != null)
            Expanded(
              child: textColor != null
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title ?? '',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: textColor,
                          ),
                        ),
                        if (subtitle != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            subtitle!,
                            style: TextStyle(
                              fontSize: 14,
                              color: textColor,
                            ),
                          ),
                        ],
                      ],
                    )
                  : TextWithSubtitle(
                      title: title ?? '',
                      subtitle: subtitle ?? '',
                      titleFontSize: 18,
                      subtitleFontSize: 14,
                      titleFontWeight: FontWeight.w600,
                    ),
            ),
          if (imagePath != null) ...[
            const SizedBox(width: 16),
            Container(
              width: 80,
              height: 60,
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.3),
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
              ),
              child: Center(
                child: BankImageWidget(
                  imagePath: imagePath!,
                  width: 32,
                  height: 32,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
