import 'package:flutter/material.dart';

/// 常见问题按钮网格
class FAQButtonsGrid extends StatelessWidget {
  final List<String> faqOptions;
  final Function(String)? onTapFAQ;

  const FAQButtonsGrid({
    super.key,
    required this.faqOptions,
    this.onTapFAQ,
  });

  @override
  Widget build(BuildContext context) {
    if (faqOptions.isEmpty) return const SizedBox.shrink();

    return Container(
      color: Colors.white,
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            '常见问题',
            style: TextStyle(
              color: Colors.black,
              fontSize: 18,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          GridView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 3,
            ),
            itemCount: faqOptions.length,
            itemBuilder: (context, index) {
              return _buildFAQButton(context, faqOptions[index]);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildFAQButton(BuildContext context, String question) {
    return GestureDetector(
      onTap: () {
        if (onTapFAQ != null) {
          onTapFAQ!(question);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(question)),
          );
        }
      },
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: const Color(0xFFE5E5E5)),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            const Icon(
              Icons.help_outline,
              size: 18,
              color: Color(0xFF007AFF),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                question,
                style: const TextStyle(
                  color: Color(0xFF333333),
                  fontSize: 13,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
