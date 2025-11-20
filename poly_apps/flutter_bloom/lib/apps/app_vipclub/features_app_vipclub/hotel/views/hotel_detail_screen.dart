import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/hotel/controllers/hotel_controller.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';

class VipClubHotelDetailScreen extends StatefulWidget {
  final String roomId;

  const VipClubHotelDetailScreen({
    super.key,
    required this.roomId,
  });

  @override
  State<VipClubHotelDetailScreen> createState() =>
      _VipClubHotelDetailScreenState();
}

class _VipClubHotelDetailScreenState extends State<VipClubHotelDetailScreen> {
  DateTime? _checkInDate;
  DateTime? _checkOutDate;
  int _numberOfGuests = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<VipClubHotelController>().loadHotelRoomDetails(widget.roomId);
    });
  }

  int get numberOfNights {
    if (_checkInDate == null || _checkOutDate == null) return 0;
    return _checkOutDate!.difference(_checkInDate!).inDays;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<VipClubHotelController>(
        builder: (context, controller, child) {
          if (controller.isLoading && controller.selectedRoom == null) {
            return Center(
              child: CircularProgressIndicator(
                color: ThemeColors.accentPurple,
              ),
            );
          }

          if (controller.selectedRoom == null) {
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
                    controller.errorMessage ?? 'Room not found',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.errorRed,
                    ),
                  ),
                ],
              ),
            );
          }

          final room = controller.selectedRoom!;

          return CustomScrollView(
            slivers: [
              _buildAppBar(room),
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildBasicInfo(room),
                    Divider(height: 1),
                    _buildDescription(room),
                    Divider(height: 1),
                    _buildRoomDetails(room),
                    Divider(height: 1),
                    _buildAmenities(room),
                    Divider(height: 1),
                    _buildPricing(room),
                    Divider(height: 1),
                    _buildDateSelection(),
                    _buildGuestSelection(room),
                    if (_checkInDate != null && _checkOutDate != null)
                      _buildBookingSummary(room),
                    SizedBox(height: ThemeDimensions.hugePadding * 2),
                  ],
                ),
              ),
            ],
          );
        },
      ),
      bottomNavigationBar: _buildBookingBar(),
    );
  }

  Widget _buildAppBar(room) {
    return SliverAppBar(
      expandedHeight: 300,
      pinned: true,
      backgroundColor: ThemeColors.accentPurple,
      foregroundColor: ThemeColors.neutralWhite,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          room.name,
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
            fontWeight: FontWeight.bold,
          ),
        ),
        background: room.imageUrl != null && room.imageUrl!.isNotEmpty
            ? Image.network(
                room.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: ThemeColors.accentPurple,
                    child: Icon(
                      Icons.hotel,
                      size: 80,
                      color: ThemeColors.neutralWhite,
                    ),
                  );
                },
              )
            : Container(
                color: ThemeColors.accentPurple,
                child: Icon(
                  Icons.hotel,
                  size: 80,
                  color: ThemeColors.neutralWhite,
                ),
              ),
      ),
    );
  }

  Widget _buildBasicInfo(room) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  room.roomType,
                  style: ThemeTextStyles.headlineSmall.copyWith(
                    color: ThemeColors.accentPurple,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                SizedBox(height: ThemeDimensions.tinyPadding),
                Text(
                  room.location,
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ThemeColors.neutralGrey,
                  ),
                ),
              ],
            ),
          ),
          if (room.vipOnly)
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
                'VIP ONLY',
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.neutralWhite,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDescription(room) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'About',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            room.description,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoomDetails(room) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Room Details',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            children: [
              Expanded(
                child: _buildDetailCard(
                  Icons.king_bed,
                  room.bedType,
                  'Bed',
                ),
              ),
              SizedBox(width: ThemeDimensions.defaultPadding),
              Expanded(
                child: _buildDetailCard(
                  Icons.square_foot,
                  '${room.roomSize} m²',
                  'Size',
                ),
              ),
              SizedBox(width: ThemeDimensions.defaultPadding),
              Expanded(
                child: _buildDetailCard(
                  Icons.people,
                  '${room.maxOccupancy}',
                  'Guests',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDetailCard(IconData icon, String value, String label) {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: ThemeColors.accentPurple.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            color: ThemeColors.accentPurple,
            size: 28,
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            value,
            style: ThemeTextStyles.bodyLarge.copyWith(
              color: ThemeColors.accentPurple,
              fontWeight: FontWeight.bold,
            ),
            textAlign: TextAlign.center,
          ),
          SizedBox(height: ThemeDimensions.tinyPadding),
          Text(
            label,
            style: ThemeTextStyles.bodySmall.copyWith(
              color: ThemeColors.neutralGrey,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmenities(room) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Amenities',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Wrap(
            spacing: ThemeDimensions.defaultPadding,
            runSpacing: ThemeDimensions.defaultPadding,
            children: [
              if (room.hasBreakfast)
                _buildAmenityItem(Icons.free_breakfast, 'Breakfast Included'),
              ...room.features.map((feature) =>
                  _buildAmenityItem(Icons.check_circle, feature)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAmenityItem(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 20,
          color: ThemeColors.accentPurple,
        ),
        SizedBox(width: ThemeDimensions.tinyPadding),
        Text(
          label,
          style: ThemeTextStyles.bodyMedium,
        ),
      ],
    );
  }

  Widget _buildPricing(room) {
    final authController = context.watch<VipClubAuthController>();
    final user = authController.currentUser;
    final discountRate = user?.discountRate ?? 0.0;
    final discountedPrice = room.basePrice * (1 - discountRate);

    return Padding(
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
            children: [
              if (discountRate > 0) ...[
                Text(
                  '\$${room.basePrice.toStringAsFixed(2)}',
                  style: ThemeTextStyles.headlineMedium.copyWith(
                    color: ThemeColors.neutralGrey,
                    decoration: TextDecoration.lineThrough,
                  ),
                ),
                SizedBox(width: ThemeDimensions.smallPadding),
                Text(
                  '\$${discountedPrice.toStringAsFixed(2)}',
                  style: ThemeTextStyles.headlineLarge.copyWith(
                    color: ThemeColors.accentGold,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ] else ...[
                Text(
                  '\$${room.basePrice.toStringAsFixed(2)}',
                  style: ThemeTextStyles.headlineLarge.copyWith(
                    color: ThemeColors.accentPurple,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
              Text(
                ' /night',
                style: ThemeTextStyles.bodyLarge.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
              ),
            ],
          ),
          if (discountRate > 0)
            Padding(
              padding: EdgeInsets.only(top: ThemeDimensions.tinyPadding),
              child: Text(
                'VIP ${(discountRate * 100).toInt()}% Discount Applied',
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.accentGold,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildDateSelection() {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Select Dates',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            children: [
              Expanded(
                child: _buildDateField(
                  label: 'Check-in',
                  date: _checkInDate,
                  onTap: () => _selectCheckInDate(),
                ),
              ),
              SizedBox(width: ThemeDimensions.defaultPadding),
              Expanded(
                child: _buildDateField(
                  label: 'Check-out',
                  date: _checkOutDate,
                  onTap: () => _selectCheckOutDate(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildDateField({
    required String label,
    required DateTime? date,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
        decoration: BoxDecoration(
          border: Border.all(
            color: ThemeColors.neutralGrey.withOpacity(0.3),
          ),
          borderRadius: BorderRadius.circular(
            ThemeDimensions.defaultRadius,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: ThemeTextStyles.bodySmall.copyWith(
                color: ThemeColors.neutralGrey,
              ),
            ),
            SizedBox(height: ThemeDimensions.tinyPadding),
            Row(
              children: [
                Icon(
                  Icons.calendar_today,
                  size: 18,
                  color: ThemeColors.accentPurple,
                ),
                SizedBox(width: ThemeDimensions.smallPadding),
                Text(
                  date == null
                      ? 'Select date'
                      : '${date.year}-${date.month.toString().padLeft(2, '0')}-${date.day.toString().padLeft(2, '0')}',
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: date == null
                        ? ThemeColors.neutralGrey
                        : ThemeColors.neutralBlack,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _selectCheckInDate() async {
    final date = await showDatePicker(
      context: context,
      initialDate: _checkInDate ?? DateTime.now(),
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(Duration(days: 365)),
    );

    if (date != null && mounted) {
      setState(() {
        _checkInDate = date;
        if (_checkOutDate != null && _checkOutDate!.isBefore(date)) {
          _checkOutDate = null;
        }
      });

      if (_checkOutDate != null) {
        _checkAvailability();
      }
    }
  }

  Future<void> _selectCheckOutDate() async {
    if (_checkInDate == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Please select check-in date first'),
          backgroundColor: ThemeColors.warningYellow,
        ),
      );
      return;
    }

    final date = await showDatePicker(
      context: context,
      initialDate: _checkOutDate ??
          _checkInDate!.add(Duration(days: 1)),
      firstDate: _checkInDate!.add(Duration(days: 1)),
      lastDate: _checkInDate!.add(Duration(days: 90)),
    );

    if (date != null && mounted) {
      setState(() {
        _checkOutDate = date;
      });
      _checkAvailability();
    }
  }

  void _checkAvailability() {
    if (_checkInDate != null && _checkOutDate != null) {
      context.read<VipClubHotelController>().checkRoomAvailability(
            widget.roomId,
            _checkInDate!,
            _checkOutDate!,
          );
    }
  }

  Widget _buildGuestSelection(room) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Number of Guests',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            children: [
              IconButton(
                onPressed: _numberOfGuests > 1
                    ? () {
                        setState(() {
                          _numberOfGuests--;
                        });
                      }
                    : null,
                icon: Icon(Icons.remove_circle_outline),
                color: ThemeColors.accentPurple,
              ),
              Container(
                width: 60,
                padding: EdgeInsets.symmetric(
                  vertical: ThemeDimensions.smallPadding,
                ),
                decoration: BoxDecoration(
                  border: Border.all(
                    color: ThemeColors.neutralGrey.withOpacity(0.3),
                  ),
                  borderRadius: BorderRadius.circular(
                    ThemeDimensions.defaultRadius,
                  ),
                ),
                child: Text(
                  '$_numberOfGuests',
                  style: ThemeTextStyles.headlineMedium.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              IconButton(
                onPressed: _numberOfGuests < room.maxOccupancy
                    ? () {
                        setState(() {
                          _numberOfGuests++;
                        });
                      }
                    : null,
                icon: Icon(Icons.add_circle_outline),
                color: ThemeColors.accentPurple,
              ),
              SizedBox(width: ThemeDimensions.smallPadding),
              Text(
                '(Max ${room.maxOccupancy} guests)',
                style: ThemeTextStyles.bodySmall.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBookingSummary(room) {
    final authController = context.watch<VipClubAuthController>();
    final user = authController.currentUser;
    final discountRate = user?.discountRate ?? 0.0;
    final pricePerNight = room.basePrice * (1 - discountRate);
    final totalPrice = pricePerNight * numberOfNights;

    return Container(
      margin: EdgeInsets.all(ThemeDimensions.defaultPadding),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: ThemeColors.accentPurple.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
        border: Border.all(
          color: ThemeColors.accentPurple.withOpacity(0.3),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Booking Summary',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Nights:',
                style: ThemeTextStyles.bodyMedium,
              ),
              Text(
                '$numberOfNights',
                style: ThemeTextStyles.bodyMedium.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Price per night:',
                style: ThemeTextStyles.bodyMedium,
              ),
              Text(
                '\$${pricePerNight.toStringAsFixed(2)}',
                style: ThemeTextStyles.bodyMedium.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Guests:',
                style: ThemeTextStyles.bodyMedium,
              ),
              Text(
                '$_numberOfGuests',
                style: ThemeTextStyles.bodyMedium.copyWith(
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
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
                '\$${totalPrice.toStringAsFixed(2)}',
                style: ThemeTextStyles.headlineMedium.copyWith(
                  color: ThemeColors.accentPurple,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBookingBar() {
    final canBook = _checkInDate != null &&
        _checkOutDate != null &&
        _numberOfGuests > 0;

    return Container(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      decoration: BoxDecoration(
        color: ThemeColors.neutralWhite,
        boxShadow: [
          BoxShadow(
            color: ThemeColors.neutralBlack.withOpacity(0.1),
            blurRadius: 10,
            offset: Offset(0, -2),
          ),
        ],
      ),
      child: SafeArea(
        child: SizedBox(
          height: 56,
          child: ElevatedButton(
            onPressed: canBook ? _handleBooking : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.accentPurple,
              foregroundColor: ThemeColors.neutralWhite,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
              disabledBackgroundColor: ThemeColors.neutralGrey.withOpacity(0.3),
            ),
            child: Text(
              canBook
                  ? 'Book Now - $numberOfNights Night${numberOfNights > 1 ? 's' : ''}'
                  : 'Select dates to book',
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }

  void _handleBooking() {
    if (_checkInDate == null || _checkOutDate == null) return;

    context.push(
      '/create-booking',
      extra: {
        'facilityType': 'hotel',
        'facilityId': widget.roomId,
        'checkIn': _checkInDate,
        'checkOut': _checkOutDate,
        'guests': _numberOfGuests,
      },
    );
  }
}
