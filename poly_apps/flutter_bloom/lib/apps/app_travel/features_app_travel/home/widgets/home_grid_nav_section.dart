import 'package:flutter/material.dart';
import '../../../models_app_travel/grid_nav_model.dart';
import 'home_grid_nav.dart';

class HomeGridNavSection extends StatefulWidget {
  final List<GridNavModel> gridNavs;

  const HomeGridNavSection({
    super.key,
    required this.gridNavs,
  });

  @override
  State<HomeGridNavSection> createState() => _HomeGridNavSectionState();
}

class _HomeGridNavSectionState extends State<HomeGridNavSection> {
  int _currentPage = 0;
  final PageController _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Widget _buildGrid() {
    return Row(
      children: [
        // 第1列（宽列）- 主要类别
        Expanded(
          flex: 16,
          child: Stack(
            children: [
              Column(
                children: [
                  // 酒店
                  Expanded(
                    child: Container(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: 16.0),
                      decoration: const BoxDecoration(
                        color: Color.fromRGBO(254, 113, 1, 1.0),
                        border: Border(bottom: BorderSide(color: Colors.white, width: 2.0)),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            '酒店',
                            style: TextStyle(fontSize: 16.0, color: Colors.white, fontWeight: FontWeight.bold, height: 1.0),
                          ),
                          SizedBox(height: 4.0),
                          Text(
                            '特价酒店',
                            style: TextStyle(fontSize: 11.0, color: Colors.white, height: 1.0),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // 机票
                  Expanded(
                    child: Container(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: 16.0),
                      decoration: const BoxDecoration(
                        color: Color.fromRGBO(53, 132, 253, 1.0),
                        border: Border(bottom: BorderSide(color: Colors.white, width: 2.0)),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            '机票',
                            style: TextStyle(fontSize: 16.0, color: Colors.white, fontWeight: FontWeight.bold, height: 1.0),
                          ),
                          SizedBox(height: 4.0),
                          Text(
                            '低价机票',
                            style: TextStyle(fontSize: 11.0, color: Colors.white, height: 1.0),
                          ),
                        ],
                      ),
                    ),
                  ),
                  // 旅游
                  Expanded(
                    child: Container(
                      alignment: Alignment.centerLeft,
                      padding: const EdgeInsets.only(left: 16.0),
                      decoration: const BoxDecoration(
                        color: Color.fromRGBO(8, 208, 159, 1.0),
                      ),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          Text(
                            '旅游',
                            style: TextStyle(fontSize: 16.0, color: Colors.white, fontWeight: FontWeight.bold, height: 1.0),
                          ),
                          SizedBox(height: 4.0),
                          Text(
                            '出境/国内游',
                            style: TextStyle(fontSize: 11.0, color: Colors.white, height: 1.0),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              Positioned.fill(
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final cellHeight = constraints.maxHeight / 3;
                    return Stack(
                      children: [
                        Positioned(
                          right: 0,
                          top: 0,
                          bottom: cellHeight * 2,
                          child: Transform.scale(
                            scale: 0.8,
                            alignment: Alignment.bottomRight,
                            child: Image.asset(
                              'assets/apps/app_travel/images/grid-nav-items-hotel@v7.15.png',
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stackTrace) => const SizedBox(),
                            ),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          top: cellHeight,
                          bottom: cellHeight,
                          child: Transform.scale(
                            scale: 0.8,
                            alignment: Alignment.bottomRight,
                            child: Image.asset(
                              'assets/apps/app_travel/images/grid-nav-items-flight@v7.15.png',
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stackTrace) => const SizedBox(),
                            ),
                          ),
                        ),
                        Positioned(
                          right: 0,
                          top: cellHeight * 2,
                          bottom: 0,
                          child: Transform.scale(
                            scale: 0.8,
                            alignment: Alignment.bottomRight,
                            child: Image.asset(
                              'assets/apps/app_travel/images/grid-nav-items-travel@v7.15.png',
                              fit: BoxFit.contain,
                              errorBuilder: (context, error, stackTrace) => const SizedBox(),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 2.0),
        // 第2列
        Expanded(
          flex: 10,
          child: Column(
            children: [
              // 民宿·客栈
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(255, 241, 226, 1.0),
                    border: Border(bottom: BorderSide(color: Colors.white, width: 2.0)),
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.home_outlined, size: 24.0, color: Color.fromRGBO(250, 174, 105, 1.0)),
                            SizedBox(height: 2.0),
                            Text(
                              '民宿·客栈',
                              style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                            ),
                          ],
                        ),
                      ),
                      Positioned(
                        top: 2.0,
                        right: 2.0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFE500),
                            borderRadius: BorderRadius.circular(10.0),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.1),
                                blurRadius: 2.0,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: const Text(
                            '订多居',
                            style: TextStyle(
                              fontSize: 9.0,
                              color: Color(0xFF000000),
                              fontWeight: FontWeight.w600,
                              height: 1.0,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // 火车·高铁
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(220, 248, 255, 1.0),
                    border: Border(bottom: BorderSide(color: Colors.white, width: 2.0)),
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: const [
                            Icon(Icons.train_outlined, size: 24.0, color: Color.fromRGBO(120, 179, 230, 1.0)),
                            SizedBox(height: 2.0),
                            Text(
                              '火车·高铁',
                              style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                            ),
                          ],
                        ),
                      ),
                      Positioned(
                        top: 2.0,
                        right: 2.0,
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6.0, vertical: 2.0),
                          decoration: BoxDecoration(
                            color: const Color(0xFFFFE500),
                            borderRadius: BorderRadius.circular(10.0),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.1),
                                blurRadius: 2.0,
                                offset: const Offset(0, 1),
                              ),
                            ],
                          ),
                          child: const Text(
                            '减3元',
                            style: TextStyle(
                              fontSize: 9.0,
                              color: Color(0xFF000000),
                              fontWeight: FontWeight.w600,
                              height: 1.0,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              // 景点·门票
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(222, 246, 246, 1.0),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.confirmation_number_outlined, size: 24.0, color: Color.fromRGBO(53, 217, 189, 1.0)),
                      SizedBox(height: 2.0),
                      Text(
                        '景点·门票',
                        style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 2.0),
        // 第3列
        Expanded(
          flex: 10,
          child: Column(
            children: [
              // 海外酒店
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(255, 241, 226, 1.0),
                    border: Border(bottom: BorderSide(color: Colors.white, width: 2.0)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.flight_takeoff_outlined, size: 24.0, color: Color.fromRGBO(250, 174, 105, 1.0)),
                      SizedBox(height: 2.0),
                      Text(
                        '海外酒店',
                        style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                      ),
                    ],
                  ),
                ),
              ),
              // 租车自驾
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(220, 248, 255, 1.0),
                    border: Border(bottom: BorderSide(color: Colors.white, width: 2.0)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.directions_car_outlined, size: 24.0, color: Color.fromRGBO(120, 179, 230, 1.0)),
                      SizedBox(height: 2.0),
                      Text(
                        '租车自驾',
                        style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                      ),
                    ],
                  ),
                ),
              ),
              // 跟团游
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(222, 246, 246, 1.0),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.groups_outlined, size: 24.0, color: Color.fromRGBO(53, 217, 189, 1.0)),
                      SizedBox(height: 2.0),
                      Text(
                        '跟团游',
                        style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 2.0),
        // 第4列
        Expanded(
          flex: 10,
          child: Column(
            children: [
              // 特价酒店（闹钟图标）
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(255, 241, 226, 1.0),
                    border: Border(bottom: BorderSide(color: Colors.white, width: 2.0)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.local_offer_outlined, size: 24.0, color: Color.fromRGBO(250, 174, 105, 1.0)),
                      SizedBox(height: 2.0),
                      Text(
                        '特价酒店',
                        style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                      ),
                    ],
                  ),
                ),
              ),
              // 接送机/站
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(220, 248, 255, 1.0),
                    border: Border(bottom: BorderSide(color: Colors.white, width: 2.0)),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.airport_shuttle_outlined, size: 24.0, color: Color.fromRGBO(120, 179, 230, 1.0)),
                      SizedBox(height: 2.0),
                      Text(
                        '接送机/站',
                        style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                      ),
                    ],
                  ),
                ),
              ),
              // 免息/分期
              Expanded(
                child: Container(
                  alignment: Alignment.center,
                  decoration: const BoxDecoration(
                    color: Color.fromRGBO(222, 246, 246, 1.0),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: const [
                      Icon(Icons.credit_card_outlined, size: 24.0, color: Color.fromRGBO(53, 217, 189, 1.0)),
                      SizedBox(height: 2.0),
                      Text(
                        '免息/分期',
                        style: TextStyle(fontSize: 11.0, color: Color(0xFF333333)),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final gridHeight = screenWidth * 0.176 * 3;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12.0),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(8.0),
        child: SizedBox(
          height: gridHeight,
          child: _buildGrid(),
        ),
      ),
    );
  }
}
