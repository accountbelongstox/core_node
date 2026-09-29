import 'package:flutter/material.dart';
import '../theme_app_wuy/theme_config_app_wuy.dart';

class WuyBackgroundDecoration extends StatelessWidget {
  final Widget child;
  final bool showGradient;
  final bool showAbstractPatterns;
  final List<Color>? gradientColors;

  const WuyBackgroundDecoration({
    super.key,
    required this.child,
    this.showGradient = true,
    this.showAbstractPatterns = true,
    this.gradientColors,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: _buildBackgroundDecoration(),
      child: Stack(
        children: [
          if (showAbstractPatterns) _buildAbstractPatterns(),
          child,
        ],
      ),
    );
  }

  BoxDecoration _buildBackgroundDecoration() {
    if (showGradient) {
      final colors = gradientColors ?? [
        WuyAppThemeConfig.wuyGradientStart,
        WuyAppThemeConfig.wuyGradientMiddle,
        WuyAppThemeConfig.wuyGradientEnd,
      ];

      return BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          stops: const [0.0, 0.5, 1.0],
          colors: colors,
        ),
      );
    }

    return const BoxDecoration(
      color: Colors.white,
    );
  }

  Widget _buildAbstractPatterns() {
    return Positioned.fill(
      child: CustomPaint(
        painter: WuyAbstractPatternPainter(),
      ),
    );
  }
}

class WuyAbstractPatternPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFE3F2FD).withOpacity(0.3)
      ..style = PaintingStyle.fill;

    // Draw subtle wavy patterns in the top half - more minimal design
    final path = Path();
    
    // Main wave pattern - more subtle
    path.moveTo(0, size.height * 0.15);
    path.quadraticBezierTo(
      size.width * 0.25, size.height * 0.08,
      size.width * 0.5, size.height * 0.12,
    );
    path.quadraticBezierTo(
      size.width * 0.75, size.height * 0.18,
      size.width, size.height * 0.15,
    );
    path.lineTo(size.width, 0);
    path.lineTo(0, 0);
    path.close();

    canvas.drawPath(path, paint);

    // Second subtle wave pattern
    final path2 = Path();
    path2.moveTo(0, size.height * 0.3);
    path2.quadraticBezierTo(
      size.width * 0.3, size.height * 0.25,
      size.width * 0.6, size.height * 0.28,
    );
    path2.quadraticBezierTo(
      size.width * 0.8, size.height * 0.32,
      size.width, size.height * 0.3,
    );
    path2.lineTo(size.width, size.height * 0.15);
    path2.lineTo(0, size.height * 0.15);
    path2.close();

    canvas.drawPath(path2, paint);

    // Add minimal circular patterns
    final circlePaint = Paint()
      ..color = const Color(0xFFBBDEFB).withOpacity(0.1)
      ..style = PaintingStyle.fill;

    // Top right circle - smaller and more subtle
    canvas.drawCircle(
      Offset(size.width * 0.85, size.height * 0.12),
      size.width * 0.06,
      circlePaint,
    );

    // Top left circle - smaller and more subtle
    canvas.drawCircle(
      Offset(size.width * 0.15, size.height * 0.18),
      size.width * 0.05,
      circlePaint,
    );

    // Center circle - smaller and more subtle
    canvas.drawCircle(
      Offset(size.width * 0.7, size.height * 0.25),
      size.width * 0.04,
      circlePaint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
