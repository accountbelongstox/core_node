import 'package:flutter/material.dart';

class ServiceScreen extends StatelessWidget {
  const ServiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader(),
            _buildServiceOptions(),
            _buildFAQSection(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    const headerHeight = 108.0;
    return Container(
      width: double.infinity,
      height: headerHeight,
      color: Colors.white,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final maxWidth = constraints.maxWidth * 0.8;
          return Stack(
            children: [
              Positioned(
                left: 0,
                top: 0,
                bottom: 0,
                child: SizedBox(
                  width: maxWidth,
                  height: headerHeight,
                  child: Image.asset(
                    'assets/apps/app_travel/images/service_header_bg.png',
                    fit: BoxFit.contain,
                    alignment: Alignment.centerLeft,
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildServiceOptions() {
    return Container(
      margin: const EdgeInsets.only(left: 16.0, right: 16.0, bottom: 16.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(12.0),
          bottomRight: Radius.circular(12.0),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '找客服帮忙',
            style: TextStyle(
              fontSize: 20.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 16.0),
          _buildServiceItem(
            icon: Icons.confirmation_number_outlined,
            iconColor: const Color(0xFF4CAF50),
            backgroundColor: const Color(0xFFE8F5E9),
            title: '门票在线客服',
            subtitle: '智能门票客服，轻松解决您的问题',
          ),
          const SizedBox(height: 12.0),
          _buildServiceItem(
            icon: Icons.hotel_outlined,
            iconColor: const Color(0xFFFF9800),
            backgroundColor: const Color(0xFFFFF3E0),
            title: '酒店在线客服',
            subtitle: '智能酒店门票客服，轻松解决您的问题',
          ),
          const SizedBox(height: 12.0),
          _buildServiceItem(
            icon: Icons.grid_view_rounded,
            iconColor: const Color(0xFFE91E63),
            backgroundColor: const Color(0xFFFCE4EC),
            title: '其他客服',
            subtitle: '点击咨询其他业务问题',
          ),
          const SizedBox(height: 12.0),
          _buildServiceItem(
            icon: Icons.flight_outlined,
            iconColor: const Color(0xFF2196F3),
            backgroundColor: const Color(0xFFE3F2FD),
            title: '机票在线客服',
            subtitle: '智能机票客服，轻松解决您的问题',
          ),
        ],
      ),
    );
  }

  Widget _buildServiceItem({
    required IconData icon,
    required Color iconColor,
    required Color backgroundColor,
    required String title,
    required String subtitle,
  }) {
    return Builder(
      builder: (context) => GestureDetector(
        onTap: () {
          debugPrint('$title tapped');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('打开 $title'),
              duration: const Duration(seconds: 1),
            ),
          );
        },
        child: Container(
          padding: const EdgeInsets.all(12.0),
          decoration: BoxDecoration(
            color: const Color(0xFFFAFAFA),
            borderRadius: BorderRadius.circular(8.0),
          ),
          child: Row(
            children: [
              Container(
                width: 48.0,
                height: 48.0,
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius: BorderRadius.circular(24.0),
                ),
                child: Icon(
                  icon,
                  size: 28.0,
                  color: iconColor,
                ),
              ),
              const SizedBox(width: 12.0),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 16.0,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4.0),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 13.0,
                        color: Colors.black45,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                size: 20.0,
                color: Colors.black26,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFAQSection() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12.0),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 8.0,
            offset: const Offset(0, 2.0),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '大家常问',
            style: TextStyle(
              fontSize: 20.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const SizedBox(height: 20.0),
          _buildFAQCategory(
            category: '关于机票',
            questions: [
              {
                'number': '1',
                'title': '顺利登机，我要了解什么？',
                'subtitle': '一张图告诉你乘机要注意的事儿',
              },
              {
                'number': '2',
                'title': '在线选座，锁定心仪座位',
                'subtitle': '想靠窗，坐一起？在家就能搞定',
              },
              {
                'number': '3',
                'title': '带行李乘机，要知道什么',
                'subtitle': '国内国际航班，哪些物品不让带',
              },
            ],
          ),
          const SizedBox(height: 24.0),
          _buildFAQCategory(
            category: '关于火车票',
            questions: [
              {
                'number': '1',
                'title': '火车票如何进行退改？',
                'subtitle': '火车票退改不用愁',
              },
              {
                'number': '2',
                'title': '我是学生，怎么购买学生票？',
                'subtitle': '学生党购票的贴心攻略',
              },
              {
                'number': '3',
                'title': '折扣火车票怎么买！',
                'subtitle': '随心出发，低价出行的实用手册',
              },
            ],
          ),
          const SizedBox(height: 16.0),
        ],
      ),
    );
  }

  Widget _buildFAQCategory({
    required String category,
    required List<Map<String, String>> questions,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          category,
          style: const TextStyle(
            fontSize: 16.0,
            fontWeight: FontWeight.bold,
            color: Colors.black87,
          ),
        ),
        const SizedBox(height: 12.0),
        ...questions.map((question) => _buildFAQItem(
              number: question['number']!,
              title: question['title']!,
              subtitle: question['subtitle']!,
            )),
      ],
    );
  }

  Widget _buildFAQItem({
    required String number,
    required String title,
    required String subtitle,
  }) {
    return Builder(
      builder: (context) => GestureDetector(
        onTap: () {
          debugPrint('FAQ: $title tapped');
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('查看：$title'),
              duration: const Duration(seconds: 1),
            ),
          );
        },
        child: Container(
          margin: const EdgeInsets.only(bottom: 12.0),
          padding: const EdgeInsets.all(12.0),
          decoration: BoxDecoration(
            color: const Color(0xFFFAFAFA),
            borderRadius: BorderRadius.circular(8.0),
          ),
          child: Row(
            children: [
              Container(
                width: 36.0,
                height: 36.0,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(18.0),
                  border: Border.all(
                    color: Colors.black12,
                    width: 1.0,
                  ),
                ),
                child: Center(
                  child: Text(
                    number,
                    style: const TextStyle(
                      fontSize: 16.0,
                      fontWeight: FontWeight.bold,
                      color: Colors.black54,
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12.0),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 15.0,
                        fontWeight: FontWeight.w600,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4.0),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        fontSize: 13.0,
                        color: Colors.black45,
                      ),
                    ),
                  ],
                ),
              ),
              const Icon(
                Icons.chevron_right,
                size: 20.0,
                color: Colors.black26,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
