// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/widgets/custom_bottom_navigation.dart';
import '../../theme_app_wuy/theme_config_app_wuy.dart';
import '../../../router_app_wuy/router_app_wuy.dart';

class WuyFriendsListScreen extends StatefulWidget {
  const WuyFriendsListScreen({super.key});

  @override
  State<WuyFriendsListScreen> createState() => _WuyFriendsListScreenState();
}

class _WuyFriendsListScreenState extends State<WuyFriendsListScreen> {
  final TextEditingController _searchController = TextEditingController();
  List<FriendItem> _friends = [];
  List<FriendItem> _filteredFriends = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadFriends();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadFriends() async {
    setState(() {
      _isLoading = true;
    });

    // Simulate loading friends data
    await Future.delayed(const Duration(seconds: 1));

    // Mock data based on the screenshot
    _friends = [
      FriendItem(
        id: '1',
        name: '小飞侠',
        avatar: 'assets/common/icons/people.png',
        isOnline: true,
        lastSeen: '刚刚',
        status: '在线',
      ),
      FriendItem(
        id: '2',
        name: '小明',
        avatar: 'assets/common/icons/people.png',
        isOnline: true,
        lastSeen: '5分钟前',
        status: '在线',
      ),
      FriendItem(
        id: '3',
        name: '小红',
        avatar: 'assets/common/icons/people.png',
        isOnline: false,
        lastSeen: '1小时前',
        status: '离线',
      ),
      FriendItem(
        id: '4',
        name: '张三',
        avatar: 'assets/common/icons/people.png',
        isOnline: true,
        lastSeen: '30分钟前',
        status: '在线',
      ),
      FriendItem(
        id: '5',
        name: '李四',
        avatar: 'assets/common/icons/people.png',
        isOnline: false,
        lastSeen: '2小时前',
        status: '离线',
      ),
    ];

    _filteredFriends = List.from(_friends);

    setState(() {
      _isLoading = false;
    });
  }

  void _filterFriends(String query) {
    setState(() {
      if (query.isEmpty) {
        _filteredFriends = List.from(_friends);
      } else {
        _filteredFriends = _friends
            .where((friend) =>
                friend.name.toLowerCase().contains(query.toLowerCase()))
            .toList();
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: WuyAppThemeConfig.wuyBackgroundColor,
      appBar: AppBar(
        title: Text(
          '好友&群聊',
          style: WuyAppThemeConfig.wuyAppBarTitle,
        ),
        backgroundColor: WuyAppThemeConfig.wuyPrimaryColor,
        elevation: 0,
        centerTitle: true,
        actions: [
          IconButton(
            icon: const Icon(Icons.search, color: Colors.white),
            onPressed: () {
              context.go(WuyAppRouter.routeSearch);
            },
          ),
        ],
      ),
      body: Column(
        children: [
          _buildSearchBar(),
          Expanded(
            child: _isLoading
                ? const Center(child: CircularProgressIndicator())
                : _buildFriendsList(),
          ),
        ],
      ),
      bottomNavigationBar: _buildBottomNavigation(),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      padding: EdgeInsets.all(WuyAppThemeConfig.wuyDefaultPadding),
      child: TextField(
        controller: _searchController,
        onChanged: _filterFriends,
        decoration: InputDecoration(
          hintText: '搜索好友',
          prefixIcon: Icon(
            Icons.search,
            color: WuyAppThemeConfig.wuyTextSecondary,
          ),
          border: OutlineInputBorder(
            borderRadius: BorderRadius.circular(WuyAppThemeConfig.wuyBorderRadius),
            borderSide: BorderSide(color: WuyAppThemeConfig.wuyTextSecondary),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(WuyAppThemeConfig.wuyBorderRadius),
            borderSide: BorderSide(color: WuyAppThemeConfig.wuyPrimaryColor, width: 2),
          ),
          contentPadding: EdgeInsets.symmetric(
            horizontal: WuyAppThemeConfig.wuyDefaultPadding,
            vertical: WuyAppThemeConfig.wuySmallPadding,
          ),
        ),
      ),
    );
  }

  Widget _buildFriendsList() {
    if (_filteredFriends.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.people_outline,
              size: 64,
              color: WuyAppThemeConfig.wuyTextSecondary,
            ),
            SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
            Text(
              _searchController.text.isEmpty
                  ? '暂无好友'
                  : '未找到相关好友',
              style: ThemeTextStyles.bodyText1.copyWith(
                color: WuyAppThemeConfig.wuyTextSecondary,
              ),
            ),
            if (_searchController.text.isEmpty) ...[
              SizedBox(height: WuyAppThemeConfig.wuyDefaultPadding),
              ElevatedButton(
                onPressed: () {
                  context.go('/wuy/find-friends');
                },
                style: WuyAppThemeConfig.wuyPrimaryButton,
                child: const Text('添加好友'),
              ),
            ],
          ],
        ),
      );
    }

    return ListView.builder(
      itemCount: _filteredFriends.length,
      itemBuilder: (context, index) {
        final friend = _filteredFriends[index];
        return _buildFriendItem(friend);
      },
    );
  }

  Widget _buildFriendItem(FriendItem friend) {
    return Container(
      margin: EdgeInsets.symmetric(
        horizontal: WuyAppThemeConfig.wuyDefaultPadding,
        vertical: ThemeDimensions.spacing4,
      ),
      decoration: WuyAppThemeConfig.wuyCardDecoration,
      child: ListTile(
        contentPadding: EdgeInsets.symmetric(
          horizontal: WuyAppThemeConfig.wuyDefaultPadding,
          vertical: WuyAppThemeConfig.wuySmallPadding,
        ),
        leading: CircleAvatar(
          radius: WuyAppThemeConfig.wuyAvatarRadius,
          backgroundColor: friend.isOnline 
              ? WuyAppThemeConfig.wuyOnlineColor 
              : WuyAppThemeConfig.wuyOfflineColor,
          child: Icon(
            Icons.person,
            color: Colors.white,
            size: 20,
          ),
        ),
        title: Text(
          friend.name,
          style: WuyAppThemeConfig.wuyFriendName,
        ),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            IconButton(
              icon: const Icon(Icons.chat, size: 20),
              onPressed: () {
                context.go('${WuyAppRouter.routeChat.replaceAll(':id', friend.id)}?name=${Uri.encodeComponent(friend.name)}');
              },
              tooltip: 'Chat',
            ),
            IconButton(
              icon: const Icon(Icons.info_outline, size: 20),
              onPressed: () {
                context.go('/wuy/friend/${friend.id}');
              },
              tooltip: 'Info',
            ),
            Switch(
              value: friend.isOnline,
              onChanged: (value) {
                setState(() {
                  friend.isOnline = value;
                });
              },
              activeColor: WuyAppThemeConfig.wuyPrimaryColor,
              materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBottomNavigation() {
    return Container(
      decoration: WuyAppThemeConfig.wuyBottomNavDecoration,
      child: SafeArea(
        child: Container(
          height: WuyAppThemeConfig.wuyBottomNavHeight,
          padding: EdgeInsets.symmetric(horizontal: WuyAppThemeConfig.wuyDefaultPadding),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildNavItem(Icons.chat, '消息', false, () => context.go(WuyAppRouter.routeSearch)),
              _buildNavItem(Icons.people, '好友', true, null),
              _buildNavItem(Icons.explore, '发现', false, () => context.go(WuyAppRouter.routeFindFriends)),
              _buildNavItem(Icons.person, '我的', false, () => context.go(WuyAppRouter.routeProfile)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem(IconData icon, String label, bool isSelected, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: ThemeDimensions.spacing12,
          vertical: WuyAppThemeConfig.wuySmallPadding,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(
              icon,
              color: isSelected 
                  ? WuyAppThemeConfig.wuyPrimaryColor 
                  : WuyAppThemeConfig.wuyTextSecondary,
              size: 24,
            ),
            SizedBox(height: ThemeDimensions.spacing4),
            Text(
              label,
              style: WuyAppThemeConfig.wuyNavLabel.copyWith(
                color: isSelected 
                    ? WuyAppThemeConfig.wuyPrimaryColor 
                    : WuyAppThemeConfig.wuyTextSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class FriendItem {
  final String id;
  final String name;
  final String avatar;
  bool isOnline;
  final String lastSeen;
  final String status;

  FriendItem({
    required this.id,
    required this.name,
    required this.avatar,
    required this.isOnline,
    required this.lastSeen,
    required this.status,
  });
}
