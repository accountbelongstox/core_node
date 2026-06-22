import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/hotel/controllers/hotel_controller.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/facility_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';

class VipClubHotelListScreen extends StatefulWidget {
  const VipClubHotelListScreen({super.key});

  @override
  State<VipClubHotelListScreen> createState() => _VipClubHotelListScreenState();
}

class _VipClubHotelListScreenState extends State<VipClubHotelListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VipClubHotelController>().loadHotelRooms();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Hotel Rooms',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.accentPurple,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: Consumer<VipClubHotelController>(
        builder: (context, controller, child) {
          if (controller.isLoading) {
            return Center(
              child: CircularProgressIndicator(
                color: ThemeColors.accentPurple,
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
                    onPressed: () => controller.loadHotelRooms(),
                    child: Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (controller.hotelRooms.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.hotel,
                    size: 64,
                    color: ThemeColors.neutralGrey,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    'No hotel rooms available',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () => controller.loadHotelRooms(),
            child: ListView.builder(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              itemCount: controller.hotelRooms.length,
              itemBuilder: (context, index) {
                final room = controller.hotelRooms[index];
                return _buildRoomCard(context, room);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildRoomCard(
    BuildContext context,
    VipClubHotelRoomModel room,
  ) {
    return Card(
      margin: EdgeInsets.only(bottom: ThemeDimensions.defaultPadding),
      elevation: 2,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: InkWell(
        onTap: () {
          context.push('${VipClubRoutes.hotel}/${room.id}');
        },
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (room.imageUrl != null && room.imageUrl!.isNotEmpty)
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.only(
                      topLeft: Radius.circular(ThemeDimensions.defaultRadius),
                      topRight: Radius.circular(ThemeDimensions.defaultRadius),
                    ),
                    child: Image.network(
                      room.imageUrl!,
                      height: 180,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return Container(
                          height: 180,
                          color: ThemeColors.accentPurple.withOpacity(0.2),
                          child: Icon(
                            Icons.hotel,
                            size: 64,
                            color: ThemeColors.accentPurple,
                          ),
                        );
                      },
                    ),
                  ),
                  if (room.vipOnly)
                    Positioned(
                      top: ThemeDimensions.defaultPadding,
                      right: ThemeDimensions.defaultPadding,
                      child: Container(
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
                    ),
                ],
              ),
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    room.name,
                    style: ThemeTextStyles.headlineSmall.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.tinyPadding),
                  Text(
                    room.roomType,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.accentPurple,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.smallPadding),
                  Text(
                    room.description,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Row(
                    children: [
                      _buildFeatureIcon(Icons.king_bed, room.bedType),
                      SizedBox(width: ThemeDimensions.defaultPadding),
                      _buildFeatureIcon(Icons.square_foot, '${room.roomSize} m²'),
                      SizedBox(width: ThemeDimensions.defaultPadding),
                      _buildFeatureIcon(Icons.people, '${room.maxOccupancy}'),
                    ],
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Row(
                    children: [
                      Text(
                        '\$${room.basePrice}',
                        style: ThemeTextStyles.headlineMedium.copyWith(
                          color: ThemeColors.accentPurple,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      Text(
                        ' /night',
                        style: ThemeTextStyles.bodyMedium.copyWith(
                          color: ThemeColors.neutralGrey,
                        ),
                      ),
                      Spacer(),
                      if (room.hasBreakfast)
                        Container(
                          padding: EdgeInsets.symmetric(
                            horizontal: ThemeDimensions.smallPadding,
                            vertical: ThemeDimensions.tinyPadding,
                          ),
                          decoration: BoxDecoration(
                            color: ThemeColors.successGreen.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(
                              ThemeDimensions.smallRadius,
                            ),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(
                                Icons.free_breakfast,
                                size: 14,
                                color: ThemeColors.successGreen,
                              ),
                              SizedBox(width: ThemeDimensions.tinyPadding),
                              Text(
                                'Breakfast',
                                style: ThemeTextStyles.bodySmall.copyWith(
                                  color: ThemeColors.successGreen,
                                ),
                              ),
                            ],
                          ),
                        ),
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

  Widget _buildFeatureIcon(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 18,
          color: ThemeColors.accentPurple,
        ),
        SizedBox(width: ThemeDimensions.tinyPadding),
        Text(
          label,
          style: ThemeTextStyles.bodySmall.copyWith(
            color: ThemeColors.neutralGrey,
          ),
        ),
      ],
    );
  }
}
