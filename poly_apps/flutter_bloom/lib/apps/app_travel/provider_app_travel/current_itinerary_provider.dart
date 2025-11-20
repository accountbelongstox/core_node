import 'package:flutter/foundation.dart';
import '../models_app_travel/order_model.dart';
import '../testdata/orders_data.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Provider for managing the current itinerary order
/// Handles setting and retrieving the active trip order displayed in "我的行程" tab
class CurrentItineraryProvider with ChangeNotifier {
  OrderModel? _currentItinerary;
  bool _isInitialized = false;

  static const String _storageKey = 'current_itinerary_order_id';

  OrderModel? get currentItinerary => _currentItinerary;
  bool get hasCurrentItinerary => _currentItinerary != null;

  /// Initialize the provider and load saved itinerary
  Future<void> initialize() async {
    if (_isInitialized) return;

    await _loadSavedItinerary();

    // If no saved itinerary, set default to "万象 → 首尔(转) → 塞班"
    if (_currentItinerary == null) {
      _setDefaultItinerary();
    }

    _isInitialized = true;
    notifyListeners();
  }

  /// Load saved itinerary from storage
  Future<void> _loadSavedItinerary() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedOrderId = prefs.getString(_storageKey);

      if (savedOrderId != null) {
        // Find the order by ID and check if it's in the future
        final allOrders = TestOrdersData.getTestOrders();
        final futureOrders = _getFutureOrders(allOrders);

        // Try to find the saved order in future orders
        try {
          final savedOrder = futureOrders.firstWhere(
            (order) => order.id == savedOrderId,
          );

          // Only set if the order is in the future
          if (_isOrderInFuture(savedOrder)) {
            _currentItinerary = savedOrder;
            debugPrint('Loaded saved itinerary: ${savedOrder.title} (${savedOrder.id})');
          }
        } catch (e) {
          // Saved order not found in future orders, will use default
          debugPrint('Saved order $savedOrderId not found in future orders, will use default');
        }
      }
    } catch (e) {
      debugPrint('Error loading saved itinerary: $e');
    }
  }

  /// Set default itinerary - prefer multi-segment flight orders
  void _setDefaultItinerary() {
    debugPrint('=== Setting default itinerary ===');
    final allOrders = TestOrdersData.getTestOrders();
    debugPrint('Total orders: ${allOrders.length}');

    final futureOrders = _getFutureOrders(allOrders);

    if (futureOrders.isEmpty) {
      debugPrint('No future orders found, clearing current itinerary');
      _currentItinerary = null;
      return;
    }

    debugPrint('Found ${futureOrders.length} future orders:');
    for (var order in futureOrders) {
      debugPrint('  - ${order.title} (${order.id}, ${order.type})');
    }

    // Prefer multi-segment flight orders
    final multiSegmentFlights = futureOrders.where((order) {
      if (order.type != OrderType.flight) return false;
      final segments = order.extraInfo?['segments'] as List?;
      return segments != null && segments.length > 1;
    }).toList();

    debugPrint('Found ${multiSegmentFlights.length} multi-segment flights:');
    for (var order in multiSegmentFlights) {
      debugPrint('  - ${order.title} (${order.id})');
    }

    if (multiSegmentFlights.isNotEmpty) {
      _currentItinerary = multiSegmentFlights.first;
      debugPrint('✓ Selected multi-segment flight: ${_currentItinerary?.title} (${_currentItinerary?.id})');
      return;
    }

    // Fallback to any flight order
    final flightOrders = futureOrders.where((order) => order.type == OrderType.flight).toList();
    if (flightOrders.isNotEmpty) {
      _currentItinerary = flightOrders.first;
      debugPrint('✓ Selected flight: ${_currentItinerary?.title} (${_currentItinerary?.id})');
      return;
    }

    // Fallback to first future order
    _currentItinerary = futureOrders.first;
    debugPrint('✓ Selected first future order: ${_currentItinerary?.title} (${_currentItinerary?.id})');
  }

  /// Get orders that are in the future (after current time)
  List<OrderModel> _getFutureOrders(List<OrderModel> orders) {
    final now = DateTime.now();
    return orders.where((order) => _isOrderInFuture(order, now: now)).toList();
  }

  /// Check if an order is in the future
  /// For multi-segment orders, check if any segment is in the future
  bool _isOrderInFuture(OrderModel order, {DateTime? now}) {
    now ??= DateTime.now();

    debugPrint('Checking if order ${order.id} (${order.title}) is in future');
    debugPrint('Current time: $now');

    // Check if order has segments
    final segments = order.extraInfo?['segments'] as List?;

    if (segments != null && segments.isNotEmpty) {
      debugPrint('Order has ${segments.length} segments');
      // For multi-segment orders, check if any segment is in the future
      for (var i = 0; i < segments.length; i++) {
        final segment = segments[i];
        final segmentDate = _parseSegmentDate(segment, order);
        final isFuture = segmentDate.isAfter(now);
        debugPrint('Segment $i: $segmentDate, is future: $isFuture');
        if (isFuture) {
          debugPrint('Order ${order.id} has future segment, returning true');
          return true;
        }
      }
      debugPrint('Order ${order.id} has no future segments, returning false');
      return false;
    } else {
      // For single orders, use order date
      final orderDate = _parseOrderDate(order);
      final isFuture = orderDate.isAfter(now);
      debugPrint('Single order date: $orderDate, is future: $isFuture');
      return isFuture;
    }
  }

  /// Parse segment date
  DateTime _parseSegmentDate(dynamic segment, OrderModel order) {
    final departureTime = segment['departureTime'] as String? ?? '';
    final departureDate = segment['departureDate'] as String? ?? '';

    // If has full date
    if (departureDate.isNotEmpty) {
      try {
        // Combine date and time if available
        if (departureTime.contains(':')) {
          final timeParts = departureTime.split(':');
          if (timeParts.length >= 2) {
            final hour = int.parse(timeParts[0]);
            final minute = int.parse(timeParts[1]);
            final dateParts = departureDate.split('-');
            if (dateParts.length == 3) {
              final year = int.parse(dateParts[0]);
              final month = int.parse(dateParts[1]);
              final day = int.parse(dateParts[2]);
              return DateTime(year, month, day, hour, minute);
            }
          }
        }
        // Date only
        return DateTime.parse(departureDate);
      } catch (e) {
        debugPrint('Error parsing segment departureDate: $e');
      }
    }

    // Try to combine order date with departure time
    final orderDate = _parseOrderDate(order);

    // Parse time like "16:35"
    if (departureTime.contains(':')) {
      try {
        final timeParts = departureTime.split(':');
        if (timeParts.length >= 2) {
          final hour = int.parse(timeParts[0]);
          final minute = int.parse(timeParts[1]);

          return DateTime(
            orderDate.year,
            orderDate.month,
            orderDate.day,
            hour,
            minute,
          );
        }
      } catch (e) {
        debugPrint('Error parsing segment time: $e');
      }
    }

    // Fallback to order date
    return orderDate;
  }

  /// Parse order date from extraInfo or date field
  DateTime _parseOrderDate(OrderModel order) {
    // Try to get startDate from extraInfo
    if (order.extraInfo?['startDate'] != null) {
      try {
        return DateTime.parse(order.extraInfo!['startDate']);
      } catch (e) {
        debugPrint('Error parsing startDate: $e');
      }
    }

    // Try to parse from date field
    final dateStr = order.date;

    // Format: "11月6日 至 11月7日" - extract start date
    if (dateStr.contains('至')) {
      final parts = dateStr.split('至');
      return _parseChineseDate(parts[0].trim());
    }

    // Format: "11月12日(周三)" or "11-12 周三"
    if (dateStr.contains('月') && dateStr.contains('日')) {
      return _parseChineseDate(dateStr);
    }

    // Format: "2025-07-22 09:30" - ISO format
    try {
      return DateTime.parse(dateStr);
    } catch (e) {
      // If all parsing fails, return a date in the past
      return DateTime(2000, 1, 1);
    }
  }

  /// Parse Chinese date format "11月6日" or "11月12日(周三)" or "11-12 周三"
  DateTime _parseChineseDate(String dateStr) {
    try {
      // Remove parentheses and clean
      final cleaned = dateStr.replaceAll(RegExp(r'\(.*?\)'), '').trim();

      // Extract month and day
      final monthMatch = RegExp(r'(\d+)月').firstMatch(cleaned);
      final dayMatch = RegExp(r'(\d+)日').firstMatch(cleaned);

      // Try format "11-12"
      final dashMatch = RegExp(r'(\d+)-(\d+)').firstMatch(cleaned);

      int? month;
      int? day;

      if (monthMatch != null && dayMatch != null) {
        month = int.parse(monthMatch.group(1)!);
        day = int.parse(dayMatch.group(1)!);
      } else if (dashMatch != null) {
        month = int.parse(dashMatch.group(1)!);
        day = int.parse(dashMatch.group(2)!);
      }

      if (month != null && day != null) {
        final now = DateTime.now();
        int year = now.year;

        // If current month is Nov/Dec and parsed month is 1-10, it's next year
        if (now.month >= 11 && month < 11) {
          year = now.year + 1;
        }

        return DateTime(year, month, day);
      }
    } catch (e) {
      debugPrint('Error parsing Chinese date: $e');
    }

    // Return a date in the past if parsing fails
    return DateTime(2000, 1, 1);
  }

  /// Set current itinerary order (only if it's in the future)
  Future<bool> setCurrentItinerary(OrderModel order) async {
    try {
      // Check if the order is in the future
      if (!_isOrderInFuture(order)) {
        debugPrint('Cannot set past order as current itinerary');
        return false;
      }

      _currentItinerary = order;

      // Save to storage
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_storageKey, order.id);

      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('Error setting current itinerary: $e');
      return false;
    }
  }

  /// Clear current itinerary
  Future<void> clearCurrentItinerary() async {
    try {
      _currentItinerary = null;

      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_storageKey);

      notifyListeners();
    } catch (e) {
      debugPrint('Error clearing current itinerary: $e');
    }
  }

  /// Check if an order is the current itinerary
  bool isCurrentItinerary(String orderId) {
    return _currentItinerary?.id == orderId;
  }

  /// Force reset to default itinerary (useful for debugging)
  Future<void> forceResetToDefault() async {
    debugPrint('=== Force resetting to default itinerary ===');
    try {
      // Clear saved preference
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_storageKey);

      // Set default
      _setDefaultItinerary();

      notifyListeners();
      debugPrint('Force reset complete');
    } catch (e) {
      debugPrint('Error during force reset: $e');
    }
  }
}
