import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';
import '../../../resources_app_travel/assets_images_app_travel.dart';
import '../../settings/views/settings_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({Key? key}) : super(key: key);

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final List<Map<String, dynamic>> _statsData = [
    {'icon': Icons.local_activity, 'label': '优惠券', 'value': 10, 'hasBadge': true},
    {'icon': Icons.star_border, 'label': '收藏浏览', 'value': 0, 'hasBadge': false},
    {'icon': Icons.account_balance_wallet, 'label': '积分', 'value': 0, 'hasBadge': false},
  ];

  final List<Map<String, dynamic>> _orderActions = [
    {'icon': Icons.credit_card, 'label': '待付款'},
    {'icon': Icons.luggage, 'label': '待出行'},
    {'icon': Icons.rate_review, 'label': '待点评'},
    {'icon': Icons.assignment_return, 'label': '退款/售后'},
    {'icon': Icons.receipt_long, 'label': '我的订单', 'isHighlight': true},
  ];

  final List<Map<String, dynamic>> _financialServices = [
    {'amount': '30万', 'title': '信用贷', 'subtitle': '最高可借'},
    {'amount': '10万', 'title': '拿去花', 'subtitle': '最高额度'},
    {'amount': '50万', 'title': '生意人贷', 'subtitle': '最高可借'},
    {'amount': '20万', 'title': '银行专区', 'subtitle': '最高可借'},
  ];

  final List<Map<String, dynamic>> _functionGrid = [
    {'icon': Icons.info_outline, 'label': '常用信息'},
    {'icon': Icons.receipt, 'label': '我的发票'},
    {'icon': Icons.card_giftcard, 'label': '权益卡'},
    {'icon': Icons.rate_review, 'label': '我的点评'},
    {'icon': Icons.edit_note, 'label': '我的笔记'},
    {'icon': Icons.camera_alt, 'label': '创作中心'},
    {'icon': Icons.group, 'label': '我的社区'},
    {'icon': Icons.map, 'label': '旅行足迹'},
    {'icon': Icons.feedback, 'label': '我要吐槽'},
    {'icon': Icons.credit_score, 'label': '我的信用'},
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildHeader(),
            _buildMemberCard(),
            _buildStats(),
            _buildOrderActions(),
            _build12306Prompt(),
            _buildFinancialServices(),
            _buildFunctionGrid(),
            _buildRecommendation(),
            const SizedBox(height: 20.0),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final userProvider = context.watch<UserProviderAppTravel>();
    final user = userProvider.user;
    final username = user.username ?? TravelLocalizationKeys.travelGuestUser.tr(context);

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.fromLTRB(16.0, 48.0, 16.0, 16.0),
      child: Row(
        children: [
          Container(
            width: 60.0,
            height: 60.0,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: user.isLoggedIn ? const Color(0xFF00D0D8) : const Color(0xFFE0E0E0),
                width: 2.0,
              ),
            ),
            child: ClipOval(
              child: user.avatarUrl != null && user.avatarUrl!.isNotEmpty
                  ? Image.network(
                      user.avatarUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return _buildDefaultAvatar();
                      },
                    )
                  : Image.asset(
                      AssetsImagesAppTravel.travelUserAvatarDefault,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return _buildDefaultAvatar();
                      },
                    ),
            ),
          ),
          const SizedBox(width: 12.0),
          Text(
            username,
            style: const TextStyle(
              fontSize: 18.0,
              fontWeight: FontWeight.bold,
              color: Colors.black87,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: () {
              debugPrint('Hexagon icon tapped');
            },
            child: Container(
              width: 36.0,
              height: 36.0,
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(6.0),
              ),
              child: const Icon(
                Icons.hexagon_outlined,
                size: 20.0,
                color: Colors.black54,
              ),
            ),
          ),
          const SizedBox(width: 8.0),
          GestureDetector(
            onTap: () {
              debugPrint('QR code scanner tapped');
            },
            child: Container(
              width: 36.0,
              height: 36.0,
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(6.0),
              ),
              child: const Icon(
                Icons.qr_code_scanner,
                size: 20.0,
                color: Colors.black54,
              ),
            ),
          ),
          const SizedBox(width: 8.0),
          GestureDetector(
            onTap: () {
              Navigator.of(context).push(
                MaterialPageRoute(
                  builder: (context) => const SettingsScreen(),
                ),
              );
            },
            child: Container(
              width: 36.0,
              height: 36.0,
              decoration: BoxDecoration(
                color: const Color(0xFFF5F5F5),
                borderRadius: BorderRadius.circular(6.0),
              ),
              child: const Icon(
                Icons.settings_outlined,
                size: 20.0,
                color: Colors.black54,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMemberCard() {
    return Container(
      margin: const EdgeInsets.all(16.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: [Color(0xFF9DD8F2), Color(0xFFB8E3F8)],
        ),
        borderRadius: BorderRadius.circular(12.0),
      ),
      child: Row(
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                '大众会员',
                style: TextStyle(
                  fontSize: 20.0,
                  fontWeight: FontWeight.bold,
                  color: Colors.black87,
                ),
              ),
              const SizedBox(height: 4.0),
              Row(
                children: const [
                  Icon(
                    Icons.diamond,
                    size: 14.0,
                    color: Colors.black54,
                  ),
                  SizedBox(width: 4.0),
                  Text(
                    '积分抵现',
                    style: TextStyle(
                      fontSize: 13.0,
                      color: Colors.black54,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const Spacer(),
          Image.asset(
            AssetsImagesAppTravel.travelVipBadge,
            width: 80.0,
            height: 80.0,
            errorBuilder: (context, error, stackTrace) {
              return Container(
                width: 80.0,
                height: 80.0,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.3),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.verified,
                  size: 40.0,
                  color: Colors.white,
                ),
              );
            },
          ),
        ],
      ),
    );
  }

  Widget _buildStats() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 20.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: _statsData.map((stat) {
          return GestureDetector(
            onTap: () {
              debugPrint('${stat['label']} tapped');
            },
            child: Column(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Row(
                      children: [
                        Icon(
                          stat['icon'],
                          size: 20.0,
                          color: Colors.black54,
                        ),
                        const SizedBox(width: 4.0),
                        Text(
                          stat['label'],
                          style: const TextStyle(
                            fontSize: 14.0,
                            color: Colors.black54,
                          ),
                        ),
                        const SizedBox(width: 4.0),
                        Text(
                          '${stat['value']}',
                          style: const TextStyle(
                            fontSize: 16.0,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                      ],
                    ),
                    if (stat['hasBadge'])
                      Positioned(
                        top: -4.0,
                        right: -4.0,
                        child: Container(
                          width: 8.0,
                          height: 8.0,
                          decoration: const BoxDecoration(
                            color: Color(0xFFFF6B35),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                  ],
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildOrderActions() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 20.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: _orderActions.map((action) {
          final isHighlight = action['isHighlight'] ?? false;
          return GestureDetector(
            onTap: () {
              debugPrint('${action['label']} tapped');
            },
            child: Column(
              children: [
                Icon(
                  action['icon'],
                  size: 28.0,
                  color: isHighlight ? const Color(0xFF00D0D8) : Colors.black54,
                ),
                const SizedBox(height: 6.0),
                Text(
                  action['label'],
                  style: TextStyle(
                    fontSize: 12.0,
                    color: isHighlight ? const Color(0xFF00D0D8) : Colors.black54,
                  ),
                ),
              ],
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _build12306Prompt() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      padding: const EdgeInsets.all(12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.train,
            size: 20.0,
            color: Color(0xFF00D0D8),
          ),
          const SizedBox(width: 8.0),
          const Expanded(
            child: Text(
              '登录12306账号可享极速出票、优先退改',
              style: TextStyle(
                fontSize: 13.0,
                color: Colors.black87,
              ),
            ),
          ),
          GestureDetector(
            onTap: () {
              debugPrint('12306 prompt tapped');
            },
            child: Row(
              children: const [
                Text(
                  '去查看',
                  style: TextStyle(
                    fontSize: 13.0,
                    color: Color(0xFF00D0D8),
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  size: 18.0,
                  color: Color(0xFF00D0D8),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFinancialServices() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              ..._financialServices.map((service) {
                return Expanded(
                  child: GestureDetector(
                    onTap: () {
                      debugPrint('${service['title']} tapped');
                    },
                    child: Column(
                      children: [
                        Text(
                          service['amount'],
                          style: const TextStyle(
                            fontSize: 18.0,
                            fontWeight: FontWeight.bold,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 4.0),
                        Text(
                          service['title'],
                          style: const TextStyle(
                            fontSize: 13.0,
                            color: Colors.black87,
                          ),
                        ),
                        const SizedBox(height: 2.0),
                        Text(
                          service['subtitle'],
                          style: const TextStyle(
                            fontSize: 11.0,
                            color: Colors.black45,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
              Container(
                width: 60.0,
                child: Column(
                  children: [
                    Container(
                      width: 40.0,
                      height: 40.0,
                      decoration: BoxDecoration(
                        color: const Color(0xFFE3F2FD),
                        borderRadius: BorderRadius.circular(8.0),
                      ),
                      child: const Icon(
                        Icons.account_balance_wallet,
                        size: 24.0,
                        color: Color(0xFF00D0D8),
                      ),
                    ),
                    const SizedBox(height: 4.0),
                    const Text(
                      '我的钱包',
                      style: TextStyle(
                        fontSize: 11.0,
                        color: Colors.black54,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12.0),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 6.0),
            decoration: BoxDecoration(
              color: const Color(0xFFFF9A56),
              borderRadius: BorderRadius.circular(15.0),
            ),
            child: const Text(
              '去查看',
              style: TextStyle(
                fontSize: 13.0,
                color: Colors.white,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFunctionGrid() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      padding: const EdgeInsets.all(16.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: GridView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 5,
          crossAxisSpacing: 8.0,
          mainAxisSpacing: 20.0,
          childAspectRatio: 0.9,
        ),
        itemCount: _functionGrid.length,
        itemBuilder: (context, index) {
          final function = _functionGrid[index];
          return GestureDetector(
            onTap: () {
              debugPrint('${function['label']} tapped');
            },
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  function['icon'],
                  size: 28.0,
                  color: Colors.black54,
                ),
                const SizedBox(height: 6.0),
                Text(
                  function['label'],
                  style: const TextStyle(
                    fontSize: 11.0,
                    color: Colors.black54,
                  ),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildRecommendation() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8.0),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: const [
                Icon(
                  Icons.circle,
                  size: 8.0,
                  color: Color(0xFF00D0D8),
                ),
                SizedBox(width: 8.0),
                Text(
                  '精彩推荐 一玩到底',
                  style: TextStyle(
                    fontSize: 16.0,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                SizedBox(width: 8.0),
                Icon(
                  Icons.circle,
                  size: 8.0,
                  color: Color(0xFF00D0D8),
                ),
              ],
            ),
          ),
          ClipRRect(
            borderRadius: const BorderRadius.only(
              bottomLeft: Radius.circular(8.0),
              bottomRight: Radius.circular(8.0),
            ),
            child: Image.asset(
              'assets/apps/app_travel/images/profile_recommendation_banner.png',
              width: double.infinity,
              height: 200.0,
              fit: BoxFit.cover,
              errorBuilder: (context, error, stackTrace) {
                return Container(
                  width: double.infinity,
                  height: 200.0,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF9C27B0), Color(0xFFE040FB)],
                    ),
                  ),
                  child: const Center(
                    child: Text(
                      '精彩推荐',
                      style: TextStyle(
                        fontSize: 24.0,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDefaultAvatar() {
    return Container(
      color: const Color(0xFFE3F2FD),
      child: const Icon(
        Icons.person,
        size: 36.0,
        color: Color(0xFF00D0D8),
      ),
    );
  }
}
