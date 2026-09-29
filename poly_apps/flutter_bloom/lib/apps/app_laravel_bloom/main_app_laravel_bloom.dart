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

