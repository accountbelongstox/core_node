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
