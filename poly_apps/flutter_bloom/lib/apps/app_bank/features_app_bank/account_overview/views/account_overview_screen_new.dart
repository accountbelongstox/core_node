// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\..\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/widgets/bank_scaffold.dart';
import '../../../config_app_bank/constants.dart';
import '../../../providers_app_bank/bank_user_provider.dart';
import '../../../config_app_bank/theme_config_app_bank.dart';
import '../../../resources_app_bank/assets_images_app_bank.dart';

class AccountOverviewScreenNew extends StatefulWidget {
  const AccountOverviewScreenNew({super.key});

  @override
  State<AccountOverviewScreenNew> createState() =>
      _AccountOverviewScreenNewState();
}

class _AccountOverviewScreenNewState extends State<AccountOverviewScreenNew>
    with TickerProviderStateMixin {
  late TabController _tabController;
  late TabController _bankCardSubTabController;
  List<TabController> _solutionTabControllers = [];
  bool _isBalanceVisible = true;
  bool _isCardBalanceVisible = true;

  String _formatAmount(double amount) {
    return amount.toStringAsFixed(2);
  }

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _bankCardSubTabController = TabController(length: 3, vsync: this);
    _solutionTabControllers = List.generate(
      20,
      (index) => TabController(length: 2, vsync: this),
    );
  }

  @override
  void dispose() {
    _tabController.dispose();
    _bankCardSubTabController.dispose();
    for (var controller in _solutionTabControllers) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final isAuthenticated = provider.isAuthenticated;

        if (!isAuthenticated) {
          WidgetsBinding.instance.addPostFrameCallback((_) {
            context.push(BankConstants.routeAuthentication);
          });
          return BankScaffold(
            currentBottomNavIndex: 4,
            backgroundColor: BankColorProvider.scaffoldBackground,
            body: const Center(
              child: CircularProgressIndicator(),
            ),
          );
        }

        final tabBarHeight = 48.0;

        return BankScaffold(
          currentBottomNavIndex: 4,
          backgroundColor: Colors.white,
          body: Consumer<BankUserProvider>(
            builder: (context, provider, child) {
              return TabBarView(
                controller: _tabController,
                children: [
                  _buildWealthPanoramaTab(context, provider.totalAssets),
                  _buildBankCardTab(context),
                ],
              );
            },
          ),
        );
      },
    );
  }

  Widget _buildAppBarWithTab(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final contentHeight = 60.0;
    final tabBarHeight = 48.0;
    final totalHeight = topPadding + contentHeight + tabBarHeight + 24.0;

    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        return SizedBox(
          height: totalHeight,
          child: Stack(
            children: [
              Positioned.fill(
                child: Container(
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [Color(0xFF4A90E2), Color(0xFF357ABD)],
                    ),
                  ),
                  child: Image.asset(
                    BankImages.accountOverviewWealthPanoramaBg,
                    fit: BoxFit.cover,
                    alignment: Alignment.topCenter,
                    errorBuilder: (context, error, stackTrace) {
                      return const SizedBox.shrink();
                    },
                  ),
                ),
              ),
              Positioned(
                left: 0,
                right: 0,
                top: 0,
                child: SafeArea(
                  bottom: false,
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.arrow_back,
                                  color: Colors.white),
                              onPressed: () => context.go(
                                  '${BankConstants.routeProfile}?view=original'),
                            ),
                            const Expanded(
                              child: Text(
                                '账户总览',
                                style: TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w600,
                                  color: Colors.white,
                                ),
                                textAlign: TextAlign.center,
                              ),
                            ),
                            IconButton(
                              icon: const Icon(Icons.message,
                                  color: Colors.white),
                              onPressed: () {},
                            ),
                            IconButton(
                              icon: const Icon(Icons.add, color: Colors.white),
                              onPressed: () {},
                            ),
                          ],
                        ),
                      ),
                      SizedBox(
                        height: tabBarHeight,
                        child: _buildCustomTransparentTabBar(),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildMyAssetCardContent(BuildContext context, double totalAssets) {
    return Container(
      margin: const EdgeInsets.only(left: 16, right: 16, bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF5273DA),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color(0xFF567CDA),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '我的资产',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              Row(
                children: [
                  const Icon(Icons.swap_horiz, color: Colors.white, size: 20),
                  const SizedBox(width: 4),
                  const Text(
                    '总负债',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        '总资产(元)',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white70,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.info_outline,
                          color: Colors.white70, size: 16),
                    ],
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _isBalanceVisible = !_isBalanceVisible;
                      });
                    },
                    child: Text(
                      _isBalanceVisible ? _formatAmount(totalAssets) : '****',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontFamily: 'monospace',
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    children: [
                      const Text(
                        '昨日收益(元)',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white70,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.info_outline,
                          color: Colors.white70, size: 16),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '--',
                    style: TextStyle(
                      fontSize: 18,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          Center(
            child: GestureDetector(
              onTap: () {
                // Show asset view options
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    '资产视图',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.keyboard_arrow_down,
                      color: Colors.white, size: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAppBar(BuildContext context) {
    final topPadding = MediaQuery.of(context).padding.top;
    final contentHeight = 60.0;
    final totalHeight = topPadding + contentHeight + 24.0;

    return SizedBox(
      height: totalHeight,
      child: Stack(
        children: [
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [Color(0xFF4A90E2), Color(0xFF357ABD)],
                ),
              ),
              child: Image.asset(
                BankImages.accountOverviewWealthPanoramaBg,
                fit: BoxFit.cover,
                alignment: Alignment.topCenter,
                errorBuilder: (context, error, stackTrace) {
                  return const SizedBox.shrink();
                },
              ),
            ),
          ),
          Positioned(
            left: 0,
            right: 0,
            top: 0,
            child: SafeArea(
              bottom: false,
              child: Container(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.transparent,
                      const Color(0xFF4A90E2).withOpacity(0.1),
                    ],
                  ),
                ),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      IconButton(
                        icon: const Icon(Icons.arrow_back, color: Colors.white),
                        onPressed: () => context
                            .go('${BankConstants.routeProfile}?view=original'),
                      ),
                      const Expanded(
                        child: Text(
                          '账户总览',
                          style: TextStyle(
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                          textAlign: TextAlign.center,
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.message, color: Colors.white),
                        onPressed: () {},
                      ),
                      IconButton(
                        icon: const Icon(Icons.add, color: Colors.white),
                        onPressed: () {},
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCustomTransparentTabBar() {
    return AnimatedBuilder(
      animation: _tabController,
      builder: (context, child) {
        return Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Row(
            children: [
              Expanded(
                flex: 1,
                child: Theme(
                  data: Theme.of(context).copyWith(
                    useMaterial3: false,
                    tabBarTheme: const TabBarThemeData(
                      labelColor: Colors.white,
                      unselectedLabelColor: Color(0xFF80A1ED),
                      indicatorColor: Colors.white,
                      dividerColor: Colors.transparent,
                      overlayColor: WidgetStatePropertyAll(Colors.transparent),
                      splashFactory: NoSplash.splashFactory,
                      labelStyle: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                      unselectedLabelStyle: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    highlightColor: Colors.transparent,
                    splashColor: Colors.transparent,
                    splashFactory: NoSplash.splashFactory,
                  ),
                  child: Material(
                    color: Colors.transparent,
                    type: MaterialType.transparency,
                    elevation: 0,
                    child: TabBar(
                      controller: _tabController,
                      isScrollable: true,
                      labelColor: Colors.white,
                      unselectedLabelColor: const Color(0xFF80A1ED),
                      indicator: UnderlineTabIndicator(
                        borderSide: const BorderSide(
                          color: Colors.white,
                          width: 3,
                        ),
                        insets: const EdgeInsets.only(
                            left: 16, right: 16, bottom: 0),
                      ),
                      indicatorSize: TabBarIndicatorSize.tab,
                      dividerColor: Colors.transparent,
                      overlayColor:
                          const WidgetStatePropertyAll(Colors.transparent),
                      splashFactory: NoSplash.splashFactory,
                      labelStyle: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                      unselectedLabelStyle: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                      tabAlignment: TabAlignment.start,
                      padding: EdgeInsets.zero,
                      labelPadding: const EdgeInsets.symmetric(horizontal: 12),
                      tabs: const [
                        Tab(text: '财富全景'),
                        Tab(text: '银行卡'),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              if (_tabController.index == 0)
                GestureDetector(
                  onTap: () {
                    // Handle eye icon tap
                  },
                  child: const Icon(
                    Icons.visibility,
                    color: Colors.white,
                    size: 24,
                  ),
                )
              else
                GestureDetector(
                  onTap: () {
                    // Handle manage button tap
                  },
                  child: const Text(
                    '管理',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildTabBarSolution(int solutionNumber) {
    if (solutionNumber < 1 || solutionNumber > 20) {
      return const SizedBox.shrink();
    }

    switch (solutionNumber) {
      case 1:
        return _buildTabBarSolution1();
      case 2:
        return _buildTabBarSolution2();
      case 3:
        return _buildTabBarSolution3();
      case 4:
        return _buildTabBarSolution4();
      case 5:
        return _buildTabBarSolution5();
      case 6:
        return _buildTabBarSolution6();
      case 7:
        return _buildTabBarSolution7();
      case 8:
        return _buildTabBarSolution8();
      case 9:
        return _buildTabBarSolution9();
      case 10:
        return _buildTabBarSolution10();
      case 11:
        return _buildTabBarSolution11();
      case 12:
        return _buildTabBarSolution12();
      case 13:
        return _buildTabBarSolution13();
      case 14:
        return _buildTabBarSolution14();
      case 15:
        return _buildTabBarSolution15();
      case 16:
        return _buildTabBarSolution16();
      case 17:
        return _buildTabBarSolution17();
      case 18:
        return _buildTabBarSolution18();
      case 19:
        return _buildTabBarSolution19();
      case 20:
        return _buildTabBarSolution20();
      default:
        return _buildTabBarSolution1();
    }
  }

  TabController _getSolutionController(int index) {
    if (index < 0 || index >= 20) {
      return _tabController;
    }
    if (_solutionTabControllers.isEmpty ||
        index >= _solutionTabControllers.length) {
      return _tabController;
    }
    return _solutionTabControllers[index];
  }

  // 方案1: Material 2 + 透明Material包装
  Widget _buildTabBarSolution1() {
    return Theme(
      data: Theme.of(context).copyWith(useMaterial3: false),
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        elevation: 0,
        child: TabBar(
          controller: _getSolutionController(0),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案2: 禁用Material 3 + 设置所有surface颜色为透明
  Widget _buildTabBarSolution2() {
    return Theme(
      data: Theme.of(context).copyWith(
        useMaterial3: false,
        colorScheme: Theme.of(context).colorScheme.copyWith(
              surface: Colors.transparent,
              surfaceContainerHighest: Colors.transparent,
              surfaceContainerHigh: Colors.transparent,
              surfaceContainer: Colors.transparent,
              surfaceContainerLow: Colors.transparent,
              surfaceContainerLowest: Colors.transparent,
              surfaceTint: Colors.transparent,
            ),
      ),
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        elevation: 0,
        child: TabBar(
          controller: _getSolutionController(1),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案3: TabBarThemeData + 移除所有交互效果
  Widget _buildTabBarSolution3() {
    return Theme(
      data: Theme.of(context).copyWith(
        useMaterial3: false,
        tabBarTheme: const TabBarThemeData(
          overlayColor: WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          dividerColor: Colors.transparent,
          labelColor: Colors.white,
          unselectedLabelColor: Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          labelStyle: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
        ),
        highlightColor: Colors.transparent,
        splashColor: Colors.transparent,
        splashFactory: NoSplash.splashFactory,
      ),
      child: TabBar(
        controller: _getSolutionController(2),
        indicatorWeight: 3,
        tabs: const [
          Tab(text: '财富全景'),
          Tab(text: '银行卡'),
        ],
      ),
    );
  }

  // 方案4: DecoratedBox替代Container
  Widget _buildTabBarSolution4() {
    return DecoratedBox(
      decoration: const BoxDecoration(color: Colors.transparent),
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(3),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案5: Opacity强制透明
  Widget _buildTabBarSolution5() {
    return Opacity(
      opacity: 1.0,
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(4),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案6: BackdropFilter (毛玻璃效果，但设置完全透明)
  Widget _buildTabBarSolution6() {
    return BackdropFilter(
      filter: ImageFilter.blur(sigmaX: 0, sigmaY: 0),
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(5),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案7: ClipRect裁剪
  Widget _buildTabBarSolution7() {
    return ClipRect(
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(6),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案8: RepaintBoundary隔离重绘
  Widget _buildTabBarSolution8() {
    return RepaintBoundary(
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(7),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案9: Builder确保正确的Context
  Widget _buildTabBarSolution9() {
    return Builder(
      builder: (BuildContext context) {
        return Theme(
          data: Theme.of(context).copyWith(useMaterial3: false),
          child: Material(
            color: Colors.transparent,
            type: MaterialType.transparency,
            child: TabBar(
              controller: _getSolutionController(8),
              labelColor: Colors.white,
              unselectedLabelColor: const Color(0xFF80A1ED),
              indicatorColor: Colors.white,
              indicatorWeight: 3,
              dividerColor: Colors.transparent,
              overlayColor: const WidgetStatePropertyAll(Colors.transparent),
              splashFactory: NoSplash.splashFactory,
              labelStyle: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
              ),
              unselectedLabelStyle: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.normal,
              ),
              tabs: const [
                Tab(text: '财富全景'),
                Tab(text: '银行卡'),
              ],
            ),
          ),
        );
      },
    );
  }

  // 方案10: ColoredBox强制颜色
  Widget _buildTabBarSolution10() {
    return ColoredBox(
      color: Colors.transparent,
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(9),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案11: Container + 透明decoration
  Widget _buildTabBarSolution11() {
    return Container(
      decoration: const BoxDecoration(color: Colors.transparent),
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(10),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案12: FittedBox适配
  Widget _buildTabBarSolution12() {
    return FittedBox(
      fit: BoxFit.none,
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(11),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案13: Transform.scale
  Widget _buildTabBarSolution13() {
    return Transform.scale(
      scale: 1.0,
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(12),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案14: AnimatedBuilder
  Widget _buildTabBarSolution14() {
    return AnimatedBuilder(
      animation: _getSolutionController(13).animation!,
      builder: (context, child) {
        return Material(
          color: Colors.transparent,
          type: MaterialType.transparency,
          child: TabBar(
            controller: _getSolutionController(13),
            labelColor: Colors.white,
            unselectedLabelColor: const Color(0xFF80A1ED),
            indicatorColor: Colors.white,
            indicatorWeight: 3,
            dividerColor: Colors.transparent,
            overlayColor: const WidgetStatePropertyAll(Colors.transparent),
            splashFactory: NoSplash.splashFactory,
            labelStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.normal,
            ),
            tabs: const [
              Tab(text: '财富全景'),
              Tab(text: '银行卡'),
            ],
          ),
        );
      },
    );
  }

  // 方案15: LayoutBuilder响应式布局
  Widget _buildTabBarSolution15() {
    return LayoutBuilder(
      builder: (context, constraints) {
        return Material(
          color: Colors.transparent,
          type: MaterialType.transparency,
          child: TabBar(
            controller: _getSolutionController(14),
            labelColor: Colors.white,
            unselectedLabelColor: const Color(0xFF80A1ED),
            indicatorColor: Colors.white,
            indicatorWeight: 3,
            dividerColor: Colors.transparent,
            overlayColor: const WidgetStatePropertyAll(Colors.transparent),
            splashFactory: NoSplash.splashFactory,
            labelStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.normal,
            ),
            tabs: const [
              Tab(text: '财富全景'),
              Tab(text: '银行卡'),
            ],
          ),
        );
      },
    );
  }

  // 方案16: 多层Material包装
  Widget _buildTabBarSolution16() {
    return Material(
      color: Colors.transparent,
      type: MaterialType.transparency,
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(15),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案17: Theme + Material + Container组合
  Widget _buildTabBarSolution17() {
    return Theme(
      data: Theme.of(context).copyWith(useMaterial3: false),
      child: Container(
        color: Colors.transparent,
        child: Material(
          color: Colors.transparent,
          type: MaterialType.transparency,
          child: TabBar(
            controller: _getSolutionController(16),
            labelColor: Colors.white,
            unselectedLabelColor: const Color(0xFF80A1ED),
            indicatorColor: Colors.white,
            indicatorWeight: 3,
            dividerColor: Colors.transparent,
            overlayColor: const WidgetStatePropertyAll(Colors.transparent),
            splashFactory: NoSplash.splashFactory,
            labelStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
            unselectedLabelStyle: const TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.normal,
            ),
            tabs: const [
              Tab(text: '财富全景'),
              Tab(text: '银行卡'),
            ],
          ),
        ),
      ),
    );
  }

  // 方案18: 完全自定义TabBar实现
  Widget _buildTabBarSolution18() {
    final controller = _getSolutionController(17);
    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        return Row(
          children: [
            Expanded(
              child: GestureDetector(
                onTap: () => controller.animateTo(0),
                child: Container(
                  color: Colors.transparent,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '财富全景',
                        style: TextStyle(
                          color: controller.index == 0
                              ? Colors.white
                              : const Color(0xFF80A1ED),
                          fontSize: 16,
                          fontWeight: controller.index == 0
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                      ),
                      if (controller.index == 0)
                        Container(
                          height: 3,
                          color: Colors.white,
                          margin: const EdgeInsets.only(top: 4),
                        ),
                    ],
                  ),
                ),
              ),
            ),
            Expanded(
              child: GestureDetector(
                onTap: () => controller.animateTo(1),
                child: Container(
                  color: Colors.transparent,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        '银行卡',
                        style: TextStyle(
                          color: controller.index == 1
                              ? Colors.white
                              : const Color(0xFF80A1ED),
                          fontSize: 16,
                          fontWeight: controller.index == 1
                              ? FontWeight.bold
                              : FontWeight.normal,
                        ),
                      ),
                      if (controller.index == 1)
                        Container(
                          height: 3,
                          color: Colors.white,
                          margin: const EdgeInsets.only(top: 4),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  // 方案19: 使用IgnorePointer + Material透明
  Widget _buildTabBarSolution19() {
    return IgnorePointer(
      ignoring: false,
      child: Material(
        color: Colors.transparent,
        type: MaterialType.transparency,
        child: TabBar(
          controller: _getSolutionController(18),
          labelColor: Colors.white,
          unselectedLabelColor: const Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          indicatorWeight: 3,
          dividerColor: Colors.transparent,
          overlayColor: const WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
          labelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          unselectedLabelStyle: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.normal,
          ),
          tabs: const [
            Tab(text: '财富全景'),
            Tab(text: '银行卡'),
          ],
        ),
      ),
    );
  }

  // 方案20: 最简化方案 - 直接TabBar + Theme
  Widget _buildTabBarSolution20() {
    return Theme(
      data: Theme.of(context).copyWith(
        useMaterial3: false,
        tabBarTheme: const TabBarThemeData(
          labelColor: Colors.white,
          unselectedLabelColor: Color(0xFF80A1ED),
          indicatorColor: Colors.white,
          dividerColor: Colors.transparent,
          overlayColor: WidgetStatePropertyAll(Colors.transparent),
          splashFactory: NoSplash.splashFactory,
        ),
      ),
      child: TabBar(
        controller: _getSolutionController(19),
        indicatorWeight: 3,
        tabs: const [
          Tab(text: '财富全景'),
          Tab(text: '银行卡'),
        ],
      ),
    );
  }

  Widget _buildTransparentTab(String text) {
    return Tab(
      text: text,
    );
  }

  Widget _buildTabContentSolution(int solutionNumber) {
    return Container(
      constraints: const BoxConstraints(
        minHeight: 200,
      ),
      color: BankColorProvider.scaffoldBackground,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Row(
              children: [
                Icon(Icons.account_balance_wallet,
                    size: 16, color: Color(0xFF4A90E2)),
                SizedBox(width: 8),
                Text(
                  '财富全景',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF4A90E2),
                  ),
                ),
              ],
            ),
          ),
          _buildWealthPanoramaTabContent(context),
          const SizedBox(height: 16),
          Container(
            margin: const EdgeInsets.only(bottom: 8),
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.blue.shade50,
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Row(
              children: [
                Icon(Icons.credit_card, size: 16, color: Color(0xFF4A90E2)),
                SizedBox(width: 8),
                Text(
                  '银行卡',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF4A90E2),
                  ),
                ),
              ],
            ),
          ),
          _buildBankCardTabContent(context),
        ],
      ),
    );
  }

  Widget _buildWealthPanoramaTabContent(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final totalAssets = provider.totalAssets;
        final currentBalance = provider.currentBalance;
        final holdingsTotal = provider.holdingsTotal;

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              _buildInfoRow('总资产', _formatAmount(totalAssets)),
              const SizedBox(height: 8),
              _buildInfoRow('活期余额', _formatAmount(currentBalance)),
              const SizedBox(height: 8),
              _buildInfoRow('持仓总额', _formatAmount(holdingsTotal)),
            ],
          ),
        );
      },
    );
  }

  Widget _buildInfoRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontSize: 14,
            color: Colors.grey,
          ),
        ),
        Text(
          value,
          style: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            fontFamily: 'monospace',
          ),
          overflow: TextOverflow.ellipsis,
        ),
      ],
    );
  }

  Widget _buildBankCardTabContent(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final bankCards = provider.bankCards;

        return Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: Colors.grey.shade200),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                '银行卡数量: ${bankCards.length}',
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (bankCards.isEmpty) ...[
                const SizedBox(height: 8),
                const Text(
                  '暂无银行卡',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.grey,
                  ),
                ),
              ] else ...[
                const SizedBox(height: 8),
                ...bankCards.take(3).map((card) => Container(
                      margin: const EdgeInsets.only(bottom: 6),
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.credit_card,
                              size: 16, color: Color(0xFF4A90E2)),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  card.cardType,
                                  style: const TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                  ),
                                ),
                                Text(
                                  '余额: ${_formatAmount(card.balance)}',
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: Colors.grey,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    )),
              ],
            ],
          ),
        );
      },
    );
  }

  Widget _buildWealthPanoramaTab(BuildContext context, double totalAssets) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final currentBalance = provider.currentBalance;
        final holdingsTotal = provider.holdingsTotal;
        final screenHeight = MediaQuery.of(context).size.height;
        final topPadding = MediaQuery.of(context).padding.top;

        return SingleChildScrollView(
          child: Stack(
            children: [
              Positioned.fill(
                child: Container(
                  color: Colors.white,
                ),
              ),
              Positioned(
                top: -topPadding,
                left: 0,
                right: 0,
                bottom: null,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final screenWidth = constraints.maxWidth;
                    return Container(
                      width: screenWidth,
                      height: screenHeight * 3,
                      child: Image.asset(
                        BankImages.accountOverviewWealthPanoramaBg,
                        fit: BoxFit.fitWidth,
                        alignment: Alignment.topCenter,
                        width: double.infinity,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            width: screenWidth,
                            height: screenHeight * 3,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Color(0xFF4A90E2), Color(0xFF357ABD)],
                              ),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
              Column(
                children: [
                  _buildAppBarContent(context, totalAssets,
                      showAssetCard: true),
                  Container(
                    color: const Color(0xFFF6F6F6),
                    child: Column(
                      children: [
                        _buildQuickActionsAndBalanceSection(
                            context, currentBalance, holdingsTotal),
                        _buildCurrentAssetsSection(context, currentBalance),
                        _buildHoldingsSection(context, holdingsTotal),
                        _buildDepositSection(context),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildAppBarContent(BuildContext context, double totalAssets,
      {bool showAssetCard = true}) {
    final topPadding = MediaQuery.of(context).padding.top;
    final tabBarHeight = 48.0;

    return Container(
      padding: EdgeInsets.only(top: topPadding),
      decoration: const BoxDecoration(
        color: Colors.transparent,
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: Row(
              children: [
                IconButton(
                  icon: const Icon(Icons.arrow_back, color: Colors.white),
                  onPressed: () =>
                      context.go('${BankConstants.routeProfile}?view=original'),
                ),
                const Expanded(
                  child: Text(
                    '账户总览',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.message, color: Colors.white),
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.add, color: Colors.white),
                  onPressed: () {},
                ),
              ],
            ),
          ),
          SizedBox(
            height: tabBarHeight,
            child: _buildCustomTransparentTabBar(),
          ),
          if (showAssetCard) _buildMyAssetCardContent(context, totalAssets),
        ],
      ),
    );
  }

  Widget _buildBankCardTab(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final bankCards = provider.bankCards;
        final savingsCards = bankCards
            .where((card) =>
                card.cardType == '储蓄卡' ||
                card.cardType == '活期' ||
                card.cardType == 'current')
            .toList();
        final creditCards = bankCards
            .where(
                (card) => card.cardType == '信用卡' || card.cardType == 'credit')
            .toList();
        final screenHeight = MediaQuery.of(context).size.height;
        final topPadding = MediaQuery.of(context).padding.top;

        return SingleChildScrollView(
          child: Stack(
            children: [
              Positioned(
                top: -topPadding,
                left: 0,
                right: 0,
                bottom: null,
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final screenWidth = constraints.maxWidth;
                    return Container(
                      width: screenWidth,
                      height: screenHeight * 3,
                      child: Image.asset(
                        BankImages.accountOverviewWealthPanoramaBg,
                        fit: BoxFit.fitWidth,
                        alignment: Alignment.topCenter,
                        width: double.infinity,
                        errorBuilder: (context, error, stackTrace) {
                          return Container(
                            width: screenWidth,
                            height: screenHeight * 3,
                            decoration: BoxDecoration(
                              gradient: const LinearGradient(
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                                colors: [Color(0xFF4A90E2), Color(0xFF357ABD)],
                              ),
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),
              ),
              Column(
                children: [
                  _buildAppBarContent(context, provider.totalAssets,
                      showAssetCard: false),
                  Container(
                    width: double.infinity,
                    height: 32.0,
                    padding: EdgeInsets.zero,
                    margin: EdgeInsets.zero,
                    decoration: const BoxDecoration(
                      color: Color(0xFFF6F6F6),
                      borderRadius: BorderRadius.only(
                        topLeft: Radius.circular(16),
                        topRight: Radius.circular(16),
                      ),
                    ),
                    child: AnimatedBuilder(
                      animation: _bankCardSubTabController,
                      builder: (context, child) {
                        final selectedIndex = _bankCardSubTabController.index;
                        return Container(
                          width: double.infinity,
                          height: 32.0,
                          padding: EdgeInsets.zero,
                          margin: EdgeInsets.zero,
                          decoration: const BoxDecoration(
                            color: Color(0xFFF6F6F6),
                            borderRadius: BorderRadius.only(
                              topLeft: Radius.circular(16),
                              topRight: Radius.circular(16),
                            ),
                          ),
                          child: Stack(
                            children: [
                              // 背景层：100%宽度和高度
                              Positioned.fill(
                                child: Container(
                                  width: double.infinity,
                                  decoration: const BoxDecoration(
                                    color: Color(0xFFF6F6F6),
                                    borderRadius: BorderRadius.only(
                                      topLeft: Radius.circular(16),
                                      topRight: Radius.circular(16),
                                    ),
                                  ),
                                ),
                              ),
                              // 内容层：靠左对齐
                              Padding(
                                padding:
                                    const EdgeInsets.symmetric(horizontal: 16),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    _buildCustomTab(
                                      context,
                                      '储蓄卡',
                                      0,
                                      selectedIndex,
                                    ),
                                    const SizedBox(width: 8),
                                    _buildCustomTab(
                                      context,
                                      '信用卡',
                                      1,
                                      selectedIndex,
                                    ),
                                    const SizedBox(width: 8),
                                    _buildCustomTab(
                                      context,
                                      '全球视图',
                                      2,
                                      selectedIndex,
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  Container(
                    width: double.infinity,
                    color: const Color(0xFFF6F6F6),
                    child: AnimatedBuilder(
                      animation: _bankCardSubTabController,
                      builder: (context, child) {
                        final selectedIndex = _bankCardSubTabController.index;
                        if (selectedIndex == 0) {
                          return _buildSavingsCardView(context, savingsCards);
                        } else if (selectedIndex == 1) {
                          return _buildCreditCardView(context, creditCards);
                        } else {
                          return _buildGlobalView(context, bankCards);
                        }
                      },
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildCustomTab(
    BuildContext context,
    String label,
    int index,
    int selectedIndex,
  ) {
    final isSelected = index == selectedIndex;
    // Tab高度：32px (100%)
    const double tabHeight = 32.0;
    // 背景色高度：tab高度的60% = 32 * 0.6 = 19.2px
    const double backgroundHeight = 19.2;

    return GestureDetector(
      onTap: () {
        _bankCardSubTabController.animateTo(index);
      },
      child: SizedBox(
        height: tabHeight,
        child: Center(
          child: Container(
            height: backgroundHeight,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 0),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFFE4ECF7) : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
            ),
            alignment: Alignment.center,
            child: Text(
              label,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w500,
                color: isSelected ? const Color(0xFF406DCA) : Colors.black,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildSavingsCardView(BuildContext context, List bankCards) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, bottom: 16, top: 0),
      child: Column(
        children: [
          ...bankCards.asMap().entries.map((entry) => _buildDetailedCard(
              context, entry.value,
              isSavingsCard: true, index: entry.key)),
          _buildEAccountSection(context, bankCards.length),
        ],
      ),
    );
  }

  Widget _buildCreditCardView(BuildContext context, List bankCards) {
    if (bankCards.isEmpty) {
      return Container(
        padding: const EdgeInsets.only(left: 16, right: 16, bottom: 16, top: 0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.credit_card, size: 64, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              '暂无信用卡',
              style: TextStyle(fontSize: 16, color: Colors.grey),
            ),
          ],
        ),
      );
    }
    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, bottom: 16, top: 0),
      child: Column(
        children: bankCards
            .asMap()
            .entries
            .map((entry) => _buildDetailedCard(context, entry.value,
                isSavingsCard: false, index: entry.key))
            .toList(),
      ),
    );
  }

  Widget _buildGlobalView(BuildContext context, List bankCards) {
    return Padding(
      padding: const EdgeInsets.only(left: 16, right: 16, bottom: 16, top: 0),
      child: Column(
        children: bankCards
            .asMap()
            .entries
            .map((entry) => _buildDetailedCard(context, entry.value,
                isSavingsCard: true, index: entry.key))
            .toList(),
      ),
    );
  }

  Widget _buildDetailedCard(BuildContext context, dynamic card,
      {required bool isSavingsCard, int index = 0}) {
    final lastFourDigits = card.cardNumber.length > 4
        ? card.cardNumber.substring(card.cardNumber.length - 4)
        : card.cardNumber;
    final bankName = '建设银行';
    final cardStatus = '正常';
    final cardTypeDetail = card.cardType == '活期' ? '龙卡通' : card.cardType;

    // 单数用 #F2F7FD，偶数用 #FFF5F4
    final backgroundColor =
        index % 2 == 0 ? const Color(0xFFF2F7FD) : const Color(0xFFFFF5F4);

    return Stack(
      children: [
        Container(
          padding: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.05),
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                margin: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: backgroundColor,
                  borderRadius:
                      BorderRadius.circular(BankConstants.borderRadius - 4),
                ),
                child: Stack(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(
                        left: 8,
                        right: 16,
                        top: 16,
                        bottom: 16,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  Container(
                                    width: 45,
                                    height: 45,
                                    decoration: const BoxDecoration(
                                      color: Colors.white,
                                      shape: BoxShape.circle,
                                    ),
                                    child: Center(
                                      child: ClipOval(
                                        child: Image.asset(
                                          BankImages
                                              .accountOverviewWealthPanoramaCardIcon,
                                          width: 45,
                                          height: 45,
                                          fit: BoxFit.cover,
                                          errorBuilder:
                                              (context, error, stackTrace) {
                                            return const Icon(
                                              Icons.account_balance,
                                              color: Color(0xFF4A90E2),
                                              size: 45,
                                            );
                                          },
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          Text(
                                            '$bankName ($lastFourDigits)',
                                            style: const TextStyle(
                                              fontSize: 14,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(width: 8),
                                          GestureDetector(
                                            onTap: () {},
                                            child: const Text(
                                              '查看卡号',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Color(0xFF4A90E2),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 2),
                                      Row(
                                        children: [
                                          Text(
                                            cardTypeDetail,
                                            style: const TextStyle(
                                              fontSize: 10,
                                              color: Colors.grey,
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                              horizontal: 6,
                                              vertical: 2,
                                            ),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFDEE7F0),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              cardStatus,
                                              style: const TextStyle(
                                                fontSize: 9,
                                                color: Color(0xFF4473BB),
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const SizedBox(width: 53),
                                  Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        children: [
                                          const Text(
                                            '可用余额(元)',
                                            style: TextStyle(
                                              fontSize: 10,
                                              color: Colors.grey,
                                            ),
                                          ),
                                          const SizedBox(width: 4),
                                          GestureDetector(
                                            onTap: () {
                                              setState(() {
                                                _isCardBalanceVisible =
                                                    !_isCardBalanceVisible;
                                              });
                                            },
                                            child: Icon(
                                              _isCardBalanceVisible
                                                  ? Icons.visibility
                                                  : Icons.visibility_off,
                                              size: 14,
                                              color: Colors.grey,
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        _isCardBalanceVisible
                                            ? _formatAmount(card.balance)
                                            : '****',
                                        style: const TextStyle(
                                          fontSize: 16,
                                          fontWeight: FontWeight.bold,
                                          fontFamily: 'monospace',
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                              if (isSavingsCard && index == 0)
                                Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Transform.translate(
                                      offset: const Offset(0, -8),
                                      child: Stack(
                                        alignment: Alignment.center,
                                        children: [
                                          Container(
                                            width: 48,
                                            height: 48,
                                            decoration: BoxDecoration(
                                              shape: BoxShape.circle,
                                              border: Border.all(
                                                color: const Color(0xFF4A90E2),
                                                width: 1,
                                                style: BorderStyle.solid,
                                              ),
                                            ),
                                          ),
                                          Positioned.fill(
                                            child: Padding(
                                              padding: const EdgeInsets.all(3),
                                              child: CustomPaint(
                                                painter: DashedCirclePainter(
                                                  color:
                                                      const Color(0xFF4A90E2),
                                                  strokeWidth: 1,
                                                ),
                                              ),
                                            ),
                                          ),
                                          Transform.rotate(
                                            angle:
                                                -0.785398, // -45 degrees in radians (right-up diagonal)
                                            child: const Text(
                                              '首选',
                                              style: TextStyle(
                                                fontSize: 12,
                                                color: Color(0xFF4A90E2),
                                                fontWeight: FontWeight.w500,
                                              ),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    OutlinedButton(
                                      onPressed: () {},
                                      style: OutlinedButton.styleFrom(
                                        backgroundColor: Colors.transparent,
                                        foregroundColor:
                                            const Color(0xFF4B82CE),
                                        side: const BorderSide(
                                          color: Color(0xFF4B82CE),
                                          width: 1,
                                        ),
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 16, vertical: 4),
                                        minimumSize: Size.zero,
                                        tapTargetSize:
                                            MaterialTapTargetSize.shrinkWrap,
                                      ),
                                      child: const Text(
                                        '详情',
                                        style: TextStyle(fontSize: 14),
                                      ),
                                    ),
                                  ],
                                ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Opacity(
                        opacity: 0.3,
                        child: Image.asset(
                          index == 1
                              ? BankImages.accountOverviewCardBgIconSecond
                              : BankImages.accountOverviewCardBgIcon,
                          width: 72,
                          height: 72,
                          fit: BoxFit.contain,
                          errorBuilder: (context, error, stackTrace) {
                            return const SizedBox.shrink();
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.only(
                    bottomLeft: Radius.circular(BankConstants.borderRadius),
                    bottomRight: Radius.circular(BankConstants.borderRadius),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: isSavingsCard
                      ? [
                          _buildCardActionButton('明细', Icons.list, () {}),
                          _buildDivider(),
                          _buildCardActionButton('转账', Icons.swap_horiz, () {}),
                          _buildDivider(),
                          _buildCardActionButton('扫码办', Icons.qr_code, () {}),
                          _buildDivider(),
                          _buildCardActionButton(
                              '买理财', Icons.trending_up, () {}),
                        ]
                      : [
                          _buildCardActionButton('明细', Icons.list, () {}),
                          _buildDivider(),
                          _buildCardActionButton('充值', Icons.add_circle, () {}),
                          _buildDivider(),
                          _buildCardActionButton(
                              '提现', Icons.remove_circle, () {}),
                        ],
                ),
              ),
            ],
          ),
        ),
        if (isSavingsCard && index == 0)
          Positioned(
            top: 8,
            right: 8,
            child: Image.asset(
              BankImages.bankCardSignedIcon,
              width: 32,
              height: 32,
              fit: BoxFit.contain,
              errorBuilder: (context, error, stackTrace) {
                return const SizedBox.shrink();
              },
            ),
          ),
      ],
    );
  }

  Widget _buildCardActionButton(
      String label, IconData icon, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Text(
        label,
        style: const TextStyle(
          fontSize: 14,
          color: Colors.black,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildDivider() {
    return Container(
      width: 1,
      height: 16,
      color: Colors.grey.withOpacity(0.3),
    );
  }

  Widget _buildEAccountSection(BuildContext context, int index) {
    // 单数用 #F2F7FD，偶数用 #FFF5F4
    final backgroundColor =
        index % 2 == 0 ? const Color(0xFFF2F7FD) : const Color(0xFFFFF5F4);
    
    return Container(
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(BankConstants.borderRadius),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            blurRadius: 4,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            margin: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: backgroundColor,
              borderRadius:
                  BorderRadius.circular(BankConstants.borderRadius - 4),
            ),
            child: Stack(
              children: [
                Padding(
                  padding: const EdgeInsets.only(
                    left: 8,
                    right: 16,
                    top: 16,
                    bottom: 16,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'e账户',
                        style: TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 12),
                      const Text(
                        '只要您持有工行、农行、中行、建行、交行、邮储银行的I类借记卡,即可享受建行的优质投资理财服务。',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.grey,
                          height: 1.5,
                        ),
                      ),
                    ],
                  ),
                ),
                Positioned(
                  bottom: 0,
                  right: 0,
                  child: Opacity(
                    opacity: 0.3,
                    child: Image.asset(
                      index == 1
                          ? BankImages.accountOverviewCardBgIconSecond
                          : BankImages.accountOverviewCardBgIcon,
                      width: 72,
                      height: 72,
                      fit: BoxFit.contain,
                      errorBuilder: (context, error, stackTrace) {
                        return const SizedBox.shrink();
                      },
                    ),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                bottomLeft: Radius.circular(BankConstants.borderRadius),
                bottomRight: Radius.circular(BankConstants.borderRadius),
              ),
            ),
            child: SizedBox(
              width: double.infinity,
              child: GestureDetector(
                onTap: () {},
                behavior: HitTestBehavior.opaque,
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: const Text(
                    '立即体验',
                    style: TextStyle(
                      color: Color(0xFF558EDF),
                      fontSize: 16,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainAssetCard(BuildContext context, double totalAssets,
      double currentBalance, double holdingsTotal) {
    return Container(
      margin: const EdgeInsets.fromLTRB(16, 0, 16, 0),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.0),
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(BankConstants.borderRadius),
          bottomRight: Radius.circular(BankConstants.borderRadius),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '我的资产',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                  color: Colors.white,
                ),
              ),
              Row(
                children: [
                  const Icon(Icons.swap_horiz, color: Colors.white, size: 20),
                  const SizedBox(width: 4),
                  const Text(
                    '总负债',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      const Text(
                        '总资产(元)',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white70,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.info_outline,
                          color: Colors.white70, size: 16),
                    ],
                  ),
                  const SizedBox(height: 8),
                  GestureDetector(
                    onTap: () {
                      setState(() {
                        _isBalanceVisible = !_isBalanceVisible;
                      });
                    },
                    child: Text(
                      _isBalanceVisible ? _formatAmount(totalAssets) : '****',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontFamily: 'monospace',
                      ),
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Row(
                    children: [
                      const Text(
                        '昨日收益(元)',
                        style: TextStyle(
                          fontSize: 14,
                          color: Colors.white70,
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(Icons.info_outline,
                          color: Colors.white70, size: 16),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '--',
                    style: TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                      fontFamily: 'monospace',
                    ),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 20),
          Center(
            child: GestureDetector(
              onTap: () {
                // Show asset view options
              },
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    '资产视图',
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 4),
                  const Icon(Icons.keyboard_arrow_down,
                      color: Colors.white, size: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickAction({
    required IconData icon,
    required String label,
    String? value,
    String? subLabel,
  }) {
    return Column(
      children: [
        Icon(icon, color: Colors.white, size: 24),
        const SizedBox(height: 8),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.white,
          ),
        ),
        if (value != null) ...[
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ],
        if (subLabel != null) ...[
          const SizedBox(height: 2),
          Text(
            subLabel,
            style: const TextStyle(
              fontSize: 12,
              color: Colors.white70,
            ),
          ),
        ],
      ],
    );
  }

  Widget _buildQuickActionsAndBalanceSection(
      BuildContext context, double currentBalance, double holdingsTotal) {
    return Container(
      margin: const EdgeInsets.only(left: 16, right: 16, bottom: 8),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: const BorderRadius.only(
          bottomLeft: Radius.circular(BankConstants.borderRadius),
          bottomRight: Radius.circular(BankConstants.borderRadius),
        ),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildQuickActionItem(
                icon: Icons.description,
                label: '账户明细',
                iconColor: Colors.grey.shade700,
                customIcon: Image.asset(
                  BankImages.bankIconAccountDetails,
                  width: 24,
                  height: 24,
                  fit: BoxFit.fill,
                  errorBuilder: (context, error, stackTrace) {
                    return Icon(
                      Icons.description,
                      color: Colors.grey.shade700,
                      size: 24,
                    );
                  },
                ),
              ),
              _buildQuickActionItem(
                icon: Icons.swap_horiz,
                label: '转账汇款',
                iconColor: const Color(0xFF4A90E2),
                customIcon: Image.asset(
                  BankImages.bankIconTransferRemittance,
                  width: 24,
                  height: 24,
                  fit: BoxFit.fill,
                  errorBuilder: (context, error, stackTrace) {
                    return Icon(
                      Icons.swap_horiz,
                      color: const Color(0xFF4A90E2),
                      size: 24,
                    );
                  },
                ),
              ),
              _buildQuickActionItem(
                icon: Icons.health_and_safety,
                label: '财富体检',
                iconColor: Colors.grey.shade700,
                customIcon: Image.asset(
                  BankImages.bankIconWealthCheckup,
                  width: 24,
                  height: 24,
                  fit: BoxFit.fill,
                  errorBuilder: (context, error, stackTrace) {
                    return Icon(
                      Icons.health_and_safety,
                      color: Colors.grey.shade700,
                      size: 24,
                    );
                  },
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      currentBalance.toStringAsFixed(2),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF213DB8),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        const Text(
                          '活期',
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF213DB8),
                          ),
                        ),
                        const SizedBox(height: 2),
                        Container(
                          width: 24,
                          height: 2,
                          decoration: BoxDecoration(
                            color: const Color(0xFF213DB8),
                            borderRadius: BorderRadius.circular(1),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Text(
                      holdingsTotal.toStringAsFixed(2),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      '持仓总额',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: Colors.black87,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildQuickActionItem({
    required IconData icon,
    required String label,
    required Color iconColor,
    Widget? customIcon,
  }) {
    return Column(
      children: [
        SizedBox(
          width: 24,
          height: 24,
          child: customIcon ??
              Icon(
                icon,
                color: iconColor,
                size: 24,
              ),
        ),
        const SizedBox(height: 8),
        Text(
          label,
          style: const TextStyle(
            fontSize: 12,
            color: Colors.black87,
          ),
        ),
      ],
    );
  }

  Widget _buildCurrentAssetsSection(BuildContext context, double balance) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.only(bottom: 8),
          decoration: const BoxDecoration(
            color: Colors.transparent,
          ),
          child: const Text(
            '活期',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Text('人民币'),
                  const SizedBox(width: 4),
                  const Icon(Icons.keyboard_arrow_down, size: 16),
                ],
              ),
              Row(
                children: [
                  Text(
                    balance.toStringAsFixed(2),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(width: 8),
                  const Icon(Icons.chevron_right, color: Colors.grey),
                ],
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHoldingsSection(BuildContext context, double totalHoldings) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16),
          padding: const EdgeInsets.only(bottom: 8),
          decoration: const BoxDecoration(
            color: Colors.transparent,
          ),
          child: const Text(
            '持仓总额',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(BankConstants.borderRadius),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildHoldingItem('龙钱宝1号', '零钱理财,能赚还能花'),
              _buildHoldingItem('龙钱宝2号', '灵活交易超省心'),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildHoldingItem(String name, String description) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Row(
            children: [
              Text(
                name,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                description,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.normal,
                  color: Colors.grey,
                ),
              ),
            ],
          ),
        ),
        const Icon(Icons.chevron_right, color: Colors.grey),
      ],
    );
  }

  Widget _buildDepositSection(BuildContext context) {
    return Consumer<BankUserProvider>(
      builder: (context, provider, child) {
        final holdingsTotal = provider.holdingsTotal;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16),
              padding: const EdgeInsets.only(bottom: 8),
              decoration: const BoxDecoration(
                color: Colors.transparent,
              ),
              child: const Text(
                '持仓总额',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Container(
              margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(BankConstants.borderRadius),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '¥${_formatAmount(holdingsTotal)}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Colors.black87,
                      fontFamily: 'monospace',
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                  const Icon(Icons.chevron_right, color: Colors.grey),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class DashedCirclePainter extends CustomPainter {
  final Color color;
  final double strokeWidth;

  DashedCirclePainter({
    required this.color,
    this.strokeWidth = 1.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width / 2) - strokeWidth / 2;

    const dashWidth = 3.0;
    const dashSpace = 2.0;
    double startAngle = 0;

    while (startAngle < 2 * 3.14159) {
      canvas.drawArc(
        Rect.fromCircle(center: center, radius: radius),
        startAngle,
        dashWidth / radius,
        false,
        paint,
      );
      startAngle += (dashWidth + dashSpace) / radius;
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
