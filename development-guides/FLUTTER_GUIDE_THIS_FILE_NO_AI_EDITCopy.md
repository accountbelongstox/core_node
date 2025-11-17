<!-- ### FLUTTER ARCHITECTURE PROMPT START ### -->

# 重要：当你看到本文档时，可能是多个AI协同工作，所以文档、代码都是实时更新，你将尽可能更新代码和文档的最新内容

# Flutter 聚合应用 - 基本规范(必须遵守基本规范)

- **项目模式**: 本项目是一个**多应用聚合 (Multi-App Aggregation)** 的 Flutter 应用，通过单一代码库支持多个业务模块。
- **目标平台**: 当前优先支持 **Android**、**iOS** 移动端以及**手机 Web 端**。
- **代码全英文，除了多语言脚本，开发中禁止运行测试命令，禁止写测试脚本，禁止写总结**
- **任何要求本规范开发的，都输出一个开发结果到 ./{your Ai Name}_devlop_result.md**文件，你可以持续更新该文件


## 多入口模式 ✅ COMPLETED
```
规范: 双入口模式
      ├── lib/main.dart                        ✅ 虚入口 (轻量级代理)，将引用特殊APP `lib/apps/app_main/`
      ├── lib/common/app/main_common.dart      ✅ 通用入口 (完整启动逻辑)
      └── lib/apps/app_{name}/main_app_{name}.dart ✅ 独立入口 (APP专用)

本应用为多入口模式:
- 主入口 (lib/main.dart): 轻量级虚入口，直接调用 `lib/apps/app_main/` 再由 app_main 调用通用入口 `main_common.dart`, 启动后会引用所有APP的路由总集、多语言总集、静态资源总集
- 通用入口 (lib/common/app/main_common.dart): 包含完整启动逻辑,对外提供一个 runCommonApp 方法 ，可以传入一个或多个的 多语言、路由等资源
- 独立入口示例:
  ├── lib/apps/app_qy/main_app_{appname A}.dart: A应用独立入口，仅包括本APP的代码和资源
  └── lib/apps/app_bloom/main_app_{appname A}.dart: B应用独立入口
功能特性:
- lib/main.dart  用于统一调试所有 APP 的特殊APP `lib/apps/app_main/`
```

## 示例APP
- 本项目包含一个示例APP，该APP将遵守本规范开发，并作为后续基于此flutter创建新APP时的蓝本，当要求开发示例APP时，你可以在`lib/apps/app_example/`其中开发

## 主入口 main.dart 特殊APP `app_main`
- **特殊性**: `lib/apps/app_main/` 由main.dart主入口直接调用，目录结构与普通APP一致，主要不同在于路由组件会硬编码引入其他app，并有一个页面(feature) `lib/apps/app_main/features_app_main/views/all_apps_showcase_screen.dart` 设计成多标题->列表方式，引入其他所有APP，标题显示为其他APP的名字，列表为其他APP的各个页面、资源等，在主页上能跳转到任何一个其他APP页进行总体调试
- **路由**: 按规范设计路由，但会硬编码引入其他APP的路由（详见"路由系统及适配双入口模式设计"）
- **页面规范**: 遵守本规范中的页面(feature)规范
- **设置和资源**: 按规范设计settings controller和assets，但无需其他APP的app_sets和app assets（因为其他页面会自行调用，只要路由被引过来即可）

## APP创建规范

### 创建APP步骤
1. 阅读本文档全部内容，遵守全部规则
2. 参考 `lib/apps/app_example/` 的结构作为模板
3. 按照以下结构创建APP目录和文件
4. 确保所有文件关联 `lib/common/` 中的基础类和扩展
5. 根据assets规范，在pubspec.yaml中添加静态资源，并创建对应目录，对应assets app中的dart文件，参考example代码编码assets资源类库（详见"静态资源使用规范"）

### APP 文件设计、结构标准化
```
规范: lib/apps/app_{name}/ 需要加`app_` 前缀
      ├── main_app_{name}.dart            # APP入口文件，调用 runCommonApp (from lib/common/app/main_common.dart)
      │                                    # 必须传入: appName, appId, appSettings, enAppLocales, zhAppLocales, 
      │                                    #          appPrefs, customUserProvider, initialRoute, homeRoute
      │
      ├── config_app_{name}/              # APP配置目录
      │   ├── app_config_app_{name}.dart  # 应用配置类 (appId, appName, baseUrl, featureFlags等)
      │   ├── constants_app_{name}.dart  # 常量定义
      │   ├── prefs_app_{name}.dart      # Prefs配置类，必须继承 AppPrefsBase (from lib/common/storage/app_prefs_base.dart)
      │   ├── provider_app_{name}.dart   # 导出 PrefsApp{name} 实例，供 main_app_{name}.dart 使用
      │   ├── storage_app_{name}.dart    # 存储配置
      │   ├── api_config_app_{name}.dart # API配置和数据解析 (from lib/common/network/models/api_config.dart)
      │   ├── api_endpoints_app_{name}.dart # API端点定义
      │   └── api_data_models_app_{name}.dart # 数据模型定义
      │
      ├── settings_app_{name}/            # APP设置配置
      │   └── settings_app_{name}.dart   # 使用 SettingItem (from lib/common/settings/models/setting_item.dart)
      │                                   # 定义: SettingItem.toggle(), SettingItem.select(), SettingItem.slider() 等
      │
      ├── providers_app_{name}/           # APP状态提供者
      │   └── {name}_user_provider.dart   # 用户Provider，必须继承 EnhancedUserProvider (from lib/common/provider_status/user_provider.dart)
      │                                   # 实现: appProfile, setAppUser(), upsertPreference() 等方法
      │
      ├── router_app_{name}/              # 路由配置（详见"路由系统及适配双入口模式设计"）
      │   ├── router_app_{name}.dart     # 路由配置主文件，实现 createRouter() 方法返回 GoRouter
      │   └── routes_provider_app_{name}.dart # 路由提供者，定义路由常量 (routeHome, routeLogin等)
      │
      ├── localization_app_{name}/        # APP多国语言目录（详见"多国语言模块"）
      │   ├── localization_keys_app_{appname}.dart # TextKey 定义，key需有 {appname} 前缀
      │   ├── en_app_{name}.dart          # 英文翻译，基于 localization_keys
      │   └── zh_app_{name}.dart          # 中文翻译，基于 localization_keys
      │
      ├── controller_app_{name}/          # APP专属控制器组
      │   ├── settings_controller_app_{name}.dart # 设置控制器
      │   ├── auth_controller_app_{name}.dart    # 认证控制器
      │   └── ...                         # 其他控制器
      │
      ├── models_app_{name}/              # 数据模型定义
      │   └── user_model_app_{name}.dart  # 必须定义，针对该APP的用户数据模型
      │
      ├── features_app_{name}/            # 功能模块
      │   └── {feature}/
      │       ├── views/                  # 页面视图
      │       ├── widgets/                # 页面组件
      │       └── controllers/            # 控制器，可引用 models_app_{name} 中的数据
      │
      ├── services_app_{name}/            # 服务层（详见"网络使用规范"）
      │   ├── {name}_auth_api_service.dart # 认证API服务，基于 auth_controller (lib/common/network/controller/auth_controller.dart)
      │   ├── {name}_public_api_service.dart # 公共API服务
      │   └── {name}_service.dart         # 通用服务
      │
      ├── repositories_app_{name}/        # 数据仓库
      │   └── {name}_repository.dart
      │
      ├── resources_app_{name}/           # APP专属assets资源
      │   ├── assets_icons_app_{name}.dart # 图标定义，assetsKey前缀需有 {appname}
      │   ├── assets_images_app_{name}.dart # 图片定义
      │   └── assets_launch_app_{name}.dart # 启动图定义
      │
      ├── utils_app_{name}/               # APP工具
      │   └── utils_app_{name}.dart
      │
      └── otherdir_app_{name}/            # 其他功能目录，均需按此格式命名

### 与 lib/common/ 的关联规范

#### 1. 应用入口 (main_app_{name}.dart)
- **调用**: `runCommonApp()` from `lib/common/app/main_common.dart`
- **必需参数**:
  - `appName`: String (应用名称)
  - `appId`: String (应用ID，用于路由命名空间)
  - `appSettings`: List<SettingItem> (从 settings_app_{name}/settings_app_{name}.dart)
  - `enAppLocales`: List<Map<String, dynamic>> (从 localization_app_{name}/en_app_{name}.dart)
  - `zhAppLocales`: List<Map<String, dynamic>> (从 localization_app_{name}/zh_app_{name}.dart)
  - `appPrefs`: AppPrefsBase (从 config_app_{name}/provider_app_{name}.dart)
  - `customUserProvider`: BaseUserProvider (从 providers_app_{name}/{name}_user_provider.dart)
  - `initialRoute`: String (从 router_app_{name}/routes_provider_app_{name}.dart)
  - `homeRoute`: String (从 router_app_{name}/routes_provider_app_{name}.dart)

#### 2. Prefs配置 (config_app_{name}/prefs_app_{name}.dart)
- **继承**: `AppPrefsBase` from `lib/common/storage/app_prefs_base.dart`
- **实现方法**: `initSharedPreferences()` 返回 SharedPreferences 实例
- **导出**: 在 `provider_app_{name}.dart` 中导出实例供 main_app_{name}.dart 使用

#### 3. 用户Provider (providers_app_{name}/{name}_user_provider.dart)
- **继承**: `EnhancedUserProvider` from `lib/common/provider_status/user_provider.dart`
- **实现方法**:
  - `appProfile`: 获取APP专属用户数据
  - `setAppUser()`: 设置用户数据
  - `upsertPreference()`: 更新用户偏好

#### 4. 设置配置 (settings_app_{name}/settings_app_{name}.dart)
- **使用**: `SettingItem` from `lib/common/settings/models/setting_item.dart`
- **方法**: `SettingItem.toggle()`, `SettingItem.select()`, `SettingItem.slider()`, `SettingItem.textInput()`, `SettingItem.checkbox()`
- **必须设置**: `appId`, `category` 用于分组管理

#### 5. 路由配置 (router_app_{name}/router_app_{name}.dart)
- **使用**: `go_router` package，实现 `createRouter()` 方法返回 `GoRouter` 实例，路由常量定义在 `routes_provider_app_{name}.dart` 中，格式为 `/app_{name}/route_name`（详见"路由系统及适配双入口模式设计"）

#### 6. 本地化 (localization_app_{name}/)
- **使用**: `LocalizationManager` from `lib/common/localization/localization_manager.dart`，所有key需有 `{appname}_` 前缀以区分公共和APP专属，通过 `runCommonApp` 的 `enAppLocales` 和 `zhAppLocales` 参数传递（详见"多国语言模块"）

#### 7. 网络服务 (services_app_{name}/)
- **使用**: `auth_controller` from `lib/common/network/controller/auth_controller.dart`，API配置使用 `ApiConfig` from `lib/common/network/models/api_config.dart`，方法: `isLogin()`, `getUserInfoData()`, `post()`, `get()`, `put()`, `delete()`（详见"网络使用规范"）

**功能特性**: `lib/common/` 内提供所有公共类库向各个APP进行服务提供；在文件夹/文件上附上 {appname} 的信息是为了让AI打开多个文件时不会因为文件同名而混淆；所有APP必须遵循上述关联规范确保与公共模块正确集成

```

## Flutter Bloom - API 指导
- **全局配置**: `../../../config/base.config.json`，开发 API 时，**必须**参考全局配置文件，根据提示词使用合适的api,并硬编码到本项目中

## 页面 / feature 设置规范 
- 无论在任何地方，特殊app 或 app 设计页面(feature) 都要遵循下面的文件结构，数据模型请统放读取 app_{name}/models_app_{name}
      ├── ... 上级目录 (如上级目录也有规范，遵守规范。)
      │   └── {feature}/
      │       ├── views/       # 页面视图 (如果有旧的 view 目录，请合并到 views目录)
      │       ├── widgets/     # 页面组件 (保留)
      │       ├── controllers/ # 控制器 (新建)
      │       └── models/      # 废弃目录，如果存在请将其中内容移置到 app_{name}/models_app_{name}

## 多国语言模块 
- 基于 'package:flutter_localization/flutter_localization.dart' 包
多国语言由于特殊性，需要先载入，所以在各个app中(包括 app_main )由 硬编码引入 en/zh.dart后，则runCommonApp最终传递给
lib/common/localization/
├── localization_manager.dart    # 由其中扩展一个方法 `TextKey`.tr(content) ,在任何页面调用，会自动根据 Setting controller中的语言设置改变而进行改变，同时 其中提供一个setAppTranslations 可以追加一个或多个 en/zh 的语言包，localization_manager.dart 已经自动截入了 common_en.dart/common_zh.dart.
├── map_locales.dart        # 语言映射配置 (基于原实现)
├── common_en.dart          # 公共英文翻译
├── common_zh.dart          # 公共中文翻译
├── localization_keys.dart    # TextKye 定义，zh/en.dart 根据此key实现

APP语言扩展实现:
lib/apps/{name}/localization_app_{name}/  # 注意原来为 `partition_locals_app_{name}` ，如有旧文件需要合并到`localization_app_{name}`。
├── en_app_{appname}.dart                     # APP专用英文翻译
└── zh_app_{appname}.dart                     # APP专用中文翻译
└── localization_keys_app_{appname}.dart      # app专属TextKye 定义,必须

app_main 特殊 APP 语言扩展实现:
lib/apps/{name}/localization_app_{name}/ # 注意原来为 `partition_locals_app_{name}` ，如有旧文件需要合并到`localization_app_{name}`。
├── ...                     # 普通APP默认实现
└── app_locales_main.dart                     # 新增文件，用于集中引入其他所有 APP 的en/zh.dart 包，并统一传给 runCommonApp -> [中间步骤] -> localization_manager.dart

功能特性:
1. 在main.dart 引用的 lib/apps/app_main/app_main_main.dart 主入口中硬编码引入所有 app 的 语言包(通过文件 'lib/apps/app_main/partition_locals_app__main/app_locales_main.dart' 集中引入 )，通过 runCommonApp 最终传递给 localization_manager 合并，并得到一个扩展了所有 app 多语言的集合，并由 `TextKey`.tr(content) 函数供所有APP调用。
2. 在main_app_xx.dart 的APP专属APP中只硬编码引入专属的app语言包，同样通过  runCommonApp 最终传递给 localization_manager 合并，得到一个只有专属app的语言集合，不包含其他app的key
4. common/localization/ 中的strKey 要还有 前缀 ,表示是公共的，专属app中的en/zh_app_{appname}.dart   ，key要带有 appname的前缀，表示是专属的。
```


## 存储管理模块设计规范 ✅ COMPLETED
规范: lib/common/storagev2/ 
            


## 主题扩展规范

### 主题系统架构 (lib/common/theme/)

```
lib/common/theme/
├── base/                            # 基础主题组件
│   ├── theme_colors.dart           # 统一颜色常量定义 (完整色彩系统)
│   ├── theme_text_styles.dart      # 文本样式定义 (iOS风格文本系统)
│   ├── theme_dimensions.dart       # 尺寸间距定义 (响应式尺寸系统)
│   ├── theme_constants.dart        # 主题常量配置
│   ├── theme_effects.dart          # 主题效果定义
│   ├── theme_extensions.dart       # 主题扩展定义
│   ├── theme_gradients.dart        # 渐变定义
│   ├── theme_shadow.dart           # 阴影定义
│   └── theme_animations.dart       # 动画定义
├── extensions/                      # 主题扩展
│   └── gradient_extensions.dart    # 渐变扩展 (合并dark/light渐变)
├── platforms/                       # 平台预设主题
│   ├── mobile/                     # 移动端主题
│   │   ├── mobile_light_theme.dart # 移动端浅色主题 (绿色薄荷主题)
│   │   └── mobile_dark_theme.dart  # 移动端深色主题 (紫色渐变主题)
│   ├── web/                        # Web端主题
│   │   ├── web_light_theme.dart    # Web端浅色主题 (荧光绿主题)
│   │   └── web_dark_theme.dart     # Web端深色主题 (科技暗黑主题)
│   └── desktop/                    # 桌面端主题
│       ├── desktop_light_theme.dart # 桌面端浅色主题 (微软风格)
│       └── desktop_dark_theme.dart # 桌面端深色主题 (VS Code风格)
├── compatibility/                   # 兼容性层
│   ├── theme_compatibility.dart    # 主题兼容性
│   └── gradient_compatibility.dart # 渐变兼容性
└── theme_manager.dart              # 主题管理器 (统一主题访问)
```

### 基础主题组件使用 (lib/common/theme/base/)

#### 1. 颜色系统 (ThemeColors)
- **位置**: `lib/common/theme/base/theme_colors.dart`，**使用**: `color: ThemeColors.blue`

#### 2. 文本样式 (ThemeTextStyles)
- **位置**: `lib/common/theme/base/theme_text_styles.dart`，**使用**: `style: ThemeTextStyles.largeTitle`

#### 3. 尺寸间距 (ThemeDimensions)
- **位置**: `lib/common/theme/base/theme_dimensions.dart`，**使用**: `padding: EdgeInsets.all(ThemeDimensions.spacing16)`

### 主题管理器使用 (ThemeManager)
- **位置**: `lib/common/theme/theme_manager.dart`，**使用**: `ThemeManager.instance.getLightTheme()`

### 渐变扩展使用 (GradientExtensions)
- **位置**: `lib/common/theme/extensions/gradient_extensions.dart`，**使用**: `gradient: GradientExtensions.primaryLight`

### APP专属主题扩展 (lib/apps/app_{name}/resources_app_{name}/)

#### 1. APP颜色扩展 (ColorsApp{Name})
- **位置**: `lib/apps/app_{name}/resources_app_{name}/colors_app_{name}.dart`，**规范**: 基于 `ThemeColors` 扩展APP专属颜色，**使用**: `color: ColorsAppExample.examplePrimaryBrand`

#### 2. APP主题扩展 (ThemeExtensionsApp{Name})
- **位置**: `lib/apps/app_{name}/resources_app_{name}/theme_extensions_app_{name}.dart`，**规范**: 仅包含APP专属的自定义主题扩展，大多数扩展应直接使用公共扩展，**使用**: `decoration: ThemeExtensionsAppExample.appDonationCardDecoration`

#### 3. APP文本样式扩展 (TextStylesApp{Name})
- **位置**: `lib/apps/app_{name}/resources_app_{name}/text_styles_app_{name}.dart`，**规范**: 基于 `ThemeTextStyles` 扩展APP专属文本样式，**使用**: `style: TextStylesAppExample.exampleCustomTitle`

### 主题使用规范

#### 1. 直接引用原则
- **优先使用**: 直接在view文件中引用 `lib/common/theme/base/` 中的类，避免二次包装或创建manager文件
- **示例**: `ThemeColors.blue`, `ThemeTextStyles.title1`, `ThemeDimensions.spacing16`

#### 2. APP扩展原则
- **仅在需要时扩展**: 如果APP不需要特殊扩展，直接使用公共主题；APP扩展应基于 `ThemeColors`, `ThemeTextStyles`, `ThemeDimensions` 扩展，避免重复定义公共主题中已有的内容

#### 3. 平台主题选择
- **自动选择**: 通过 `ThemeManager` 自动根据平台选择主题；在 `runCommonApp` 中可通过 `lightTheme` 和 `darkTheme` 参数手动指定；主题受 `SettingsController` 中的主题设置影响

#### 4. 迁移规范
- **优先扩展**: 如果view中使用的key在 `lib/common/theme/base/` 中不存在，优先在base中扩展；适配顺序：先 `ThemeDimensions`，再 `ThemeTextStyles`，最后 `ThemeColors`；不要将view中的key替换为base中已有的key，而是扩展base

### 与 lib/common/ 的关联
- **基础主题类**: `lib/common/theme/base/theme_colors.dart` (颜色系统), `theme_text_styles.dart` (文本样式), `theme_dimensions.dart` (尺寸间距), `extensions/gradient_extensions.dart` (渐变扩展), `theme_manager.dart` (主题管理器)
- **平台主题**: `lib/common/theme/platforms/mobile/` (移动端), `web/` (Web端), `desktop/` (桌面端)
- **设计原则**: 无Manager文件，直接使用静态类；优先直接引用公共主题类，避免二次封装；仅在APP需要特殊定制时才创建扩展文件

## 公共模块架构 (lib/common/)

实际模块树结构：
```
lib/common/
├── app/                    # 应用入口 (main_common.dart)
├── assets/                 # 资源管理 (icons/images/launch)
├── auth_v2/                # 认证系统v2 (多提供商: Google/GitHub/微信/QQ/手机号)
├── cache_manager/          # 缓存管理器
├── constants/              # 应用常量
├── controller/             # 控制器 (settings_controller)
├── database/               # 数据库系统 ✅ (SQLite/IndexedDB/接口抽象/模型)
├── i18n/                   # 国际化服务
├── iframe/                 # iframe监听器
├── localization/           # 本地化管理 (多语言/地图本地化)
├── map/                    # 地图模块 ✅ (地图服务/定位服务/工具类)
├── media/                   # 音视频模块 ✅ (音频播放录制/视频播放录制/工具)
├── model/                   # 数据模型 (用户/消息/词汇表)
├── network/                 # 网络框架v1 (统一客户端/拦截器/WebSocket/端点)
├── network_v2/              # 网络框架v2 (认证策略/缓存/队列/解析)
├── provider_status/         # 状态提供者 (基础/屏幕尺寸/用户)
├── repo/                    # 数据仓库
├── sdk/                     # SDK集成 (Azure Maps/Tencent Maps)
├── services/                # 服务层 (设置服务)
├── settings/                # 设置系统 ✅ (模型/配置/存储)
├── storage/                 # 存储系统v1 (Hive实现/接口/迁移)
├── storagev2/               # 存储系统v2 (应用/业务/数据访问/DI)
├── theme/                   # 主题系统 (基础/平台适配/兼容性)
├── utils/                   # 工具类库 (日期/验证/图片/显示/平台/文本/Web)
└── widgets/                 # 组件库 (65个组件: 按钮/输入/对话框/导航/布局/通用)
```

模块说明：公共模块提供核心基础设施，包括网络框架(双版本)、存储系统(双版本)、数据库(跨平台SQLite/IndexedDB)、认证系统(多提供商)、地图/音视频/设置等完整功能模块，以及65+可复用组件和工具类库，支持多平台(Web/Native)和国际化。



## 路由系统及适配双入口模式设计
- **规范**: `lib/apps/app_{name}/router_app_{name}/` 目录包含 `router_app_{name}.dart` (路由配置主文件，基于`go_router`，实现`createRouter()`方法传给runCommonApp) 和 `routes_provider_app_{name}.dart` (路由提供者，用于路由定义和聚合)
- **总入口**: `lib/apps/app_main/router_app_main/routes_provider_app_main.dart` 硬编码所有其他APP的路由，import `lib/apps/app_{name}/router_app_{name}/router_app_{name}.dart` 或 `routes_provider_app_{name}.dart`

## `lib/common/utils` 工具类库设计
- **迁移**: 根据新的架构设计，所有工具类和辅助类已从分散的 `lib/util/` 和 `lib/helper/` 目录迁移到统一的 `lib/common/utils/` 目录下
- **旧代码兼容**: `display_helper.dart` 中 DeviceType 更名为 DisplayDeviceType
- **目录结构**: `lib/common/utils/` 包含 `utils.dart` (统一导出文件), `compatibility/` (向后兼容层), `date/` (日期时间工具), `validation/` (数据验证工具), `image/` (图片处理工具), `display/` (显示和响应式设计工具), `platform/` (平台检测工具), `common/` (通用工具类), `web/` (Web平台专用工具), `text/` (文本处理工具)
- **推荐导入**: `import 'package:qyflutter/common/utils/utils.dart';`

## 网络使用规范
- 使用规范，在 `config_app_{name}` 目前定义网络对象(注意网络对象不是一个url字符串，而是包含了url/认证方式等因素的一个对象 from `lib/common/network/models/api_config.dart`)，同时在同目录定义数据结构, 之后将网络对象/数据结构 传递给 `auth_controller.dart`(返回一个包含了isLogin/getUserInfoData/post/get/put/delete等方法且支持数据持久化的网络客户端对象)，在`services_app_{name}`目录下建立 `{name}_auth_api_service.dart` / `{name}_product_api_service.dart` 这样的文件进行传递，并在server.dart方法中导出 post / isLogin / get 等方法, 多个 `service` 方法供不同的页面调用

lib/common/network/controller/
└── auth_controller.dart                    # 认证控制器工厂

lib/apps/app_{name}/
├── config_app_{name}/
│   ├── api_config_app_{name}.dart              # API配置和数据解析
│   ├── api_endpoints_app_{name}.dart           # API端点定义
│   └── api_data_models_app_{name}.dart             # 数据模型定义
└── services_app_{name}/
    ├── auth_api_app_{name}_service.dart        # 示例 ：认证API服务
    ├── user_api_app_{name}_service.dart        # 示例 ：用户API服务
    ├── product_api_app_{name}_service.dart     # 示例 ：产品API服务

//-------------------------------------------

## 状态管理
- **状态管理包**: 使用 `package:provider/provider.dart` / `package:flutter/foundation.dart` 作为状态管理，对于需要持久化的数据使用数据库，状态管理通用类实现在 `lib/common` 中
- **Get包**: 本项目已不使用Get作为状态管理，Get仅提供获取系统常量的基本功能，旧代码中包含请修改过来，现在使用provider包来作为状态管理，在lib/common中实现通用类
- **UserProvider**: 任何APP都至少要提供一个UserProvider对象，在APP中实现`lib/apps/app_{appname}/models_app_{name}/user_model_app_{name}.dart`，用于存放APP的用户登录状态，以及一个Setting的持久化controller用于供各个VIEW调用设置、设置全局settingKey等


// -----------------------------------------------------------------------------------------------------

## Profile 使用规范
- 待添加

// ----------------------------------------------------------------------------------------------------------


## APP迁移计划
- 旧的app目录内的 locationze / controller 等文件夹，按{appname}这种新的命名规范移动和合并（注意：有可能同时存在旧的文件夹和新的文件夹，这是由于某个AI移动了一半造成的，你可以进行合并“旧的合并到新的”）
- 目录结构层级修改为新的构架结构... 如果旧的文件和新的文件重复（比如新的文件已经正确、但忘记删除旧的文件），你可以检查完毕确认安全后移除旧的文件
- 不需要旧的文件 和 新的构架的桥接文件，比如 `legacy` 你将检查是否有文件调用了此类桥接代码，然后全部移动为新的构架.

## flutter bloom 框架更新 
- **Prefs**: `lib/common/provider_status/prefs.dart` 已删除，改由app的config中提供prefs给runCommonApp，每个app都有独立的prefs
- **UserModel**: `lib/common/modole/user_model.dart` 已删除，user_model改为由专属APP提供，任何APP都至少要提供一个UserProvider对象（详见"状态管理"）


## 静态资源使用规范

### 资源目录结构
```
assets/
├── common/              # 公共资源（所有APP共享）
│   ├── icons/          # 公共图标，路径: assets/common/icons/
│   ├── images/         # 公共图片，路径: assets/common/images/
│   └── launch/         # 公共启动图，路径: assets/common/launch/
├── .internal_common    # 内部资源，仅用于恢复编译替换的图标/背景图，禁止写入dart代码
└── apps/               # APP专属资源
    ├── app_{name}/     # APP专属资源目录
    │   ├── icons/      # APP图标，路径: assets/apps/app_{name}/icons/
    │   ├── images/     # APP图片，路径: assets/apps/app_{name}/images/
    │   └── launch/     # APP启动图，路径: assets/apps/app_{name}/launch/
    └── .internal_{appname} # APP内部资源，仅用于替换编译资源，禁止写入dart代码
```

### 公共资源使用 (lib/common/assets/)

#### 1. 公共图标 (CommonAssetsIcons)
- **位置**: `lib/common/assets/common_assets_icons.dart`，**路径**: `assets/common/icons/{filename}`，**使用**: `Image.asset(CommonAssetsIcons.logo)`

#### 2. 公共图片 (CommonAssetsImages)
- **位置**: `lib/common/assets/common_assets_images.dart`，**路径**: `assets/common/images/{filename}`，**使用**: `Image.asset(CommonAssetsImages.avatarPlaceholder)`

#### 3. 公共启动图 (CommonAssetsLaunch)
- **位置**: `lib/common/assets/common_assets_launch.dart`，**路径**: `assets/common/launch/{filename}`，**使用**: `Image.asset(CommonAssetsLaunch.splash)`

### APP专属资源使用 (lib/apps/app_{name}/resources_app_{name}/)

#### 1. APP图标 (AssetsIconsApp{Name})
- **位置**: `lib/apps/app_{name}/resources_app_{name}/assets_icons_app_{name}.dart`，**路径**: `assets/apps/app_{name}/icons/{filename}`，**Key命名**: 所有常量名必须有 `{appname}` 前缀，**使用**: `Image.asset(AssetsIconsAppExample.exampleLogo)`

#### 2. APP图片 (AssetsImagesApp{Name})
- **位置**: `lib/apps/app_{name}/resources_app_{name}/assets_images_app_{name}.dart`，**路径**: `assets/apps/app_{name}/images/{filename}`，**Key命名**: 所有常量名必须有 `{appname}` 前缀，**使用**: `Image.asset(AssetsImagesAppExample.exampleBanner)`

#### 3. APP启动图 (AssetsLaunchApp{Name})
- **位置**: `lib/apps/app_{name}/resources_app_{name}/assets_launch_app_{name}.dart`，**路径**: `assets/apps/app_{name}/launch/{filename}`，**Key命名**: 所有常量名必须有 `{appname}` 前缀，**使用**: `Image.asset(AssetsLaunchAppExample.exampleSplash)`

### 资源使用规范

#### 1. 导入规范
- **公共资源**: 从 `lib/common/assets/` 导入；**APP资源**: 从 `lib/apps/app_{name}/resources_app_{name}/` 导入；**禁止**: APP资源文件禁止导入common资源进行二次包装

#### 2. 使用方式
- **Image.asset**: `Image.asset(CommonAssetsIcons.logo)`
- **AssetImage**: `image: AssetImage(CommonAssetsImages.backgroundLight)`
- **IconButton**: `icon: Image.asset(CommonAssetsIcons.menu)`

#### 3. 命名和路径规范
- **Key命名**: 公共资源直接命名无需前缀 (`logo`)，APP资源必须有 `{appname}` 前缀 (`exampleLogo`)，避免不同APP之间的资源Key冲突
- **路径格式**: 公共资源 `assets/common/{type}/{filename}`，APP资源 `assets/apps/app_{name}/{type}/{filename}`，类型为 `icons`, `images`, `launch`
- **资源添加**: 公共资源禁止随意添加需所有APP共享，APP资源仅在 `resources_app_{name}/` 目录下添加，字体资源仅在common中定义一次

### 与 lib/common/ 的关联
- **公共资源类**: `lib/common/assets/common_assets_icons.dart` (公共图标), `common_assets_images.dart` (公共图片), `common_assets_launch.dart` (公共启动图)
- **设计原则**: 无Manager文件，直接使用类中的静态常量，不进行二次封装；APP资源独立封装，禁止引入common进行二次包装

