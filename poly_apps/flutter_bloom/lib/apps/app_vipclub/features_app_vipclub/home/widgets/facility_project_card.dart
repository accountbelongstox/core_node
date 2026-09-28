import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/custom_button.dart';

class VipClubFacilityProjectCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final Color iconColor;
  final VoidCallback onViewDetails;
  final VoidCallback onBook;

  const VipClubFacilityProjectCard({
    super.key,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.iconColor,
    required this.onViewDetails,
    required this.onBook,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 280,
      margin: EdgeInsets.only(right: ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: ThemeColors.neutralWhite,
        borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
        boxShadow: [
          BoxShadow(
            color: ThemeColors.neutralBlack.withOpacity(0.08),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
          BoxShadow(
            color: ThemeColors.neutralBlack.withOpacity(0.04),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  iconColor.withOpacity(0.1),
                  iconColor.withOpacity(0.05),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(ThemeDimensions.largeRadius),
                topRight: Radius.circular(ThemeDimensions.largeRadius),
              ),
            ),
            child: Row(
              children: [
                Container(
                  width: 56,
                  height: 56,
                  decoration: BoxDecoration(
                    color: iconColor.withOpacity(0.15),
                    borderRadius:
                        BorderRadius.circular(ThemeDimensions.defaultRadius),
                  ),
                  child: Icon(
                    icon,
                    color: iconColor,
                    size: 32,
                  ),
                ),
                SizedBox(width: ThemeDimensions.defaultPadding),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: ThemeTextStyles.headingSmall.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      SizedBox(height: ThemeDimensions.tinyPadding),
                      Text(
                        subtitle,
                        style: ThemeTextStyles.caption1.copyWith(
                          color: ThemeColors.neutralDarkGrey,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
            child: Row(
              children: [
                Expanded(
                  child: CustomButton(
                    onPressed: onViewDetails,
                    buttonText: 'View Details',
                    transparent: true,
                    showBorder: true,
                    borderColor: iconColor,
                    textColor: iconColor,
                    height: 38,
                    radius: ThemeDimensions.defaultRadius,
                    fontSize: ThemeDimensions.fontSizeSmall,
                  ),
                ),
                SizedBox(width: ThemeDimensions.smallPadding),
                Expanded(
                  child: CustomButton(
                    onPressed: onBook,
                    buttonText: 'Book Now',
                    transparent: false,
                    backgroundColor: iconColor,
                    textColor: ThemeColors.neutralWhite,
                    height: 38,
                    radius: ThemeDimensions.defaultRadius,
                    fontSize: ThemeDimensions.fontSizeSmall,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
