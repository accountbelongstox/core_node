import 'package:flutter/material.dart';
import '../models_app_travel/order_model.dart';

/// 酒店详情页面
class HotelDetailPage extends StatefulWidget {
  final String hotelName;
  final String orderId;

  const HotelDetailPage({
    super.key,
    required this.hotelName,
    required this.orderId,
  });

  @override
  State<HotelDetailPage> createState() => _HotelDetailPageState();
}

class _HotelDetailPageState extends State<HotelDetailPage> {
  int _selectedTabIndex = 0;
  final List<String> _tabs = ['房型', '点评', '亮点', '设施', '周边', '政策'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: const Color(0xFF00D0D8),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.chevron_left, color: Colors.white, size: 32),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.hotelName,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 17,
            fontWeight: FontWeight.w500,
          ),
        ),
        centerTitle: false,
      ),
      body: Column(
        children: [
          // 顶部大标题区
          Container(
            color: Colors.white,
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // 房型标签
                const Text(
                  '房型',
                  style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF999999),
                  ),
                ),
                const SizedBox(height: 8),
                // 酒店名称
                Text(
                  widget.hotelName,
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 4),
                // 英文名
                const Text(
                  'Serenti Hotel Saipan',
                  style: TextStyle(
                    fontSize: 14,
                    color: Color(0xFF666666),
                  ),
                ),
                const SizedBox(height: 12),
                // 操作按钮行
                Row(
                  children: [
                    _buildActionButton(Icons.favorite_border, '收藏'),
                    const SizedBox(width: 20),
                    _buildActionButton(Icons.share_outlined, '分享'),
                    const SizedBox(width: 20),
                    _buildActionButton(Icons.shopping_cart_outlined, '购物车'),
                    const SizedBox(width: 20),
                    _buildActionButton(Icons.more_horiz, '更多'),
                  ],
                ),
                const SizedBox(height: 16),
                // 问酒店、价格、查看房型按钮行
                Row(
                  children: [
                    // 问酒店按钮
                    GestureDetector(
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('问酒店')),
                        );
                      },
                      child: Row(
                        children: const [
                          Icon(
                            Icons.chat_bubble_outline,
                            size: 16,
                            color: Color(0xFF00D0D8),
                          ),
                          SizedBox(width: 4),
                          Text(
                            '问酒店',
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFF00D0D8),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const Spacer(),
                    // 价格
                    RichText(
                      text: const TextSpan(
                        children: [
                          TextSpan(
                            text: '¥',
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFFFF6B35),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          TextSpan(
                            text: '731',
                            style: TextStyle(
                              fontSize: 24,
                              color: Color(0xFFFF6B35),
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          TextSpan(
                            text: '起',
                            style: TextStyle(
                              fontSize: 14,
                              color: Color(0xFFFF6B35),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    // 查看房型按钮
                    ElevatedButton(
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('查看房型')),
                        );
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00D0D8),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 10,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(6),
                        ),
                        elevation: 0,
                      ),
                      child: const Text(
                        '查看房型',
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Tab栏
          Container(
            color: Colors.white,
            child: Row(
              children: _tabs.asMap().entries.map((entry) {
                final index = entry.key;
                final tab = entry.value;
                final isSelected = _selectedTabIndex == index;
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      setState(() {
                        _selectedTabIndex = index;
                      });
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      decoration: BoxDecoration(
                        border: Border(
                          bottom: BorderSide(
                            color: isSelected
                                ? const Color(0xFF00D0D8)
                                : Colors.transparent,
                            width: 2,
                          ),
                        ),
                      ),
                      child: Text(
                        tab,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 14,
                          color: isSelected
                              ? const Color(0xFF00D0D8)
                              : const Color(0xFF666666),
                          fontWeight:
                              isSelected ? FontWeight.w500 : FontWeight.normal,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          // 内容区域
          Expanded(
            child: SingleChildScrollView(
              child: Container(
                color: Colors.white,
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // 文章内容
                    _buildArticleSection(
                      '塞伦提酒店地处塞班岛中心，距离泻湖水疗中心和麦克海滩不到5分钟步行路程。此酒店距离DFS精品购物中心 0.3英里(0.5 公里)，距离马里亚纳帕萨奥 0.3 英里(0.5 公里)。',
                      'assets/apps/app_travel/images/article1.png',
                    ),

                    _buildArticleSection(
                      '您可利用免费 WiFi和旅游/票务服务等便利服务和设施。',
                      'assets/apps/app_travel/images/article2.png',
                    ),

                    _buildArticleSection(
                      '酒店设有咖啡馆，您可以在这里享用美味餐点。每天07:00 至 12:00 提供收费的欧陆式早餐。',
                      'assets/apps/app_travel/images/article3.png',
                    ),

                    _buildArticleSection(
                      '特色服务/设施包括干洗/洗衣服务、多语言服务和行李寄存。酒店提供免费自助停车。',
                      'assets/apps/app_travel/images/article4.png',
                    ),

                    // 最后一段文字（无图片）
                    const SizedBox(height: 12),
                    const Text(
                      '有 47 间客房提供冰箱和LED 电视;您定能在旅途中找到家的舒适。提供免费无线网络，方便您与朋友保持联系;有线频道可满足您的娱乐需求。配备淋浴设施的私人浴室提供免费洗浴用品和吹风机。便利设施包括保险箱和书桌;而且每天提供客房服务。',
                      style: TextStyle(
                        fontSize: 14,
                        height: 1.8,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// 构建操作按钮（图标+文字）
  Widget _buildActionButton(IconData icon, String label) {
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
            size: 22,
            color: Colors.black87,
          ),
          const SizedBox(height: 4),
          Text(
            label,
            style: const TextStyle(
              fontSize: 11,
              color: Colors.black87,
            ),
          ),
        ],
      ),
    );
  }

  /// 构建文章段落（文字+图片）
  Widget _buildArticleSection(String text, String imagePath) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 文字段落
        Text(
          text,
          style: const TextStyle(
            fontSize: 14,
            height: 1.8,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 12),
        // 图片（100%宽度，等比例）
        ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.asset(
            imagePath,
            width: double.infinity,
            fit: BoxFit.fitWidth,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                width: double.infinity,
                height: 200,
                decoration: BoxDecoration(
                  color: const Color(0xFFF0F0F0),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(
                        Icons.image_not_supported,
                        size: 48,
                        color: Color(0xFFCCCCCC),
                      ),
                      SizedBox(height: 8),
                      Text(
                        '图片加载失败',
                        style: TextStyle(
                          color: Color(0xFF999999),
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
