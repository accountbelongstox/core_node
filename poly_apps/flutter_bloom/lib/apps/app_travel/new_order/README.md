# 订单详情页面 (Order Detail Page)

这是一个完整的订单详情页面实现，基于旅游App的酒店订单详情UI设计。

## 文件结构

```
new_order/
├── models/
│   └── order_detail_model.dart        # 订单详情数据模型
├── data/
│   └── order_detail_test_data.dart    # 测试数据
├── widgets/
│   ├── order_detail_app_bar.dart      # 顶部导航栏
│   ├── order_status_card.dart         # 订单状态卡片
│   ├── payment_info_card.dart         # 支付信息卡片
│   ├── hotel_recommendation_list.dart # 酒店推荐横向列表
│   ├── hotel_main_info_card.dart      # 酒店主信息卡片
│   ├── checkin_info_card.dart         # 入住信息卡片
│   ├── guest_info_card.dart           # 住客信息卡片
│   ├── services_card.dart             # 服务信息卡片
│   ├── faq_buttons_grid.dart          # 常见问题按钮网格
│   └── bottom_action_button.dart      # 底部操作按钮
├── order_detail_page.dart             # 主页面
└── README.md                          # 说明文档
```

## 功能特性

### 1. 页面组件

- **导航栏**: 显示订单号，包含返回、客服、分享按钮
- **订单状态**: 显示当前订单状态（已取消/待支付/已确认等）
- **支付信息**: 显示价格、夜数、含税费信息
- **酒店推荐**: 横向滚动的推荐酒店列表
- **酒店信息**: 酒店名称、地址、图片
- **入住信息**: 入住日期、房型、床型、早餐信息
- **住客信息**: 住客姓名、联系电话、邮箱（可复制）
- **服务信息**: 发票服务、接送服务
- **常见问题**: 常见问题快捷按钮
- **底部按钮**: 根据订单状态显示不同的操作按钮

### 2. 数据模型

- `OrderDetailModel`: 完整的订单详情数据
- `HotelInfo`: 酒店基本信息
- `CheckInInfo`: 入住信息
- `RoomInfo`: 房型信息
- `PaymentInfo`: 支付信息
- `ServiceInfo`: 服务信息
- `HotelRecommendation`: 推荐酒店信息

### 3. UI规范

- 主色调: #007AFF (蓝色)
- 强调色: #FF8800 (橙色)
- 主文字: #000000/#333333
- 辅助文字: #999999
- 背景色: #F5F5F5
- 卡片背景: #FFFFFF

## 使用方法

### 基本用法

```dart
import 'package:flutter/material.dart';
import 'new_order/order_detail_page.dart';
import 'new_order/data/order_detail_test_data.dart';

// 使用测试数据
Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => OrderDetailPage(
      orderDetail: OrderDetailTestData.getSaipanHotelOrder(),
    ),
  ),
);
```

### 从订单列表导航

```dart
import 'package:flutter/material.dart';
import 'new_order/order_detail_page.dart';
import 'new_order/models/order_detail_model.dart';

// 从现有订单模型转换
void navigateToOrderDetail(BuildContext context, OrderModel order) {
  // 构造 OrderDetailModel
  final orderDetail = OrderDetailModel(
    orderId: order.id,
    status: _convertStatus(order.status),
    hotel: HotelInfo(
      nameCn: order.title,
      nameEn: order.extraInfo?['hotelName'] ?? '',
      imageUrl: order.imageUrl,
      address: order.extraInfo?['address'] ?? '',
    ),
    // ... 其他字段
  );

  Navigator.push(
    context,
    MaterialPageRoute(
      builder: (context) => OrderDetailPage(
        orderDetail: orderDetail,
      ),
    ),
  );
}

OrderDetailStatus _convertStatus(OrderStatus status) {
  switch (status) {
    case OrderStatus.pending:
      return OrderDetailStatus.pending;
    case OrderStatus.confirmed:
      return OrderDetailStatus.confirmed;
    case OrderStatus.cancelled:
      return OrderDetailStatus.cancelled;
    // ... 其他状态转换
    default:
      return OrderDetailStatus.confirmed;
  }
}
```

### 自定义数据

```dart
final customOrderDetail = OrderDetailModel(
  orderId: '1234567890',
  status: OrderDetailStatus.confirmed,
  hotel: HotelInfo(
    nameCn: '自定义酒店',
    nameEn: 'Custom Hotel',
    imageUrl: 'assets/images/hotel.png',
    address: '酒店地址',
  ),
  checkIn: CheckInInfo(
    checkInDate: DateTime(2025, 12, 1),
    checkOutDate: DateTime(2025, 12, 5),
    checkInTime: '15:00后',
    checkOutTime: '12:00前',
    nights: 4,
  ),
  room: RoomInfo(
    roomType: '豪华双人房',
    bedConfig: '1张大床',
    hasBreakfast: true,
  ),
  guestNames: ['张三', '李四'],
  phone: '138****5678',
  email: 'test@example.com',
  payment: PaymentInfo(
    totalAmount: 1200.00,
    pricePerNight: 300.00,
    includeTax: true,
  ),
  services: ServiceInfo(
    canIssueInvoice: true,
  ),
  recommendations: [],
  faqOptions: ['如何取消订单', '如何修改订单'],
);

Navigator.push(
  context,
  MaterialPageRoute(
    builder: (context) => OrderDetailPage(
      orderDetail: customOrderDetail,
    ),
  ),
);
```

## 图片资源

确保以下图片资源已添加到 `assets/apps/app_travel/images/` 目录：

- `order_hotel_saipan.png` - 塞班酒店主图
- `hotel_recommend_1.png` - 推荐酒店1（绿洲精品屋）
- `hotel_recommend_2.png` - 推荐酒店2（塞班皇冠假日）
- `hotel_recommend_3.png` - 推荐酒店3（G.T.旅馆）

## 依赖

确保在 `pubspec.yaml` 中添加以下依赖：

```yaml
dependencies:
  flutter:
    sdk: flutter
  intl: ^0.18.0  # 用于日期格式化
```

## 注意事项

1. 日期格式化需要 `intl` 包支持
2. 所有图片路径需要在 `pubspec.yaml` 中正确配置
3. 住客信息中的电话和邮箱已做脱敏处理
4. 复制功能需要用户授予剪贴板权限

## 扩展功能

### 添加自定义事件处理

```dart
OrderDetailPage(
  orderDetail: orderDetail,
  // 可以在组件内部添加自定义回调
)
```

### 修改样式

可以直接修改各个组件的样式常量，例如：

```dart
// 在 order_status_card.dart 中修改字体大小
const TextStyle(
  fontSize: 28, // 修改为其他值
  fontWeight: FontWeight.bold,
)
```

## 技术栈

- Flutter 3.x
- Material Design 3
- 响应式布局
- 可复用组件设计

## 作者

AI Assistant

## 许可

MIT License
