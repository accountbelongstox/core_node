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
import 'package:carousel_slider/carousel_slider.dart';
import '../../../models_app_travel/swiper_item_model.dart';

class HomeSwiper extends StatefulWidget {
  final List<SwiperItemModel> swiperItems;

  const HomeSwiper({
    super.key,
    required this.swiperItems,
  });

  @override
  State<HomeSwiper> createState() => _HomeSwiperState();
}

class _HomeSwiperState extends State<HomeSwiper> {
  int _currentIndex = 0;

  @override
  Widget build(BuildContext context) {
    if (widget.swiperItems.isEmpty) {
      return const SizedBox.shrink();
    }

    final screenWidth = MediaQuery.of(context).size.width;
    final containerHeight = screenWidth * 0.512;
    final imageHeight = screenWidth * 0.59765625;
    final indicatorBottom = screenWidth * 0.16;

    return Container(
      width: double.infinity,
      height: containerHeight,
      color: const Color(0xFFEEEEEE),
      child: ClipRect(
        child: Stack(
          children: [
            CarouselSlider(
              options: CarouselOptions(
                height: containerHeight,
                viewportFraction: 1.0,
                autoPlay: true,
                autoPlayInterval: const Duration(milliseconds: 3000),
                autoPlayAnimationDuration: const Duration(milliseconds: 800),
                enlargeCenterPage: false,
                onPageChanged: (index, reason) {
                  setState(() {
                    _currentIndex = index;
                  });
                },
              ),
              items: widget.swiperItems.map((item) {
                return Builder(
                  builder: (BuildContext context) {
                    return Transform.translate(
                      offset: const Offset(0, -32.0),
                      child: SizedBox(
                        width: screenWidth,
                        height: imageHeight,
                        child: item.getFullImageUrl().startsWith('assets/')
                            ? Image.asset(
                                item.getFullImageUrl(),
                                fit: BoxFit.cover,
                                width: screenWidth,
                                height: imageHeight,
                                errorBuilder: (context, error, stackTrace) {
                                  return Container(
                                    color: const Color(0xFFEEEEEE),
                                    child: const Center(
                                      child: Icon(
                                        Icons.broken_image,
                                        size: 50,
                                        color: Color(0xFFCCCCCC),
                                      ),
                                    ),
                                  );
                                },
                              )
                            : Image.network(
                                item.getFullImageUrl(),
                                fit: BoxFit.cover,
                                width: screenWidth,
                                height: imageHeight,
                                errorBuilder: (context, error, stackTrace) {
                                  return Container(
                                    color: const Color(0xFFEEEEEE),
                                    child: const Center(
                                      child: Icon(
                                        Icons.broken_image,
                                        size: 50,
                                        color: Color(0xFFCCCCCC),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
                    );
                  },
                );
              }).toList(),
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: 44.0,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withOpacity(0.4),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              bottom: 0,
              left: 0,
              right: 0,
              height: 44.0,
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFFF8F8F8),
                  borderRadius: BorderRadius.vertical(
                    bottom: Radius.elliptical(screenWidth / 2, 30.0),
                  ),
                  boxShadow: const [
                    BoxShadow(
                      color: Color(0xFFF8F8F8),
                      blurRadius: 0,
                      spreadRadius: 30.0,
                      offset: Offset(0, 30.0),
                    ),
                  ],
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: indicatorBottom,
              child: Center(
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: widget.swiperItems.asMap().entries.map((entry) {
                    final isActive = _currentIndex == entry.key;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 300),
                      width: isActive ? 16.0 : 8.0,
                      height: 8.0,
                      margin: const EdgeInsets.symmetric(horizontal: 3.0),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(4.0),
                        color: isActive
                            ? Colors.white
                            : Colors.white.withOpacity(0.5),
                      ),
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
