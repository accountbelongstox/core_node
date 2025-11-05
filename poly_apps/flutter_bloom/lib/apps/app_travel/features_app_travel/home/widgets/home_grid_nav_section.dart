import 'package:flutter/material.dart';
import '../../../models_app_travel/grid_nav_model.dart';
import 'home_grid_nav.dart';

class HomeGridNavSection extends StatefulWidget {
  final List<GridNavModel> gridNavs;

  const HomeGridNavSection({
    super.key,
    required this.gridNavs,
  });

  @override
  State<HomeGridNavSection> createState() => _HomeGridNavSectionState();
}

class _HomeGridNavSectionState extends State<HomeGridNavSection> {
  int _currentPage = 0;
  final PageController _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final rowHeight = screenWidth * 0.176;
    final totalHeight = rowHeight * widget.gridNavs.length;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12.0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(8.0),
            child: SizedBox(
              height: totalHeight,
              child: PageView.builder(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() {
                    _currentPage = index;
                  });
                },
                itemCount: 2,
                itemBuilder: (context, pageIndex) {
                  return SingleChildScrollView(
                    physics: const NeverScrollableScrollPhysics(),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: widget.gridNavs.asMap().entries.map((entry) {
                        return HomeGridNav(
                          gridNav: entry.value,
                          isFirst: entry.key == 0,
                        );
                      }).toList(),
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 8.0),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(2, (index) {
              final isActive = index == _currentPage;
              return AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3.0),
                width: isActive ? 16.0 : 8.0,
                height: 8.0,
                decoration: BoxDecoration(
                  color: isActive ? const Color(0xFF00D0D8) : const Color(0xFFD9D9D9),
                  borderRadius: BorderRadius.circular(4.0),
                ),
              );
            }),
          ),
        ],
      ),
    );
  }
}
