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

import 'package:qyflutter/apps/app_achat/features_app_achat/chat_details/domain/model/chat_message_model.dart';

class ChatDetailsService {
  // Get chat information
  (String, String) getChatInfo() {
    return (
      'Product Development Discussion',
      'Manager Zhang, Designer Li, Engineer Wang, Product Manager Zhao'
    );
  }

  // Get chat message list
  List<ChatMessageModel> getMessages() {
    return [
      ChatMessageModel(
        sender: '【专属约炮】接待员：小玉 💖 上班时间：🌙 夜班：22:00 - 06:00',
        content: '很多哥哥觉得小仙女似乎并不属于自己的世界，其实你只是缺一个平台，很多寂寞难耐的小姐姐都在等着哥哥来约，联系我给彼此一个建立性福的机会吧',
        time: '09:30',
        avatar: '玉',
        isMe: false,
      ),
      ChatMessageModel(
        sender: '【专属约炮】接待员：小玉 💖 上班时间：🌙 夜班：22:00 - 06:00',
        content: '会员反馈安排一波在这个色色的社会，你有想换女友的幻想吗?刺激、激情、统统占满，还不赶紧行动起来',
        time: '09:32',
        avatar: '玉',
        isMe: false,
      ),
      ChatMessageModel(
        sender: '【专属约炮】接待员：小玉 💖 上班时间：🌙 夜班：22:00 - 06:00',
        content: '这样粉嫩的小姐姐都是谁在约呀，还没有约的哥哥，想约可以联系我安排哦，这个时间不早不晚刚刚好呢，工作忙的时候闲暇时间',
        time: '09:32',
        avatar: '玉',
        isMe: false,
      ),
      ChatMessageModel(
        sender: '【专属约炮】接待员：小玉 💖 上班时间：🌙 夜班：22:00 - 06:00',
        content: '这样粉嫩的小姐姐都是谁在约呀，还没有约的哥哥，想约可以联系我安排哦，这个时间不早不晚刚刚好呢，工作忙的时候闲暇时间',
        time: '09:33',
        avatar: '玉',
        isMe: false,
      ),
      ChatMessageModel(
        sender: '【专属约炮】接待员：小玉 💖 上班时间：🌙 夜班：22:00 - 06:00',
        content: '大晚上的其他哥哥姐姐都和自己心仪炮友打炮睿哥哥还在靠双手解决吗@手淫会导致阳衰哦@从医学界的角度来看性爱对身体有益处，而且对心理也有好处。它可以锻炼身体，增加激素分泌保护前列腺，减少心脏病和心肌梗塞的发生，缓解疼痛，减轻压力，以及增加性生活质量参为了自己的身体健康着想联系妹妹给你安排炮友吧',
        time: '09:35',
        avatar: '玉',
        isMe: false,
      ),
      ChatMessageModel(
        sender: 'Wang',
        content: '请待待服务器连接中...',
        time: '09:37',
        avatar: 'W',
        isMe: true,
      ),
    ];
  }

  // Send a new message
  void sendMessage(List<ChatMessageModel> messages, String content) {
    final newMessage = ChatMessageModel(
      sender: 'Me',
      content: content,
      time: _getCurrentTime(),
      avatar: 'M',
      isMe: true,
    );
    messages.add(newMessage);
  }

  // Get current time in HH:mm format
  String _getCurrentTime() {
    final now = DateTime.now();
    return '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';
  }
}
