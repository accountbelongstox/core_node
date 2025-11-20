import 'order_model.dart';

/// Itinerary item model representing a single travel activity in a day
class ItineraryItemModel {
  final String id;
  final DateTime date;
  final ItineraryItemType type;
  final String title;
  final String? subtitle;
  final String? destination;
  final Map<String, dynamic>? details;
  final OrderModel? relatedOrder;

  ItineraryItemModel({
    required this.id,
    required this.date,
    required this.type,
    required this.title,
    this.subtitle,
    this.destination,
    this.details,
    this.relatedOrder,
  });

  factory ItineraryItemModel.fromOrder(OrderModel order) {
    DateTime date;
    ItineraryItemType type;
    String? destination;

    try {
      date = _parseDateFromOrder(order);
    } catch (e) {
      date = DateTime.now();
    }

    switch (order.type) {
      case OrderType.flight:
        type = ItineraryItemType.flight;
        destination = _extractDestination(order);
        break;
      case OrderType.hotel:
        type = ItineraryItemType.hotel;
        destination = order.title;
        break;
      case OrderType.train:
        type = ItineraryItemType.train;
        destination = _extractDestination(order);
        break;
      case OrderType.scenic:
        type = ItineraryItemType.attraction;
        destination = order.title;
        break;
      case OrderType.tour:
        type = ItineraryItemType.tour;
        destination = _extractDestination(order);
        break;
    }

    return ItineraryItemModel(
      id: order.id,
      date: date,
      type: type,
      title: order.title,
      subtitle: order.subtitle,
      destination: destination,
      details: order.extraInfo,
      relatedOrder: order,
    );
  }

  static DateTime _parseDateFromOrder(OrderModel order) {
    final dateStr = order.date;

    if (dateStr.contains('至')) {
      final parts = dateStr.split('至');
      return _parseChineseDate(parts[0].trim());
    } else if (dateStr.contains(' ')) {
      final datePart = dateStr.split(' ')[0];
      if (datePart.contains('月')) {
        return _parseChineseDate(datePart);
      }
    } else if (dateStr.contains('月')) {
      return _parseChineseDate(dateStr);
    }

    return DateTime.now();
  }

  static DateTime _parseChineseDate(String dateStr) {
    final now = DateTime.now();
    final monthMatch = RegExp(r'(\d+)月').firstMatch(dateStr);
    final dayMatch = RegExp(r'(\d+)日').firstMatch(dateStr);

    if (monthMatch != null && dayMatch != null) {
      final month = int.parse(monthMatch.group(1)!);
      final day = int.parse(dayMatch.group(1)!);
      return DateTime(now.year, month, day);
    }

    return now;
  }

  static String? _extractDestination(OrderModel order) {
    final title = order.title;

    if (title.contains('→')) {
      final parts = title.split('→');
      return parts.length > 1 ? parts.last.trim() : null;
    }

    if (order.extraInfo != null) {
      if (order.extraInfo!.containsKey('arrival')) {
        return order.extraInfo!['arrival'] as String?;
      }
    }

    return null;
  }
}

/// Daily itinerary model grouping items by date
class DailyItineraryModel {
  final DateTime date;
  final List<ItineraryItemModel> items;
  final String? weatherInfo;
  final String? tips;

  DailyItineraryModel({
    required this.date,
    required this.items,
    this.weatherInfo,
    this.tips,
  });

  String get dateDisplay {
    final month = date.month.toString().padLeft(2, '0');
    final day = date.day.toString().padLeft(2, '0');
    final weekday = _getWeekdayName(date.weekday);
    return '$month月${day}日 $weekday';
  }

  String _getWeekdayName(int weekday) {
    const weekdays = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
    return weekdays[weekday - 1];
  }

  bool get hasFlights {
    return items.any((item) => item.type == ItineraryItemType.flight);
  }

  bool get hasHotels {
    return items.any((item) => item.type == ItineraryItemType.hotel);
  }

  String? get mainDestination {
    final flightItem = items.firstWhere(
      (item) => item.type == ItineraryItemType.flight && item.destination != null,
      orElse: () => items.first,
    );
    return flightItem.destination;
  }
}

enum ItineraryItemType {
  flight,
  hotel,
  train,
  attraction,
  tour,
  transfer,
  other,
}
