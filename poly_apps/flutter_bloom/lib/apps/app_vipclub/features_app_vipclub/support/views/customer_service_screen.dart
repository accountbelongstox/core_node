import 'package:flutter/material.dart';
import 'package:qyflutter/common/widgets/widgets.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/apps/app_vipclub/models_app_vipclub/support_model_app_vipclub.dart';
import 'package:qyflutter/apps/app_vipclub/services_app_vipclub/support_api_service_app_vipclub.dart';

/// Customer Service Chat Screen
class VipClubCustomerServiceScreen extends StatefulWidget {
  const VipClubCustomerServiceScreen({super.key});

  @override
  State<VipClubCustomerServiceScreen> createState() =>
      _VipClubCustomerServiceScreenState();
}

class _VipClubCustomerServiceScreenState
    extends State<VipClubCustomerServiceScreen> {
  final _supportService = VipClubSupportApiService();
  final _messageController = TextEditingController();
  final _scrollController = ScrollController();

  List<VipClubSupportMessageModel> _messages = [];
  VipClubSupportInfoModel? _supportInfo;
  bool _isLoading = true;
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    _loadMessages();
    _loadSupportInfo();
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _loadMessages() async {
    setState(() => _isLoading = true);

    try {
      final conversation = await _supportService.getMessages();
      setState(() {
        _messages = conversation.messages;
        _isLoading = false;
      });

      // Scroll to bottom
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_scrollController.hasClients) {
          _scrollController.animateTo(
            _scrollController.position.maxScrollExtent,
            duration: Duration(milliseconds: 300),
            curve: Curves.easeOut,
          );
        }
      });
    } catch (e) {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _loadSupportInfo() async {
    try {
      final info = await _supportService.getSupportInfo();
      setState(() => _supportInfo = info);
    } catch (e) {
      // Ignore error, info is optional
    }
  }

  Future<void> _sendMessage() async {
    final message = _messageController.text.trim();
    if (message.isEmpty) return;

    setState(() => _isSending = true);

    try {
      await _supportService.sendMessage(message: message);

      // Add message locally
      final newMessage = VipClubSupportMessageModel(
        id: DateTime.now().millisecondsSinceEpoch.toString(),
        userId: 'current_user',
        message: message,
        isFromUser: true,
        createdAt: DateTime.now(),
      );

      setState(() {
        _messages.add(newMessage);
        _messageController.clear();
        _isSending = false;
      });

      // Scroll to bottom
      _scrollController.animateTo(
        _scrollController.position.maxScrollExtent,
        duration: Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    } catch (e) {
      setState(() => _isSending = false);

      showErrorDialog(
        context: context,
        title: 'Failed to Send',
        message: e.toString(),
      );
    }
  }

  void _showContactInfo() {
    showCustomBottomSheet(
      context: context,
      child: _buildContactInfoSheet(),
    );
  }

  Widget _buildContactInfoSheet() {
    return Container(
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ListSectionHeader(title: 'Contact Information'),
          SizedBox(height: ThemeDimensions.defaultPadding),
          if (_supportInfo != null) ...[
            IconListTile(
              icon: Icons.phone,
              title: 'Phone',
              subtitle: _supportInfo!.phone,
              onTap: () {
                // Launch phone dialer
                showCustomSnackbar(
                  context: context,
                  message: 'Calling ${_supportInfo!.phone}...',
                  type: SnackbarType.info,
                );
              },
            ),
            IconListTile(
              icon: Icons.email,
              title: 'Email',
              subtitle: _supportInfo!.email,
              onTap: () {
                // Launch email client
                showCustomSnackbar(
                  context: context,
                  message: 'Opening email client...',
                  type: SnackbarType.info,
                );
              },
            ),
            if (_supportInfo!.wechat.isNotEmpty)
              IconListTile(
                icon: Icons.chat,
                title: 'WeChat',
                subtitle: _supportInfo!.wechat,
                onTap: () {},
              ),
            if (_supportInfo!.whatsapp.isNotEmpty)
              IconListTile(
                icon: Icons.phone_android,
                title: 'WhatsApp',
                subtitle: _supportInfo!.whatsapp,
                onTap: () {},
              ),
            IconListTile(
              icon: Icons.access_time,
              title: 'Hours',
              subtitle: _supportInfo!.hours,
            ),
          ] else
            LoadingState(message: 'Loading contact information...'),
          SizedBox(height: ThemeDimensions.defaultPadding),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.neutralWhite,
      appBar: AppBar(
        title: Text('Customer Service'),
        backgroundColor: ThemeColors.primaryBlue,
        foregroundColor: ThemeColors.neutralWhite,
        actions: [
          IconButton(
            icon: Icon(Icons.info_outline),
            onPressed: _showContactInfo,
            tooltip: 'Contact Info',
          ),
        ],
      ),
      body: Column(
        children: [
          // Messages List
          Expanded(
            child: _buildMessagesList(),
          ),

          // Input Area
          _buildMessageInput(),
        ],
      ),
    );
  }

  Widget _buildMessagesList() {
    if (_isLoading) {
      return LoadingState(message: 'Loading conversation...');
    }

    if (_messages.isEmpty) {
      return EmptyState(
        title: 'No Messages Yet',
        message: 'Start a conversation with our support team',
        icon: Icons.chat_bubble_outline,
        buttonText: 'Send First Message',
        onButtonPressed: () {
          // Focus on input
        },
      );
    }

    return ListView.builder(
      controller: _scrollController,
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      itemCount: _messages.length,
      itemBuilder: (context, index) {
        final message = _messages[index];
        return _buildMessageBubble(message);
      },
    );
  }

  Widget _buildMessageBubble(VipClubSupportMessageModel message) {
    final isUser = message.isFromUser;

    return Padding(
      padding: EdgeInsets.only(bottom: ThemeDimensions.defaultPadding),
      child: Row(
        mainAxisAlignment:
            isUser ? MainAxisAlignment.end : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!isUser) ...[
            CircleAvatar(
              backgroundColor: ThemeColors.primaryBlue,
              radius: 16,
              child: Icon(
                Icons.support_agent,
                size: 16,
                color: ThemeColors.neutralWhite,
              ),
            ),
            SizedBox(width: ThemeDimensions.smallPadding),
          ],
          Flexible(
            child: Container(
              padding: EdgeInsets.symmetric(
                horizontal: ThemeDimensions.defaultPadding,
                vertical: ThemeDimensions.smallPadding,
              ),
              decoration: BoxDecoration(
                color: isUser
                    ? ThemeColors.primaryBlue
                    : ThemeColors.neutralGrey.withOpacity(0.1),
                borderRadius: BorderRadius.circular(
                  ThemeDimensions.defaultRadius,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    message.message,
                    style: ThemeTextStyles.bodyMedium.copyWith(
                      color: isUser
                          ? ThemeColors.neutralWhite
                          : ThemeColors.neutralBlack,
                    ),
                  ),
                  SizedBox(height: ThemeDimensions.tinyPadding),
                  Text(
                    message.formattedTime,
                    style: ThemeTextStyles.bodySmall.copyWith(
                      color: isUser
                          ? ThemeColors.neutralWhite.withOpacity(0.7)
                          : ThemeColors.neutralGrey,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (isUser) ...[
            SizedBox(width: ThemeDimensions.smallPadding),
            CircleAvatar(
              backgroundColor: ThemeColors.accentGold,
              radius: 16,
              child: Icon(
                Icons.person,
                size: 16,
                color: ThemeColors.neutralWhite,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMessageInput() {
    return Container(
      decoration: BoxDecoration(
        color: ThemeColors.neutralWhite,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 10,
            offset: Offset(0, -2),
          ),
        ],
      ),
      padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
      child: SafeArea(
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: _messageController,
                enabled: !_isSending,
                decoration: InputDecoration(
                  hintText: 'Type your message...',
                  filled: true,
                  fillColor: ThemeColors.neutralGrey.withOpacity(0.1),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(
                      ThemeDimensions.largeRadius,
                    ),
                    borderSide: BorderSide.none,
                  ),
                  contentPadding: EdgeInsets.symmetric(
                    horizontal: ThemeDimensions.defaultPadding,
                    vertical: ThemeDimensions.smallPadding,
                  ),
                ),
                maxLines: null,
                textInputAction: TextInputAction.send,
                onSubmitted: (_) => _sendMessage(),
              ),
            ),
            SizedBox(width: ThemeDimensions.smallPadding),
            FloatingButton(
              icon: _isSending ? Icons.hourglass_empty : Icons.send,
              onPressed: _isSending ? null : _sendMessage,
              backgroundColor: ThemeColors.primaryBlue,
            ),
          ],
        ),
      ),
    );
  }
}
