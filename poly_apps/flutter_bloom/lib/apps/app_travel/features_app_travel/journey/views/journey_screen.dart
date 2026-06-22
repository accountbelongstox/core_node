import 'package:flutter/material.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../widgets/my_itinerary_tab.dart';
import '../widgets/all_orders_tab.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';

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
    _tabController.addListener(() {
      setState(() {});
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  void _showOrderCategoryMenu() {
    showDialog(
      context: context,
      barrierColor: Colors.black.withOpacity(0.3),
      builder: (BuildContext context) {
        return Align(
          alignment: Alignment.topCenter,
          child: Material(
            color: Colors.transparent,
            child: Container(
              margin: const EdgeInsets.only(top: 100.0, left: 16.0, right: 16.0),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16.0),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.1),
                    blurRadius: 10.0,
                    offset: const Offset(0, 5.0),
                  ),
                ],
              ),
              child: SingleChildScrollView(
                child: Container(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.symmetric(vertical: 12.0, horizontal: 16.0),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE8F8F5),
                          border: Border.all(color: const Color(0xFF4DD0E1), width: 1.0),
                          borderRadius: BorderRadius.circular(8.0),
                        ),
                        child: const Text(
                          '全部订单',
                          style: TextStyle(
                            fontSize: 16.0,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF00BFA5),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20.0),
                      const Text(
                        '旅行产品',
                        style: TextStyle(
                          fontSize: 16.0,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 12.0),
                      _buildCategoryGrid([
                        '机票·套餐', '酒店住宿', '民宿住宿',
                        '汽车票·船票', '火车票', '门票',
                        '专车·租车', '旅游度假', '团购',
                        '签证', '惠玩', '当地抵扣券',
                      ]),
                      const SizedBox(height: 20.0),
                      const Text(
                        '商城及会员',
                        style: TextStyle(
                          fontSize: 16.0,
                          fontWeight: FontWeight.bold,
                          color: Colors.black87,
                        ),
                      ),
                      const SizedBox(height: 12.0),
                      _buildCategoryGrid([
                        '旅行商城', '付费会员',
                      ]),
                      const SizedBox(height: 16.0),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildCategoryGrid(List<String> items) {
    return Wrap(
      spacing: 8.0,
      runSpacing: 8.0,
      children: items.map((item) {
        return Container(
          width: (MediaQuery.of(context).size.width - 64.0) / 3,
          padding: const EdgeInsets.symmetric(vertical: 10.0, horizontal: 8.0),
          decoration: BoxDecoration(
            color: const Color(0xFFF5F5F5),
            borderRadius: BorderRadius.circular(8.0),
          ),
          alignment: Alignment.center,
          child: Text(
            item,
            style: const TextStyle(
              fontSize: 14.0,
              fontWeight: FontWeight.w500,
              color: Colors.black87,
            ),
            textAlign: TextAlign.center,
          ),
        );
      }).toList(),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: _tabController.index == 0 ? Colors.transparent : const Color(0xFFF5F5F5),
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
      color: _tabController.index == 0 ? Colors.transparent : Colors.white,
      child: Column(
        children: [
          // Top bar with tabs and service button
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
            child: Row(
              children: [
                Expanded(
                  child: Row(
                    children: [
                      GestureDetector(
                        onTap: () {
                          _tabController.animateTo(0);
                        },
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 8.0),
                          child: Text(
                            TravelLocalizationKeys.travelMyItinerary.tr(context),
                            style: TextStyle(
                              fontSize: 23.4,
                              fontWeight: FontWeight.bold,
                              color: _tabController.index == 0 ? Colors.black87 : Colors.black54,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 16.0),
                      GestureDetector(
                        onTap: () {
                          _tabController.animateTo(1);
                        },
                        child: Row(
                          children: [
                            Text(
                              TravelLocalizationKeys.travelAllOrders.tr(context),
                              style: TextStyle(
                                fontSize: 23.4,
                                fontWeight: FontWeight.bold,
                                color: _tabController.index == 1 ? Colors.black87 : Colors.black54,
                              ),
                            ),
                            const SizedBox(width: 4.0),
                            GestureDetector(
                              onTap: _showOrderCategoryMenu,
                              child: Icon(
                                Icons.keyboard_arrow_down,
                                size: 20.0,
                                color: _tabController.index == 1 ? Colors.black87 : Colors.black54,
                              ),
                            ),
                          ],
                        ),
                      ),
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
