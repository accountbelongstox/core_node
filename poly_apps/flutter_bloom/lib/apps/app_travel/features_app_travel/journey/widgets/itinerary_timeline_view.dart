import 'package:flutter/material.dart';
import '../../../models_app_travel/itinerary_model.dart';
import '../../../services_app_travel/journey_service.dart';
import 'wechat_subscribe_banner.dart';
import 'date_header.dart';
import 'flight_itinerary_card.dart';

/// Timeline view for displaying user's itinerary organized by date
class ItineraryTimelineView extends StatefulWidget {
  const ItineraryTimelineView({super.key});

  @override
  State<ItineraryTimelineView> createState() => _ItineraryTimelineViewState();
}

class _ItineraryTimelineViewState extends State<ItineraryTimelineView> {
  final JourneyService _journeyService = JourneyService();
  List<DailyItineraryModel> _dailyItineraries = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadItinerary();
  }

  Future<void> _loadItinerary() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final itineraries = await _journeyService.fetchDailyItinerary();
      setState(() {
        _dailyItineraries = itineraries;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(
          valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00D0D8)),
        ),
      );
    }

    if (_dailyItineraries.isEmpty) {
      return _buildEmptyState();
    }

    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: Column(
            children: [
              const SizedBox(height: 16.0),
              const WechatSubscribeBanner(),
              const SizedBox(height: 8.0),
            ],
          ),
        ),

        SliverList(
          delegate: SliverChildBuilderDelegate(
            (context, index) {
              final daily = _dailyItineraries[index];
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  DateHeader(
                    date: daily.date,
                    destination: daily.mainDestination,
                  ),
                  ...daily.items.map((item) => _buildItineraryItem(item)),
                  const SizedBox(height: 16.0),
                ],
              );
            },
            childCount: _dailyItineraries.length,
          ),
        ),

        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Center(
              child: TextButton(
                onTap: () {},
                style: TextButton.styleFrom(
                  foregroundColor: const Color(0xFF00D0D8),
                ),
                child: const Text(
                  '查看全部订单',
                  style: TextStyle(
                    fontSize: 14.0,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildItineraryItem(ItineraryItemModel item) {
    switch (item.type) {
      case ItineraryItemType.flight:
        return FlightItineraryCard(itinerary: item);
      case ItineraryItemType.hotel:
        return _buildHotelCard(item);
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildHotelCard(ItineraryItemModel item) {
    final order = item.relatedOrder;
    if (order == null) return const SizedBox.shrink();

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.06),
            blurRadius: 8.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(
                Icons.hotel,
                size: 20.0,
                color: Color(0xFFFFB84D),
              ),
              const SizedBox(width: 8.0),
              Expanded(
                child: Text(
                  order.title,
                  style: const TextStyle(
                    fontSize: 15.0,
                    fontWeight: FontWeight.w600,
                    color: Colors.black87,
                  ),
                ),
              ),
              Text(
                order.statusText ?? '',
                style: const TextStyle(
                  fontSize: 13.0,
                  color: Colors.black45,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8.0),
          Text(
            order.subtitle,
            style: const TextStyle(
              fontSize: 13.0,
              color: Colors.black54,
            ),
          ),
          const SizedBox(height: 12.0),
          Row(
            children: [
              const Icon(
                Icons.access_time,
                size: 14.0,
                color: Colors.black45,
              ),
              const SizedBox(width: 4.0),
              Text(
                order.date,
                style: const TextStyle(
                  fontSize: 12.0,
                  color: Colors.black45,
                ),
              ),
              const Spacer(),
              Text(
                order.price,
                style: const TextStyle(
                  fontSize: 16.0,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFFFF6B35),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const SizedBox(height: 120.0),
          Icon(
            Icons.travel_explore,
            size: 80.0,
            color: Colors.grey[300],
          ),
          const SizedBox(height: 16.0),
          Text(
            '暂无行程',
            style: TextStyle(
              fontSize: 16.0,
              color: Colors.grey[600],
            ),
          ),
          const SizedBox(height: 8.0),
          Text(
            '预订后将自动生成行程',
            style: TextStyle(
              fontSize: 14.0,
              color: Colors.grey[500],
            ),
          ),
        ],
      ),
    );
  }
}
