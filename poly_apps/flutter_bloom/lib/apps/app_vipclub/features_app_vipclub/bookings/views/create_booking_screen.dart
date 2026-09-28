import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/bookings/controllers/booking_controller.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';
import 'package:qyflutter/apps/app_vipclub/router_app_vipclub/router_app_vipclub.dart';

class VipClubCreateBookingScreen extends StatefulWidget {
  final Map<String, dynamic> bookingData;

  const VipClubCreateBookingScreen({
    super.key,
    required this.bookingData,
  });

  @override
  State<VipClubCreateBookingScreen> createState() =>
      _VipClubCreateBookingScreenState();
}

class _VipClubCreateBookingScreenState
    extends State<VipClubCreateBookingScreen> {
  final _notesController = TextEditingController();
  bool _agreeToTerms = false;

  @override
  void dispose() {
    _notesController.dispose();
    super.dispose();
  }

  String get facilityType => widget.bookingData['facilityType'] as String;
  String get facilityId => widget.bookingData['facilityId'] as String;

  DateTime get bookingDate {
    if (facilityType == 'hotel') {
      return widget.bookingData['checkIn'] as DateTime;
    }
    return widget.bookingData['date'] as DateTime;
  }

  String get timeSlot {
    if (facilityType == 'hotel') {
      final checkOut = widget.bookingData['checkOut'] as DateTime;
      return '${checkOut.year}-${checkOut.month.toString().padLeft(2, '0')}-${checkOut.day.toString().padLeft(2, '0')}';
    }
    return widget.bookingData['timeSlot'] as String;
  }

  int get duration {
    if (facilityType == 'hotel') {
      final checkIn = widget.bookingData['checkIn'] as DateTime;
      final checkOut = widget.bookingData['checkOut'] as DateTime;
      return checkOut.difference(checkIn).inDays;
    }
    return 1;
  }

  @override
  Widget build(BuildContext context) {
    final authController = context.watch<VipClubAuthController>();
    final user = authController.currentUser;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Confirm Booking',
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              _buildBookingDetails(),
              SizedBox(height: ThemeDimensions.largePadding),
              _buildUserInfo(user),
              SizedBox(height: ThemeDimensions.largePadding),
              _buildPricingSummary(user),
              SizedBox(height: ThemeDimensions.largePadding),
              _buildNotesField(),
              SizedBox(height: ThemeDimensions.largePadding),
              _buildTermsCheckbox(),
              SizedBox(height: ThemeDimensions.hugePadding),
              _buildConfirmButton(),
              SizedBox(height: ThemeDimensions.hugePadding),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBookingDetails() {
    String typeLabel;
    IconData typeIcon;
    Color typeColor;

    switch (facilityType) {
      case 'shooting':
        typeLabel = 'Shooting Range';
        typeIcon = Icons.sports_score;
        typeColor = ThemeColors.primaryBlue;
        break;
      case 'golf':
        typeLabel = 'Golf Course';
        typeIcon = Icons.golf_course;
        typeColor = ThemeColors.successGreen;
        break;
      case 'hotel':
        typeLabel = 'Hotel Room';
        typeIcon = Icons.hotel;
        typeColor = ThemeColors.accentPurple;
        break;
      default:
        typeLabel = 'Facility';
        typeIcon = Icons.business;
        typeColor = ThemeColors.neutralGrey;
    }

    return Card(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(
                  typeIcon,
                  color: typeColor,
                  size: 28,
                ),
                SizedBox(width: ThemeDimensions.smallPadding),
                Text(
                  typeLabel,
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            SizedBox(height: ThemeDimensions.defaultPadding),
            _buildDetailRow(
              Icons.calendar_today,
              'Date',
              facilityType == 'hotel'
                  ? '${_formatDate(widget.bookingData['checkIn'])} - ${_formatDate(widget.bookingData['checkOut'])}'
                  : _formatDate(bookingDate),
            ),
            if (facilityType != 'hotel')
              _buildDetailRow(
                Icons.access_time,
                'Time',
                timeSlot,
              ),
            if (facilityType == 'hotel')
              _buildDetailRow(
                Icons.nights_stay,
                'Nights',
                '$duration night${duration > 1 ? 's' : ''}',
              ),
            if (widget.bookingData.containsKey('players'))
              _buildDetailRow(
                Icons.people,
                'Players',
                '${widget.bookingData['players']}',
              ),
            if (widget.bookingData.containsKey('guests'))
              _buildDetailRow(
                Icons.people,
                'Guests',
                '${widget.bookingData['guests']}',
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value) {
    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.smallPadding),
      child: Row(
        children: [
          Icon(
            icon,
            size: 20,
            color: ThemeColors.neutralGrey,
          ),
          SizedBox(width: ThemeDimensions.smallPadding),
          Text(
            '$label:',
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
          SizedBox(width: ThemeDimensions.smallPadding),
          Expanded(
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

  Widget _buildUserInfo(user) {
    if (user == null) {
      return Card(
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
          child: Text(
            'Please login to continue',
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: ThemeColors.errorRed,
            ),
          ),
        ),
      );
    }

    return Card(
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Contact Information',
              style: ThemeTextStyles.headlineSmall.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.defaultPadding),
            _buildDetailRow(Icons.person, 'Name', user.name ?? 'N/A'),
            _buildDetailRow(Icons.email, 'Email', user.email ?? 'N/A'),
            _buildDetailRow(Icons.phone, 'Phone', user.phone),
          ],
        ),
      ),
    );
  }

  Widget _buildPricingSummary(user) {
    final discountRate = user?.discountRate ?? 0.0;
    final basePrice = 100.0;
    final totalBeforeDiscount = basePrice * duration;
    final discount = totalBeforeDiscount * discountRate;
    final finalPrice = totalBeforeDiscount - discount;

    return Card(
      color: ThemeColors.primaryBlue.withOpacity(0.05),
      child: Padding(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pricing Summary',
              style: ThemeTextStyles.headlineSmall.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
            SizedBox(height: ThemeDimensions.defaultPadding),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Subtotal:',
                  style: ThemeTextStyles.bodyMedium,
                ),
                Text(
                  '\$${totalBeforeDiscount.toStringAsFixed(2)}',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
            if (discountRate > 0) ...[
              SizedBox(height: ThemeDimensions.smallPadding),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'VIP Discount (${(discountRate * 100).toInt()}%):',
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: ThemeColors.accentGold,
                    ),
                  ),
                  Text(
                    '-\$${discount.toStringAsFixed(2)}',
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
                  'Total:',
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '\$${finalPrice.toStringAsFixed(2)}',
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

  Widget _buildNotesField() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Special Requests (Optional)',
          style: ThemeTextStyles.bodyLarge.copyWith(
            fontWeight: FontWeight.w500,
          ),
        ),
        SizedBox(height: ThemeDimensions.smallPadding),
        TextField(
          controller: _notesController,
          maxLines: 4,
          decoration: InputDecoration(
            hintText: 'Any special requests or notes...',
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(
                ThemeDimensions.defaultRadius,
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildTermsCheckbox() {
    return Row(
      children: [
        Checkbox(
          value: _agreeToTerms,
          onChanged: (value) {
            setState(() {
              _agreeToTerms = value ?? false;
            });
          },
          activeColor: ThemeColors.primaryBlue,
        ),
        Expanded(
          child: GestureDetector(
            onTap: () {
              setState(() {
                _agreeToTerms = !_agreeToTerms;
              });
            },
            child: Text.rich(
              TextSpan(
                text: 'I agree to the ',
                style: ThemeTextStyles.bodySmall,
                children: [
                  TextSpan(
                    text: 'cancellation policy',
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ThemeColors.primaryBlue,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  TextSpan(text: ' and '),
                  TextSpan(
                    text: 'terms of service',
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: ThemeColors.primaryBlue,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildConfirmButton() {
    return Consumer<VipClubBookingController>(
      builder: (context, controller, child) {
        return SizedBox(
          height: 56,
          child: ElevatedButton(
            onPressed: (!_agreeToTerms || controller.isLoading)
                ? null
                : _handleConfirmBooking,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.primaryBlue,
              foregroundColor: ThemeColors.neutralWhite,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
              disabledBackgroundColor: ThemeColors.neutralGrey.withOpacity(0.3),
            ),
            child: controller.isLoading
                ? SizedBox(
                    height: 24,
                    width: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(
                        ThemeColors.neutralWhite,
                      ),
                    ),
                  )
                : Text(
                    'Confirm Booking',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
        );
      },
    );
  }

  Future<void> _handleConfirmBooking() async {
    final controller = context.read<VipClubBookingController>();

    final extras = <String, dynamic>{};
    if (_notesController.text.isNotEmpty) {
      extras['notes'] = _notesController.text;
    }

    if (widget.bookingData.containsKey('players')) {
      extras['players'] = widget.bookingData['players'];
    }

    if (widget.bookingData.containsKey('guests')) {
      extras['guests'] = widget.bookingData['guests'];
    }

    final success = await controller.createBooking(
      facilityType: facilityType,
      facilityId: facilityId,
      bookingDate: bookingDate,
      timeSlot: timeSlot,
      duration: duration,
      extras: extras.isNotEmpty ? extras : null,
    );

    if (success && mounted) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          title: Row(
            children: [
              Icon(
                Icons.check_circle,
                color: ThemeColors.successGreen,
                size: 32,
              ),
              SizedBox(width: ThemeDimensions.smallPadding),
              Text('Booking Confirmed'),
            ],
          ),
          content: Text(
            'Your booking has been confirmed! You will receive a confirmation email shortly.',
          ),
          actions: [
            TextButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.go(VipClubRoutes.bookings);
              },
              child: Text('View Bookings'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.go(VipClubRoutes.home);
              },
              child: Text('Go to Home'),
            ),
          ],
        ),
      );
    } else if (mounted && controller.errorMessage != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(controller.errorMessage!),
          backgroundColor: ThemeColors.errorRed,
        ),
      );
    }
  }

  String _formatDate(DateTime date) {
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}';
  }
}
