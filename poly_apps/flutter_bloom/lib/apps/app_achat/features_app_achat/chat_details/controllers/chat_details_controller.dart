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
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_details/domain/model/chat_message_model.dart';
import 'package:qyflutter/apps/app_achat/features_app_achat/chat_details/domain/service/chat_details_service.dart';

class ChatDetailsController extends ChangeNotifier {
  final ChatDetailsService _service;
  final String chatId;
  
  List<ChatMessageModel> _messages = [];
  bool _isLoading = false;
  String? _errorMessage;

  ChatDetailsController({
    required this.chatId,
    ChatDetailsService? service,
  }) : _service = service ?? ChatDetailsService() {
    _loadMessages();
  }

  List<ChatMessageModel> get messages => List.unmodifiable(_messages);
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> _loadMessages() async {
    try {
      _isLoading = true;
      _errorMessage = null;
      notifyListeners();

      _messages = _service.getMessages();
      
      _isLoading = false;
      notifyListeners();
    } catch (e) {
      _isLoading = false;
      _errorMessage = e.toString();
      notifyListeners();
    }
  }

  Future<void> sendMessage(String content) async {
    if (content.trim().isEmpty) return;

    try {
      _service.sendMessage(_messages, content.trim());
      notifyListeners();
    } catch (e) {
      _errorMessage = 'Failed to send message: $e';
      notifyListeners();
    }
  }

  void showMoreOptions(BuildContext context) {
    showModalBottomSheet(
      context: context,
      builder: (context) => Container(
        padding: const EdgeInsets.all(16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.info_outline),
              title: const Text('Chat Info'),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.search),
              title: const Text('Search Messages'),
              onTap: () => Navigator.pop(context),
            ),
            ListTile(
              leading: const Icon(Icons.clear_all),
              title: const Text('Clear Chat'),
              onTap: () => Navigator.pop(context),
            ),
          ],
        ),
      ),
    );
  }

  (String, String) getChatInfo() {
    return _service.getChatInfo();
  }

  Future<void> refresh() async {
    await _loadMessages();
  }
}
