import 'package:flutter/material.dart';
import '../order_detail_page.dart';
import '../data/order_detail_test_data.dart';

/// 订单详情演示页面
///
/// 这个文件展示了如何使用订单详情页面
class OrderDetailDemo extends StatelessWidget {
  const OrderDetailDemo({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('订单详情演示'),
      ),
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text(
              '点击按钮查看订单详情',
              style: TextStyle(fontSize: 18),
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => OrderDetailPage(
                      orderDetail: OrderDetailTestData.getSaipanHotelOrder(),
                    ),
                  ),
                );
              },
              child: const Text('查看塞班酒店订单详情'),
            ),
          ],
        ),
      ),
    );
  }
}
