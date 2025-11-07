# 订单详情页面集成指南

本文档说明如何将订单详情页面集成到现有的订单系统中。

## 快速开始

### 1. 从订单列表跳转到详情页面

在现有的订单列表页面中，修改订单卡片的点击事件：

```dart
import 'package:flutter/material.dart';
import 'new_order/order_detail_page.dart';
import 'new_order/utils/order_converter.dart';
import 'models_app_travel/order_model.dart';

// 在订单卡片的 onTap 中
void onOrderTap(BuildContext context, OrderModel order) {
  final orderDetail = OrderConverter.toOrderDetail(order);

  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => OrderDetailPage(
        orderDetail: orderDetail,
      ),
    ),
  );
}
```

### 2. 修改现有订单列表页面

找到订单列表的实现文件（例如 `orders_page.dart`），在订单卡片的 GestureDetector 或 InkWell 中添加导航逻辑：

```dart
// 在 OrderCard 或类似组件中
GestureDetector(
  onTap: () => onOrderTap(context, order),
  child: OrderCard(order: order),
)
```

### 3. 使用测试数据直接查看

如果想直接查看订单详情页面的效果：

```dart
import 'package:flutter/material.dart';
import 'new_order/order_detail_page.dart';
import 'new_order/data/order_detail_test_data.dart';

// 在任何地方添加一个按钮
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
  child: const Text('查看订单详情示例'),
)
```

## 详细集成步骤

### 步骤 1: 导入必要的文件

在需要使用订单详情页面的文件中添加导入：

```dart
import 'package:flutter/material.dart';
import 'new_order/order_detail_page.dart';
import 'new_order/models/order_detail_model.dart';
import 'new_order/utils/order_converter.dart';
```

### 步骤 2: 创建导航方法

创建一个辅助方法来处理导航逻辑：

```dart
class OrderNavigator {
  /// 导航到订单详情页面
  static Future<void> navigateToOrderDetail(
    BuildContext context,
    OrderModel order,
  ) async {
    // 转换订单模型
    final orderDetail = OrderConverter.toOrderDetail(order);

    // 导航到详情页面
    await Navigator.push(
      context,
      MaterialPageRoute(
        builder: (context) => OrderDetailPage(
          orderDetail: orderDetail,
        ),
      ),
    );
  }

  /// 如果需要带返回值的导航
  static Future<bool?> navigateToOrderDetailWithResult(
    BuildContext context,
    OrderModel order,
  ) async {
    final orderDetail = OrderConverter.toOrderDetail(order);

    return await Navigator.push<bool>(
      context,
      MaterialPageRoute(
        builder: (context) => OrderDetailPage(
          orderDetail: orderDetail,
        ),
      ),
    );
  }
}
```

### 步骤 3: 修改订单列表页面

假设现有的订单列表页面结构如下：

```dart
// 原始代码
class OrdersPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        return OrderCard(
          order: order,
          onTap: () {
            // 原来可能是空的或者只有简单的操作
            debugPrint('Order tapped: ${order.id}');
          },
        );
      },
    );
  }
}
```

修改后：

```dart
import 'new_order/utils/order_converter.dart';
import 'new_order/order_detail_page.dart';

class OrdersPage extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      itemCount: orders.length,
      itemBuilder: (context, index) {
        final order = orders[index];
        return OrderCard(
          order: order,
          onTap: () {
            // 导航到订单详情页面
            final orderDetail = OrderConverter.toOrderDetail(order);
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => OrderDetailPage(
                  orderDetail: orderDetail,
                ),
              ),
            );
          },
        );
      },
    );
  }
}
```

### 步骤 4: 修改 OrderModel 的 actions

如果订单卡片使用了 OrderModel 中的 actions，可以修改对应的回调：

```dart
// 在创建 OrderModel 时
OrderModel(
  id: '123456',
  // ... 其他字段
  actions: [
    OrderAction(
      label: '查看详情',
      color: const Color(0xFF00D0D8),
      onTap: () {
        final orderDetail = OrderConverter.toOrderDetail(order);
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => OrderDetailPage(
              orderDetail: orderDetail,
            ),
          ),
        );
      },
      isPrimary: true,
    ),
  ],
)
```

## 高级集成

### 1. 添加页面转场动画

```dart
Navigator.push(
  context,
  PageRouteBuilder(
    pageBuilder: (context, animation, secondaryAnimation) => OrderDetailPage(
      orderDetail: orderDetail,
    ),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      const begin = Offset(1.0, 0.0);
      const end = Offset.zero;
      const curve = Curves.easeInOut;

      var tween = Tween(begin: begin, end: end).chain(
        CurveTween(curve: curve),
      );

      return SlideTransition(
        position: animation.drive(tween),
        child: child,
      );
    },
  ),
);
```

### 2. 处理返回结果

如果需要在返回时执行某些操作：

```dart
final result = await Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => OrderDetailPage(
      orderDetail: orderDetail,
    ),
  ),
);

if (result != null && result is bool && result) {
  // 处理返回结果，例如刷新列表
  _refreshOrderList();
}
```

### 3. 添加 Hero 动画

在订单列表的图片上添加 Hero tag：

```dart
// 订单列表中的图片
Hero(
  tag: 'order_image_${order.id}',
  child: Image.asset(order.imageUrl),
)

// 在订单详情页面的酒店信息卡片中也添加相同的 Hero tag
Hero(
  tag: 'order_image_${orderDetail.orderId}',
  child: Image.asset(orderDetail.hotel.imageUrl),
)
```

## 数据同步

### 从后端加载推荐酒店

订单详情中的推荐酒店列表可以从后端API获取：

```dart
class OrderDetailService {
  Future<List<HotelRecommendation>> fetchRecommendations(String orderId) async {
    // 调用API获取推荐酒店
    final response = await http.get(
      Uri.parse('https://api.example.com/orders/$orderId/recommendations'),
    );

    if (response.statusCode == 200) {
      final List<dynamic> data = json.decode(response.body);
      return data.map((json) => HotelRecommendation(
        name: json['name'],
        imageUrl: json['imageUrl'],
        rating: json['rating'].toDouble(),
        ratingText: json['ratingText'],
        price: json['price'].toDouble(),
        totalPrice: json['totalPrice'],
        distanceInMeters: json['distanceInMeters'],
      )).toList();
    }

    return [];
  }
}
```

然后在构建 OrderDetailModel 时使用：

```dart
Future<OrderDetailModel> buildOrderDetail(OrderModel order) async {
  final recommendations = await OrderDetailService().fetchRecommendations(order.id);

  return OrderDetailModel(
    // ... 其他字段
    recommendations: recommendations,
  );
}
```

## 常见问题

### Q1: 日期格式不正确怎么办？

修改 `OrderConverter` 中的 `_parseDateFromString` 方法，根据你的实际日期格式进行解析。

### Q2: 图片显示不出来？

1. 确保图片路径在 `pubspec.yaml` 中正确配置
2. 检查图片文件是否存在于对应路径
3. 使用 `flutter pub get` 重新加载资源

### Q3: 如何自定义样式？

直接修改对应的 widget 文件中的样式常量，或者创建主题配置。

### Q4: 如何添加自定义功能？

在对应的 widget 中添加回调参数，例如：

```dart
class HotelMainInfoCard extends StatelessWidget {
  final VoidCallback? onTapHotel;
  final VoidCallback? onTapMap;
  // ...
}
```

## 测试

### 单元测试

```dart
test('OrderConverter converts OrderModel correctly', () {
  final order = OrderModel(
    id: 'test123',
    type: OrderType.hotel,
    status: OrderStatus.confirmed,
    title: '测试酒店',
    // ...
  );

  final detail = OrderConverter.toOrderDetail(order);

  expect(detail.orderId, equals('test123'));
  expect(detail.status, equals(OrderDetailStatus.confirmed));
});
```

### Widget 测试

```dart
testWidgets('OrderDetailPage displays correctly', (WidgetTester tester) async {
  final orderDetail = OrderDetailTestData.getSaipanHotelOrder();

  await tester.pumpWidget(
    MaterialApp(
      home: OrderDetailPage(orderDetail: orderDetail),
    ),
  );

  expect(find.text(orderDetail.orderId), findsOneWidget);
  expect(find.text(orderDetail.hotel.nameCn), findsOneWidget);
});
```

## 下一步

1. 添加更多的交互功能（分享、收藏等）
2. 实现订单状态的实时更新
3. 添加评论和评分功能
4. 集成支付功能

## 支持

如有问题，请参考 [README.md](README.md) 或联系开发团队。
