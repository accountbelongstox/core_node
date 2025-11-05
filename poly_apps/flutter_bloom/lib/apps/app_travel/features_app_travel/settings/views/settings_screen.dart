import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:go_router/go_router.dart';
import 'package:qyflutter/common/controller/settings_controller.dart';
import 'package:qyflutter/common/localization/localization_manager.dart';
import '../../../provider_app_travel/user_provider_app_travel.dart';
import '../../../router_app_travel/routes_provider_app_travel.dart';
import '../../../localization_app_travel/localization_keys_app_travel.dart';
import '../../../constants_app_travel/cities_app_travel.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {

  final List<Map<String, dynamic>> _accountSettings = [
    {
      'icon': Icons.person_add,
      'iconColor': Color(0xFF00D0D8),
      'title': '实名认证',
      'trailing': '去实名',
      'trailingColor': Color(0xFFFF3B30),
    },
    {
      'icon': Icons.security,
      'iconColor': Color(0xFF00D0D8),
      'title': '账号安全',
      'subtitle': '修改登录密码、修改手机号码',
    },
    {
      'icon': Icons.link,
      'iconColor': Color(0xFF00D0D8),
      'title': '账号关联',
    },
    {
      'icon': Icons.payment,
      'iconColor': Color(0xFF00D0D8),
      'title': '支付设置',
    },
  ];

  final List<Map<String, dynamic>> _systemSettings = [
    {
      'icon': Icons.location_city,
      'iconColor': Color(0xFF9C9FDE),
      'title': '当前城市',
    },
    {
      'icon': Icons.devices,
      'iconColor': Color(0xFF9C9FDE),
      'title': '登录设备管理',
    },
    {
      'icon': Icons.settings,
      'iconColor': Color(0xFF9C9FDE),
      'title': '系统设置',
    },
    {
      'icon': Icons.language,
      'iconColor': Color(0xFF9C9FDE),
      'title': '语言/Language',
    },
  ];

  final List<Map<String, dynamic>> _aboutSettings = [
    {
      'icon': Icons.info,
      'iconColor': Color(0xFF9C9FDE),
      'title': '关于去哪儿网',
    },
    {
      'icon': Icons.policy,
      'iconColor': Color(0xFF9C9FDE),
      'title': '隐私政策摘要',
    },
    {
      'icon': Icons.share_outlined,
      'iconColor': Color(0xFF9C9FDE),
      'title': '第三方共享个人信息清单',
    },
    {
      'icon': Icons.list_alt,
      'iconColor': Color(0xFF9C9FDE),
      'title': '个人信息收集清单',
    },
    {
      'icon': Icons.apps,
      'iconColor': Color(0xFF9C9FDE),
      'title': '应用权限清单',
    },
  ];

  @override
  Widget build(BuildContext context) {
    final userProvider = context.watch<UserProviderAppTravel>();

    return Scaffold(
      backgroundColor: const Color(0xFFF5F5F5),
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.black87),
          onPressed: () => Navigator.of(context).pop(),
        ),
        title: const Text(
          '设置',
          style: TextStyle(
            fontSize: 18.0,
            fontWeight: FontWeight.w500,
            color: Colors.black87,
          ),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            _buildUserProfile(),
            const SizedBox(height: 12.0),
            _buildSettingsSection(_accountSettings),
            const SizedBox(height: 12.0),
            _buildSettingsSection(_systemSettings),
            const SizedBox(height: 12.0),
            _buildSettingsSection(_aboutSettings),
            const SizedBox(height: 12.0),
            if (userProvider.isLoggedIn) _buildLogoutButton(userProvider),
            const SizedBox(height: 20.0),
          ],
        ),
      ),
    );
  }

  Widget _buildLogoutButton(UserProviderAppTravel userProvider) {
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16.0),
      child: ElevatedButton(
        onPressed: () => _showLogoutDialog(userProvider),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.red.shade400,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14.0),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(8.0),
          ),
        ),
        child: Text(
          TravelLocalizationKeys.travelLogout.tr(context),
          style: const TextStyle(
            fontSize: 16.0,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }

  void _showLogoutDialog(UserProviderAppTravel userProvider) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(TravelLocalizationKeys.travelLogout.tr(context)),
          content: Text(TravelLocalizationKeys.travelConfirm.tr(context)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(TravelLocalizationKeys.travelCancel.tr(context)),
            ),
            ElevatedButton(
              onPressed: () async {
                await userProvider.logout();
                if (mounted) {
                  Navigator.of(context).pop();
                  context.go(TravelAppRoutesProvider.routeLogin);
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.red,
              ),
              child: Text(TravelLocalizationKeys.travelConfirm.tr(context)),
            ),
          ],
        );
      },
    );
  }

  Widget _buildUserProfile() {
    final userProvider = context.watch<UserProviderAppTravel>();
    final user = userProvider.user;
    final username = user.username ?? TravelLocalizationKeys.travelGuestUser.tr(context);
    final email = user.email ?? '';

    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(16.0),
      child: Row(
        children: [
          Container(
            width: 64.0,
            height: 64.0,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: user.isLoggedIn ? const Color(0xFF00D0D8) : const Color(0xFFE0E0E0),
                width: 2.0,
              ),
            ),
            child: ClipOval(
              child: user.avatarUrl != null
                  ? Image.network(
                      user.avatarUrl!,
                      fit: BoxFit.cover,
                      errorBuilder: (context, error, stackTrace) {
                        return _buildDefaultAvatar();
                      },
                    )
                  : _buildDefaultAvatar(),
            ),
          ),
          const SizedBox(width: 16.0),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  username,
                  style: const TextStyle(
                    fontSize: 18.0,
                    fontWeight: FontWeight.bold,
                    color: Colors.black87,
                  ),
                ),
                const SizedBox(height: 6.0),
                Text(
                  email.isNotEmpty ? email : TravelLocalizationKeys.travelGuestUser.tr(context),
                  style: const TextStyle(
                    fontSize: 14.0,
                    color: Colors.black45,
                  ),
                ),
              ],
            ),
          ),
          GestureDetector(
            onTap: () {
              if (user.isLoggedIn) {
                _showEditProfileDialog(userProvider);
              } else {
                _showLoginPromptDialog();
              }
            },
            child: Row(
              children: const [
                Text(
                  '修改',
                  style: TextStyle(
                    fontSize: 15.0,
                    color: Colors.black54,
                  ),
                ),
                SizedBox(width: 4.0),
                Icon(
                  Icons.chevron_right,
                  size: 20.0,
                  color: Colors.black26,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDefaultAvatar() {
    return Container(
      color: const Color(0xFFE3F2FD),
      child: const Icon(
        Icons.person,
        size: 36.0,
        color: Color(0xFF00D0D8),
      ),
    );
  }

  Widget _buildSettingsSection(List<Map<String, dynamic>> settings) {
    return Container(
      color: Colors.white,
      child: ListView.separated(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        itemCount: settings.length,
        separatorBuilder: (context, index) => const Divider(
          height: 1.0,
          indent: 56.0,
          endIndent: 16.0,
        ),
        itemBuilder: (context, index) {
          final setting = settings[index];
          return _buildSettingItem(setting);
        },
      ),
    );
  }

  Widget _buildSettingItem(Map<String, dynamic> setting) {
    return InkWell(
      onTap: () {
        _handleSettingTap(setting['title']);
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
        child: Row(
          children: [
            Container(
              width: 40.0,
              height: 40.0,
              decoration: BoxDecoration(
                color: (setting['iconColor'] as Color).withOpacity(0.15),
                borderRadius: BorderRadius.circular(8.0),
              ),
              child: Icon(
                setting['icon'],
                size: 24.0,
                color: setting['iconColor'],
              ),
            ),
            const SizedBox(width: 12.0),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    setting['title'],
                    style: const TextStyle(
                      fontSize: 15.0,
                      fontWeight: FontWeight.w500,
                      color: Colors.black87,
                    ),
                  ),
                  if (setting['subtitle'] != null) ...{
                    const SizedBox(height: 4.0),
                    Text(
                      setting['subtitle'],
                      style: const TextStyle(
                        fontSize: 12.0,
                        color: Colors.black45,
                      ),
                    ),
                  },
                ],
              ),
            ),
            if (setting['trailing'] != null)
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    setting['trailing'],
                    style: TextStyle(
                      fontSize: 14.0,
                      color: setting['trailingColor'] ?? Colors.black54,
                    ),
                  ),
                  const SizedBox(width: 4.0),
                ],
              ),
            Icon(
              Icons.chevron_right,
              size: 20.0,
              color: Colors.black26,
            ),
          ],
        ),
      ),
    );
  }

  void _handleSettingTap(String settingTitle) {
    final settingsController = context.read<SettingsController>();
    final userProvider = context.read<UserProviderAppTravel>();

    switch (settingTitle) {
      case '当前城市':
        _showCitySelectionDialog(userProvider);
        break;
      case '实名认证':
        _showComingSoonDialog('实名认证');
        break;
      case '账号安全':
        _showSecurityDialog();
        break;
      case '账号关联':
        _showComingSoonDialog('账号关联');
        break;
      case '支付设置':
        _showComingSoonDialog('支付设置');
        break;
      case '登录设备管理':
        _showComingSoonDialog('登录设备管理');
        break;
      case '系统设置':
        _showSystemSettingsDialog(settingsController);
        break;
      case '语言/Language':
        _showLanguageDialog(settingsController);
        break;
      case '关于去哪儿网':
        _showAboutDialog();
        break;
      case '隐私政策摘要':
        _showComingSoonDialog('隐私政策摘要');
        break;
      case '第三方共享个人信息清单':
        _showComingSoonDialog('第三方共享个人信息清单');
        break;
      case '个人信息收集清单':
        _showComingSoonDialog('个人信息收集清单');
        break;
      case '应用权限清单':
        _showComingSoonDialog('应用权限清单');
        break;
      default:
        debugPrint('$settingTitle tapped');
    }
  }

  void _showLoginPromptDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(TravelLocalizationKeys.travelLogin.tr(context)),
          content: Text(TravelLocalizationKeys.travelPleaseEnterUsername.tr(context)),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(TravelLocalizationKeys.travelCancel.tr(context)),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                context.go(TravelAppRoutesProvider.routeLogin);
              },
              child: Text(TravelLocalizationKeys.travelLogin.tr(context)),
            ),
          ],
        );
      },
    );
  }

  void _showEditProfileDialog(UserProviderAppTravel userProvider) {
    final user = userProvider.user;
    final TextEditingController nameController = TextEditingController(
      text: user.username ?? '',
    );
    final TextEditingController emailController = TextEditingController(
      text: user.email ?? '',
    );

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('修改资料'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: '昵称',
                  border: OutlineInputBorder(),
                ),
              ),
              const SizedBox(height: 16.0),
              TextField(
                controller: emailController,
                decoration: const InputDecoration(
                  labelText: '邮箱',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('取消'),
            ),
            ElevatedButton(
              onPressed: () async {
                final success = await userProvider.updateProfile(
                  username: nameController.text,
                  email: emailController.text,
                );
                if (mounted) {
                  Navigator.of(context).pop();
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(
                      content: Text(success ? '修改成功' : '修改失败'),
                    ),
                  );
                }
              },
              child: const Text('确定'),
            ),
          ],
        );
      },
    );
  }

  void _showSecurityDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('账号安全'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.lock),
                title: const Text('修改登录密码'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.of(context).pop();
                  _showComingSoonDialog('修改登录密码');
                },
              ),
              const Divider(),
              ListTile(
                contentPadding: EdgeInsets.zero,
                leading: const Icon(Icons.phone),
                title: const Text('修改手机号码'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () {
                  Navigator.of(context).pop();
                  _showComingSoonDialog('修改手机号码');
                },
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('关闭'),
            ),
          ],
        );
      },
    );
  }

  void _showSystemSettingsDialog(SettingsController settingsController) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('系统设置'),
          content: StatefulBuilder(
            builder: (context, setDialogState) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('深色模式'),
                    value: settingsController.isDarkMode,
                    onChanged: (value) {
                      settingsController.toggleTheme();
                      setDialogState(() {});
                      setState(() {});
                    },
                  ),
                  const Divider(),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.notifications),
                    title: const Text('通知设置'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(context).pop();
                      _showComingSoonDialog('通知设置');
                    },
                  ),
                  const Divider(),
                  ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: const Icon(Icons.storage),
                    title: const Text('清除缓存'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () {
                      Navigator.of(context).pop();
                      _showClearCacheDialog();
                    },
                  ),
                ],
              );
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('关闭'),
            ),
          ],
        );
      },
    );
  }

  void _showLanguageDialog(SettingsController settingsController) {
    final currentLanguage = settingsController.getCurrentLocaleIdentifier();

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('选择语言 / Select Language'),
          content: StatefulBuilder(
            builder: (context, setDialogState) {
              return Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  RadioListTile<String>(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('简体中文'),
                    value: 'zh',
                    groupValue: currentLanguage,
                    onChanged: (value) {
                      if (value != null) {
                        settingsController.changeLanguage(value);
                        setDialogState(() {});
                        setState(() {});
                      }
                    },
                  ),
                  RadioListTile<String>(
                    contentPadding: EdgeInsets.zero,
                    title: const Text('English'),
                    value: 'en',
                    groupValue: currentLanguage,
                    onChanged: (value) {
                      if (value != null) {
                        settingsController.changeLanguage(value);
                        setDialogState(() {});
                        setState(() {});
                      }
                    },
                  ),
                ],
              );
            },
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('关闭'),
            ),
          ],
        );
      },
    );
  }

  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('关于去哪儿网'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: const [
              Icon(
                Icons.flight_takeoff,
                size: 64.0,
                color: Color(0xFF00D0D8),
              ),
              SizedBox(height: 16.0),
              Text(
                '去哪儿旅行',
                style: TextStyle(
                  fontSize: 20.0,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: 8.0),
              Text(
                'Version 1.0.0',
                style: TextStyle(
                  fontSize: 14.0,
                  color: Colors.black54,
                ),
              ),
              SizedBox(height: 16.0),
              Text(
                '让旅行更简单',
                style: TextStyle(
                  fontSize: 14.0,
                  color: Colors.black54,
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('确定'),
            ),
          ],
        );
      },
    );
  }

  void _showClearCacheDialog() {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('清除缓存'),
          content: const Text('确定要清除应用缓存吗？这不会删除您的个人数据。'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('取消'),
            ),
            ElevatedButton(
              onPressed: () {
                Navigator.of(context).pop();
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('缓存已清除')),
                );
              },
              child: const Text('确定'),
            ),
          ],
        );
      },
    );
  }

  void _showCitySelectionDialog(UserProviderAppTravel userProvider) {
    final TextEditingController customCityController = TextEditingController();
    final currentCity = userProvider.user.currentCity ?? CitiesAppTravel.defaultCity;

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(TravelLocalizationKeys.travelSelectCity.tr(context)),
          content: SizedBox(
            width: double.maxFinite,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  TravelLocalizationKeys.travelPopularCities.tr(context),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Flexible(
                  child: ListView.builder(
                    shrinkWrap: true,
                    itemCount: CitiesAppTravel.popularCities.length,
                    itemBuilder: (context, index) {
                      final city = CitiesAppTravel.popularCities[index];
                      return RadioListTile<String>(
                        contentPadding: EdgeInsets.zero,
                        title: Text(city),
                        value: city,
                        groupValue: currentCity,
                        onChanged: (value) async {
                          if (value != null) {
                            await userProvider.updateProfile(currentCity: value);
                            if (mounted) {
                              Navigator.of(context).pop();
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    '${TravelLocalizationKeys.travelCityChangedTo.tr(context)} $value',
                                  ),
                                ),
                              );
                            }
                          }
                        },
                      );
                    },
                  ),
                ),
                const Divider(),
                TextField(
                  controller: customCityController,
                  decoration: InputDecoration(
                    labelText: TravelLocalizationKeys.travelCustomCity.tr(context),
                    border: const OutlineInputBorder(),
                    hintText: TravelLocalizationKeys.travelEnterCityName.tr(context),
                  ),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: Text(TravelLocalizationKeys.travelCancel.tr(context)),
            ),
            ElevatedButton(
              onPressed: () async {
                final customCity = customCityController.text.trim();
                if (customCity.isNotEmpty) {
                  await userProvider.updateProfile(currentCity: customCity);
                  if (mounted) {
                    Navigator.of(context).pop();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          '${TravelLocalizationKeys.travelCityChangedTo.tr(context)} $customCity',
                        ),
                      ),
                    );
                  }
                }
              },
              child: Text(TravelLocalizationKeys.travelConfirm.tr(context)),
            ),
          ],
        );
      },
    );
  }

  void _showComingSoonDialog(String feature) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Text(feature),
          content: const Text('此功能即将推出'),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('确定'),
            ),
          ],
        );
      },
    );
  }
}
