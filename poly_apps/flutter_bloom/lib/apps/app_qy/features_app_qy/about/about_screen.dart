import 'package:flutter/material.dart';
import 'package:qyflutter/apps/app_qy/features_app_qy/profile/domain/model/about_model.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';

class AboutScreenView extends StatelessWidget {
  const AboutScreenView({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('About'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(10),
        child: Text(aboutData, style: ThemeTextStyles.textMedium.copyWith(fontSize: 16)),
      ),
    );
  }
}
