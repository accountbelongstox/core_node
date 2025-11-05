import 'package:flutter/material.dart';
import '../../../models_app_travel/hot_content_model.dart';
import '../../../models_app_travel/travel_inspiration_model.dart';
import '../../../testdata/journey_data.dart';

/// Tab widget for displaying "My Itinerary" content
/// Includes travel inspiration, fun maps, and hot picks sections
class MyItineraryTab extends StatefulWidget {
  const MyItineraryTab({super.key});

  @override
  State<MyItineraryTab> createState() => _MyItineraryTabState();
}

class _MyItineraryTabState extends State<MyItineraryTab>
    with AutomaticKeepAliveClientMixin {
  List<TravelInspirationModel> _inspirations = [];
  List<HotContentModel> _hotContents = [];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() {
    // Load data from testdata (similar to orders_data.dart pattern)
    _inspirations = TestJourneyData.getTravelInspirations();
    _hotContents = TestJourneyData.getHotContents();
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      child: Column(
        children: [
          _buildEmptyState(),
          if (_inspirations.isNotEmpty) _buildTravelInspiration(),
          if (_hotContents.isNotEmpty) _buildHotSelection(),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 40.0),
      child: Column(
        children: [
          Image.asset(
            'assets/apps/app_travel/images/empty_order_mascot.png',
            width: 160.0,
            height: 160.0,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                width: 160.0,
                height: 160.0,
                decoration: BoxDecoration(
                  color: const Color(0xFFE3F2FD),
                  borderRadius: BorderRadius.circular(80.0),
                ),
                child: const Icon(
                  Icons.receipt_long_outlined,
                  size: 80.0,
                  color: Color(0xFF00D0D8),
                ),
              );
            },
          ),
          const SizedBox(height: 16.0),
          const Text(
            '您还没有订单哦～',
            style: TextStyle(
              fontSize: 15.0,
              color: Colors.black38,
            ),
          ),
          const SizedBox(height: 60.0),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                '找不到订单，',
                style: TextStyle(
                  fontSize: 13.0,
                  color: Colors.black38,
                ),
              ),
              GestureDetector(
                onTap: () {
                  debugPrint('Check reason tapped');
                },
                child: const Text(
                  '点击查看原因',
                  style: TextStyle(
                    fontSize: 13.0,
                    color: Color(0xFF00D0D8),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8.0),
          const Text(
            '*根据铁路局规定，火车票仅展示近30天订单*',
            style: TextStyle(
              fontSize: 11.0,
              color: Colors.black26,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTravelInspiration() {
    return Container(
      margin: const EdgeInsets.only(top: 12.0, bottom: 16.0),
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
      color: Colors.white,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '旅行灵感',
            style: TextStyle(
              fontSize: 17.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 12.0),
          ..._inspirations.map((inspiration) =>
              _buildInspirationItem(inspiration)),
        ],
      ),
    );
  }

  Widget _buildInspirationItem(TravelInspirationModel inspiration) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12.0),
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F8F8),
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Row(
        children: [
          Container(
            width: 48.0,
            height: 48.0,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(8.0),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8.0),
              child: Image.asset(
                inspiration.imageUrl,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: const Color(0xFF4A9F7C),
                    child: const Icon(
                      Icons.map_outlined,
                      color: Colors.white,
                      size: 28.0,
                    ),
                  );
                },
              ),
            ),
          ),
          const SizedBox(width: 12.0),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  inspiration.title,
                  style: const TextStyle(
                    fontSize: 15.0,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4.0),
                Text(
                  inspiration.subtitle,
                  style: const TextStyle(
                    fontSize: 13.0,
                    color: Colors.black45,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.chevron_right,
            size: 20.0,
            color: Colors.black26,
          ),
        ],
      ),
    );
  }

  Widget _buildHotSelection() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '热门精选',
            style: TextStyle(
              fontSize: 17.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 16.0),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              crossAxisSpacing: 12.0,
              mainAxisSpacing: 12.0,
              childAspectRatio: 0.68,
            ),
            itemCount: _hotContents.length,
            itemBuilder: (context, index) {
              return _buildHotContentCard(_hotContents[index]);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildHotContentCard(HotContentModel content) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(8.0),
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(8.0)),
              child: Image.asset(
                content.image,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    color: const Color(0xFFF0F0F0),
                    child: const Center(
                      child: Icon(
                        Icons.image,
                        size: 48.0,
                        color: Colors.grey,
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  content.title,
                  style: const TextStyle(
                    fontSize: 13.0,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4.0),
                Text(
                  content.subtitle,
                  style: const TextStyle(
                    fontSize: 12.0,
                    color: Colors.black54,
                  ),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 8.0),
                Row(
                  children: [
                    const CircleAvatar(
                      radius: 10.0,
                      backgroundColor: Color(0xFF00D0D8),
                      child: Icon(
                        Icons.person,
                        size: 12.0,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(width: 6.0),
                    Expanded(
                      child: Text(
                        content.author,
                        style: const TextStyle(
                          fontSize: 11.0,
                          color: Colors.black45,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const Icon(
                      Icons.favorite_border,
                      size: 14.0,
                      color: Colors.black38,
                    ),
                    const SizedBox(width: 4.0),
                    Text(
                      '${content.likes}',
                      style: const TextStyle(
                        fontSize: 11.0,
                        color: Colors.black45,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
