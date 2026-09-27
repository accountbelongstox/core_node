import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class DeveloperFeedbackScreen extends StatelessWidget {
  const DeveloperFeedbackScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Developer Feedback'),
        backgroundColor: const Color(0xFF74B9FF),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => context.pop(),
        ),
      ),
      body: const Center(
        child: Text(
          'Developer Feedback Screen',
          style: TextStyle(fontSize: 18),
        ),
      ),
    );
  }
}
