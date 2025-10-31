// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import '../../../models_app_travel/popular_item_model.dart';
import '../../../widgets/travel_icons.dart';

class HomePopular extends StatelessWidget {
  final List<PopularItemModel> popularItems;

  const HomePopular({
    Key? key,
    required this.popularItems,
  }) : super(key: key);

  Widget _buildPopularItem(PopularItemModel item) {
    return Container(
      margin: const EdgeInsets.only(top: 32.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Container(
            width: 160.0,
            height: 160.0,
            decoration: BoxDecoration(
              color: const Color(0xFFEEEEEE),
            ),
            child: item.getFullImageUrl().startsWith('assets/')
                ? Image.asset(
                    item.getFullImageUrl(),
                    width: 80.0,
                    height: 80.0,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        width: 80.0,
                        height: 80.0,
                        color: const Color(0xFFEEEEEE),
                        child: const Icon(Icons.broken_image, size: 30, color: Colors.grey),
                      );
                    },
                  )
                : Image.network(
                    item.getFullImageUrl(),
                    width: 80.0,
                    height: 80.0,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        width: 80.0,
                        height: 80.0,
                        color: const Color(0xFFEEEEEE),
                        child: const Icon(Icons.broken_image, size: 30, color: Colors.grey),
                      );
                    },
                  ),
          ),
          Expanded(
            child: Container(
              height: 80.0,
              padding: const EdgeInsets.only(left: 10.0),
              child: Stack(
                children: [
                  Positioned(
                    left: -11.5,
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: CustomPaint(
                        size: const Size(12.0, 12.0),
                        painter: _TrianglePainter(),
                      ),
                    ),
                  ),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                    children: [
                      const Text(
                        '景点人气榜',
                        style: TextStyle(
                          fontSize: 16.0,
                          fontWeight: FontWeight.normal,
                          color: Colors.black87,
                        ),
                      ),
                      ...item.list.asMap().entries.map((entry) {
                        final index = entry.key;
                        final sight = entry.value;
                        Color rankColor = const Color(0xFF666666);
                        if (index == 0) {
                          rankColor = const Color(0xFFFF3838);
                        } else if (index == 1) {
                          rankColor = const Color(0xFFFF9F33);
                        }
                        return Text.rich(
                          TextSpan(
                            children: [
                              TextSpan(
                                text: '${index + 1}',
                                style: TextStyle(
                                  fontSize: 12.0,
                                  color: rankColor,
                                ),
                              ),
                              TextSpan(
                                text: ' $sight',
                                style: const TextStyle(
                                  fontSize: 12.0,
                                  color: Color(0xFF666666),
                                ),
                              ),
                            ],
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        );
                      }).toList(),
                    ],
                  ),
                ],
              ),
            ),
          ),
          GestureDetector(
            onTap: () {
              debugPrint('More tapped: ${item.title}');
            },
            child: Padding(
              padding: const EdgeInsets.only(left: 4.0),
              child: Icon(
                TravelIcons.arrowRight,
                size: 12.0,
                color: const Color(0xFF999999),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (popularItems.isEmpty) {
      return const SizedBox.shrink();
    }

    return Container(
      margin: const EdgeInsets.fromLTRB(12.0, 0, 12.0, 12.0),
      padding: const EdgeInsets.all(10.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.1),
            blurRadius: 6.0,
            offset: const Offset(0, 0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '排行榜',
                style: TextStyle(
                  fontSize: 18.0,
                  fontWeight: FontWeight.normal,
                  color: Colors.black87,
                ),
              ),
              GestureDetector(
                onTap: () {
                  debugPrint('More rankings tapped');
                },
                child: Row(
                  children: [
                    const Text(
                      '更多',
                      style: TextStyle(
                        fontSize: 12.0,
                        color: Color(0xFF999999),
                      ),
                    ),
                    Icon(
                      TravelIcons.arrowRight,
                      size: 12.0,
                      color: const Color(0xFF999999),
                    ),
                  ],
                ),
              ),
            ],
          ),
          ...popularItems.map((item) => _buildPopularItem(item)).toList(),
        ],
      ),
    );
  }
}

class _TrianglePainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;

    final path = Path();
    path.moveTo(0, size.height / 2 - 6.0);
    path.lineTo(6.0, size.height / 2);
    path.lineTo(0, size.height / 2 + 6.0);
    path.close();

    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
