import 'package:flutter/material.dart';
import '../models/order_detail_model.dart';
import '../hotel_detail_page.dart';

/// 酒店主信息卡片
class HotelMainInfoCard extends StatelessWidget {
  final HotelInfo hotel;
  final String? orderId;
  final VoidCallback? onTapHotel;
  final VoidCallback? onTapMap;

  const HotelMainInfoCard({
    super.key,
    required this.hotel,
    this.orderId,
    this.onTapHotel,
    this.onTapMap,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // 酒店名称
          Text(
            hotel.nameCn,
            style: const TextStyle(
              color: Colors.black,
              fontSize: 17,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 3),
          Row(
            children: [
              Expanded(
                child: Text(
                  hotel.nameEn,
                  style: const TextStyle(
                    color: Color(0xFF666666),
                    fontSize: 14,
                  ),
                ),
              ),
              // 酒店图片缩略图
              if (hotel.imageUrl.isNotEmpty)
                ClipRRect(
                  borderRadius: BorderRadius.circular(4),
                  child: Image.asset(
                    hotel.imageUrl,
                    width: 60,
                    height: 60,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) {
                      return Container(
                        width: 60,
                        height: 60,
                        color: const Color(0xFFF0F0F0),
                        child: const Icon(Icons.hotel, color: Colors.grey),
                      );
                    },
                  ),
                ),
            ],
          ),

          // 酒店地址
          if (hotel.address.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Icon(
                  Icons.location_on,
                  size: 16,
                  color: Color(0xFF00D0D8),
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    hotel.address,
                    style: const TextStyle(
                      color: Color(0xFF666666),
                      fontSize: 13,
                      height: 1.4,
                    ),
                  ),
                ),
                GestureDetector(
                  onTap: onTapMap ?? () {
                    debugPrint('Open map for: ${hotel.address}');
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFF00D0D8)),
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: const Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.map,
                          size: 14,
                          color: Color(0xFF00D0D8),
                        ),
                        SizedBox(width: 4),
                        Text(
                          '地图',
                          style: TextStyle(
                            fontSize: 12,
                            color: Color(0xFF00D0D8),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: 16),
          // 酒店详情按钮（统一样式）
          GestureDetector(
            onTap: onTapHotel ?? () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => HotelDetailPage(
                    hotelName: hotel.nameCn,
                    orderId: orderId ?? '',
                  ),
                ),
              );
            },
            child: const Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  '酒店详情',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF00D0D8),
                    fontWeight: FontWeight.w500,
                  ),
                ),
                SizedBox(width: 4),
                Icon(
                  Icons.chevron_right,
                  size: 18,
                  color: Color(0xFF00D0D8),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          // 服务图标网格
          _buildServiceGrid(context),
        ],
      ),
    );
  }

  /// 构建服务图标网格
  Widget _buildServiceGrid(BuildContext context) {
    final services = [
      {'icon': Icons.hotel, 'label': '向酒店'},
      {'icon': Icons.local_taxi, 'label': '接送机'},
      {'icon': Icons.phone, 'label': '联系酒店'},
      {'icon': Icons.apartment, 'label': '设施服务'},
      {'icon': Icons.assignment, 'label': '入住必读'},
    ];

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: services.map((service) {
          return _buildServiceIcon(
            context,
            icon: service['icon'] as IconData,
            label: service['label'] as String,
          );
        }).toList(),
      ),
    );
  }

  /// 构建单个服务图标
  Widget _buildServiceIcon(
    BuildContext context, {
    required IconData icon,
    required String label,
  }) {
    return GestureDetector(
      onTap: () {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(label)),
        );
      },
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(
            icon,
            size: 28,
            color: const Color(0xFF666666),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF666666),
            ),
          ),
        ],
      ),
    );
  }
}
