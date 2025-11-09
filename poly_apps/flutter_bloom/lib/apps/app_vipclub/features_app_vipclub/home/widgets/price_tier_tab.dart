import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/price_tier_model_app_vipclub.dart';

class VipClubPriceTierTab extends StatelessWidget {
  final List<VipClubPriceTierModel> tiers;
  final Function(VipClubPriceTierModel) onSelectTier;

  const VipClubPriceTierTab({
    super.key,
    required this.tiers,
    required this.onSelectTier,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Membership Tiers',
            style: ThemeTextStyles.headingMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              childAspectRatio: 0.75,
              crossAxisSpacing: 16,
              mainAxisSpacing: 16,
            ),
            itemCount: tiers.length,
            itemBuilder: (context, index) {
              final tier = tiers[index];
              return _buildTierCard(tier);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildTierCard(VipClubPriceTierModel tier) {
    Color tierColor;
    switch (tier.name.toLowerCase()) {
      case 'gold':
        tierColor = ThemeColors.accentOrange;
        break;
      case 'platinum':
        tierColor = ThemeColors.accentPurple;
        break;
      case 'diamond':
        tierColor = ThemeColors.primaryBlue;
        break;
      default:
        tierColor = ThemeColors.neutralDarkGrey;
    }

    return GestureDetector(
      onTap: () => onSelectTier(tier),
      child: Container(
        decoration: BoxDecoration(
          color: ThemeColors.neutralWhite,
          borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
          border: tier.isPopular
              ? Border.all(color: tierColor, width: 2)
              : Border.all(color: ThemeColors.neutralLightGrey),
          boxShadow: [
            BoxShadow(
              color: ThemeColors.neutralBlack.withOpacity(0.06),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (tier.isPopular)
              Container(
                width: double.infinity,
                padding: EdgeInsets.symmetric(
                  vertical: ThemeDimensions.tinyPadding,
                ),
                decoration: BoxDecoration(
                  color: tierColor,
                  borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(ThemeDimensions.largeRadius),
                    topRight: Radius.circular(ThemeDimensions.largeRadius),
                  ),
                ),
                child: Text(
                  'POPULAR',
                  style: ThemeTextStyles.caption2.copyWith(
                    color: ThemeColors.neutralWhite,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
            Expanded(
              child: Padding(
                padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      tier.name,
                      style: ThemeTextStyles.headingSmall.copyWith(
                        color: tierColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: ThemeDimensions.smallPadding),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '\$${tier.price.toStringAsFixed(0)}',
                          style: ThemeTextStyles.headingLarge.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          '/${tier.duration}',
                          style: ThemeTextStyles.bodySmall.copyWith(
                            color: ThemeColors.neutralGrey,
                          ),
                        ),
                      ],
                    ),
                    SizedBox(height: ThemeDimensions.defaultPadding),
                    Expanded(
                      child: ListView.builder(
                        padding: EdgeInsets.zero,
                        physics: const NeverScrollableScrollPhysics(),
                        itemCount: tier.features.length,
                        itemBuilder: (context, index) {
                          return Padding(
                            padding: EdgeInsets.only(
                              bottom: ThemeDimensions.tinyPadding,
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(
                                  Icons.check_circle,
                                  size: 16,
                                  color: tierColor,
                                ),
                                SizedBox(width: ThemeDimensions.tinyPadding),
                                Expanded(
                                  child: Text(
                                    tier.features[index],
                                    style: ThemeTextStyles.caption1.copyWith(
                                      color: ThemeColors.neutralDarkGrey,
                                    ),
                                    maxLines: 2,
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
