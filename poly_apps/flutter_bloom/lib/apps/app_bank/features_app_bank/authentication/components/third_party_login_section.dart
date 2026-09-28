import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';

class ThirdPartyLoginSection extends StatelessWidget {
  final VoidCallback? onWeChatTap;
  final VoidCallback? onAlipayTap;
  final VoidCallback? onMoreTap;

  const ThirdPartyLoginSection({
    super.key,
    this.onWeChatTap,
    this.onAlipayTap,
    this.onMoreTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        const Text(
          '其他登录方式',
          style: TextStyle(
            fontSize: 14,
            color: Colors.grey,
          ),
        ),
        const SizedBox(height: 20),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildThirdPartyIcon(
              icon: FontAwesomeIcons.weixin,
              color: const Color(0xFF07C160),
              isFontAwesome: true,
              onTap: onWeChatTap ?? () {},
            ),
            const SizedBox(width: 32),
            _buildThirdPartyIcon(
              icon: FontAwesomeIcons.alipay,
              color: const Color(0xFF1890FF),
              isFontAwesome: true,
              onTap: onAlipayTap ?? () {},
            ),
          ],
        ),
        const SizedBox(height: 20),
        _buildMoreLink(),
      ],
    );
  }

  Widget _buildThirdPartyIcon({
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
    bool isFontAwesome = false,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.1),
              blurRadius: 8,
              offset: const Offset(0, 2),
              spreadRadius: 0,
            ),
          ],
        ),
        child: Center(
          child: isFontAwesome
              ? FaIcon(icon, color: color, size: 24)
              : Icon(icon, color: color, size: 24),
        ),
      ),
    );
  }

  Widget _buildMoreLink() {
    return Center(
      child: TextButton(
        onPressed: onMoreTap,
        style: TextButton.styleFrom(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          minimumSize: Size.zero,
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        child: const Text(
          '更多',
          style: TextStyle(
            fontSize: 12,
            color: Color(0xFF1890FF),
          ),
        ),
      ),
    );
  }
}
