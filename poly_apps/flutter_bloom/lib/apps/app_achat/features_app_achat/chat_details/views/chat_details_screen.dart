import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:qyflutter/common/theme/base/theme_dimensions.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/widgets/network_connection_dialog.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_details/controllers/chat_details_controller.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_details/widgets/chat_details_app_bar.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_details/widgets/chat_details_widgets.dart';

class ChatDetailsScreen extends StatefulWidget {
  final String chatId;
  
  const ChatDetailsScreen({
    super.key,
    this.chatId = '',
  });

  @override
  State<ChatDetailsScreen> createState() => _ChatDetailsScreenState();
}

class _ChatDetailsScreenState extends State<ChatDetailsScreen> {
  final TextEditingController _messageController = TextEditingController();
  late ChatDetailsController _controller;

  @override
  void initState() {
    super.initState();
    _controller = ChatDetailsController(chatId: widget.chatId);
  }

  void _sendMessage() {
    if (_messageController.text.trim().isNotEmpty) {
      // Check global setting for send message functionality
      final settingsController = Provider.of<SettingsController>(context, listen: false);
      final isSendMessageEnabled = settingsController.getSetting<bool>('send_message_enabled', false) ?? false;
      
      if (isSendMessageEnabled) {
        _controller.sendMessage(_messageController.text.trim());
        _messageController.clear();
      } else {
        // Show network connection dialog when send message is disabled
        NetworkConnectionDialog.show(context);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider.value(
      value: _controller,
      child: Consumer<ChatDetailsController>(
        builder: (context, controller, child) {
          final (title, subtitle) = controller.getChatInfo();

          return Scaffold(
            backgroundColor: const Color(0xFFF6F6F6),
            appBar: ChatDetailsAppBar(
              title: title,
              subtitle: subtitle,
              onMorePressed: () => controller.showMoreOptions(context),
            ),
            body: Column(
              children: [
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.only(top: ThemeDimensions.paddingSizeSmall),
                    itemCount: controller.messages.length,
                    itemBuilder: (context, index) => ChatDetailsWidgets.buildMessageItem(controller.messages[index]),
                  ),
                ),
                ChatDetailsWidgets.buildInputBar(_messageController, context, _sendMessage),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _messageController.dispose();
    _controller.dispose();
    super.dispose();
  }
}
