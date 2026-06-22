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

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/theme/base/theme_colors.dart';
import 'package:qyflutter/common/theme/base/theme_text_styles.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import 'package:qyflutter/common/widgets/cards/premium_cards.dart';
import '../../../router_app_wuy/router_app_wuy.dart';
import '../../../localization_app_wuy/localization_keys_app_wuy.dart';
import '../../../config_app_wuy/storage_app_wuy.dart';

/// Send Request Screen for Wuy App
///
/// 1:1 implementation matching React version SendRequest.tsx
/// Features:
/// - MobileLayout with background gradient orbs
/// - Header with title and back button
/// - User avatar and info display
/// - GlassCard with form fields:
///   - Message input
///   - Alias/Remark input
///   - Relation dropdown
/// - Send Request button
class WuySendRequestScreen extends StatefulWidget {
  const WuySendRequestScreen({super.key});

  @override
  State<WuySendRequestScreen> createState() => _WuySendRequestScreenState();
}

class _WuySendRequestScreenState extends State<WuySendRequestScreen> {
  final TextEditingController _messageController =
      TextEditingController(text: "Hi, I'm Alex. Please add me.");
  final TextEditingController _aliasController =
      TextEditingController(text: "Uncle John");
  String _selectedRelation = 'Family';

  final List<String> _relationOptions = ['Family', 'Partner', 'Friend'];

  @override
  void dispose() {
    _messageController.dispose();
    _aliasController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final storage = StorageAppWuy.instance;
    final isDarkMode = storage.isDarkMode();

    return Scaffold(
      backgroundColor:
          isDarkMode ? ThemeColors.grey900 : ThemeColors.grey50,
      body: Stack(
        children: [
          // Background gradient orbs (matching React version)
          Positioned(
            top: -MediaQuery.of(context).size.height * 0.2,
            left: -MediaQuery.of(context).size.width * 0.2,
            child: Container(
              width: MediaQuery.of(context).size.width * 0.8,
              height: MediaQuery.of(context).size.height * 0.5,
              decoration: BoxDecoration(
                color: ThemeColors.blue.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: ClipOval(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 100, sigmaY: 100),
                  child: Container(),
                ),
              ),
            ),
          ),
          Positioned(
            bottom: -MediaQuery.of(context).size.height * 0.1,
            right: -MediaQuery.of(context).size.width * 0.1,
            child: Container(
              width: MediaQuery.of(context).size.width * 0.8,
              height: MediaQuery.of(context).size.height * 0.5,
              decoration: BoxDecoration(
                color: ThemeColors.purple.withOpacity(0.2),
                shape: BoxShape.circle,
              ),
              child: ClipOval(
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 100, sigmaY: 100),
                  child: Container(),
                ),
              ),
            ),
          ),
          // Content
          SafeArea(
            child: Column(
              children: [
                // Header (matching React: Header title="Verify Request" backTo="/friends/add")
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 20, vertical: 16),
                  child: Row(
                    children: [
                      // Back button
                      GestureDetector(
                        onTap: () => context.go(WuyAppRouter.getAddFriendRoute()),
                        child: Container(
                          padding: const EdgeInsets.all(8),
                          child: Icon(
                            Icons.chevron_left,
                            size: 24,
                            color: isDarkMode
                                ? ThemeColors.white
                                : ThemeColors.black,
                          ),
                        ),
                      ),
                      // Title
                      Expanded(
                        child: Text(
                          LocalizationKeysAppWuy.wuySendRequestTitle
                              .tr(context),
                          style: ThemeTextStyles.title1Bold.copyWith(
                            fontSize: 18, // text-lg
                            fontWeight: FontWeight.bold, // font-bold
                            color: isDarkMode
                                ? ThemeColors.white
                                : ThemeColors.black,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      // Spacer for alignment
                      const SizedBox(width: 40),
                    ],
                  ),
                ),

                // Content (matching React: px-6 pt-6)
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 24),
                    child: Column(
                      children: [
                        // User info (matching React: flex flex-col items-center mb-8)
                        Column(
                          children: [
                            // Avatar (matching React: w-20 h-20 rounded-full border-4 border-white shadow-lg)
                            Container(
                              width: 80, // w-20 (80px)
                              height: 80, // h-20 (80px)
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: ThemeColors.white,
                                  width: 4,
                                ),
                                boxShadow: [
                                  BoxShadow(
                                    color: ThemeColors.black.withOpacity(0.1),
                                    blurRadius: 8,
                                    offset: const Offset(0, 4),
                                  ),
                                ],
                              ),
                              child: ClipOval(
                                child: Image.network(
                                  'https://api.dicebear.com/7.x/avataaars/svg?seed=John',
                                  fit: BoxFit.cover,
                                ),
                              ),
                            ),
                            const SizedBox(height: 12), // mb-3
                            // Name (matching React: text-xl font-bold)
                            Text(
                              'John Doe',
                              style: ThemeTextStyles.title2Bold.copyWith(
                                fontSize: 20, // text-xl
                                fontWeight: FontWeight.bold, // font-bold
                                color: isDarkMode
                                    ? ThemeColors.white
                                    : ThemeColors.black,
                              ),
                            ),
                            const SizedBox(height: 4),
                            // Location (matching React: text-slate-400 text-sm)
                            Text(
                              'Beijing, China',
                              style: ThemeTextStyles.bodyMedium.copyWith(
                                fontSize: 14, // text-sm
                                color: ThemeColors.grey400, // text-slate-400
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 32), // mb-8

                        // Form card (matching React: GlassCard className="space-y-4")
                        GlassCard(
                          padding: const EdgeInsets.all(16), // p-4
                          borderRadius: BorderRadius.circular(16), // rounded-2xl
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Message field (matching React)
                              _buildFormField(
                                context,
                                label: LocalizationKeysAppWuy
                                    .wuySendRequestMessage
                                    .tr(context),
                                controller: _messageController,
                                isDarkMode: isDarkMode,
                              ),

                              const SizedBox(height: 16), // space-y-4

                              // Alias/Remark field (matching React)
                              _buildFormField(
                                context,
                                label: LocalizationKeysAppWuy
                                    .wuySendRequestAlias
                                    .tr(context),
                                controller: _aliasController,
                                isDarkMode: isDarkMode,
                              ),

                              const SizedBox(height: 16), // space-y-4

                              // Relation dropdown (matching React)
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    LocalizationKeysAppWuy
                                        .wuySendRequestRelation
                                        .tr(context),
                                    style: ThemeTextStyles.caption2.copyWith(
                                      fontSize: 12, // text-xs
                                      fontWeight: FontWeight.bold, // font-bold
                                      color: ThemeColors.grey500, // text-slate-500
                                      letterSpacing: 0.5, // uppercase
                                    ),
                                  ),
                                  const SizedBox(height: 4), // mb-1
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 16, vertical: 12),
                                    decoration: BoxDecoration(
                                      color: ThemeColors.white.withOpacity(0.5),
                                      borderRadius: BorderRadius.circular(12), // rounded-xl
                                      border: Border.all(
                                        color: ThemeColors.white.withOpacity(0.6),
                                        width: 1,
                                      ),
                                    ),
                                    child: DropdownButton<String>(
                                      value: _selectedRelation,
                                      isExpanded: true,
                                      underline: Container(),
                                      style: ThemeTextStyles.bodyMedium.copyWith(
                                        color: isDarkMode
                                            ? ThemeColors.white
                                            : ThemeColors.black,
                                      ),
                                      items: _relationOptions.map((option) {
                                        String label;
                                        switch (option) {
                                          case 'Family':
                                            label = LocalizationKeysAppWuy
                                                .wuySendRequestRelationFamily
                                                .tr(context);
                                            break;
                                          case 'Partner':
                                            label = LocalizationKeysAppWuy
                                                .wuySendRequestRelationPartner
                                                .tr(context);
                                            break;
                                          case 'Friend':
                                            label = LocalizationKeysAppWuy
                                                .wuySendRequestRelationFriend
                                                .tr(context);
                                            break;
                                          default:
                                            label = option;
                                        }
                                        return DropdownMenuItem<String>(
                                          value: option,
                                          child: Text(label),
                                        );
                                      }).toList(),
                                      onChanged: (value) {
                                        if (value != null) {
                                          setState(() {
                                            _selectedRelation = value;
                                          });
                                        }
                                      },
                                    ),
                                  ),
                                ],
                              ),

                              const SizedBox(height: 16), // pt-4

                              // Send Request button (matching React: Button)
                              Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(vertical: 14),
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      ThemeColors.blue, // from-blue-500
                                      ThemeColors.blue.withOpacity(0.8), // to-cyan-400 (using blue as fallback)
                                    ],
                                  ),
                                  borderRadius: BorderRadius.circular(12), // rounded-xl
                                  boxShadow: [
                                    BoxShadow(
                                      color: ThemeColors.blue.withOpacity(0.3),
                                      blurRadius: 8,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Text(
                                  LocalizationKeysAppWuy.wuySendRequestSend
                                      .tr(context),
                                  style: ThemeTextStyles.title3Bold.copyWith(
                                    color: ThemeColors.white,
                                    fontWeight: FontWeight.bold, // font-bold
                                    letterSpacing: 0.5, // tracking-wide
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFormField(
    BuildContext context, {
    required String label,
    required TextEditingController controller,
    required bool isDarkMode,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Label (matching React: text-xs font-bold text-slate-500 uppercase ml-1 mb-1 block)
        Text(
          label,
          style: ThemeTextStyles.caption2.copyWith(
            fontSize: 12, // text-xs
            fontWeight: FontWeight.bold, // font-bold
            color: ThemeColors.grey500, // text-slate-500
            letterSpacing: 0.5, // uppercase
          ),
        ),
        const SizedBox(height: 4), // mb-1
        // Input (matching React: Input)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: ThemeColors.white.withOpacity(0.5),
            borderRadius: BorderRadius.circular(12), // rounded-xl
            border: Border.all(
              color: ThemeColors.white.withOpacity(0.6),
              width: 1,
            ),
          ),
          child: TextField(
            controller: controller,
            style: ThemeTextStyles.bodyMedium.copyWith(
              color: isDarkMode ? ThemeColors.white : ThemeColors.black,
            ),
            decoration: InputDecoration(
              border: InputBorder.none,
              isDense: true,
            ),
          ),
        ),
      ],
    );
  }
}

