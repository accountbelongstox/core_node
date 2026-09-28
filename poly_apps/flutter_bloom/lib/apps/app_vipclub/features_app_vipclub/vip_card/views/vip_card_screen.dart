import 'package:flutter/material.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'dart:math' as math;

class VipClubVipCardScreen extends StatefulWidget {
  const VipClubVipCardScreen({super.key});

  @override
  State<VipClubVipCardScreen> createState() => _VipClubVipCardScreenState();
}

class _VipClubVipCardScreenState extends State<VipClubVipCardScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animationController;
  late Animation<double> _rotationAnimation;
  late Animation<double> _scaleAnimation;

  final String memberName = 'John Anderson';
  final String cardNumber = '1234 5678 9012 3456';
  final String memberType = 'gold';
  final int vipPoints = 25680;
  final DateTime memberSince = DateTime(2020, 1, 15);
  final DateTime expiryDate = DateTime(2025, 12, 31);

  @override
  void initState() {
    super.initState();
    _animationController = AnimationController(
      duration: const Duration(seconds: 2),
      vsync: this,
    );

    _rotationAnimation = Tween<double>(
      begin: 0,
      end: 2 * math.pi,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));

    _scaleAnimation = Tween<double>(
      begin: 0.9,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _animationController,
      curve: Curves.easeInOut,
    ));

    _animationController.forward();
  }

  @override
  void dispose() {
    _animationController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.neutralBlack,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(
            Icons.arrow_back,
            color: ThemeColors.neutralWhite,
          ),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: Text(
          'VIP Gold Card',
          style: ThemeTextStyles.headingMedium.copyWith(
            color: ThemeColors.neutralWhite,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: EdgeInsets.all(ThemeDimensions.largePadding),
          child: Column(
            children: [
              SizedBox(height: ThemeDimensions.hugePadding),
              _buildAnimatedCard(),
              SizedBox(height: ThemeDimensions.hugePadding),
              _buildCardDetails(),
              SizedBox(height: ThemeDimensions.largePadding),
              _buildBenefits(),
              SizedBox(height: ThemeDimensions.largePadding),
              _buildActions(),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAnimatedCard() {
    return AnimatedBuilder(
      animation: _animationController,
      builder: (context, child) {
        return Transform.scale(
          scale: _scaleAnimation.value,
          child: Container(
            height: 220,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(ThemeDimensions.largeRadius),
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFFD4AF37).withOpacity(0.5),
                  blurRadius: 30,
                  spreadRadius: 5,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Stack(
              children: [
                Container(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(
                      ThemeDimensions.largeRadius,
                    ),
                    gradient: const LinearGradient(
                      colors: [
                        Color(0xFFD4AF37),
                        Color(0xFFFFD700),
                        Color(0xFFFFF8DC),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                  ),
                ),
                Positioned.fill(
                  child: CustomPaint(
                    painter: _GoldCardPatternPainter(),
                  ),
                ),
                Padding(
                  padding: EdgeInsets.all(ThemeDimensions.largePadding),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              Icon(
                                Icons.stars_rounded,
                                color: ThemeColors.neutralBlack,
                                size: 32,
                              ),
                              SizedBox(width: ThemeDimensions.smallPadding),
                              Text(
                                'VIP CLUB',
                                style: ThemeTextStyles.bodyLarge.copyWith(
                                  color: ThemeColors.neutralBlack,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 2,
                                ),
                              ),
                            ],
                          ),
                          Container(
                            padding: EdgeInsets.symmetric(
                              horizontal: ThemeDimensions.defaultPadding,
                              vertical: ThemeDimensions.tinyPadding,
                            ),
                            decoration: BoxDecoration(
                              color: ThemeColors.neutralBlack,
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Text(
                              'GOLD',
                              style: ThemeTextStyles.caption1.copyWith(
                                color: const Color(0xFFD4AF37),
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            cardNumber.replaceAllMapped(
                              RegExp(r'.{4}'),
                              (match) => '${match.group(0)} ',
                            ),
                            style: ThemeTextStyles.headingMedium.copyWith(
                              color: ThemeColors.neutralBlack,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 3,
                            ),
                          ),
                          SizedBox(height: ThemeDimensions.smallPadding),
                          Text(
                            memberName.toUpperCase(),
                            style: ThemeTextStyles.bodyMedium.copyWith(
                              color: ThemeColors.neutralBlack,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 1.5,
                            ),
                          ),
                        ],
                      ),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildCardInfo(
                            'MEMBER SINCE',
                            '${memberSince.month.toString().padLeft(2, '0')}/${memberSince.year}',
                          ),
                          _buildCardInfo(
                            'VALID THRU',
                            '${expiryDate.month.toString().padLeft(2, '0')}/${expiryDate.year.toString().substring(2)}',
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
      },
    );
  }

  Widget _buildCardInfo(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: ThemeTextStyles.caption1.copyWith(
            color: ThemeColors.neutralBlack.withOpacity(0.7),
            fontSize: 9,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
        SizedBox(height: 2),
        Text(
          value,
          style: ThemeTextStyles.caption1.copyWith(
            color: ThemeColors.neutralBlack,
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildCardDetails() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.largePadding),
      decoration: BoxDecoration(
        color: ThemeColors.neutralDarkGrey.withOpacity(0.3),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: Column(
        children: [
          _buildDetailRow('VIP Points', '$vipPoints pts'),
          Divider(
            color: ThemeColors.neutralGrey.withOpacity(0.3),
            height: ThemeDimensions.largePadding,
          ),
          _buildDetailRow('Member Level', 'Gold Member'),
          Divider(
            color: ThemeColors.neutralGrey.withOpacity(0.3),
            height: ThemeDimensions.largePadding,
          ),
          _buildDetailRow('Discount Rate', '10% OFF'),
          Divider(
            color: ThemeColors.neutralGrey.withOpacity(0.3),
            height: ThemeDimensions.largePadding,
          ),
          _buildDetailRow('Priority Booking', 'Available'),
        ],
      ),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: ThemeTextStyles.bodyMedium.copyWith(
            color: ThemeColors.neutralWhite.withOpacity(0.8),
          ),
        ),
        Text(
          value,
          style: ThemeTextStyles.bodyMedium.copyWith(
            color: const Color(0xFFD4AF37),
            fontWeight: FontWeight.bold,
          ),
        ),
      ],
    );
  }

  Widget _buildBenefits() {
    final benefits = [
      'Exclusive 10% discount on all services',
      'Priority booking for all facilities',
      'Free equipment rental upgrades',
      'Complimentary valet parking',
      'Access to VIP lounge',
      'Birthday bonus: 2000 VIP points',
    ];

    return Container(
      padding: EdgeInsets.all(ThemeDimensions.largePadding),
      decoration: BoxDecoration(
        color: ThemeColors.neutralDarkGrey.withOpacity(0.3),
        borderRadius: BorderRadius.circular(ThemeDimensions.defaultRadius),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'VIP Benefits',
            style: ThemeTextStyles.headingMedium.copyWith(
              color: ThemeColors.neutralWhite,
            ),
          ),
          SizedBox(height: ThemeDimensions.defaultPadding),
          ...benefits.map((benefit) => Padding(
                padding: EdgeInsets.only(
                  bottom: ThemeDimensions.smallPadding,
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.check_circle,
                      color: const Color(0xFFD4AF37),
                      size: 20,
                    ),
                    SizedBox(width: ThemeDimensions.smallPadding),
                    Expanded(
                      child: Text(
                        benefit,
                        style: ThemeTextStyles.bodySmall.copyWith(
                          color: ThemeColors.neutralWhite.withOpacity(0.9),
                        ),
                      ),
                    ),
                  ],
                ),
              )),
        ],
      ),
    );
  }

  Widget _buildActions() {
    return Column(
      children: [
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFFD4AF37),
              foregroundColor: ThemeColors.neutralBlack,
              padding: EdgeInsets.symmetric(
                vertical: ThemeDimensions.defaultPadding,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
            ),
            child: Text(
              'View QR Code',
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
        SizedBox(height: ThemeDimensions.defaultPadding),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton(
            onPressed: () {},
            style: OutlinedButton.styleFrom(
              foregroundColor: const Color(0xFFD4AF37),
              side: const BorderSide(
                color: Color(0xFFD4AF37),
                width: 2,
              ),
              padding: EdgeInsets.symmetric(
                vertical: ThemeDimensions.defaultPadding,
              ),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
            ),
            child: Text(
              'Upgrade to Platinum',
              style: ThemeTextStyles.bodyLarge.copyWith(
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GoldCardPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.1)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    for (var i = 0; i < 15; i++) {
      final path = Path();
      final startY = size.height * (i / 15);
      path.moveTo(0, startY);
      path.quadraticBezierTo(
        size.width / 2,
        startY + 20,
        size.width,
        startY,
      );
      canvas.drawPath(path, paint);
    }

    final circlePaint = Paint()
      ..color = Colors.white.withOpacity(0.05)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(
      Offset(size.width * 0.8, size.height * 0.3),
      80,
      circlePaint,
    );
    canvas.drawCircle(
      Offset(size.width * 0.2, size.height * 0.7),
      60,
      circlePaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
