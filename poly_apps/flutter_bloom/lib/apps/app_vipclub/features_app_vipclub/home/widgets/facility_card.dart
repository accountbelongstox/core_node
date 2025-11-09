import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';

class FacilityCard extends StatelessWidget {
  final VipClubFacilityModel facility;
  final VoidCallback onTap;

  const FacilityCard({
    super.key,
    required this.facility,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 280,
        margin: EdgeInsets.only(right: ThemeDimensions.defaultPadding),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.neutralBlack.withOpacity(0.1),
              blurRadius: 8,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                flex: 3,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    facility.imageUrl != null
                        ? Image.network(
                            facility.imageUrl!,
                            fit: BoxFit.cover,
                            errorBuilder: (context, error, stackTrace) =>
                                _buildPlaceholderImage(),
                          )
                        : _buildPlaceholderImage(),
                    if (facility.vipOnly)
                      Positioned(
                        top: 8,
                        right: 8,
                        child: Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.smallPadding,
                            vertical: ThemeDimensions.tinyPadding,
                          ),
                          decoration: BoxDecoration(
                            color: ThemeColors.warningYellow,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.star,
                                size: 14,
                                color: ThemeColors.neutralWhite,
                              ),
                              SizedBox(width: 4),
                              Text(
                                'VIP',
                                style: ThemeTextStyles.caption1.copyWith(
                                  color: ThemeColors.neutralWhite,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Expanded(
                flex: 2,
                child: Container(
                  color: ThemeColors.neutralWhite,
                  padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            facility.name,
                            style: ThemeTextStyles.bodyLarge.copyWith(
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          SizedBox(height: ThemeDimensions.tinyPadding),
                          Text(
                            _getFacilityTypeLabel(),
                            style: ThemeTextStyles.caption1.copyWith(
                              color: ThemeColors.neutralGrey,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '\$${facility.basePrice.toStringAsFixed(0)}',
                            style: ThemeTextStyles.bodyLarge.copyWith(
                              color: ThemeColors.primaryBlue,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Icon(
                            Icons.arrow_forward,
                            size: 20,
                            color: ThemeColors.primaryBlue,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPlaceholderImage() {
    Color backgroundColor;
    IconData iconData;

    switch (facility.type) {
      case 'shooting':
        backgroundColor = ThemeColors.accentOrange.withOpacity(0.2);
        iconData = Icons.my_location;
        break;
      case 'golf':
        backgroundColor = ThemeColors.accentGreen.withOpacity(0.2);
        iconData = Icons.golf_course;
        break;
      case 'hotel':
        backgroundColor = ThemeColors.primaryBlue.withOpacity(0.2);
        iconData = Icons.hotel;
        break;
      default:
        backgroundColor = ThemeColors.neutralLightGrey;
        iconData = Icons.location_on;
    }

    return Container(
      color: backgroundColor,
      child: Center(
        child: Icon(
          iconData,
          size: 64,
          color: ThemeColors.neutralGrey,
        ),
      ),
    );
  }

  String _getFacilityTypeLabel() {
    switch (facility.type) {
      case 'shooting':
        return 'Shooting Range';
      case 'golf':
        return 'Golf Course';
      case 'hotel':
        return 'Hotel Room';
      default:
        return 'Facility';
    }
  }
}
