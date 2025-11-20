import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/bookings/controllers/booking_controller.dart';

class VipClubBookingDetailScreen extends StatefulWidget {
  final String bookingId;

  const VipClubBookingDetailScreen({
    super.key,
    required this.bookingId,
  });

  @override
  State<VipClubBookingDetailScreen> createState() =>
      _VipClubBookingDetailScreenState();
}

class _VipClubBookingDetailScreenState
    extends State<VipClubBookingDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context
          .read<VipClubBookingController>()
          .loadBookingDetails(widget.bookingId);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Booking Details',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
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

          if (controller.selectedBooking == null) {
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
                    controller.errorMessage ?? 'Booking not found',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.errorRed,
                    ),
                  ),
                ],
              ),
            );
          }

          final booking = controller.selectedBooking!;

          return SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                _buildStatusCard(booking),
                _buildBookingInfo(booking),
                _buildPricingInfo(booking),
                if (booking.extras != null && booking.extras!.isNotEmpty)
                  _buildExtrasInfo(booking),
                _buildTimestamps(booking),
                if (booking.status == 'confirmed' || booking.status == 'pending')
                  _buildActions(context, controller, booking),
                SizedBox(height: ThemeDimensions.hugePadding),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildStatusCard(booking) {
    Color statusColor;
    IconData statusIcon;

    switch (booking.status) {
      case 'pending':
        statusColor = ThemeColors.warningYellow;
        statusIcon = Icons.pending;
        break;
      case 'confirmed':
        statusColor = ThemeColors.successGreen;
        statusIcon = Icons.check_circle;
        break;
      case 'completed':
        statusColor = ThemeColors.neutralGrey;
        statusIcon = Icons.done_all;
        break;
      case 'cancelled':
        statusColor = ThemeColors.errorRed;
        statusIcon = Icons.cancel;
        break;
      default:
        statusColor = ThemeColors.neutralGrey;
        statusIcon = Icons.help_outline;
    }

    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: statusColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        border: Border.all(
          color: statusColor,
          width: 2,
        ),
      ),
      child: Row(
        children: [
          Icon(
            statusIcon,
            color: statusColor,
            size: 32,
          ),
          SizedBox(width: ThemeDimensions.defaultPadding),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  booking.status.toUpperCase(),
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    color: statusColor,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: ThemeDimensions.tinyPadding),
                Text(
                  _getStatusDescription(booking.status),
                  style: ThemeTextStyles.bodySmall.copyWith(
                    color: statusColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBookingInfo(booking) {
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

    return Card(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
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
                  size: 28,
                ),
                SizedBox(width: ThemeDimensions.smallPadding),
                Text(
                  'Booking Information',
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.defaultPadding),
            _buildInfoRow('Booking ID', booking.id),
            _buildInfoRow('Facility', booking.facilityName),
            _buildInfoRow('Type', booking.facilityType.toUpperCase()),
            _buildInfoRow('Date', _formatDate(booking.bookingDate)),
            _buildInfoRow('Time', booking.timeSlot),
            _buildInfoRow('Duration', '${booking.duration} hour${booking.duration > 1 ? 's' : ''}'),
          ],
        ),
      ),
    );
  }

  Widget _buildPricingInfo(booking) {
    return Card(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pricing',
              style: ThemeTextStyles.headlineSmall.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.defaultPadding),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Base Price:',
                  style: ThemeTextStyles.bodyMedium,
                ),
                Text(
                  '\$${booking.price.toStringAsFixed(2)}',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            if (booking.discount > 0) ...[
              SizedBox(height: ThemeDimensions.smallPadding),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Discount:',
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.accentGold,
                    ),
                  ),
                  Text(
                    '-\$${booking.discount.toStringAsFixed(2)}',
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.accentGold,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ],
            Divider(height: ThemeDimensions.largePadding),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Total Paid:',
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '\$${booking.finalPrice.toStringAsFixed(2)}',
                  style: ThemeTextStyles.headlineMedium.copyWith(
                    color: ThemeColors.primaryBlue,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExtrasInfo(booking) {
    return Card(
      margin: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Additional Information',
              style: ThemeTextStyles.headlineSmall.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.defaultPadding),
            ...booking.extras!.entries.map((entry) {
              return _buildInfoRow(
                entry.key,
                entry.value.toString(),
              );
            }).toList(),
          ],
        ),
      ),
    );
  }

  Widget _buildTimestamps(booking) {
    return Card(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Timestamps',
              style: ThemeTextStyles.headlineSmall.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.defaultPadding),
            _buildInfoRow('Created At', _formatDateTime(booking.createdAt)),
            _buildInfoRow('Last Updated', _formatDateTime(booking.updatedAt)),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.smallPadding),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            flex: 2,
            child: Text(
              label,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.neutralGrey,
              ),
            ),
          ),
          Expanded(
            flex: 3,
            child: Text(
              value,
              style: ThemeTextStyles.bodyMedium.copyWith(
                fontWeight: FontWeight.w500,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions(
    BuildContext context,
    VipClubBookingController controller,
    booking,
  ) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: ThemeDimensions.defaultPadding),
      child: Column(
        children: [
          SizedBox(
            width: double.infinity,
            height: 48,
            child: OutlinedButton.icon(
              onPressed: () {
                _showCancelDialog(context, controller, booking.id);
              },
              icon: Icon(Icons.cancel),
              label: Text('Cancel Booking'),
              style: OutlinedButton.styleFrom(
                foregroundColor: ThemeColors.errorRed,
                side: BorderSide(color: ThemeColors.errorRed),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(
                    ThemeDimensions.defaultRadius,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _showCancelDialog(
    BuildContext context,
    VipClubBookingController controller,
    String bookingId,
  ) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Cancel Booking'),
        content: Text(
          'Are you sure you want to cancel this booking? This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Text('Keep Booking'),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.of(context).pop();
              final success = await controller.cancelBooking(bookingId);
              if (success && mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Booking cancelled successfully'),
                    backgroundColor: ThemeColors.successGreen,
                  ),
                );
                context.pop();
              } else if (mounted && controller.errorMessage != null) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text(controller.errorMessage!),
                    backgroundColor: ThemeColors.errorRed,
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.errorRed,
            ),
            child: Text('Cancel Booking'),
          ),
        ],
      ),
    );
  }

  String _getStatusDescription(String status) {
    switch (status) {
      case 'pending':
        return 'Your booking is awaiting confirmation';
      case 'confirmed':
        return 'Your booking has been confirmed';
      case 'completed':
        return 'This booking has been completed';
      case 'cancelled':
        return 'This booking has been cancelled';
      default:
        return '';
    }
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }

  String _formatDateTime(DateTime dateTime) {
    return '${_formatDate(dateTime)} ${dateTime.hour.toString().padLeft(2, '0')}:${dateTime.minute.toString().padLeft(2, '0')}';
  }
}
