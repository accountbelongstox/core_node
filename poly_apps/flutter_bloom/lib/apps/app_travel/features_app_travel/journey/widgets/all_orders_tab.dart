import 'package:flutter/material.dart';
import '../../../models_app_travel/order_model.dart';
import '../../../testdata/orders_data.dart';

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

  Widget _buildOrderCard(OrderModel order) {
    return Container(
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
          // Order header
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              children: [
                Icon(
                  order.typeIcon,
                  size: 18.0,
                  color: const Color(0xFF00D0D8),
                ),
                const SizedBox(width: 6.0),
                Text(
                  order.typeDisplayName,
                  style: const TextStyle(
                    fontSize: 13.0,
                    fontWeight: FontWeight.w500,
                    color: Colors.black87,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                  decoration: BoxDecoration(
                    color: order.displayStatusColor.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(4.0),
                  ),
                  child: Text(
                    order.statusDisplayName,
                    style: TextStyle(
                      fontSize: 12.0,
                      color: order.displayStatusColor,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const Divider(height: 1.0, thickness: 1.0),

          // Order content
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Order image
                ClipRRect(
                  borderRadius: BorderRadius.circular(8.0),
                  child: Image.asset(
                    order.imageUrl,
                    width: 100.0,
                    height: 80.0,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        width: 100.0,
                        height: 80.0,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F0F0),
                          borderRadius: BorderRadius.circular(8.0),
                        ),
                        child: Icon(
                          order.typeIcon,
                          size: 40.0,
                          color: Colors.grey[400],
                        ),
                      );
                    },
                  ),
                ),
                const SizedBox(width: 12.0),

                // Order details
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        order.title,
                        style: const TextStyle(
                          fontSize: 15.0,
                          fontWeight: FontWeight.w600,
                          color: Colors.black87,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6.0),
                      Text(
                        order.subtitle,
                        style: const TextStyle(
                          fontSize: 13.0,
                          color: Colors.black54,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 6.0),
                      Row(
                        children: [
                          const Icon(
                            Icons.access_time,
                            size: 14.0,
                            color: Colors.black45,
                          ),
                          const SizedBox(width: 4.0),
                          Expanded(
                            child: Text(
                              order.date,
                              style: const TextStyle(
                                fontSize: 12.0,
                                color: Colors.black45,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Price and quantity
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12.0),
            child: Row(
              children: [
                Text(
                  '订单编号: ${order.id}',
                  style: const TextStyle(
                    fontSize: 12.0,
                    color: Colors.black38,
                  ),
                ),
                const Spacer(),
                if (order.quantity > 1) ...[
                  Text(
                    'x${order.quantity}  ',
                    style: const TextStyle(
                      fontSize: 13.0,
                      color: Colors.black54,
                    ),
                  ),
                ],
                Text(
                  order.price,
                  style: const TextStyle(
                    fontSize: 17.0,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFF6B35),
                  ),
                ),
              ],
            ),
          ),

          // Order actions
          if (order.actions.isNotEmpty) ...[
            const Divider(height: 20.0, thickness: 1.0),
            Padding(
              padding: const EdgeInsets.fromLTRB(12.0, 0, 12.0, 12.0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: order.actions.map((action) {
                  return Container(
                    margin: const EdgeInsets.only(left: 8.0),
                    child: action.isPrimary
                        ? ElevatedButton(
                            onPressed: action.onTap,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: action.color ?? const Color(0xFF00D0D8),
                              foregroundColor: Colors.white,
                              elevation: 0,
                              padding: const EdgeInsets.symmetric(
                                horizontal: 20.0,
                                vertical: 10.0,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20.0),
                              ),
                            ),
                            child: Text(
                              action.label,
                              style: const TextStyle(fontSize: 13.0),
                            ),
                          )
                        : OutlinedButton(
                            onPressed: action.onTap,
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.black54,
                              side: const BorderSide(color: Colors.black26),
                              padding: const EdgeInsets.symmetric(
                                horizontal: 16.0,
                                vertical: 10.0,
                              ),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(20.0),
                              ),
                            ),
                            child: Text(
                              action.label,
                              style: const TextStyle(fontSize: 13.0),
                            ),
                          ),
                  );
                }).toList(),
              ),
            ),
          ] else
            const SizedBox(height: 12.0),
        ],
      ),
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
}
