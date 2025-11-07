import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/shooting/controllers/shooting_controller.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';

class VipClubShootingListScreen extends StatefulWidget {
  const VipClubShootingListScreen({super.key});

  @override
  State<VipClubShootingListScreen> createState() =>
      _VipClubShootingListScreenState();
}

class _VipClubShootingListScreenState extends State<VipClubShootingListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VipClubShootingController>().loadShootingRanges();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Shooting Ranges',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: Consumer<VipClubShootingController>(
        builder: (context, controller, child) {
          if (controller.isLoading) {
            return Center(
              child: CircularProgressIndicator(
                color: ThemeColors.primaryBlue,
              ),
            );
          }

          if (controller.errorMessage != null) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.error_outline,
                    size: 64,
                    color: ThemeColors.errorRed,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    controller.errorMessage!,
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.errorRed,
                    ),
                    textAlign: TextAlign.center,
                  ),
                  SizedBox(height: ThemeDimensions.largePadding),
                  ElevatedButton(
                    onPressed: () => controller.loadShootingRanges(),
                    child: Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (controller.shootingRanges.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.sports_score,
                    size: 64,
                    color: ThemeColors.neutralGrey,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    'No shooting ranges available',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => controller.loadShootingRanges(),
            child: ListView.builder(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              itemCount: controller.shootingRanges.length,
              itemBuilder: (context, index) {
                final range = controller.shootingRanges[index];
                return _buildRangeCard(context, range);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildRangeCard(
    BuildContext context,
    VipClubShootingRangeModel range,
  ) {
    return Card(
      margin: EdgeInsets.only(bottom: ThemeDimensions.defaultPadding),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: InkWell(
        onTap: () {
          context.push('${VipClubRoutes.shooting}/${range.id}');
        },
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (range.imageUrl != null && range.imageUrl!.isNotEmpty)
              ClipRRect(
                borderRadius: BorderRadius.only(
                  topLeft: Radius.circular(ThemeDimensions.defaultRadius),
                  topRight: Radius.circular(ThemeDimensions.defaultRadius),
                ),
                child: Image.network(
                  range.imageUrl!,
                  height: 180,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (context, error, stackTrace) {
                    return Container(
                      height: 180,
                      color: ThemeColors.neutralGrey.withOpacity(0.2),
                      child: Icon(
                        Icons.sports_score,
                        size: 64,
                        color: ThemeColors.neutralGrey,
                      ),
                    );
                  },
                ),
              ),
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          range.name,
                          style: ThemeTextStyles.headlineSmall.copyWith(
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      if (range.vipOnly)
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.smallPadding,
                            vertical: ThemeDimensions.tinyPadding,
                          ),
                          decoration: BoxDecoration(
                            color: ThemeColors.accentGold,
                            borderRadius: BorderRadius.circular(
                              ThemeDimensions.smallRadius,
                            ),
                          ),
                          child: Text(
                            'VIP',
                            style: ThemeTextStyles.bodySmall.copyWith(
                              color: ThemeColors.neutralWhite,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.smallPadding),
                  Text(
                    range.description,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Row(
                    children: [
                      Icon(
                        Icons.location_on_outlined,
                        size: 18,
                        color: ThemeColors.neutralGrey,
                      ),
                      SizedBox(width: ThemeDimensions.tinyPadding),
                      Text(
                        range.location,
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ThemeColors.neutralGrey,
                        ),
                      ),
                      Spacer(),
                      Text(
                        '\$${range.basePrice}/hr',
                        style: ThemeTextStyles.headlineSmall.copyWith(
                          color: ThemeColors.primaryBlue,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Wrap(
                    spacing: ThemeDimensions.smallPadding,
                    runSpacing: ThemeDimensions.smallPadding,
                    children: [
                      _buildFeatureChip('${range.laneCount} Lanes'),
                      ...range.weaponTypes
                          .take(2)
                          .map((weapon) => _buildFeatureChip(weapon)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFeatureChip(String label) {
    return Container(
      padding: EdgeInsets.symmetric(
        horizontal: ThemeDimensions.smallPadding,
        vertical: ThemeDimensions.tinyPadding,
      ),
      decoration: BoxDecoration(
        color: ThemeColors.primaryBlue.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.smallRadius),
      ),
      child: Text(
        label,
        style: ThemeTextStyles.bodySmall.copyWith(
          color: ThemeColors.primaryBlue,
        ),
      ),
    );
  }
}
