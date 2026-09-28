import 'package:flutter/material.dart';

class MedicalScreenView extends StatelessWidget {
  const MedicalScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: <Widget>[
        Text('This is the medical screen', style: TextStyle(fontSize: 20)),
      ])),
    );
  }
}
