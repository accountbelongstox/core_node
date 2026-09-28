import 'package:flutter/material.dart';
import '../../../models_app_travel/order_model.dart';
import '../../../testdata/orders_data.dart';
import '../../../resources_app_travel/assets_images_app_travel.dart';
import '../../../new_order/order_detail_page.dart';
import '../../../new_order/utils/order_converter.dart';
import '../../../provider_app_travel/traveler_provider_app_travel.dart';
import '../../flight_detail/flight_order_detail_page.dart';
import 'package:provider/provider.dart';

/// Tab widget for displaying "All Orders"
/// Includes order filtering, search, and list view
class AllOrdersTab extends StatefulWidget {
  const AllOrdersTab({super.key});

  @override
  State<AllOrdersTab> createState() => _AllOrdersTabState();
}

class _AllOrdersTabState extends State<AllOrdersTab>
    with AutomaticKeepAliveClientMixin {
  int _selectedFilterIndex = 0;
  String _searchQuery = '';
  List<OrderModel> _allOrders = [];
  List<OrderModel> _filteredOrders = [];

  final List<String> _filterTabs = ['全部', '待支付', '待出行', '退款/售后', '待点评'];

  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  void _loadOrders() {
    _allOrders = TestOrdersData.getTestOrders();
    _applyFilters();
  }

  void _applyFilters() {
    setState(() {
      String currentFilter = _filterTabs[_selectedFilterIndex];
      _filteredOrders = TestOrdersData.filterOrders(_allOrders, currentFilter);

      // Apply search filter
      if (_searchQuery.isNotEmpty) {
        _filteredOrders = _filteredOrders.where((order) {
          return order.title.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              order.subtitle.toLowerCase().contains(_searchQuery.toLowerCase()) ||
              order.id.toLowerCase().contains(_searchQuery.toLowerCase());
        }).toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);
    final orderCounts = TestOrdersData.getOrderCounts(_allOrders);

    return Column(
      children: [
        _buildSearchBar(),
        _buildFilterTabs(orderCounts),
        Expanded(
          child: _filteredOrders.isEmpty
              ? _buildEmptyState()
              : _buildOrderList(),
        ),
      ],
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: const EdgeInsets.all(12.0),
      color: Colors.white,
      child: Container(
        height: 40.0,
        decoration: BoxDecoration(
          color: const Color(0xFFF5F5F5),
          borderRadius: BorderRadius.circular(20.0),
        ),
        child: Row(
          children: [
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 12.0),
              child: Icon(
                Icons.search,
                size: 20.0,
                color: Colors.grey,
              ),
            ),
            Expanded(
              child: TextField(
                onChanged: (value) {
                  setState(() {
                    _searchQuery = value;
                  });
                  _applyFilters();
                },
                decoration: const InputDecoration(
                  hintText: '输入关键字、目的地、出行人姓名',
                  hintStyle: TextStyle(
                    fontSize: 13.0,
                    color: Colors.grey,
                  ),
                  border: InputBorder.none,
                  focusedBorder: InputBorder.none,
                  enabledBorder: InputBorder.none,
                  errorBorder: InputBorder.none,
                  disabledBorder: InputBorder.none,
                  isDense: true,
                  contentPadding: EdgeInsets.symmetric(vertical: 10.0),
                ),
                style: const TextStyle(fontSize: 13.0),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFilterTabs(Map<String, int> orderCounts) {
    return Container(
      height: 50.0,
      color: Colors.white,
      child: ListView.builder(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: 12.0),
        itemCount: _filterTabs.length,
        itemBuilder: (context, index) {
          final isSelected = _selectedFilterIndex == index;
          final filterName = _filterTabs[index];
          final count = orderCounts[filterName] ?? 0;

          return GestureDetector(
            onTap: () {
              setState(() {
                _selectedFilterIndex = index;
              });
              _applyFilters();
            },
            child: Container(
              margin: const EdgeInsets.only(right: 8.0, top: 8.0, bottom: 8.0),
              padding: const EdgeInsets.symmetric(horizontal: 20.0),
              decoration: BoxDecoration(
                color: isSelected ? const Color(0xFF00D0D8) : Colors.transparent,
                borderRadius: BorderRadius.circular(17.0),
                border: isSelected
                    ? null
                    : Border.all(color: Colors.grey[300]!, width: 1.0),
              ),
              alignment: Alignment.center,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    filterName,
                    style: TextStyle(
                      fontSize: 13.0,
                      color: isSelected ? Colors.white : Colors.black54,
                      fontWeight: isSelected ? FontWeight.w500 : FontWeight.normal,
                    ),
                  ),
                  if (count > 0) ...[
                    const SizedBox(width: 4.0),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                      decoration: BoxDecoration(
                        color: isSelected ? Colors.white : const Color(0xFFFF6B35),
                        borderRadius: BorderRadius.circular(10.0),
                      ),
                      child: Text(
                        count.toString(),
                        style: TextStyle(
                          fontSize: 11.0,
                          color: isSelected ? const Color(0xFF00D0D8) : Colors.white,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildOrderList() {
    return ListView.builder(
      padding: const EdgeInsets.symmetric(vertical: 8.0),
      itemCount: _filteredOrders.length,
      itemBuilder: (context, index) {
        return _buildOrderCard(_filteredOrders[index]);
      },
    );
  }

  /// 统一的订单导航方法
  /// 根据订单类型路由到相应的详情页面
  void _navigateToOrderDetail(OrderModel order) {
    // 根据订单类型路由到不同的专用详情页面
    switch (order.type) {
      case OrderType.flight:
        // 机票订单 -> FlightOrderDetailPage
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => FlightOrderDetailPage(order: order),
          ),
        );
        break;

      case OrderType.hotel:
        // 酒店订单 -> OrderDetailPage
        final travelerProvider = context.read<TravelerProviderAppTravel>();
        final defaultTraveler = travelerProvider.defaultTraveler;
        final orderDetail = OrderConverter.toOrderDetail(
          order,
          defaultTraveler: defaultTraveler,
        );
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => OrderDetailPage(orderDetail: orderDetail),
          ),
        );
        break;

      case OrderType.train:
      case OrderType.scenic:
      case OrderType.tour:
        // 其他订单类型暂时使用酒店详情页或显示待开发提示
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('${order.typeDisplayName}详情页面开发中...'),
            duration: const Duration(seconds: 2),
          ),
        );
        break;
    }
  }

  Widget _buildOrderCard(OrderModel order) {
    final isCompleted = order.status == OrderStatus.completed;
    final isPending = order.status == OrderStatus.confirmed ||
                      order.status == OrderStatus.traveling;
    final extraInfo = order.extraInfo ?? {};
    final cancellationPolicy = extraInfo['cancellationPolicy'] ?? '';
    final isNonRefundable = cancellationPolicy.contains('不可取消') ||
                            cancellationPolicy.contains('不可退');

    // Colors based on status
    final textColor = isCompleted ? Colors.black45 : Colors.black87;
    final subtextColor = isCompleted ? Colors.black26 : Colors.black54;

    return GestureDetector(
      onTap: () => _navigateToOrderDetail(order),
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 6.0),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12.0),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.04),
              blurRadius: 8.0,
              offset: const Offset(0, 2.0),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header with icon and status
            Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        order.typeIcon,
                        size: 20.0,
                        color: isCompleted ? Colors.grey : const Color(0xFF00D0D8),
                      ),
                      const SizedBox(width: 6.0),
                      Text(
                        order.typeDisplayName,
                        style: TextStyle(
                          fontSize: 13.0,
                          fontWeight: FontWeight.w500,
                          color: textColor,
                        ),
                      ),
                      const Spacer(),
                      Text(
                        order.statusDisplayName,
                        style: TextStyle(
                          fontSize: 13.0,
                          color: isCompleted ? Colors.grey : textColor,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                      if (order.status != OrderStatus.completed)
                        const Icon(Icons.delete_outline, size: 18, color: Colors.black26),
                    ],
                  ),
                  const SizedBox(height: 4.0),
                  Text(
                    '订单号: ${order.id}',
                    style: TextStyle(
                      fontSize: 11.0,
                      color: subtextColor,
                    ),
                  ),
                ],
              ),
            ),

            // Non-refundable badge (only for non-completed orders)
            if (isNonRefundable && !isCompleted) ...[
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12.0),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 3.0),
                      decoration: BoxDecoration(
                        color: Colors.grey[100],
                        borderRadius: BorderRadius.circular(4.0),
                        border: Border.all(color: Colors.grey[300]!, width: 0.5),
                      ),
                      child: Text(
                        '不可改签',
                        style: TextStyle(
                          fontSize: 11.0,
                          color: Colors.grey[600],
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 8.0),
            ],

            // Main content
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12.0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Route with large text
                        _buildOrderTitle(order, isCompleted),
                        const SizedBox(height: 6.0),
                        // Date and flight info
                        Text(
                          '${order.date} | ${order.subtitle}',
                          style: TextStyle(
                            fontSize: 12.0,
                            color: subtextColor,
                          ),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  // Price on the right
                  Text(
                    order.price,
                    style: TextStyle(
                      fontSize: 20.0,
                      fontWeight: FontWeight.bold,
                      color: isCompleted ? Colors.grey : const Color(0xFFFF6B35),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 12.0),

            // Service tags with blue dots
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12.0),
              child: Wrap(
                spacing: 16.0,
                runSpacing: 8.0,
                children: [
                  _buildServiceTag('客服', Icons.support_agent),
                  if (order.type == OrderType.flight) ...[
                    _buildServiceTag('订单自助服务'),
                    _buildServiceTag('查询订单记录'),
                    _buildServiceTag('飞机餐点回显'),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 12.0),

            // Order detail button
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 12.0),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () => _navigateToOrderDetail(order),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: const Color(0xFF00D0D8),
                    side: const BorderSide(color: Color(0xFF00D0D8), width: 1.0),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8.0),
                    ),
                    padding: const EdgeInsets.symmetric(vertical: 10.0),
                  ),
                  child: const Text(
                    '订单详情',
                    style: TextStyle(
                      fontSize: 14.0,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
            ),

            const SizedBox(height: 12.0),
          ],
        ),
      ),
    );
  }

  Widget _buildOrderTitle(OrderModel order, bool isCompleted) {
    final textColor = isCompleted ? Colors.black38 : Colors.black87;

    // 检查是否是有转机的航班订单
    if (!order.hasTransfer) {
      // 普通订单，直接显示标题
      return Text(
        order.title,
        style: TextStyle(
          fontSize: 15.0,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      );
    }

    // 航班转机订单，显示带转机图标的标题
    // 解析标题，提取出发地和目的地
    final parts = order.title.split('→');
    if (parts.length < 2) {
      return Text(
        order.title,
        style: TextStyle(
          fontSize: 15.0,
          fontWeight: FontWeight.w600,
          color: textColor,
        ),
        maxLines: 2,
        overflow: TextOverflow.ellipsis,
      );
    }

    final departure = parts[0].trim();
    final arrival = parts[parts.length - 1].trim().replaceAll(RegExp(r'\(.*?\)'), '').trim();

    return Row(
      children: [
        // 出发地
        Flexible(
          child: Text(
            departure,
            style: TextStyle(
              fontSize: 15.0,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
        const SizedBox(width: 6.0),

        // 中线和转机图标
        SizedBox(
          width: 40.0,
          height: 18.0,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // 中线
              Positioned(
                left: 0,
                right: 0,
                child: Container(
                  height: 1.0,
                  color: isCompleted ? Colors.grey[300] : Colors.grey[400],
                ),
              ),
              // 转机图标
              Center(
                child: Container(
                  padding: const EdgeInsets.all(2.0),
                  decoration: const BoxDecoration(
                    color: Colors.white,
                  ),
                  child: Image.asset(
                    AssetsImagesAppTravel.travelIconTransfer,
                    width: 16.0,
                    height: 16.0,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        width: 16.0,
                        height: 16.0,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: isCompleted ? Colors.grey[300]! : Colors.grey,
                            width: 1.0,
                          ),
                        ),
                        child: Center(
                          child: Text(
                            '转',
                            style: TextStyle(
                              fontSize: 10.0,
                              color: isCompleted ? Colors.grey[300] : Colors.grey,
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),
            ],
          ),
        ),

        const SizedBox(width: 6.0),

        // 目的地
        Flexible(
          child: Text(
            arrival,
            style: TextStyle(
              fontSize: 15.0,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ),
      ],
    );
  }

  Widget _buildServiceTag(String label, [IconData? icon]) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        if (icon != null) ...[
          Icon(icon, size: 14.0, color: Colors.black54),
          const SizedBox(width: 4.0),
        ] else
          Container(
            width: 6.0,
            height: 6.0,
            decoration: const BoxDecoration(
              color: Color(0xFF00D0D8),
              shape: BoxShape.circle,
            ),
          ),
        if (icon == null) const SizedBox(width: 6.0),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12.0,
            color: Colors.black54,
          ),
        ),
      ],
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
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
            '暂无订单',
            style: TextStyle(
              fontSize: 15.0,
              color: Colors.black38,
            ),
          ),
        ],
      ),
    );
  }

  /// 获取未来N天后的日期字符串
  String _getFutureDate(int daysToAdd) {
    final futureDate = DateTime.now().add(Duration(days: daysToAdd));
    return '${futureDate.month}月${futureDate.day}日';
  }
}
