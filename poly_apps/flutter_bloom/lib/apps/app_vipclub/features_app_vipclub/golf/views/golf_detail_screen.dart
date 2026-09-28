import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/golf/controllers/golf_controller.dart';
import 'package:qyflutter/apps/app_vipclub/features_app_vipclub/auth/controllers/auth_controller.dart';

class VipClubGolfDetailScreen extends StatefulWidget {
  final String courseId;

  const VipClubGolfDetailScreen({
    super.key,
    required this.courseId,
  });

  @override
  State<VipClubGolfDetailScreen> createState() =>
      _VipClubGolfDetailScreenState();
}

class _VipClubGolfDetailScreenState extends State<VipClubGolfDetailScreen> {
  DateTime _selectedDate = DateTime.now();
  String? _selectedTeeTime;
  int _numberOfPlayers = 1;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final controller = context.read<VipClubGolfController>();
      controller.loadGolfCourseDetails(widget.courseId);
      controller.loadAvailableSlots(widget.courseId, _selectedDate);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Consumer<VipClubGolfController>(
        builder: (context, controller, child) {
          if (controller.isLoading && controller.selectedCourse == null) {
            return Center(
              child: CircularProgressIndicator(
                color: ThemeColors.successGreen,
              ),
            );
          }

          if (controller.selectedCourse == null) {
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
                    controller.errorMessage ?? 'Course not found',
                    style: ThemeTextStyles.bodyLarge.copyWith(
                      color: ThemeColors.errorRed,
                    ),
                  ),
                ],
              ),
            );
          }

          final course = controller.selectedCourse!;

          return CustomScrollView(
            slivers: [
              _buildAppBar(course),
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildBasicInfo(course),
                    Divider(height: 1),
                    _buildDescription(course),
                    Divider(height: 1),
                    _buildCourseDetails(course),
                    Divider(height: 1),
                    _buildFeatures(course),
                    Divider(height: 1),
                    _buildPricing(course),
                    Divider(height: 1),
                    _buildDateSelection(),
                    _buildPlayerSelection(),
                    _buildTeeTimeSelection(controller),
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

  Widget _buildAppBar(course) {
    return SliverAppBar(
      expandedHeight: 300,
      pinned: true,
      backgroundColor: ThemeColors.successGreen,
      foregroundColor: ThemeColors.neutralWhite,
      flexibleSpace: FlexibleSpaceBar(
        title: Text(
          course.name,
          style: ThemeTextStyles.headlineMedium.copyWith(
            color: ThemeColors.neutralWhite,
            fontWeight: FontWeight.bold,
          ),
        ),
        background: course.imageUrl != null && course.imageUrl!.isNotEmpty
            ? Image.network(
                course.imageUrl!,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: ThemeColors.successGreen,
                    child: Icon(
                      Icons.golf_course,
                      size: 80,
                      color: ThemeColors.neutralWhite,
                    ),
                  );
                },
              )
            : Container(
                color: ThemeColors.successGreen,
                child: Icon(
                  Icons.golf_course,
                  size: 80,
                  color: ThemeColors.neutralWhite,
                ),
              ),
      ),
    );
  }

  Widget _buildBasicInfo(course) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Row(
        children: [
          Icon(
            Icons.location_on,
            color: ThemeColors.successGreen,
            size: 20,
          ),
          SizedBox(width: ThemeDimensions.tinyPadding),
          Expanded(
            child: Text(
              course.location,
              style: ThemeTextStyles.bodyMedium.copyWith(
                color: ThemeColors.neutralGrey,
              ),
            ),
          ),
          if (course.vipOnly)
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

  Widget _buildDescription(course) {
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
            course.description,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: ThemeColors.neutralGrey,
              height: 1.5,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCourseDetails(course) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Course Details',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            children: [
              Expanded(
                child: _buildDetailCard(
                  Icons.flag,
                  '${course.holes}',
                  'Holes',
                ),
              ),
              SizedBox(width: ThemeDimensions.defaultPadding),
              Expanded(
                child: _buildDetailCard(
                  Icons.straighten,
                  '${course.par}',
                  'Par',
                ),
              ),
              SizedBox(width: ThemeDimensions.defaultPadding),
              Expanded(
                child: _buildDetailCard(
                  Icons.star,
                  course.difficulty,
                  'Difficulty',
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
        color: ThemeColors.successGreen.withOpacity(0.1),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: Column(
        children: [
          Icon(
            icon,
            color: ThemeColors.successGreen,
            size: 28,
          ),
          SizedBox(height: ThemeDimensions.smallPadding),
          Text(
            value,
            style: ThemeTextStyles.headlineMedium.copyWith(
              color: ThemeColors.successGreen,
              fontWeight: FontWeight.bold,
            ),
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

  Widget _buildFeatures(course) {
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
            children: course.features.map((feature) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.check_circle,
                    size: 20,
                    color: ThemeColors.successGreen,
                  ),
                  SizedBox(width: ThemeDimensions.tinyPadding),
                  Text(
                    feature,
                    style: ThemeTextStyles.bodyMedium,
                  ),
                ],
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildPricing(course) {
    final authController = context.watch<VipClubAuthController>();
    final user = authController.currentUser;
    final discountRate = user?.discountRate ?? 0.0;
    final discountedPrice = course.basePrice * (1 - discountRate);

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
                  '\$${course.basePrice.toStringAsFixed(2)}',
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
                  '\$${course.basePrice.toStringAsFixed(2)}',
                  style: ThemeTextStyles.headlineLarge.copyWith(
                    color: ThemeColors.successGreen,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
              Text(
                ' /round',
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
                  _selectedTeeTime = null;
                });
                context
                    .read<VipClubGolfController>()
                    .loadAvailableSlots(widget.courseId, date);
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
                    color: ThemeColors.successGreen,
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

  Widget _buildPlayerSelection() {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Number of Players',
            style: ThemeTextStyles.headlineSmall.copyWith(
              fontWeight: FontWeight.bold,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          Row(
            children: [
              IconButton(
                onPressed: _numberOfPlayers > 1
                    ? () {
                        setState(() {
                          _numberOfPlayers--;
                        });
                      }
                    : null,
                icon: Icon(Icons.remove_circle_outline),
                color: ThemeColors.successGreen,
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
                  '$_numberOfPlayers',
                  style: ThemeTextStyles.headlineMedium.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              IconButton(
                onPressed: _numberOfPlayers < 4
                    ? () {
                        setState(() {
                          _numberOfPlayers++;
                        });
                      }
                    : null,
                icon: Icon(Icons.add_circle_outline),
                color: ThemeColors.successGreen,
              ),
              SizedBox(width: ThemeDimensions.smallPadding),
              Text(
                '(Max 4 players)',
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

  Widget _buildTeeTimeSelection(controller) {
    return Padding(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Select Tee Time',
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
                  color: ThemeColors.successGreen,
                ),
              ),
            )
          else if (controller.availableSlots.isEmpty)
            Padding(
              padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
              child: Text(
                'No available tee times for this date',
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
                final isSelected = _selectedTeeTime == slot;
                return InkWell(
                  onTap: () {
                    setState(() {
                      _selectedTeeTime = slot;
                    });
                  },
                  child: Container(
                    padding: EdgeInsets.symmetric(
                      horizontal: ThemeDimensions.defaultPadding,
                      vertical: ThemeDimensions.smallPadding,
                    ),
                    decoration: BoxDecoration(
                      color: isSelected
                          ? ThemeColors.successGreen
                          : ThemeColors.neutralWhite,
                      borderRadius: BorderRadius.circular(
                        ThemeDimensions.defaultRadius,
                      ),
                      border: Border.all(
                        color: isSelected
                            ? ThemeColors.successGreen
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
            onPressed: _selectedTeeTime == null ? null : _handleBooking,
            style: ElevatedButton.styleFrom(
              backgroundColor: ThemeColors.successGreen,
              foregroundColor: ThemeColors.neutralWhite,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
              disabledBackgroundColor: ThemeColors.neutralGrey.withOpacity(0.3),
            ),
            child: Text(
              _selectedTeeTime == null
                  ? 'Select a tee time'
                  : 'Book $_numberOfPlayers Player${_numberOfPlayers > 1 ? 's' : ''}',
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
    if (_selectedTeeTime == null) return;

    context.push(
      '/create-booking',
      extra: {
        'facilityType': 'golf',
        'facilityId': widget.courseId,
        'date': _selectedDate,
        'timeSlot': _selectedTeeTime,
        'players': _numberOfPlayers,
      },
    );
  }
}
