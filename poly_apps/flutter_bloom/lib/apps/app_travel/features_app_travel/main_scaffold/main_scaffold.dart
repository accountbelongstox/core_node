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
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../home/views/home_screen.dart';
import '../journey/views/journey_screen.dart';
import '../service/views/service_screen.dart';
import '../explore/views/explore_screen.dart';
import '../profile/views/profile_screen.dart';
import '../../router_app_travel/routes_provider_app_travel.dart';
import '../../localization_app_travel/localization_keys_app_travel.dart';
import '../../resources_app_travel/colors_app_travel.dart';
import '../../resources_app_travel/assets_images_app_travel.dart';

class MainScaffold extends StatefulWidget {
  final int initialIndex;

  const MainScaffold({
    super.key,
    this.initialIndex = 0,
  });

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
        selectedItemColor: TravelColors.travelPrimary,
        backgroundColor: Colors.white,
        items: [
          NavigationItem(
            icon: Icons.home_outlined,
            activeIcon: Icons.home,
            iconImage: AssetsImagesAppTravel.travelNavTabHome,
            activeIconImage: AssetsImagesAppTravel.travelNavTabHome,
            label: TravelLocalizationKeys.travelHome.tr(context),
            route: TravelAppRoutesProvider.routeHome,
          ),
          NavigationItem(
            icon: Icons.calendar_today_outlined,
            activeIcon: Icons.calendar_today,
            iconImage: AssetsImagesAppTravel.travelNavTabJourney,
            activeIconImage: AssetsImagesAppTravel.travelNavTabJourney,
            label: TravelLocalizationKeys.travelJourney.tr(context),
            route: TravelAppRoutesProvider.routeHome,
          ),
          NavigationItem(
            icon: Icons.chat_bubble_outline,
            activeIcon: Icons.chat_bubble,
            iconImage: AssetsImagesAppTravel.travelNavTabService,
            activeIconImage: AssetsImagesAppTravel.travelNavTabService,
            label: TravelLocalizationKeys.travelCustomerService.tr(context),
            route: TravelAppRoutesProvider.routeHome,
          ),
          NavigationItem(
            icon: Icons.explore_outlined,
            activeIcon: Icons.explore,
            iconImage: AssetsImagesAppTravel.travelNavTabExplore,
            activeIconImage: AssetsImagesAppTravel.travelNavTabExplore,
            label: TravelLocalizationKeys.travelExploreWorld.tr(context),
            route: TravelAppRoutesProvider.routeSearch,
            badge: TravelLocalizationKeys.travelTravelGuide.tr(context),
            badgeColor: const Color(0xFFFF3B30),
          ),
          NavigationItem(
            icon: Icons.person_outline,
            activeIcon: Icons.person,
            iconImage: AssetsImagesAppTravel.travelNavTabMine,
            activeIconImage: AssetsImagesAppTravel.travelNavTabMine,
            label: TravelLocalizationKeys.travelMine.tr(context),
            route: TravelAppRoutesProvider.routeProfile,
          ),
        ],
      ),
    );
  }
}
