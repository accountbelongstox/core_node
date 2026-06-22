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
import '../../../models_app_wuy/friend_model_app_wuy.dart';
import '../../../services_app_wuy/wuy_fake_data_generator.dart';
import '../../../config_app_wuy/storage_app_wuy.dart';

// Exact Tailwind CSS color values
class _TailwindColors {
  static const Color blue100 = Color(0xFFDBEAFE); // bg-blue-100
  static const Color blue300 = Color(0xFF93C5FD); // text-blue-300
  static const Color blue500 = Color(0xFF3B82F6); // text-blue-500
  static const Color orange400 = Color(0xFFFB923C); // text-orange-400
  static const Color red400 = Color(0xFFF87171); // text-red-400
  static const Color purple100 = Color(0xFFF3E8FF); // bg-purple-100
  static const Color purple600 = Color(0xFF9333EA); // text-purple-600
  static const Color orange100 = Color(0xFFFED7AA); // bg-orange-100
  static const Color orange600 = Color(0xFFEA580C); // text-orange-600
  static const Color slate400 = Color(0xFF94A3B8); // text-slate-400
  static const Color slate500 = Color(0xFF64748B); // text-slate-500
  static const Color slate600 = Color(0xFF475569); // text-slate-600
  static const Color slate700 = Color(0xFF334155); // text-slate-700
}

/// Friend Detail Screen for Wuy App
///
/// 1:1 implementation matching React version FriendDetail.tsx
/// Features:
/// - MobileLayout with background gradient orbs
/// - Header with friend name and back button
/// - Map Preview card (clickable, links to history)
/// - Health Stats grid (3 columns: Steps, Heart, Temp)
/// - Device Report card (Network, Unlocks, Screen Time)
/// - Places card (horizontal scrollable list)
class WuyFriendInfoScreen extends StatefulWidget {
  final String friendId;

  const WuyFriendInfoScreen({
    super.key,
    required this.friendId,
  });

  @override
  State<WuyFriendInfoScreen> createState() => _WuyFriendInfoScreenState();
}

class _WuyFriendInfoScreenState extends State<WuyFriendInfoScreen> {
  FriendModelAppWuy? friend;

  @override
  void initState() {
    super.initState();
    _loadFriendData();
  }

  void _loadFriendData() {
    final friends = WuyFakeDataGenerator.generateFakeFriends();
    friend = friends.firstWhere(
      (f) => f.id == widget.friendId,
      orElse: () => friends.first,
    );
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    if (friend == null) {
      return Scaffold(
        body: Center(
          child: Text(
            LocalizationKeysAppWuy.wuyStatusNoData.tr(context),
          ),
        ),
      );
    }

    final storage = StorageAppWuy.instance;
    final isDarkMode = storage.isDarkMode();

    return Scaffold(
      backgroundColor: isDarkMode ? ThemeColors.grey900 : ThemeColors.grey50,
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
                // Header (matching React: Header title={friend.name} backTo="/friends")
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  child: Row(
                    children: [
                      // Back button
                      GestureDetector(
                        onTap: () => context.go(WuyAppRouter.getFriendsRoute()),
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
                          friend!.displayName,
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

                // Content (matching React: px-5 space-y-4 pb-10)
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 20, vertical: 16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Map Preview (matching React: Link to="/history")
                        GestureDetector(
                          onTap: () =>
                              context.go(WuyAppRouter.getHistoryTracksRoute()),
                          child: GlassCard(
                            padding: EdgeInsets.zero, // p-0
                            borderRadius:
                                BorderRadius.circular(16), // rounded-2xl
                            child: Container(
                              height: 160, // h-40 (160px)
                              decoration: BoxDecoration(
                                color: _TailwindColors.blue100, // bg-blue-100
                                borderRadius: BorderRadius.circular(16),
                              ),
                              child: Stack(
                                children: [
                                  // MAP VIEW text (matching React: text-blue-300 font-bold text-4xl opacity-20)
                                  Center(
                                    child: Text(
                                      'MAP VIEW',
                                      style:
                                          ThemeTextStyles.displayLarge.copyWith(
                                        fontSize: 36, // text-4xl
                                        fontWeight:
                                            FontWeight.bold, // font-bold
                                        color: _TailwindColors
                                            .blue300, // text-blue-300
                                        letterSpacing: 2,
                                      ),
                                    ),
                                  ),
                                  // Bottom info bar (matching React: bg-white/60 backdrop-blur-md)
                                  Positioned(
                                    bottom: 0,
                                    left: 0,
                                    right: 0,
                                    child: Container(
                                      padding: const EdgeInsets.all(12), // p-3
                                      decoration: BoxDecoration(
                                        color:
                                            ThemeColors.white.withOpacity(0.6),
                                        borderRadius: const BorderRadius.only(
                                          bottomLeft: Radius.circular(16),
                                          bottomRight: Radius.circular(16),
                                        ),
                                      ),
                                      child: ClipRect(
                                        child: BackdropFilter(
                                          filter: ImageFilter.blur(
                                              sigmaX: 10, sigmaY: 10),
                                          child: Row(
                                            mainAxisAlignment:
                                                MainAxisAlignment.spaceBetween,
                                            children: [
                                              // Location (matching React: text-xs font-bold text-slate-700)
                                              Row(
                                                children: [
                                                  Icon(
                                                    Icons.location_on,
                                                    size: 12,
                                                    color: _TailwindColors
                                                        .blue500, // text-blue-500
                                                  ),
                                                  const SizedBox(
                                                      width: 4), // gap-1
                                                  Text(
                                                    friend!.lastLocation?[
                                                            'address'] ??
                                                        '',
                                                    style: ThemeTextStyles
                                                        .caption2
                                                        .copyWith(
                                                      fontSize: 12, // text-xs
                                                      fontWeight: FontWeight
                                                          .bold, // font-bold
                                                      color: _TailwindColors
                                                          .slate700, // text-slate-700
                                                    ),
                                                  ),
                                                ],
                                              ),
                                              // Updated time (matching React: text-[10px] text-slate-500)
                                              Text(
                                                '${LocalizationKeysAppWuy.wuyStatsUpdated.tr(context)}: 1 ${LocalizationKeysAppWuy.wuyTimeMinutesAgo.tr(context)}',
                                                style: ThemeTextStyles.caption2
                                                    .copyWith(
                                                  fontSize: 10, // text-[10px]
                                                  color: _TailwindColors
                                                      .slate500, // text-slate-500
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 16), // space-y-4

                        // Health Stats (matching React: grid grid-cols-3 gap-3)
                        Row(
                          children: [
                            // Steps card
                            Expanded(
                              child: _buildHealthStatCard(
                                context,
                                icon: Icons.directions_walk,
                                iconColor: _TailwindColors
                                    .orange400, // text-orange-400
                                value: '${friend!.healthData?['steps'] ?? 0}',
                                label: LocalizationKeysAppWuy.wuyStatsSteps
                                    .tr(context),
                                isDarkMode: isDarkMode,
                              ),
                            ),
                            const SizedBox(width: 12), // gap-3
                            // Heart card
                            Expanded(
                              child: _buildHealthStatCard(
                                context,
                                icon: Icons.favorite,
                                iconColor:
                                    _TailwindColors.red400, // text-red-400
                                value:
                                    '${friend!.healthData?['heartRate'] ?? 0}',
                                suffix: ' bpm',
                                label: LocalizationKeysAppWuy.wuyStatsHeart
                                    .tr(context),
                                isDarkMode: isDarkMode,
                              ),
                            ),
                            const SizedBox(width: 12), // gap-3
                            // Temp card
                            Expanded(
                              child: _buildHealthStatCard(
                                context,
                                icon: Icons.thermostat,
                                iconColor: ThemeColors.blue, // text-blue-400
                                value: '${friend!.healthData?['temp'] ?? 0}',
                                suffix: '°C',
                                label: LocalizationKeysAppWuy.wuyStatsTemp
                                    .tr(context),
                                isDarkMode: isDarkMode,
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 16), // space-y-4

                        // Device Report (matching React: GlassCard)
                        GlassCard(
                          padding: const EdgeInsets.all(16), // p-4
                          borderRadius:
                              BorderRadius.circular(16), // rounded-2xl
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Title (matching React: text-sm font-bold uppercase text-slate-400 mb-4)
                              Text(
                                LocalizationKeysAppWuy.wuyStatsDevice
                                    .tr(context),
                                style: ThemeTextStyles.bodyMedium.copyWith(
                                  fontSize: 14, // text-sm
                                  fontWeight: FontWeight.bold, // font-bold
                                  color: _TailwindColors
                                      .slate400, // text-slate-400
                                  letterSpacing: 0.5, // uppercase
                                ),
                              ),
                              const SizedBox(height: 16), // mb-4
                              // Device items (matching React: space-y-4)
                              _buildDeviceItem(
                                context,
                                icon: Icons.wifi,
                                iconBgColor:
                                    _TailwindColors.blue100, // bg-blue-100
                                iconColor:
                                    _TailwindColors.blue500, // text-blue-600
                                label: LocalizationKeysAppWuy.wuyStatsNetwork
                                    .tr(context),
                                value: friend!.phoneReport?['network'] ?? 'N/A',
                                isDarkMode: isDarkMode,
                                showBorder: true,
                              ),
                              const SizedBox(height: 16), // space-y-4
                              _buildDeviceItem(
                                context,
                                icon: Icons.smartphone,
                                iconBgColor:
                                    _TailwindColors.purple100, // bg-purple-100
                                iconColor: _TailwindColors
                                    .purple600, // text-purple-600
                                label: LocalizationKeysAppWuy.wuyStatsUnlocks
                                    .tr(context),
                                value:
                                    '${friend!.phoneReport?['unlocks'] ?? 0} ${LocalizationKeysAppWuy.wuyStatsTimes.tr(context)}',
                                isDarkMode: isDarkMode,
                                showBorder: true,
                              ),
                              const SizedBox(height: 16), // space-y-4
                              _buildDeviceItem(
                                context,
                                icon: Icons.access_time,
                                iconBgColor:
                                    _TailwindColors.orange100, // bg-orange-100
                                iconColor: _TailwindColors
                                    .orange600, // text-orange-600
                                label: LocalizationKeysAppWuy.wuyStatsScreenTime
                                    .tr(context),
                                value:
                                    friend!.phoneReport?['usageTime'] ?? 'N/A',
                                isDarkMode: isDarkMode,
                                showBorder: false,
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 16), // space-y-4

                        // Places (matching React: GlassCard)
                        GlassCard(
                          padding: const EdgeInsets.all(16), // p-4
                          borderRadius:
                              BorderRadius.circular(16), // rounded-2xl
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // Title (matching React: text-sm font-bold uppercase text-slate-400 mb-4)
                              Text(
                                LocalizationKeysAppWuy.wuyStatsPlaces
                                    .tr(context),
                                style: ThemeTextStyles.bodyMedium.copyWith(
                                  fontSize: 14, // text-sm
                                  fontWeight: FontWeight.bold, // font-bold
                                  color: _TailwindColors
                                      .slate400, // text-slate-400
                                  letterSpacing: 0.5, // uppercase
                                ),
                              ),
                              const SizedBox(height: 16), // mb-4
                              // Places list (matching React: flex gap-4 overflow-x-auto)
                              SizedBox(
                                height: 80, // h-[80px]
                                child: ListView.builder(
                                  scrollDirection: Axis.horizontal,
                                  itemCount: 3,
                                  itemBuilder: (context, index) {
                                    return Container(
                                      margin: EdgeInsets.only(
                                          right: index < 2 ? 16 : 0), // gap-4
                                      width: 100, // min-w-[100px]
                                      decoration: BoxDecoration(
                                        color: ThemeColors.white
                                            .withOpacity(0.5), // bg-white/50
                                        borderRadius: BorderRadius.circular(
                                            12), // rounded-xl
                                        border: Border.all(
                                          color: ThemeColors.white.withOpacity(
                                              0.4), // border-white/40
                                          width: 1,
                                        ),
                                      ),
                                      child: Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(
                                            Icons.location_on,
                                            size: 16,
                                            color: _TailwindColors
                                                .blue500, // text-blue-500
                                          ),
                                          const SizedBox(height: 4), // mb-1
                                          Text(
                                            'Central Park',
                                            style: ThemeTextStyles.caption2
                                                .copyWith(
                                              fontSize: 12, // text-xs
                                              fontWeight:
                                                  FontWeight.bold, // font-bold
                                              color: isDarkMode
                                                  ? ThemeColors.white
                                                  : ThemeColors.black,
                                            ),
                                            textAlign: TextAlign.center,
                                          ),
                                          const SizedBox(height: 4), // mt-1
                                          Text(
                                            '2h 30m',
                                            style: ThemeTextStyles.caption2
                                                .copyWith(
                                              fontSize: 10, // text-[10px]
                                              color: _TailwindColors
                                                  .slate400, // text-slate-400
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 40), // pb-10
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

  Widget _buildHealthStatCard(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String value,
    String? suffix,
    required String label,
    required bool isDarkMode,
  }) {
    return GlassCard(
      padding: const EdgeInsets.all(12), // p-3
      borderRadius: BorderRadius.circular(16), // rounded-2xl
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            icon,
            size: 24,
            color: iconColor,
          ),
          const SizedBox(height: 8), // gap-2
          // Value (matching React: font-bold text-lg text-slate-700)
          RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: value,
                  style: ThemeTextStyles.title3Bold.copyWith(
                    fontSize: 18, // text-lg
                    fontWeight: FontWeight.bold, // font-bold
                    color: isDarkMode
                        ? ThemeColors.white
                        : _TailwindColors.slate700, // text-slate-700
                  ),
                ),
                if (suffix != null)
                  TextSpan(
                    text: suffix,
                    style: ThemeTextStyles.caption2.copyWith(
                      fontSize: 12, // text-xs
                      color: isDarkMode
                          ? ThemeColors.white
                          : _TailwindColors.slate700,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: 4), // gap-2
          // Label (matching React: text-[10px] text-slate-400 uppercase)
          Text(
            label,
            style: ThemeTextStyles.caption2.copyWith(
              fontSize: 10, // text-[10px]
              color: _TailwindColors.slate400, // text-slate-400
              letterSpacing: 0.5, // uppercase
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDeviceItem(
    BuildContext context, {
    required IconData icon,
    required Color iconBgColor,
    required Color iconColor,
    required String label,
    required String value,
    required bool isDarkMode,
    required bool showBorder,
  }) {
    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            // Left side (matching React: flex items-center gap-3)
            Row(
              children: [
                // Icon container (matching React: p-2 bg-blue-100 text-blue-600 rounded-lg)
                Container(
                  padding: const EdgeInsets.all(8), // p-2
                  decoration: BoxDecoration(
                    color: iconBgColor,
                    borderRadius: BorderRadius.circular(8), // rounded-lg
                  ),
                  child: Icon(
                    icon,
                    size: 18,
                    color: iconColor,
                  ),
                ),
                const SizedBox(width: 12), // gap-3
                // Label (matching React: font-medium)
                Text(
                  label,
                  style: ThemeTextStyles.bodyMedium.copyWith(
                    fontWeight: FontWeight.w500, // font-medium
                    color: isDarkMode ? ThemeColors.white : ThemeColors.black,
                  ),
                ),
              ],
            ),
            // Right side (matching React: font-bold text-slate-600)
            Text(
              value,
              style: ThemeTextStyles.bodyMedium.copyWith(
                fontWeight: FontWeight.bold, // font-bold
                color: isDarkMode
                    ? ThemeColors.white
                    : _TailwindColors.slate600, // text-slate-600
              ),
            ),
          ],
        ),
        if (showBorder)
          Container(
            margin: const EdgeInsets.only(top: 12), // pb-3
            decoration: BoxDecoration(
              border: Border(
                bottom: BorderSide(
                  color: isDarkMode
                      ? ThemeColors.white.withOpacity(0.1)
                      : ThemeColors.black.withOpacity(0.05), // border-black/5
                  width: 1,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
