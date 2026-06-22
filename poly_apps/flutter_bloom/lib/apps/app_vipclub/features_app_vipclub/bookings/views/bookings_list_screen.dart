import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/bookings/controllers/booking_controller.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/booking_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';

class VipClubBookingsListScreen extends StatefulWidget {
  const VipClubBookingsListScreen({super.key});

  @override
  State<VipClubBookingsListScreen> createState() =>
      _VipClubBookingsListScreenState();
}

class _VipClubBookingsListScreenState extends State<VipClubBookingsListScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  String? _selectedStatus;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
    _tabController.addListener(_handleTabChange);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VipClubBookingController>().loadMyBookings();
    });
  }

  @override
  void dispose() {
    _tabController.removeListener(_handleTabChange);
    _tabController.dispose();
    super.dispose();
  }

  void _handleTabChange() {
    if (!_tabController.indexIsChanging) {
      String? status;
      switch (_tabController.index) {
        case 0:
          status = null;
          break;
        case 1:
          status = 'pending';
          break;
        case 2:
          status = 'confirmed';
          break;
        case 3:
          status = 'completed';
          break;
      }

      setState(() {
        _selectedStatus = status;
      });

      context.read<VipClubBookingController>().loadMyBookings(status: status);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'My Bookings',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: ThemeColors.neutralWhite,
          labelColor: ThemeColors.neutralWhite,
          unselectedLabelColor: ThemeColors.neutralWhite.withOpacity(0.7),
          tabs: [
            Tab(text: 'All'),
            Tab(text: 'Pending'),
            Tab(text: 'Confirmed'),
            Tab(text: 'Completed'),
          ],
        ),
      ),
      body: Consumer<VipClubBookingController>(
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
                    onPressed: () => controller.loadMyBookings(
                      status: _selectedStatus,
                    ),
                    child: Text('Retry'),
                  ),
                ],
              ),
            );
          }

          if (controller.myBookings.isEmpty) {
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(
                    Icons.event_busy,
                    size: 64,
                    color: ThemeColors.neutralGrey,
                  ),
                  SizedBox(height: ThemeDimensions.defaultPadding),
                  Text(
                    'No bookings found',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            onRefresh: () =>
                controller.loadMyBookings(status: _selectedStatus),
            child: ListView.builder(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              itemCount: controller.myBookings.length,
              itemBuilder: (context, index) {
                final booking = controller.myBookings[index];
                return _buildBookingCard(context, booking);
              },
            ),
          );
        },
      ),
    );
  }

  Widget _buildBookingCard(
    BuildContext context,
    VipClubBookingModel booking,
  ) {
    IconData facilityIcon;
    Color facilityColor;

    switch (booking.facilityType) {
      case 'shooting':
        facilityIcon = Icons.sports_score;
        facilityColor = ThemeColors.primaryBlue;
        break;
      case 'golf':
        facilityIcon = Icons.golf_course;
        facilityColor = ThemeColors.successGreen;
        break;
      case 'hotel':
        facilityIcon = Icons.hotel;
        facilityColor = ThemeColors.accentPurple;
        break;
      default:
        facilityIcon = Icons.business;
        facilityColor = ThemeColors.neutralGrey;
    }

    Color statusColor;
    switch (booking.status) {
      case 'pending':
        statusColor = ThemeColors.warningYellow;
        break;
      case 'confirmed':
        statusColor = ThemeColors.successGreen;
        break;
      case 'completed':
        statusColor = ThemeColors.neutralGrey;
        break;
      case 'cancelled':
        statusColor = ThemeColors.errorRed;
        break;
      default:
        statusColor = ThemeColors.neutralGrey;
    }

    return Card(
      margin: EdgeInsets.only(bottom: ThemeDimensions.defaultPadding),
      child: InkWell(
        onTap: () {
          context.push('${VipClubRoutes.bookings}/${booking.id}');
        },
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    facilityIcon,
                    color: facilityColor,
                    size: 24,
                  ),
                  SizedBox(width: ThemeDimensions.smallPadding),
                  Expanded(
                    child: Text(
                      booking.facilityName,
                      style: ThemeTextStyles.headlineSmall.copyWith(
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.smallPadding,
                      vertical: ThemeDimensions.tinyPadding,
                    ),
                    decoration: BoxDecoration(
                      color: statusColor.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(
                        ThemeDimensions.smallRadius,
                      ),
                    ),
                    child: Text(
                      booking.status.toUpperCase(),
                      style: ThemeTextStyles.bodySmall.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              SizedBox(height: ThemeDimensions.defaultPadding),
              Row(
                children: [
                  Icon(
                    Icons.calendar_today,
                    size: 16,
                    color: ThemeColors.neutralGrey,
                  ),
                  SizedBox(width: ThemeDimensions.tinyPadding),
                  Text(
                    _formatDate(booking.bookingDate),
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                  ),
                  SizedBox(width: ThemeDimensions.defaultPadding),
                  Icon(
                    Icons.access_time,
                    size: 16,
                    color: ThemeColors.neutralGrey,
                  ),
                  SizedBox(width: ThemeDimensions.tinyPadding),
                  Text(
                    booking.timeSlot,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.neutralGrey,
                    ),
                  ),
                ],
              ),
              SizedBox(height: ThemeDimensions.defaultPadding),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  if (booking.discount > 0) ...[
                    Text(
                      '\$${booking.price.toStringAsFixed(2)}',
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: ThemeColors.neutralGrey,
                        decoration: TextDecoration.lineThrough,
                      ),
                    ),
                    SizedBox(width: ThemeDimensions.tinyPadding),
                  ],
                  Text(
                    '\$${booking.finalPrice.toStringAsFixed(2)}',
                    style: ThemeTextStyles.headlineSmall.copyWith(
                      color: ThemeColors.primaryBlue,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Spacer(),
                  Icon(
                    Icons.chevron_right,
                    color: ThemeColors.neutralGrey,
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}
