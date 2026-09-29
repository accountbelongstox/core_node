import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_example/features_app_example/home/views/home_screen.dart';
import 'package:qyflutter/common/widgets/enhanced_bottom_navigation.dart';
import 'package:qyflutter/apps/app_example/router_app_example/routes_provider_app_example.dart';
// AI: Claude Code - Replaced app-specific HomeBottomNavigationBar with common EnhancedBottomNavigation

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          HomeScreen(),
          Positioned(
            child: Align(
              alignment: Alignment.bottomCenter,
              child: EnhancedBottomNavigation(
                currentIndex: 0,
                useRoundedDesign: true,
                showLabels: false,
                items: [
                  NavigationItem(
                    icon: Icons.home_filled,
                    label: 'home',
                    route: ExampleAppRoutesProvider.routeHome,
                  ),
                  NavigationItem(
                    icon: Icons.archive_outlined,
                    label: 'activity',
                    route: ExampleAppRoutesProvider.routeDonation,
                  ),
                  NavigationItem(
                    icon: Icons.list_outlined,
                    label: 'notification',
                    route: ExampleAppRoutesProvider.routeFundraising,
                    isCenter: true,
                  ),
                  NavigationItem(
                    icon: Icons.sms_outlined,
                    label: 'chat',
                    route: ExampleAppRoutesProvider.routeChat,
                  ),
                  NavigationItem(
                    icon: Icons.person_outline,
                    label: 'profile',
                    route: ExampleAppRoutesProvider.routeProfile,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
