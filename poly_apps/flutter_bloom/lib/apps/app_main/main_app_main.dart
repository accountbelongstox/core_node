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
import 'package:qyflutter/common/app/main_common.dart';
import 'package:qyflutter/apps/app_main/apps_bootstrap_main.dart';
import 'package:qyflutter/apps/app_main/provider_app_main.dart';
import 'package:qyflutter/apps/app_main/localization_app_main/en_app_main.dart';
import 'package:qyflutter/apps/app_main/localization_app_main/zh_app_main.dart';

/// Main App Entry Point
/// This is the special app called by lib/main.dart
/// It aggregates all other apps and provides a showcase interface
void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await runCommonApp(
    appName: 'Flutter Bloom - Main',
    appId: 'main',
    customApp: const MainApp(),
    enAppLocales: EnAppMain.locales,
    zhAppLocales: ZhAppMain.locales,
    appPrefs: prefsAppMain,
    initializeUnifiedStorage: true, // Use v1 storage (UnifiedStorage + Hive)
  );
}

class MainApp extends StatelessWidget {
  const MainApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Bloom - Main',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        useMaterial3: true,
      ),
      home: const MainHomePage(title: 'Flutter Bloom - Main'),
    );
  }
}

class MainHomePage extends StatefulWidget {
  const MainHomePage({super.key, required this.title});

  final String title;

  @override
  State<MainHomePage> createState() => _MainHomePageState();
}

class _MainHomePageState extends State<MainHomePage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
      body: const Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            Text(
              'Welcome to Flutter Bloom Main App',
              style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            SizedBox(height: 20),
            Text(
              'This is the main aggregation app that provides access to all other apps.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 16),
            ),
            SizedBox(height: 40),
            AppsBootstrapMain(),
          ],
        ),
      ),
    );
  }
}
