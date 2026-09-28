import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class VipStatusCard extends StatelessWidget {
  final String memberType;
  final int points;
  final double discountRate;
  final VoidCallback onTap;

  const VipStatusCard({
    super.key,
    required this.memberType,
    required this.points,
    required this.discountRate,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final cardColor = _getCardColor();
    final accentColor = _getAccentColor();

    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.largePadding),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: [
              cardColor,
              cardColor.withOpacity(0.8),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
          boxShadow: [
            BoxShadow(
              color: cardColor.withOpacity(0.4),
              blurRadius: 16,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Row(
                  children: [
                    Icon(
                      Icons.stars,
                      color: accentColor,
                      size: 32,
                    ),
                    SizedBox(width: ThemeDimensions.smallPadding),
                    Text(
                      _getMemberTypeLabel(),
                      style: ThemeTextStyles.headingMedium.copyWith(
                        color: ThemeColors.neutralWhite,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),
                Icon(
                  Icons.arrow_forward_ios,
                  color: ThemeColors.neutralWhite.withOpacity(0.8),
                  size: 20,
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.largePadding),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                _buildStatColumn(
                  label: 'VIP Points',
                  value: points.toString(),
                  accentColor: accentColor,
                ),
                Container(
                  width: 1,
                  height: 40,
                  color: ThemeColors.neutralWhite.withOpacity(0.3),
                ),
                _buildStatColumn(
                  label: 'Discount',
                  value: '${(discountRate * 100).toInt()}%',
                  accentColor: accentColor,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatColumn({
    required String label,
    required String value,
    required Color accentColor,
  }) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: ThemeTextStyles.caption1.copyWith(
              color: ThemeColors.neutralWhite.withOpacity(0.8),
            ),
          ),
          SizedBox(height: ThemeDimensions.tinyPadding),
          Text(
            value,
            style: ThemeTextStyles.headingLarge.copyWith(
              color: accentColor,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Color _getCardColor() {
    switch (memberType) {
      case 'gold':
        return const Color(0xFFD4AF37);
      case 'platinum':
        return const Color(0xFFE5E4E2);
      case 'diamond':
        return const Color(0xFFB9F2FF);
      default:
        return ThemeColors.primaryBlue;
    }
  }

  Color _getAccentColor() {
    switch (memberType) {
      case 'gold':
        return const Color(0xFFFFF8DC);
      case 'platinum':
        return const Color(0xFF4A4A4A);
      case 'diamond':
        return const Color(0xFF00CED1);
      default:
        return ThemeColors.neutralWhite;
    }
  }

  String _getMemberTypeLabel() {
    switch (memberType) {
      case 'gold':
        return 'Gold Member';
      case 'platinum':
        return 'Platinum Member';
      case 'diamond':
        return 'Diamond Member';
      default:
        return 'VIP Member';
    }
  }
}
