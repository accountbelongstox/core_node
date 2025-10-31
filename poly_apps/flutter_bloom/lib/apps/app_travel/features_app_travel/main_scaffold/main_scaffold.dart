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
import 'package:qyflutter/common/widgets/enhanced_bottom_navigation.dart';
import '../home/views/home_screen.dart';
import '../journey/views/journey_screen.dart';
import '../service/views/service_screen.dart';
import '../explore/views/explore_screen.dart';
import '../favorites/views/favorites_screen.dart';
import '../profile/views/profile_screen.dart';
import '../../router_app_travel/routes_provider_app_travel.dart';

class MainScaffold extends StatefulWidget {
  final int initialIndex;

  const MainScaffold({
    Key? key,
    this.initialIndex = 0,
  }) : super(key: key);

  @override
  State<MainScaffold> createState() => _MainScaffoldState();
}

class _MainScaffoldState extends State<MainScaffold> {
  late int _currentIndex;
  late PageController _pageController;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onPageChanged(int index) {
    setState(() {
      _currentIndex = index;
    });
  }

  void _onNavItemTapped(int index) {
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: PageView(
        controller: _pageController,
        onPageChanged: _onPageChanged,
        children: const [
          HomeScreen(isInScaffold: true),
          JourneyScreen(),
          ServiceScreen(),
          ExploreScreen(),
          ProfileScreen(),
        ],
      ),
      bottomNavigationBar: EnhancedBottomNavigation(
        currentIndex: _currentIndex,
        onTap: _onNavItemTapped,
        showLabels: true,
        selectedItemColor: const Color(0xFF00D0D8),
        items: const [
          NavigationItem(
            icon: Icons.home_outlined,
            activeIcon: Icons.home,
            label: '首页',
            route: TravelAppRoutesProvider.routeHome,
          ),
          NavigationItem(
            icon: Icons.calendar_today_outlined,
            activeIcon: Icons.calendar_today,
            label: '行程',
            route: TravelAppRoutesProvider.routeHome,
          ),
          NavigationItem(
            icon: Icons.chat_bubble_outline,
            activeIcon: Icons.chat_bubble,
            label: '客服',
            route: TravelAppRoutesProvider.routeHome,
          ),
          NavigationItem(
            icon: Icons.explore_outlined,
            activeIcon: Icons.explore,
            label: '看世界',
            route: TravelAppRoutesProvider.routeSearch,
            badge: '旅行攻略',
            badgeColor: Color(0xFFFF3B30),
          ),
          NavigationItem(
            icon: Icons.person_outline,
            activeIcon: Icons.person,
            label: '我的',
            route: TravelAppRoutesProvider.routeProfile,
          ),
        ],
      ),
    );
  }
}
