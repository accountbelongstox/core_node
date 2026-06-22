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
