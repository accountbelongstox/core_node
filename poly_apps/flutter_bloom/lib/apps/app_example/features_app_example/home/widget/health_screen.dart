import 'package:flutter/material.dart';

class HealthScreenView extends StatelessWidget {
  const HealthScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Health')),
      body: const Center(child: Text('Health')),
    );
  }
}
