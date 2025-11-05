import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../widgets/my_itinerary_tab.dart';
import '../widgets/all_orders_tab.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';
import '../../../resources_app_travel/colors_app_travel.dart';

/// Journey Screen with Tab Navigation
/// Displays "My Itinerary" and "All Orders" in separate tabs
///
/// Features:
/// - Tab-based navigation for better UX
/// - Centralized data management (no hardcoded data)
/// - Separate components for each tab
class JourneyScreen extends StatefulWidget {
  const JourneyScreen({super.key});

  @override
  State<JourneyScreen> createState() => _JourneyScreenState();
}

class _JourneyScreenState extends State<JourneyScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: TabBarView(
                controller: _tabController,
                children: const [
                  MyItineraryTab(),
                  AllOrdersTab(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      color: Colors.white,
      child: Column(
        children: [
          // Top bar with tabs and service button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Row(
              children: [
                Expanded(
                  child: TabBar(
                    controller: _tabController,
                    isScrollable: true,
                    indicatorColor: TravelColors.travelPrimary,
                    indicatorWeight: 3.0,
                    indicatorSize: TabBarIndicatorSize.label,
                    labelColor: Colors.black87,
                    labelStyle: const TextStyle(
                      fontSize: 18.0,
                      fontWeight: FontWeight.bold,
                    ),
                    unselectedLabelColor: Colors.black54,
                    unselectedLabelStyle: const TextStyle(
                      fontSize: 15.0,
                      fontWeight: FontWeight.normal,
                    ),
                    tabs: [
                      Tab(text: TravelLocalizationKeys.travelMyItinerary.tr(context)),
                      Tab(text: TravelLocalizationKeys.travelAllOrders.tr(context)),
                    ],
                  ),
                ),
                const SizedBox(width: 16.0),
                GestureDetector(
                  onTap: () {
                    debugPrint('Service tapped');
                    // TODO: Navigate to service/customer support page
                  },
                  child: Column(
                    children: [
                      const Icon(
                        Icons.headset_mic_outlined,
                        size: 24.0,
                        color: Colors.black54,
                      ),
                      const SizedBox(height: 2.0),
                      Text(
                        TravelLocalizationKeys.travelCustomerService.tr(context),
                        style: const TextStyle(
                          fontSize: 11.0,
                          color: Colors.black54,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
