import 'package:flutter/material.dart';

class HomeLocationPrompt extends StatefulWidget {
  const HomeLocationPrompt({Key? key}) : super(key: key);

  @override
  State<HomeLocationPrompt> createState() => _HomeLocationPromptState();
}

class _HomeLocationPromptState extends State<HomeLocationPrompt> {
  bool _isVisible = true;

  void _closePrompt() {
    setState(() {
      _isVisible = false;
    });
  }

  void _enableLocation() {
    debugPrint('Enable location clicked');
    _closePrompt();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isVisible) {
      return const SizedBox.shrink();
    }

    return Positioned(
      left: 0,
      right: 0,
      bottom: 12.0,
      child: Container(
        margin: const EdgeInsets.symmetric(horizontal: 12.0, vertical: 8.0),
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 12.0),
        decoration: BoxDecoration(
          color: const Color(0xFF2C2C2C).withOpacity(0.95),
          borderRadius: BorderRadius.circular(8.0),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(0.3),
              blurRadius: 8.0,
              offset: const Offset(0, 2.0),
            ),
          ],
        ),
        child: Row(
          children: [
            const Expanded(
              child: Text(
                '开启定位后，查看周边旅游资源',
                style: TextStyle(
                  fontSize: 14.0,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: 12.0),
            GestureDetector(
              onTap: _enableLocation,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20.0,
                  vertical: 8.0,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF00D0D8),
                  borderRadius: BorderRadius.circular(16.0),
                ),
                child: const Text(
                  '去开启',
                  style: TextStyle(
                    fontSize: 14.0,
                    color: Colors.white,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ),
            const SizedBox(width: 8.0),
            GestureDetector(
              onTap: _closePrompt,
              child: Container(
                padding: const EdgeInsets.all(4.0),
                child: const Icon(
                  Icons.close,
                  size: 20.0,
                  color: Colors.white70,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
