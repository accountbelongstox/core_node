import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/shooting/controllers/shooting_controller.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';

class VipClubShootingDetailScreen extends StatefulWidget {
  final String rangeId;

  const VipClubShootingDetailScreen({
    super.key,
    required this.rangeId,
  });

  @override
  State<VipClubShootingDetailScreen> createState() =>
      _VipClubShootingDetailScreenState();
}

class _VipClubShootingDetailScreenState
    extends State<VipClubShootingDetailScreen> {
  DateTime _selectedDate = DateTime.now();
  String? _selectedTimeSlot;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = context.read<VipClubShootingController>();
      controller.loadShootingRangeDetails(widget.rangeId);
      controller.loadAvailableSlots(widget.rangeId, _selectedDate);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<VipClubShootingController>(
        builder: (context, controller, child) {
          if (controller.isLoading && controller.selectedRange == null) {
            return Center(
              child: CircularProgressIndicator(
                color: ThemeColors.primaryBlue,
              ),
            );
          }

          if (controller.selectedRange == null) {
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
                    controller.errorMessage ?? 'Range not found',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.errorRed,
                    ),
                  ),
                ],
              ),
            );
          }

          final range = controller.selectedRange!;

          return CustomScrollView(
            slivers: [
              _buildAppBar(range),
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildBasicInfo(range),
                    Divider(height: 1),
                    _buildDescription(range),
                    Divider(height: 1),
                    _buildFeatures(range),
                    Divider(height: 1),
                    _buildWeaponTypes(range),
                    Divider(height: 1),
                    _buildPricing(range),
                    Divider(height: 1),
                    _buildDateSelection(),
                    _buildTimeSlotSelection(controller),
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

  Widget _buildAppBar(range) {
    return SliverAppBar(
      expandedHeight: 300,
      pinned: true,
      backgroundColor: ThemeColors.primaryBlue,
      foregroundColor: ThemeColors.neutralWhite,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          range.name,
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
            fontWeight: FontWeight.bold,
          ),
        ),
        background: range.imageUrl != null && range.imageUrl!.isNotEmpty
            ? Image.network(
                range.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: ThemeColors.neutralGrey,
                    child: Icon(
                      Icons.sports_score,
                      size: 80,
                      color: ThemeColors.neutralWhite,
                    ),
                  );
                },
              )
            : Container(
                color: ThemeColors.neutralGrey,
                child: Icon(
                  Icons.sports_score,
                  size: 80,
                  color: ThemeColors.neutralWhite,
                ),
              ),
      ),
    );
  }

  Widget _buildBasicInfo(range) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Row(
        children: [
          Icon(
            Icons.location_on,
            color: ThemeColors.primaryBlue,
            size: 20,
          ),
          SizedBox(width: ThemeDimensions.tinyPadding),
          Expanded(
            child: Text(
              range.location,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.neutralGrey,
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

  Widget _buildDescription(range) {
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
            range.description,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatures(range) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Features',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Wrap(
            spacing: ThemeDimensions.defaultPadding,
            runSpacing: ThemeDimensions.defaultPadding,
            children: [
              _buildFeatureItem(Icons.track_changes, '${range.laneCount} Lanes'),
              ...range.features.map((feature) =>
                  _buildFeatureItem(Icons.check_circle_outline, feature)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureItem(IconData icon, String label) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(
          icon,
          size: 20,
          color: ThemeColors.primaryBlue,
        ),
        SizedBox(width: ThemeDimensions.tinyPadding),
        Text(
          label,
          style: ThemeTextStyles.bodyMedium,
        ),
      ],
    );
  }

  Widget _buildWeaponTypes(range) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Available Weapons',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Wrap(
            spacing: ThemeDimensions.smallPadding,
            runSpacing: ThemeDimensions.smallPadding,
            children: range.weaponTypes.map((weapon) {
              return Container(
                padding: EdgeInsets.symmetric(
                  horizontal: ThemeDimensions.defaultPadding,
                  vertical: ThemeDimensions.smallPadding,
                ),
                decoration: BoxDecoration(
                  color: ThemeColors.primaryBlue.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(
                    ThemeDimensions.defaultRadius,
                  ),
                  border: Border.all(
                    color: ThemeColors.primaryBlue.withOpacity(0.3),
                  ),
                ),
                child: Text(
                  weapon,
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    color: ThemeColors.primaryBlue,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildPricing(range) {
    final authController = context.watch<VipClubAuthController>();
    final user = authController.currentUser;
    final discountRate = user?.discountRate ?? 0.0;
    final discountedPrice = range.basePrice * (1 - discountRate);

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
                  '\$${range.basePrice.toStringAsFixed(2)}',
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
                  '\$${range.basePrice.toStringAsFixed(2)}',
                  style: ThemeTextStyles.headlineLarge.copyWith(
                    color: ThemeColors.primaryBlue,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
              Text(
                ' /hour',
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
            'Select Date',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          InkWell(
            onTap: () async {
              final date = await showDatePicker(
                context: context,
                initialDate: _selectedDate,
                firstDate: DateTime.now(),
                lastDate: DateTime.now().add(Duration(days: 90)),
              );
              if (date != null && mounted) {
                setState(() {
                  _selectedDate = date;
                  _selectedTimeSlot = null;
                });
                context
                    .read<VipClubShootingController>()
                    .loadAvailableSlots(widget.rangeId, date);
              }
            },
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
              child: Row(
                children: [
                  Icon(
                    Icons.calendar_today,
                    color: ThemeColors.primaryBlue,
                  ),
                  SizedBox(width: ThemeDimensions.defaultPadding),
                  Text(
                    '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}',
                    style: ThemeTextStyles.bodyLarge,
                  ),
                  Spacer(),
                  Icon(
                    Icons.arrow_drop_down,
                    color: ThemeColors.neutralGrey,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeSlotSelection(controller) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Select Time Slot',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          if (controller.isLoading)
            Center(
              child: Padding(
                padding: EdgeInsets.all(ThemeDimensions.largePadding),
                child: CircularProgressIndicator(
                  color: ThemeColors.primaryBlue,
                ),
              ),
            )
          else if (controller.availableSlots.isEmpty)
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Text(
                'No available slots for this date',
                style: ThemeTextStyles.bodyMedium.copyWith(
                  color: ThemeColors.neutralGrey,
                ),
              ),
            )
          else
            Wrap(
              spacing: ThemeDimensions.smallPadding,
              runSpacing: ThemeDimensions.smallPadding,
              children: controller.availableSlots.map<Widget>((slot) {
                final isSelected = _selectedTimeSlot == slot;
                return InkWell(
                  onTap: () {
                    setState(() {
                      _selectedTimeSlot = slot;
                    });
                  },
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.defaultPadding,
                      vertical: ThemeDimensions.smallPadding,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? ThemeColors.primaryBlue
                          : ThemeColors.neutralWhite,
                      borderRadius: BorderRadius.circular(
                        ThemeDimensions.defaultRadius,
                      ),
                      border: Border.all(
                        color: isSelected
                            ? ThemeColors.primaryBlue
                            : ThemeColors.neutralGrey.withOpacity(0.3),
                      ),
                    ),
                    child: Text(
                      slot,
                      style: ThemeTextStyles.bodyMedium.copyWith(
                        color: isSelected
                            ? ThemeColors.neutralWhite
                            : ThemeColors.neutralBlack,
                        fontWeight:
                            isSelected ? FontWeight.bold : FontWeight.normal,
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildBookingBar() {
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
            onPressed: _selectedTimeSlot == null ? null : _handleBooking,
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
            child: Text(
              _selectedTimeSlot == null
                  ? 'Select a time slot'
                  : 'Book Now',
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
    if (_selectedTimeSlot == null) return;

    context.push(
      '/create-booking',
      extra: {
        'facilityType': 'shooting',
        'facilityId': widget.rangeId,
        'date': _selectedDate,
        'timeSlot': _selectedTimeSlot,
      },
    );
  }
}
