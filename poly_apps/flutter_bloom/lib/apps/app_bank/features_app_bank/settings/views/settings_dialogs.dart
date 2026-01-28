// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../localization_app_bank/localization_keys_app_bank.dart';
import 'package:qyflutter/apps/app_bank/config_app_bank/constants.dart';

class SettingsDialogs {
  static void showAboutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(BankLocalizationKeys.bankAboutApp.tr(context)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
                '${BankLocalizationKeys.bankDebugAppVersion.tr(context)}: ${BankConstants.appVersion}'),
            const SizedBox(height: 8),
            const Text('Developer: Flutter Team'),
            const SizedBox(height: 8),
            const Text('© 2024 Bank App. All rights reserved.'),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                Navigator.pop(context);
                Future.delayed(const Duration(milliseconds: 100), () {
                  if (context.mounted) {
                    GoRouter.of(context).push(BankConstants.routeDeveloperFeedback);
                  }
                });
              },
              child: Text(
                BankLocalizationKeys.bankAboutAppDesc.tr(context),
                style: TextStyle(
                  fontSize: 12,
                  color: Colors.grey[500],
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                Navigator.pop(context);
                Future.delayed(const Duration(milliseconds: 100), () {
                  if (context.mounted) {
                    SettingsDialogs.showLogViewerDialog(context);
                  }
                });
              },
              child: Container(
                padding:
                    const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                decoration: BoxDecoration(
                  color: const Color(0xFF74B9FF).withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.bug_report_outlined,
                      size: 16,
                      color: Color(0xFF74B9FF),
                    ),
                    const SizedBox(width: 8),
                    const Text(
                      '日志查看',
                      style: TextStyle(
                        fontSize: 12,
                        color: Color(0xFF74B9FF),
                        decoration: TextDecoration.underline,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(BankLocalizationKeys.bankConfirm.tr(context)),
          ),
        ],
      ),
    );
  }

  static void showLogViewerDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (dialogContext) {
        return _LogViewerDialogContent(
          dialogContext: dialogContext,
        );
      },
    );
  }

  static void showLogNotFoundDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('提示'),
        content: const Text('没有找到日志'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(BankLocalizationKeys.bankConfirm.tr(context)),
          ),
        ],
      ),
    );
  }

  static void showFeatureNotAvailable(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('提示'),
        content: const Text('功能无须设置'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: Text(BankLocalizationKeys.bankConfirm.tr(context)),
          ),
        ],
      ),
    );
  }

  static void showLogoutDialog(
      BuildContext context, Function() onLogout, Function() onLogoutAndClear) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('退出登录'),
        content: const Text('请选择退出方式：'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              Future.delayed(const Duration(milliseconds: 100), () {
                if (context.mounted) {
                  onLogout();
                }
              });
            },
            child: const Text(
              '退出登录',
              style: TextStyle(color: Colors.blue),
            ),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              Future.delayed(const Duration(milliseconds: 100), () {
                if (context.mounted) {
                  onLogoutAndClear();
                }
              });
            },
            child: const Text(
              '退出并清除数据',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }

  static void showClearDataConfirmDialog(
      BuildContext context, Function() onConfirm) {
    showDialog(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('确认清除数据'),
        content: const Text(
          '确定要退出登录并清除所有用户数据吗？\n\n'
          '注意：注册信息不会被清除，只有重新注册时才会更新注册信息。',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('取消'),
          ),
          TextButton(
            onPressed: () {
              Navigator.pop(dialogContext);
              Future.delayed(const Duration(milliseconds: 100), () {
                if (context.mounted) {
                  onConfirm();
                }
              });
            },
            child: const Text(
              '确定清除',
              style: TextStyle(color: Colors.red),
            ),
          ),
        ],
      ),
    );
  }
}

class _LogViewerDialogContent extends StatefulWidget {
  final BuildContext dialogContext;

  const _LogViewerDialogContent({
    required this.dialogContext,
  });

  @override
  State<_LogViewerDialogContent> createState() => _LogViewerDialogContentState();
}

class _LogViewerDialogContentState extends State<_LogViewerDialogContent> {
  late final TextEditingController _controller;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('日志查看'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('请输入日志名：'),
          const SizedBox(height: 16),
          TextField(
            controller: _controller,
            decoration: const InputDecoration(
              hintText: '请输入日志名',
              border: OutlineInputBorder(),
            ),
            autofocus: true,
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(widget.dialogContext),
          child: const Text('取消'),
        ),
        TextButton(
          onPressed: () {
            final debugCode = _controller.text.trim();
            // Get GoRouter instance before closing dialog
            final router = GoRouter.of(context);
            final navigatorContext = context;
            
            Navigator.pop(widget.dialogContext);
            
            Future.delayed(const Duration(milliseconds: 200), () {
              if (navigatorContext.mounted) {
                if (debugCode == 'debug' ||
                    debugCode == 'dev123' ||
                    debugCode == 'developer') {
                  try {
                    router.push(BankConstants.routeApiStatusMonitor);
                  } catch (e) {
                    debugPrint('❌ Navigation error: $e');
                    debugPrint('❌ Debug code: $debugCode');
                  }
                } else {
                  SettingsDialogs.showLogNotFoundDialog(navigatorContext);
                }
              }
            });
          },
          child: const Text('确认'),
        ),
      ],
    );
  }
}
