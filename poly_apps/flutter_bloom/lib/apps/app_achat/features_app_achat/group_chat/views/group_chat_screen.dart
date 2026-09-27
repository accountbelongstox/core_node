import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/group_chat/domain/model/chat_message_model.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/group_chat/domain/service/chat_service.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/group_chat/widgets/chat_message_list.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/group_chat/widgets/chat_input_bar.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/group_chat/widgets/group_chat_appbar.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';

class GroupChatScreen extends StatefulWidget {
  final String groupId;
  final String groupName;
  final String groupMembers;
  
  const GroupChatScreen({
    super.key,
    this.groupId = '',
    this.groupName = '',
    this.groupMembers = '',
  });

  @override
  State<GroupChatScreen> createState() => _GroupChatScreenState();
}

class _GroupChatScreenState extends State<GroupChatScreen> {
  final TextEditingController _messageController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final ChatService _chatService = ChatService();
  List<ChatMessage> _messages = [];
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadMessages();
  }

  Future<void> _loadMessages() async {
    setState(() {
      _isLoading = true;
    });
    
    try {
      // Simulate loading messages
      await Future.delayed(const Duration(milliseconds: 500));
      if (mounted) {
        setState(() {
          _messages = ChatMessage.getDefaultMessages();
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('achat_group_chat_load_error'.tr(context))),
        );
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendTextMessage() async {
    final text = _messageController.text.trim();
    if (text.isEmpty) return;
    
    setState(() {
      _messages.add(_chatService.sendTextMessage(text, context));
      _messageController.clear();
    });
    _scrollToBottom();
  }

  Future<void> _sendImageMessage() async {
    final message = await _chatService.sendImageMessage(context);
    if (message != null) {
      setState(() {
        _messages.add(message);
      });
      _scrollToBottom();
    }
  }

  Future<void> _sendFileMessage() async {
    final message = await _chatService.sendFileMessage(context);
    if (message != null) {
      setState(() {
        _messages.add(message);
      });
      _scrollToBottom();
    }
  }

  Future<void> _sendVoiceMessage() async {
    final message = await _chatService.sendVoiceMessage(context);
    if (message != null) {
      setState(() {
        _messages.add(message);
      });
      _scrollToBottom();
    }
  }

  void _onSearch() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('achat_group_chat_search_coming_soon'.tr(context))),
    );
  }

  void _onMore() {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('achat_group_chat_more_coming_soon'.tr(context))),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Theme.of(context).colorScheme.surface,
      appBar: GroupChatAppBar(
        groupName: widget.groupName,
        groupMembers: widget.groupMembers,
        onSearch: _onSearch,
        onMore: _onMore,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(),
            )
          : Column(
              children: [
                Expanded(
                  child: ChatMessageList(
                    messages: _messages,
                    scrollController: _scrollController,
                  ),
                ),
                ChatInputBar(
                  messageController: _messageController,
                  onSendText: _sendTextMessage,
                  onSendImage: _sendImageMessage,
                  onSendFile: _sendFileMessage,
                  onSendVoice: _sendVoiceMessage,
                ),
              ],
            ),
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    _scrollController.dispose();
    super.dispose();
  }
}
