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

Future<void> main() async {
  WidgetsFlutterBinding widgetsBinding;
  ThemeData lightTheme;
  ThemeData darkTheme;

  widgetsBinding = WidgetsFlutterBinding.ensureInitialized();

  lightTheme = ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
    useMaterial3: true,
  );

  darkTheme = ThemeData(
    colorScheme: ColorScheme.fromSeed(seedColor: Colors.blueGrey, brightness: Brightness.dark),
    useMaterial3: true,
  );

  await runCommonApp(
    appName: 'Laravel Bloom',
    appId: 'laravel_bloom',
    customApp: const _LaravelBloomApp(),
    lightTheme: lightTheme,
    darkTheme: darkTheme,
    initializeUnifiedStorage: true,
  );

  widgetsBinding;
}

class _LaravelBloomApp extends StatelessWidget {
  const _LaravelBloomApp({super.key});

  @override
  Widget build(BuildContext context) {
    Scaffold scaffold;

    scaffold = Scaffold(
      appBar: AppBar(
        title: const Text('Laravel Bloom'),
      ),
      body: const Center(
        child: Text(
          'Laravel Bloom Web App\n(placeholder entry)',
          textAlign: TextAlign.center,
        ),
      ),
    );

    return MaterialApp(
      title: 'Laravel Bloom',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blue),
        useMaterial3: true,
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.blueGrey, brightness: Brightness.dark),
        useMaterial3: true,
      ),
      home: scaffold,
    );
  }
}

