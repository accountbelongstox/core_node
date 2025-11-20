import 'package:flutter/material.dart';

enum OrderType {
  hotel,
  flight,
  train,
  scenic,
  tour,
}

enum OrderStatus {
  pending,
  confirmed,
  traveling,
  completed,
  refunding,
  refunded,
  cancelled,
}

class OrderModel {
  final String id;
  final OrderType type;
  final OrderStatus status;
  final String title;
  final String subtitle;
  final String imageUrl;
  final String date;
  final String price;
  final int quantity;
  final String? statusText;
  final Color? statusColor;
  final List<OrderAction> actions;
  final Map<String, dynamic>? extraInfo;

  OrderModel({
    required this.id,
    required this.type,
    required this.status,
    required this.title,
    required this.subtitle,
    required this.imageUrl,
    required this.date,
    required this.price,
    this.quantity = 1,
    this.statusText,
    this.statusColor,
    this.actions = const [],
    this.extraInfo,
  });

  String get typeDisplayName {
    switch (type) {
      case OrderType.hotel:
        return '酒店订单';
      case OrderType.flight:
        return '机票订单';
      case OrderType.train:
        return '火车票订单';
      case OrderType.scenic:
        return '景点门票';
      case OrderType.tour:
        return '旅游产品';
    }
  }

  String get statusDisplayName {
    if (statusText != null) return statusText!;

    switch (status) {
      case OrderStatus.pending:
        return '待支付';
      case OrderStatus.confirmed:
        return '已确认';
      case OrderStatus.traveling:
        return '待出行';
      case OrderStatus.completed:
        return '待点评';
      case OrderStatus.refunding:
        return '退款中';
      case OrderStatus.refunded:
        return '已退款';
      case OrderStatus.cancelled:
        return '已取消';
    }
  }

  Color get displayStatusColor {
    if (statusColor != null) return statusColor!;

    switch (status) {
      case OrderStatus.pending:
        return const Color(0xFFFF6B35);
      case OrderStatus.confirmed:
        return const Color(0xFF00D0D8);
      case OrderStatus.traveling:
        return const Color(0xFF00D0D8);
      case OrderStatus.completed:
        return const Color(0xFFFF9A56);
      case OrderStatus.refunding:
        return const Color(0xFFFF3B30);
      case OrderStatus.refunded:
        return const Color(0xFF999999);
      case OrderStatus.cancelled:
        return const Color(0xFF999999);
    }
  }

  IconData get typeIcon {
    switch (type) {
      case OrderType.hotel:
        return Icons.hotel;
      case OrderType.flight:
        return Icons.flight;
      case OrderType.train:
        return Icons.train;
      case OrderType.scenic:
        return Icons.landscape;
      case OrderType.tour:
        return Icons.tour;
    }
  }

  // 判断是否是转机航班
  bool get hasTransfer {
    if (type != OrderType.flight) return false;
    return extraInfo?['hasTransfer'] == true ||
           extraInfo?['isMultiSegment'] == true ||
           (extraInfo?['totalStops'] != null && extraInfo!['totalStops'] > 0);
  }

  bool matchesFilter(String filter) {
    switch (filter) {
      case '全部':
        return true;
      case '待支付':
        return status == OrderStatus.pending;
      case '待出行':
        return status == OrderStatus.traveling || status == OrderStatus.confirmed;
      case '退款/售后':
        return status == OrderStatus.refunding || status == OrderStatus.refunded;
      case '待点评':
        return status == OrderStatus.completed;
      default:
        return true;
    }
  }
}

class OrderAction {
  final String label;
  final Color? color;
  final VoidCallback onTap;
  final bool isPrimary;

  OrderAction({
    required this.label,
    this.color,
    required this.onTap,
    this.isPrimary = false,
  });
}
