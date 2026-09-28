import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';
import 'bank_image_widget.dart';
import 'text_with_subtitle.dart';

class BannerImageCard extends StatelessWidget {
  final String imagePath;
  final String? title;
  final String? subtitle;
  final double height;
  final Color? textColor;
  final EdgeInsets? textPadding;
  final Alignment textAlignment;
  final VoidCallback? onTap;

  const BannerImageCard({
    super.key,
    required this.imagePath,
    this.title,
    this.subtitle,
    this.height = 120,
    this.textColor,
    this.textPadding,
    this.textAlignment = Alignment.topLeft,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      height: height,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            spreadRadius: 0,
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        child: Stack(
          children: [
            BankImageWidget(
              imagePath: imagePath,
              fit: BoxFit.cover,
            ),
            if (title != null || subtitle != null)
              Positioned(
                left: textAlignment == Alignment.topLeft ? 16 : null,
                right: textAlignment == Alignment.topRight ? 16 : null,
                top: 16,
                child: textColor != null
                    ? Column(
                        crossAxisAlignment: textAlignment == Alignment.topLeft
                            ? CrossAxisAlignment.start
                            : CrossAxisAlignment.end,
                        children: [
                          Text(
                            title ?? '',
                            style: TextStyle(
                              fontSize: 16,
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
                        titleFontSize: 16,
                        subtitleFontSize: 14,
                        titleFontWeight: FontWeight.w600,
                      ),
              ),
          ],
        ),
      ),
    );
  }
}
