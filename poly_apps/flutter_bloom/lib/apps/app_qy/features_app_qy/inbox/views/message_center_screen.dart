/// Message Center screen showing all conversations and messages
library;

import 'package:flutter/material.dart';
import '../../../../../../common/i18n/i18n_service.dart';
import '../../../../../../common/theme/app_theme.dart';
import '../../../../../../common/widgets/animations/animation_utils.dart';
import '../domain/model/inbox_model.dart';

class MessageCenterScreen extends StatefulWidget {
  const MessageCenterScreen({super.key});

  @override
  State<MessageCenterScreen> createState() => _MessageCenterScreenState();
}

class _MessageCenterScreenState extends State<MessageCenterScreen>
    with TickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _fadeAnimation;
  late TabController _tabController;

  final List<InboxModel> _conversations = [
    InboxModel(
      id: '1',
      name: '学习助手',
      avatar: '🤖',
      lastMessage: '今天的词汇学习已完成，继续保持！',
      time: '2分钟前',
      unreadCount: 2,
      isOnline: true,
      messageType: InboxType.system,
    ),
    InboxModel(
      id: '2',
      name: '英语角小组',
      avatar: '👥',
      lastMessage: 'John: 大家觉得这个语法点怎么样？',
      time: '15分钟前',
      unreadCount: 5,
      isOnline: false,
      messageType: InboxType.group,
    ),
    InboxModel(
      id: '3',
      name: 'Lucy',
      avatar: '👩‍🎓',
      lastMessage: '好的，明天见！',
      time: '1小时前',
      unreadCount: 0,
      isOnline: true,
      messageType: InboxType.personal,
    ),
    InboxModel(
      id: '4',
      name: '系统通知',
      avatar: '🔔',
      lastMessage: '您获得新的学习成就徽章！',
      time: '2小时前',
      unreadCount: 1,
      isOnline: false,
      messageType: InboxType.notification,
    ),
    InboxModel(
      id: '5',
      name: '学习提醒',
      avatar: '⏰',
      lastMessage: '该复习今天学习的单词了',
      time: '3小时前',
      unreadCount: 0,
      isOnline: false,
      messageType: InboxType.system,
    ),
  ];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      duration: ComponentStyles.normalDuration,
      vsync: this,
    );
    _fadeAnimation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: ComponentStyles.primaryCurve),
    );
    _tabController = TabController(length: 3, vsync: this);
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              AppTheme.auroraGradient.colors[0].withOpacity(0.1),
              AppTheme.auroraGradient.colors[1].withOpacity(0.05),
              Colors.white,
            ],
          ),
        ),
        child: SafeArea(
          child: FadeTransition(
            opacity: _fadeAnimation,
            child: Column(
              children: [
                _buildAppBar(),
                _buildTabBar(),
                Expanded(
                  child: TabBarView(
                    controller: _tabController,
                    children: [
                      _buildConversationList(),
                      _buildGroupChats(),
                      _buildNotifications(),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
      floatingActionButton: AnimationUtils.scaleOnTap(
        child: BouncingButton(
          onPressed: _startNewChat,
          child: Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              gradient: AppTheme.primaryGradient,
              borderRadius: BorderRadius.circular(28),
              boxShadow: [
                BoxShadow(
                  color: AppTheme.primaryGreen.withOpacity(0.3),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: const Icon(
              Icons.add,
              color: Colors.white,
              size: 28,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildAppBar() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          BouncingButton(
            onPressed: () => Navigator.of(context).pop(),
            child: Icon(
              Icons.arrow_back,
              color: AppTheme.textPrimary,
              size: 24,
            ),
          ),
          Expanded(
            child: Column(
              children: [
                Text(
                  '消息中心',
                  style: AppTextStyles.headline4.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '${_conversations.where((c) => c.unreadCount > 0).length} 条未读消息',
                  style: AppTextStyles.bodySmall.copyWith(
                    color: AppTheme.textSecondary,
                  ),
                ),
              ],
            ),
          ),
          BouncingButton(
            onPressed: _markAllAsRead,
            child: Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: AppTheme.primaryGreen.withOpacity(0.1),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(
                Icons.done_all,
                color: AppTheme.primaryGreen,
                size: 20,
              ),
            ),
          ),
          const SizedBox(width: 8),
          BouncingButton(
            onPressed: _searchMessages,
            child: Icon(
              Icons.search,
              color: AppTheme.primaryGreen,
              size: 24,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(25),
        boxShadow: [
          BoxShadow(
            color: AppTheme.shadowLight.withOpacity(0.1),
            blurRadius: 10,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          gradient: AppTheme.primaryGradient,
          borderRadius: BorderRadius.circular(25),
        ),
        labelColor: Colors.white,
        unselectedLabelColor: AppTheme.textSecondary,
        indicatorSize: TabBarIndicatorSize.tab,
        labelStyle: AppTextStyles.bodyMedium.copyWith(
          fontWeight: FontWeight.bold,
        ),
        unselectedLabelStyle: AppTextStyles.bodyMedium,
        tabs: const [
          Tab(
            icon: Icon(Icons.chat),
            text: '全部',
          ),
          Tab(
            icon: Icon(Icons.group),
            text: '群组',
          ),
          Tab(
            icon: Icon(Icons.notifications),
            text: '通知',
          ),
        ],
      ),
    );
  }

  Widget _buildConversationList() {
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _conversations.length,
      itemBuilder: (context, index) {
        final conversation = _conversations[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildConversationItem(conversation),
          ),
        );
      },
    );
  }

  Widget _buildConversationItem(InboxModel conversation) {
    return BouncingButton(
      onPressed: () => _openConversation(conversation),
      child: Container(
        decoration: ComponentStyles.primaryCardDecoration,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                _getConversationColor(conversation).withOpacity(0.05),
                Colors.white.withOpacity(0.9),
              ],
            ),
          ),
          child: Row(
            children: [
              _buildAvatar(conversation),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            conversation.name,
                            style: AppTextStyles.headline6.copyWith(
                              color: AppTheme.textPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Text(
                          conversation.time,
                          style: AppTextStyles.bodySmall.copyWith(
                            color: AppTheme.textSecondary,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            conversation.lastMessage,
                            style: AppTextStyles.bodyMedium.copyWith(
                              color: conversation.unreadCount > 0
                                  ? AppTheme.textPrimary
                                  : AppTheme.textSecondary,
                              fontWeight: conversation.unreadCount > 0
                                  ? FontWeight.w600
                                  : FontWeight.normal,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (conversation.unreadCount > 0) ...[
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              gradient: AppTheme.errorGradient,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              conversation.unreadCount.toString(),
                              style: AppTextStyles.bodySmall.copyWith(
                                color: Colors.white,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar(InboxModel conversation) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        gradient: _getConversationColor(conversation),
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: _getConversationColor(conversation).colors[0].withOpacity(0.3),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Stack(
        children: [
          Center(
            child: Text(
              conversation.avatar,
              style: const TextStyle(fontSize: 24),
            ),
          ),
          if (conversation.isOnline)
            Positioned(
              right: 0,
              bottom: 0,
              child: Container(
                width: 12,
                height: 12,
                decoration: BoxDecoration(
                  color: AppTheme.success,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(
                    color: Colors.white,
                    width: 2,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildGroupChats() {
    final groupChats = _conversations
        .where((c) => c.messageType == InboxType.group)
        .toList();

    if (groupChats.isEmpty) {
      return _buildEmptyState('👥', '暂无群组聊天', '加入或创建学习小组开始讨论');
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: groupChats.length,
      itemBuilder: (context, index) {
        final chat = groupChats[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildConversationItem(chat),
          ),
        );
      },
    );
  }

  Widget _buildNotifications() {
    final notifications = _conversations
        .where((c) => c.messageType == InboxType.notification ||
                     c.messageType == InboxType.system)
        .toList();

    if (notifications.isEmpty) {
      return _buildEmptyState('🔔', '暂无通知', '系统通知和提醒将显示在这里');
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: notifications.length,
      itemBuilder: (context, index) {
        final notification = notifications[index];
        return AnimationUtils.staggeredAnimation(
          index: index,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _buildConversationItem(notification),
          ),
        );
      },
    );
  }

  Widget _buildEmptyState(String emoji, String title, String subtitle) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 120,
            height: 120,
            decoration: BoxDecoration(
              color: AppTheme.primaryGreen.withOpacity(0.1),
              borderRadius: BorderRadius.circular(60),
            ),
            child: Center(
              child: Text(
                emoji,
                style: const TextStyle(fontSize: 60),
              ),
            ),
          ),
          const SizedBox(height: 24),
          Text(
            title,
            style: AppTextStyles.headline5.copyWith(
              color: AppTheme.textPrimary,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            subtitle,
            style: AppTextStyles.bodyMedium.copyWith(
              color: AppTheme.textSecondary,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  LinearGradient _getConversationColor(InboxModel conversation) {
    switch (conversation.messageType) {
      case InboxType.personal:
        return AppTheme.primaryGradient;
      case InboxType.group:
        return AppTheme.socialGradient;
      case InboxType.system:
        return AppTheme.infoGradient;
      case InboxType.notification:
        return AppTheme.warningGradient;
    }
  }

  void _openConversation(InboxModel conversation) {
    // Navigate to chat screen
    Navigator.of(context).pushNamed('/chat', arguments: conversation);
  }

  void _startNewChat() {
    // Show new chat options
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (context) => _buildNewChatSheet(),
    );
  }

  Widget _buildNewChatSheet() {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 40,
            height: 4,
            margin: const EdgeInsets.symmetric(vertical: 12),
            decoration: BoxDecoration(
              color: AppTheme.borderLight,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              children: [
                Text(
                  '开始新对话',
                  style: AppTextStyles.headline5.copyWith(
                    color: AppTheme.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 20),
                _buildNewChatOption('👤', '私聊', '与单个同学交流'),
                _buildNewChatOption('👥', '群聊', '创建或加入学习小组'),
                _buildNewChatOption('🤖', 'AI助手', '获取学习建议和帮助'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNewChatOption(String icon, String title, String subtitle) {
    return BouncingButton(
      onPressed: () {
        Navigator.of(context).pop();
        // Handle new chat creation
      },
      child: Container(
        padding: const EdgeInsets.all(16),
        margin: const EdgeInsets.only(bottom: 12),
        decoration: BoxDecoration(
          color: AppTheme.primaryGreen.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: AppTheme.primaryGreen.withOpacity(0.2),
          ),
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                gradient: AppTheme.primaryGradient,
                borderRadius: BorderRadius.circular(24),
              ),
              child: Center(
                child: Text(
                  icon,
                  style: const TextStyle(fontSize: 24),
                ),
              ),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: AppTextStyles.headline6.copyWith(
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    subtitle,
                    style: AppTextStyles.bodyMedium.copyWith(
                      color: AppTheme.textSecondary,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_forward_ios,
              color: AppTheme.textSecondary,
              size: 16,
            ),
          ],
        ),
      ),
    );
  }

  void _markAllAsRead() {
    setState(() {
      for (var conversation in _conversations) {
        conversation.unreadCount = 0;
      }
    });

    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('所有消息已标记为已读'),
        backgroundColor: AppTheme.success,
      ),
    );
  }

  void _searchMessages() {
    showSearch(
      context: context,
      delegate: MessageSearchDelegate(_conversations),
    );
  }
}

// Custom SearchDelegate for searching messages
class MessageSearchDelegate extends SearchDelegate<String> {
  final List<InboxModel> conversations;

  MessageSearchDelegate(this.conversations);

  @override
  List<Widget> buildActions(BuildContext context) {
    return [
      IconButton(
        icon: const Icon(Icons.close),
        onPressed: () => close(context, ''),
      ),
    ];
  }

  @override
  Widget buildLeading(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.arrow_back),
      onPressed: () => close(context, ''),
    );
  }

  @override
  Widget buildResults(BuildContext context) {
    final results = conversations.where((conversation) =>
      conversation.name.toLowerCase().contains(query.toLowerCase()) ||
      conversation.lastMessage.toLowerCase().contains(query.toLowerCase())
    ).toList();

    return ListView.builder(
      itemCount: results.length,
      itemBuilder: (context, index) {
        final conversation = results[index];
        return ListTile(
          leading: CircleAvatar(
            child: Text(conversation.avatar),
          ),
          title: Text(conversation.name),
          subtitle: Text(conversation.lastMessage),
          onTap: () => close(context, conversation.id),
        );
      },
    );
  }

  @override
  Widget buildSuggestions(BuildContext context) {
    return buildResults(context);
  }
}