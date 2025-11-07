import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';

class VipClubBenefitsScreen extends StatelessWidget {
  const VipClubBenefitsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'VIP Benefits',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.accentGold,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: ListView(
        children: [
          _buildHeader(),
          _buildMembershipTiers(),
          _buildBenefitsList(),
          SizedBox(height: ThemeDimensions.hugePadding),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.hugePadding),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [
            ThemeColors.accentGold,
            ThemeColors.accentGold.withOpacity(0.8),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        children: [
          Icon(
            Icons.stars,
            size: 64,
            color: ThemeColors.neutralWhite,
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Text(
            'Unlock Exclusive Benefits',
            style: ThemeTextStyles.displayMedium.copyWith(
              color: ThemeColors.neutralWhite,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            'Enjoy premium services and special privileges',
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: ThemeColors.neutralWhite.withOpacity(0.9),
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildMembershipTiers() {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Membership Tiers',
            style: ThemeTextStyles.headlineMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          _buildTierCard(
            'Regular Member',
            ThemeColors.successGreen,
            '0 points',
            '0% discount',
            [
              'Access to all facilities',
              'Standard booking priority',
              'Earn VIP points',
            ],
          ),
          _buildTierCard(
            'Gold Member',
            ThemeColors.accentGold,
            '10,000 points',
            '10% discount',
            [
              'All Regular benefits',
              'Priority booking',
              'Exclusive lounge access',
              '10% discount on all services',
            ],
          ),
          _buildTierCard(
            'Platinum Member',
            Color(0xFFE5E4E2),
            '50,000 points',
            '20% discount',
            [
              'All Gold benefits',
              'VIP fast track',
              'Complimentary drinks',
              '20% discount on all services',
              'Birthday special gifts',
            ],
          ),
          _buildTierCard(
            'Diamond Member',
            ThemeColors.accentPurple,
            '100,000 points',
            '30% discount',
            [
              'All Platinum benefits',
              'Personal concierge service',
              'Free equipment rental',
              '30% discount on all services',
              'Exclusive event invitations',
              'Annual membership gift',
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTierCard(
    String title,
    Color color,
    String requirement,
    String discount,
    List<String> benefits,
  ) {
    return Card(
      margin: EdgeInsets.only(bottom: ThemeDimensions.defaultPadding),
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
          border: Border.all(
            color: color,
            width: 2,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              decoration: BoxDecoration(
                color: color.withOpacity(0.2),
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(ThemeDimensions.defaultRadius - 2),
                  topRight: Radius.circular(ThemeDimensions.defaultRadius - 2),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.stars,
                    color: color,
                    size: 28,
                  ),
                  SizedBox(width: ThemeDimensions.smallPadding),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: ThemeTextStyles.headlineSmall.copyWith(
                            color: color,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: ThemeDimensions.tinyPadding),
                        Text(
                          requirement,
                          style: ThemeTextStyles.bodySmall.copyWith(
                            color: color,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.smallPadding,
                      vertical: ThemeDimensions.tinyPadding,
                    ),
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(
                        ThemeDimensions.smallRadius,
                      ),
                    ),
                    child: Text(
                      discount,
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: ThemeColors.neutralWhite,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: benefits.map((benefit) {
                  return Padding(
                    padding: EdgeInsets.only(
                      bottom: ThemeDimensions.smallPadding,
                    ),
                    child: Row(
                      children: [
                        Icon(
                          Icons.check_circle,
                          size: 20,
                          color: color,
                        ),
                        SizedBox(width: ThemeDimensions.smallPadding),
                        Expanded(
                          child: Text(
                            benefit,
                            style: ThemeTextStyles.bodyMedium,
                          ),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBenefitsList() {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Additional Benefits',
            style: ThemeTextStyles.headlineMedium.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          _buildBenefitItem(
            Icons.card_giftcard,
            'Points Rewards',
            'Earn 10 points for every dollar spent',
            ThemeColors.primaryBlue,
          ),
          _buildBenefitItem(
            Icons.event_available,
            'Flexible Booking',
            'Free cancellation up to 24 hours before',
            ThemeColors.successGreen,
          ),
          _buildBenefitItem(
            Icons.favorite,
            'Special Occasions',
            'Birthday bonuses and anniversary gifts',
            ThemeColors.errorRed,
          ),
          _buildBenefitItem(
            Icons.local_activity,
            'Exclusive Events',
            'Access to members-only tournaments and events',
            ThemeColors.accentPurple,
          ),
          _buildBenefitItem(
            Icons.people,
            'Refer a Friend',
            'Earn bonus points when friends join',
            ThemeColors.warningYellow,
          ),
        ],
      ),
    );
  }

  Widget _buildBenefitItem(
    IconData icon,
    String title,
    String description,
    Color color,
  ) {
    return Card(
      margin: EdgeInsets.only(bottom: ThemeDimensions.defaultPadding),
      child: ListTile(
        leading: Container(
          padding: EdgeInsets.all(ThemeDimensions.smallPadding),
          decoration: BoxDecoration(
            color: color.withOpacity(0.2),
            borderRadius: BorderRadius.circular(ThemeDimensions.smallRadius),
          ),
          child: Icon(
            icon,
            color: color,
            size: 24,
          ),
        ),
        title: Text(
          title,
          style: ThemeTextStyles.bodyLarge.copyWith(
            fontWeight: FontWeight.bold,
          ),
        ),
        subtitle: Padding(
          padding: EdgeInsets.only(top: ThemeDimensions.tinyPadding),
          child: Text(
            description,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
        ),
      ),
    );
  }
}
