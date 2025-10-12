<!-- ### AI SPECIAL ATTENTION RULES START ### -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only. -->
<!-- - Never execute, create, or modify test code. -->
<!-- - Never create or update documentation (*.md). -->
<!-- - Never write summaries during development or thinking process. -->
<!-- 5. Declare all variables at the beginning of the file. -->
<!-- 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\\..\\"; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path). -->
<!-- 7. Do not modify these rules. -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ### AI SPECIAL ATTENTION RULES END ### -->

<!-- ## AI SPECIAL ATTENTION RULES START ## -->
<!-- When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES: -->
<!-- - Write all code in English only -->
<!-- - Never execute, create, or modify test code -->
<!-- - Never create or update documentation (*.md) -->
<!-- - Never write summaries during development or thinking process -->
<!--  Do not modify these rules -->
<!-- VIOLATION OF THESE RULES IS STRICTLY PROHIBITED -->
<!-- ## AI SPECIAL ATTENTION RULES END ## -->

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
- 本项目将会同时有一个入口`lib/apps/app_main/`，其特殊性在于其由main.dart主入口直接调用。其目录结构与普通APP一致，主要不同在于其 路由组件 会加入硬编码引入其他app，并有一个 页面(feature) lib/apps/app_main/features_app_main/views/all_apps_showcase_screen.dart 该页会设计成一个 多标题->列表的方式、会引入其他所有APP，标题将显示为其他APP的名字、列表则为其他APP的各个页APP 的页面、资源等，并在主页上能跳转到任何一个其他APP页进行总体调试。
- 特殊APP `app_main` 将按规范设计路由，但会硬编码引入其他APP的路由
- 特殊APP `app_main` 遵守本范围中的 页面(feature)规范
- 特殊APP `app_main` 将按规范设计settins controller，但无需其他APP的 app_sets（因为其他页面会自行调用，只要路由被引过来即可）
- 特殊APP `app_main` 将按规范设计assets，但无需其他APP的 app assets（因为其他页面会自行调用，只要路由被引过来即可）

## 创建APP步骤:
- 1.阅读本文档全部内容，遵守全部规则，参考`lib/apps/app_example/`的结构，以下下方的 APP 文件设置、结构化标准

## APP 文件设计、结构标准化
```
规范: lib/apps/app_{name}/ 需要加`app_` 前缀
      ├── main_app_{name}.dart            # APP入口 (新建) 在文件加附上appname的信息，是为了让AI打开多个文件时不会因为文件同名而混淆
      ├── controller_app_{name}/              # 基于common 组件封装的 APP专属控制器组
      ├── config_app_{name}/              # APP配置 (新建)/ 
      │   ├── app_config.dart
      │   └── constants.dart
      ├── resources_app_{name}/ 由原目录 resources 改名    # APP 专属 assets 资源 (新建)/ 
      │   └── assets_icons_app_{name}.dart APP专属图标定义、需要参考公共 common assets的写法, assetsKey 前缀需要有 {appname}
      │   └── assets_images_app_{name}.dart 
      │   └── assets_fonts_app_{name}.dart  # 废弃文件，font只在common中定义一次
      ├── models_app_{name}/            # 所有数据模型定义，其中至少要定义以下文件
      │   └── user_model_app_{name}.dart  * 必须定义，针对该APP的用户数据模式
      ├── features_app_{name}/            # 功能模块 (重命名feature_{name})/ 
      │   └── {feature}/
      │       ├── views/       # 页面视图 (如果有旧的 view 目录，请合并到 views 目录)
      │       ├── widgets/     # 页面组件 (保留)
      │       ├── controllers/ # 控制器 (新建)，可引用总 models_app_{name} 中的数据
      ├── services_app_{name}/            # 服务层 (新建)/ 
      │   └── {name}_service.dart
      │   └── {name}_auth_api_service.dart # 基于 网络/持久化实现的用户认证的网络客户端: 方法 ：登陆/注册/注销/是否登陆/用户信息/POST发送/GET,PUT,DELETE发送等方法.
      │   └── {name}_public_api_service.dart  #  基于 网络/持久化实现的用户认证的网络客户端, 方法 : POST发送/GET,PUT,DELETE发送等方法.
      ├── repositories_app_{name}/        # 数据仓库 (新建)/ 
      │   └── {name}_repository.dart
      ├── utils_app_{name}/               # APP工具 (新建)/ 
      │   └── app_utils.dart
      ├── localization_app_{name}/        # APP多国语言目录
      │   ├── en_app_{name}.dart
      │   └── zh_app_{name}.dart
      │   └── localization_keys_app_{appname}.dart      # app专属TextKye 定义,必须, en_app / zh_app 基于此key定义，textKey 需要有`{appname}`作为前缀
      └── router_app_{name}/              
      │   └── router_app_{name}.dart    # 路由配置 (重命名router_{name})/ 路由的KEY 定义在路由代码中，不要定义在常量文件中，这样修改路由的时候 不必要同时打开两个文件,需要在其中实现`createRouter` 方法 传给runCommonApp。
      └── otherdir_app_{name}/           # 所有功能、资源等文件夹均要按此格式命名 

功能特性:
- lib/common/ 内提供所有公共类库，向各个APP进行服务提供
- 在文件夹/文件上附上 {appname} 的信息，是为了让AI打开多个文件时不会因为文件同名而混淆

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
            

## 配置管理模块 应用于多入口设计规范
```
通用设置: lib/common/config/
      ├── app_config.dart      # 通用应用配置、如isDark等所有APP都会用到的配置
      ├── environment_config.dart # 环境配置
      ├── api_config.dart      # API配置
      └── constants.dart       # 常量定义
```

## 主题系统模块 / Styles 调用及 APP 扩展规范
```
lib/common/theme/
├── base/                            # 基础主题组件 ✅
│   ├── theme_colors.dart           ✅ 重命名: 统一颜色常量定义 (完整色彩系统)
│   ├── theme_text_styles.dart      ✅ 新增: 文本样式定义 (iOS风格文本系统)
│   ├── theme_dimensions.dart       ✅ 新增: 尺寸间距定义 (响应式尺寸系统)
│   └── theme_constants.dart        ✅ 新增: 主题常量配置 (主题配置常量)
├── extensions/                      # 主题扩展 ✅
│   ├── gradient_extensions.dart    ✅ 重组: 渐变扩展 (合并dark/light渐变)
│   ├── platform_extensions.dart    # 待创建: 平台特定扩展
│   └── custom_extensions.dart      # 待创建: 自定义扩展
├── platforms/                       #  针对不同平台的预设主题，每个平台至少包含一个dart/light主题，这些主题 受 本文档 的 `Setting controller` 中对应的变量影响，请在代码开发中注意
│   ├── mobile/                     # 移动端主题 ✅
│   │   ├── mobile_light_theme.dart ✅ 重命名: 移动端浅色主题 (绿色薄荷主题)
│   │   └── mobile_dark_theme.dart  ✅ 重命名: 移动端深色主题 (紫色渐变主题)
│   ├── web/                        # Web端主题 ✅
│   │   ├── web_light_theme.dart    ✅ 重命名: Web端浅色主题 (荧光绿主题)
│   │   └── web_dark_theme.dart     ✅ 重命名: Web端深色主题 (科技暗黑主题)
│   └── desktop/                    # 桌面端主题 ✅
│       ├── desktop_light_theme.dart ✅ 新增: 桌面端浅色主题 (微软风格)
│       └── desktop_dark_theme.dart  ✅ 新增: 桌面端深色主题 (VS Code风格)
└── theme_manager.dart              # 主题管理器 (待创建)

-  APP专属 调用及扩展 styles,App 中由以处几个文件调用`lib/common/theme/base/`中的颜色,字体等基本设置，为了减小二次包装: 无 manager文件
lib/apps/app_{name}/  *： 注意，这些是在app有特别扩展的情况下，如果不需要扩展，直接在view文件中引用`lib/common/theme/base/`
      ├── resources_app_{name}/ 
      │   └── colors_app_{name}.dart - 特定的样式扩展，将基于common中的对应style
      │   └── text_styles_app_{name}.dart -特定的文本样式扩展，将基于common中的对应style
      │   └── dimensions_app_{name}.dart - 的主题扩展和组件样式，将基于common中的对应style

lib/common/theme/ 以下废弃( 因为已经定义在 `lib/common/theme/base/`)
├── styles/common_styles.dart              # 废弃( 因为已经定义在 `lib/common/theme/base/`)
├── styles/common_text_styles.dart         # 废弃( 因为已经定义在 `lib/common/theme/base/`)    
├── styles/common_theme_extensions         # 废弃( 因为已经定义在 `lib/common/theme/base/`)      
├── 其他废弃 styles 目录
目前在移置过程中，如果发现view中有的key而 `lib/common/theme/base/` 没有，则优先在 `lib/common/theme/base/` 目录中扩展出key,而不是将view中的key替换成base中的。
需要将所有view页中的Dimensions 适配 package:qyflutter/common/theme/base/theme_dimensions.dart 中的，但如果 theme_dimensions 中的key不存在，优先扩展  theme_dimensions.dart
需要将所有view页中的styles 适配 package:qyflutter/common/theme/base/ 中的，但如果 theme_text_styles/  theme_colors 中的key不存在，优先扩展  `theme/base`
需要将所有view页中的 colors 适配 package:qyflutter/common/theme/base/ 中的，但如果 theme_colors 中的key不存在，优先扩展  `theme/base`
```

## 公共组件模块
```
当前: lib/common/widgets/
优化: lib/common/widgets/
      ├── buttons/             # 按钮组件
      │   ├── custom_button.dart (保留)
      │   └── swipeable_button/ (保留目录)
      ├── inputs/              # 输入组件
      │   ├── custom_text_field.dart (保留)
      │   └── custom_search_input.dart (保留)
      ├── dialogs/             # 对话框组件
      │   ├── animated_custom_dialog.dart (保留)
      │   ├── confirmation_dialog.dart (保留)
      │   └── image_dialog.dart (保留)
      ├── navigation/          # 导航组件
      │   ├── custom_app_bar.dart (保留)
      │   └── custom_bottom_navigation.dart (保留)
      ├── layouts/             # 布局组件
      │   ├── responsive_layout.dart (保留)
      │   └── paginated_list_view.dart (保留)
      └── common/              # 通用组件
          ├── custom_image.dart (保留)
          ├── custom_loader.dart (保留)
          └── no_data_screen.dart (保留)

迁移: 按功能分类重组现有widgets
```

## 工具类模块
TODO：
```
当前: lib/helper/ 和 lib/util/
合并: lib/common/utils/
      ├── date/                # 日期工具
      │   └── date_converter.dart (从helper/移动)
      ├── validation/          # 验证工具
      │   └── email_checker.dart (从helper/移动)
      ├── image/               # 图片工具
      │   ├── image_loader.dart (从helper/移动)
      │   └── image_size_checker.dart (从helper/移动)
      ├── display/             # 显示工具
      │   ├── display_helper.dart (从helper/移动)
      │   └── responsive_helper.dart (从helper/移动)
      ├── platform/            # 平台工具
      │   └── get_platform.dart (从util/移动)
      └── common/              # 通用工具
          ├── price_converter.dart (从helper/移动)
          └── toaster_helper.dart (从helper/移动)

迁移: 合并helper和util目录，按功能分类
```

## 新增模块

### 文件操作模块
```
新建: lib/common/file/
      ├── file_manager.dart    # 文件管理器
      ├── file_picker_service.dart # 文件选择服务
      └── file_utils.dart      # 文件工具
```

### 地图模块 ✅ COMPLETED
```
已创建: lib/common/map/
      ├── map_service.dart           ✅ 地图服务 (地图显示/标记/路线)
      ├── location_service.dart      ✅ 定位服务 (GPS/权限/位置流)
      └── map_utils.dart             ✅ 地图工具 (距离/方位/边界计算)

功能特性:
- 地图: 交互式地图组件/标记管理/路线规划/地址搜索
- 定位: GPS定位/权限管理/位置流/精度控制
- 工具: 距离计算/方位计算/坐标转换/边界检测
- 跨平台: Web和Native平台适配
- 算法: Haversine公式/Douglas-Peucker简化/坐标验证
```

### 音视频模块 ✅ COMPLETED
```
已创建: lib/common/media/
      ├── audio/               # 音频处理
      │   ├── audio_player.dart      ✅ 音频播放器 (支持Web/Native)
      │   └── audio_recorder.dart    ✅ 音频录制器 (多格式支持)
      ├── video/               # 视频处理
      │   ├── video_player.dart      ✅ 视频播放器 (跨平台组件)
      │   └── video_recorder.dart    ✅ 视频录制器 (摄像头支持)
      └── media_utils.dart           ✅ 媒体工具类 (文件处理/格式验证)

功能特性:
- 音频: 播放/录制/格式转换/音量控制
- 视频: 播放/录制/摄像头切换/质量设置
- 工具: 文件验证/格式检测/大小计算/MIME类型
- 跨平台: Web和Native平台适配
```

### 数据库模块 ✅ COMPLETED
```
当前: lib/util/idb_shim/ 和 lib/util/sqlite/
重组: lib/common/database/
      ├── interfaces/          # 数据库接口 ✅
      │   └── database_interface.dart        ✅ 数据库抽象接口 (CRUD/事务/迁移)
      ├── sqlite/              # SQLite实现 ✅
      │   └── sqlite_service.dart           ✅ SQLite服务 (跨平台/事务支持)
      ├── idb/                 # IndexedDB实现 ✅
      │   └── idb_service.dart              ✅ IndexedDB服务 (Web优化)
      ├── models/              # 数据模型 ✅
      │   └── base_model.dart               ✅ 基础模型类 (时间戳/验证)
      └── database_manager.dart             ✅ 数据库管理器 (多类型/迁移)

功能特性:
- 接口抽象: 统一的CRUD接口/事务支持/迁移管理
- SQLite: 跨平台支持/事务处理/表管理/查询构建
- IndexedDB: Web优化/对象存储/索引支持
- 模型系统: 基础模型/时间戳/验证/关系映射
- 管理器: 多数据库类型/自动迁移/健康检查/统计信息
- 类型安全: 泛型支持/编译时检查

迁移: 重组现有数据库相关代码 ✅
```

## 通用设置系统模块 ✅ COMPLETED
```
设计方案: 硬编码传递设置配置实现代码隔离，设置模块是供各个APP的设置页面使用的基本类库，基于每个APP都要进行基本设置这个需求，首先会有一个共公的设置对象，之后会在各个入口硬编码 APP 专属的设置对象，核心思路是每个APP得到一个包含基本设置(如isDark)等的集合，同时设置会被持久化保存。同时设置对象将有特殊的信息指导页面如何设计：如 某个设置 -> 期望设置为select选项、某设置 -> 期望设置为toggle等，并附有可选项、默认值(会被持久化数据覆盖)、Lable字符(可选)等信息。

架构组成:
lib/common/settings/
├── models/
│   └── setting_item.dart              ✅ 通用设置模板 (支持toggle/select/checkbox/slider/textInput等)
├── configs/
│   ├── base_settings.dart             ✅ 基础设置 (base_sets: 主题/语言/字体等),这是考虑到大部份APP都必备的设计,同时专属的APP设置也要基于此编码格式
- settings 公共控制器
lib/common/controller/
└── settings_controller.dart       ✅ 通用设置管理类库[该库自动先附加base_settings]，通过构造方法 ( 可以传入多个 base_settings规范的语言编码 ) 合并为一个可用的设置类，直接供页面使用

APP专属设置 (app_sets):
├── lib/apps/app_{appname}/settings_app_{appname}/
│   └── settings_app_{appname}.dart       # 将实现一个与base_settings.dart 编码格式一致的设置扩充：比如 是否每日更新，注意：需要以{appname}为setting_key的前缀。并同时引入 `lib/common/controller/settings_controller.dart` 进行追加 `app_sets` 的封装，最终由 settings_app_{appname}.dart 提供一个可供 feature(页面) 等使用的 setting 实例 

```



## 路由系统及适配双入口模式设计
```
当前: lib/app_{name}/
优化: lib/apps/app_{name}/ 需要加`app_` 前缀
      ├── router_app_{name}.dart     # 为APP提供的路由，基于'package:go_router 例如:`static const String routeHome = '/{name}/home';` (废弃旧方法：不要再对路由使用provider进行二次包装),需要在其中实现`createRouter` 方法 传给runCommonApp.
      
总入口 - 硬编码所有app的路由文件:
     lib/apps/app_main/
      ├── apps_bootstrap_main.dart 硬编码所有其他 APP 的路由比如 import `lib/apps/app_{name}/router_app_{name}.dart`
```

##  `lib/common/utils` 工具类库设计
- 根据新的架构设计，所有工具类和辅助类已从分散的 `lib/util/` 和 `lib/helper/` 目录迁移到统一的 `lib/common/utils/` 目录下。
```
## 旧代码兼容
1. `display_helper.dart` 中 DeviceType  更名为 DisplayDeviceType
```
- 工具类模块位于 `lib/common/utils/` 目录下，提供应用程序所需的各种工具类和辅助函数。
- 目录结构
```
 `utils.dart` - 统一导出文件，提供所有工具类的单一导入点
 `compatibility/` - 向后兼容层，支持旧版本导入路径
 `date/` - 日期时间相关工具
 `validation/` - 数据验证工具
 `image/` - 图片处理工具
 `display/` - 显示和响应式设计工具
 `platform/` - 平台检测工具
 `common/` - 通用工具类
 `web/` - Web平台专用工具
 `text/` - 文本处理工具
- **推荐导入方式**:
   import 'package:qyflutter/common/utils/utils.dart';
```

## 网络使用规范
- 使用规范，在 `config_app_{name}` 目前定义网络对象(注意网络对象不是一个url字符串，而是包含了url/认证方式等因素的一个对象 from `li/common/network/models/api_config.dart`)，同时在同目录定义数据结构, 之后将网络对象/数据结构 传递给 `auth_controller.dart`(返回一个包含了isLogin/getUserInfoData/post/get/put/delete等方法且支持数据持久化的网络客户端对象)，在`services_app_{name}`目录下建立 `{name}_auth_api_service.dart` / `{name}_product_api_service.dart` 这样的文件进行传递，并在server.dart方法中导出 post / isLogin / get 等方法, 多个 `service` 方法供不同的页面调用

lib/common/controller/
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
- 本项目使用 'package:provider/provider.dart' /'package:flutter/foundation.dart' 作为状态管理，对于某此需要持久化的数据，使用数据库,状态管理将要一个通用的类实现在 `lib/common`中
- 本项目已经没有使用Get作为状态管理，Get仅在本项目中提供获取系统常的基本功能，无其他用处，可能旧代码中会包含请修改过来。现在使用provider包来作为状态管理，且在 lib/common 中实现通用类。你可以先查看 ·lib/common· 是否否有对应的代码。
- 任何APP都至少要提供 一个 UserProvider 对象，在APP中实现`lib/apps/app_{appname}/models_app_{name}/user_model_app_{name}.dart`，用于存放APP的用户登陆状态，以及一个Setting 的持久化 controller 用于供各个VIEW调用设置、设置全局 settingKey等。


// -----------------------------------------------------------------------------------------------------

## Profile 使用规范
- 待添加

// ----------------------------------------------------------------------------------------------------------

## 创建APP步骤
1.根据assets规范，在 pubspec.yaml中添加静态资源，并创建对应目录，对应assets app中的dart文件，以及参考 example代码编码assets 资源类库.

## APP迁移计划
- 旧的app目录内的 locationze / controller 等文件夹，按{appname}这种新的命名规范移动和合并（注意：有可能同时存在旧的文件夹和新的文件夹，这是由于某个AI移动了一半造成的，你可以进行合并“旧的合并到新的”）
- 目录结构层级修改为新的构架结构... 如果旧的文件和新的文件重复（比如新的文件已经正确、但忘记删除旧的文件），你可以检查完毕确认安全后移除旧的文件
- 不需要旧的文件 和 新的构架的桥接文件，比如 `legacy` 你将检查是否有文件调用了此类桥接代码，然后全部移动为新的构架.

## flutter bloom 框架更新 
- `lib/common/provider_status/prefs.dart` 文件删除，改由app的config中提供 prefs 给runCommonApp，这样做的好处是如果在主main中调用所有app则每个app都有独立的prefs.
- `lib/common/modole/user_model.dart` 文件删除， user_model改为由专属APP提供，任何APP都至少要提供 一个 UserProvider 对象，在APP中实现`user_model.dart`，用于存放APP的用户登陆状态，以及一个Setting 的持久化 controller 用于供各个VIEW调用设置、设置全局 settingKey等。

## prefs 的全局使用
- 创建 provider 文件要求 在 `lib/common/app_{name}/provider_app_{name}`  目录下创建 provider_app_{name}.dart 文件
- 这个文件至少要导出一个实例化的 PrefsApp{name} 对象
- 导出的实例对象要提供给 main_app_{name}.dart，在 runCommonApp 中传入
- settings_controller  中也可以调用这个实例
- PrefsApp{name} 实现要求 至少要实现 AppPrefsBase 中要求的方法
- 添加一个 initSharedPreferences 方法，该方法应该返回一个 prefs 而不是传入，这样 appPrefs 就有 prefs 了
- 在 main_app_{name}.dart 中合适的地方调用 PrefsApp{name} 的 initSharedPreferences 完成初始化工作，runCommonApp 内部会自动调用


## assets 静态资源构架
- 公共资源 及 专属app的静态文件组成（所有app都有可能引用的通用资源），禁止往assets/common中添加
lib/assets/
      ├── common/              # 公共资源
      │   ├── icons/           # 资源固定，非必要不添加
      │   ├── images/          # 资源固定，非必要不添加
      │   ├── fonts/           # 资源固定，非必要不添加
      │   └── launch/         # 资源固定，非必要不添加
      ├── .internal_common    # 仅用于还原因其他app编译或调试替换 $rootDir/andriod | ios | windows 中的原始图标、背景图，禁止写入assets dart 代码
      └── apps/                # APP资源
          ├── app_{name}/      # App专属资源
          │   ├── icons/
          │   ├── images/
          │   └── launch/
          │   └── fonts/
          ├── other app
          ├── .internal_{appnam} # App 内挂专属资源，仅用于存入替换 $RootDir/andrioid | ios等替换编译资源的图标、启动图等，因为此类资源打包时实际只在 flutter 项目的 $RootDir/andrioid | ios 里起作用，不放在 app_{name} 是防止打包是被打包到apk中，或者ai分不清写到assets dart代码中。
          ├── other internal for app
- 资源代码组成 为减少二次包装，以下构架设计中不要使用 manager 文件 。
lib/common/assets/        # 通用资源编码，对应 `lib/assets/common/*`
   ├── common_assets_icons.dart       # 提供全局调用的 Icons 图标预设，直接引用assets/app_common_assets/ 中的资源, assetsKey 前缀需要有 `common_` 开头
   ├── common_assets_images.dart         # 同上，但放图片类assets
   └── common_assets_launch.dart         # 同上，但放背景图、启动图 等大形图片资源
lib/apps/app_{name}/ APP 专属assets 参考`common`格式独立封装 ，禁止二次包装、禁止引入common，不使用 manager 等二包文件 。
   ├── resources_app_{name}/  # 独立封装，禁止引入common二次包装...
   │   └── assets_icons_app_{name} APP专属图标定义、assetsKey 前缀需要有 {appname}
   │   └── assets_images_app_{name} 
   │   └── assets_fonts_app_{name}  # 除非要求字体，否则不定义

## “调试及编译逻辑” 
- 设计思路，为了在调试和编译时，支持对多app入口的静态资源切换，参考本规范 `assets` 目录规范
1. 由$FlutterBloomRootDir/winStart.bat -> $FlutterBloomRootDir/scripts($FlutterPublicScriptDir)/dev($DevScriptDir)/startDevByWin.ps 作为入口点，脚本根据自身位置定位$FlutterBloomRootDir目录/$ScriptDev 目录 并使用$ScriptDev/win_common/Gvar.ps1(全局变量、常量) | BCommon.ps1(通用方法) 配合，并根据startDevByWin.ps可扩展出一系列功能： a, 扫描$FlutterBloomRootDir/lib/apps 目录，得到app表、其中$app_main = `lib/apps/app_main/` 能同时调试所有APP的特殊APPNAME, 并显示为一个菜单 上下箭头选择不同的 flutter-app 左右箭头toggle可选项，使用`win_common` 中的文件变量系统交换变量，对于菜单toggle的选项将要保存在文件变量中,下次运行时将要预设（以免每次选择） flutter-app 每个的可选项为【调试 | 编译】、菜单扩展一个触发 "辅助开发图标可视系统"，在$DevScriptDir/build_option.ini($build_option)中建立每个app的编译选项 APP名=：【外挂目录 = dir or $null or $true | 随机ID = $boolen | 随机APP显示名 = $boolne | 固定ID值(xxx.xxx.xxx) | 固定APP显示名值 | 是否优化压缩图片 | 调试平台 | 调试端口(仅对web有效) | 编译平台(andrioid/ios/win/全部) | 是否使用外挂目录安全编译 】b, 确保有常量目录 $BuildDir = D:\programing\.build_dir、$assets_plugin_dir = $BuildDir\assets_{app-name} 、$assets_internal_plugin_dir = $FlutterBloomRootDir/assets/.internal_{appnam} 、$DevTmpDir = $FlutterBloomRootDir/.dev_tmp/，$CacheDir = $DevTmpDir/.cache/，$BackpuDirRule = $DevTmpDir/.backpu/$BackupNamespaceDir/$BackupName_$timestamp、Gvar变量交换目录及相关功能、Debug常量$Debug、[$OriginalAppName/$OriginalAppPackageId] = $DevScriptDir/original_config.ini，通过Gavr交换常量/变量，实现Gvar一套交换规则.ps1/.py共用、别分实际ps1Gvar / PyGvar / ps1Common / PyCommon 逻辑，并由 $FlutterBloomRootDir/scripts/dev/py_helper | powershell_helper 中的一系列*.py / .ps1脚本辅助实现，当$Debug开启时，所有脚本都遵循打印即将操作的信息-等待按Y 以及 打印即将操作目录-等待按Y 以及 所有操作都有备份可恢复溯源，同时所有脚本任何条件下都遵循：只能修改不能删除文件/文件夹、任何单一脚功能不能太复杂保持代码300行内、代码全英文、ps1脚本$varname后禁止紧跟字符串`$varname:`[error] -> `$varname :`[ok]
、所能备份都要有$BackpuDirRule、所有脚本.ps1/.py都要在脚本执行前打印尽可能多的使用变量信息以便调试, b-1: *.py 辅助预编译脚本[适配$Debug、遵循之前述的规则]  根据 $build_optio 如果是 `使用外挂目录安全编译` ，在编译模式下，将$FlutterBloomRootDir 整个复制到 $BuildDir 并加上index, 将修改 $FlutterBloomRootDir => $Build/$FlutterBloomRootDir_$index,使用Gvar交换$FlutterBloomRootDir,后面的$FlutterBloomRootDir都是指经过Gvar读取的变量$FlutterBloomRootDirByGvar b-2: *.py 辅助预编译脚本[适配$Debug、遵循之前述的规则] 信息收集 通过以下正则规则组[`namespace "xxx.xxx.xxx`,`applicationId "xxx.xxx.xxx"`,`"package_name": "xxx.xxx.xxx"`,`-keep class xxx.xxx.xxx`,`package="xxx.xxx.xxx"`,`package xxx.xxx.xxx` ]遍历 在 $FlutterBloomRootDirByGvar/andrioid | ios |windows => ($PlatformByFlutterDirs)  查找得到所有的包ID，为防止有此ai改一个漏掉一个你需要全部查找、记录找到的文件，如果有多个不同的ID需要打印，将ID or IDs 放入Gvar 交换区； b-3: *.py 辅助预编译脚本[适配$Debug、遵循之前述的规则] ID替换，根据 $build_option 是使用Gvar交换区IDs 还是随机ID，生成随机ID或使用$OriginalAppPackageId替换 -上一步所查找到的文件，b-4: 辅助预编译脚本[适配$Debug、遵循之前述的规则] APP显示名查找及替换 在$PlatformByFlutterDirs 中找到可能的appname，同样根据 $build_option 中的选项是否生成随机名和$OriginalAppName进行处理和替换, b-5: *.py 辅助预编译脚本[适配$Debug、遵循之前述的规则] 设置一个$souceFileImagName -> [$TargetImageNameList]根据 $build_option，优先根据 $assets_plugin_dir 未找到则 $assets_internal_plugin_dir 找到 $souceFileImagName,遍历使用 $TargetImageFileNameList 查找 $PlatformByFlutterDirs, 分析每个$targetImage得到尺寸/大小，将$souceFileImagName等比例缩放到至少能适配$targetImage并裁掉多余的部份，如果已经满足直接裁剪合适，然后替换$TargetFileName，为了防止图片位置的不固定，本脚本所有文件查找使用弟归搜索、禁止直接使用路径、同时根据  $build_option  选择是否压缩力片, b-5-1: *.py 辅助预编译脚本[适配$Debug、遵循之前述的规则] 需要先实现一个独立的yaml操作类($yamlClassByPy)，禁止使用python yaml相关第三方库，而是使用读取为文件并使用\n分割字符串，并使用统计行首到第一个字符串的空格数来区分是否是几级标题的方法，必须以此方法来操作pubspec.yaml和其他相关yaml文件, b5-2: 使用$yamlClassByPy 并同时参考$FlutterBloomRootDirByGvar/pubspec.yaml 中的assets规则，根据{appname}确保assets目录存在，确保其他assets目录被注释，如果是主入口(能同时调试所有APP的特殊APP 的$app_main)则保证所有app 的assets目录被添加-便编译时不引用其他资源/调试也可以看到资源是否引入正确 c-1: 回到 startDevByWin.ps ，使用 powershell 环境，扩展辅助功能配合基本脚本，在使用$build_option 执行是否调试、编译的功能，并使用对应web/andriod/ios的命令，以及对app 编译是否添加进行压缩的命令。调试/编译将在try中进行，以使无论是否调试/编译成功，都能finall最终执行清理命令，c-2：根据c-1的要求，将主脚本的主要功能拆分出出放到$DevScriptDir/powershell_helper 目录中，主脚本只保留调用和if判断进行分支的功能，d: *.py 清理脚本[适配$Debug、遵循之前述的规则] 使用pubspece.yaml 最后时间戳的备份、以及$DevScriptDir/original_config.ini 和 `lib/common/.internal_common` 中的 资源，反向照抄一份 b1-bx 步骤的脚本，进行恢复，e：再次回到powershell环境，切换最初目录[脚本脚本开始前需要备份]。
- 如果以上脚本还未开发，请在开发时全部重构当前代码并写入一份开发记录 `$FlutterBloomRootDirByGvar/docs/DevSricptDebugBuild.md`，如果该文件已经存在，我还同时叫你开发，你可以先查看其中的进度和实际代码
- 辅助开发图标可视系统，本项目作为一个关联的web项目、启动后监听一个40017端口并调用浏览器打开，但将使用以上规范中的一些信息，但注意和以上脚本不关联, 原型参考 $FlutterPublicScriptDir/flutter_icons_view($FlutterIconViewDir)/flutter_icon_scanner.py,功能:开发 $FlutterIconViewDir/main.py及辅助功能，（同时建立一个 启动脚本 ps1,cmd触发脚本[注意不要同名] 对于本项目用到的包 打印pip 安装提示用于复制，但不安装打印即可只是用于提示，同时ps1也可用 $FlutterBloomRootDir/startDevByWin.ps 中的追加菜单启动）.1：启动后扫描 $PlatformByFlutterDirs 下的所有图片信息，并分几大组 Android/ios/windows/web 分别显示，路径文件名作为二级标题，图片显示预览/大小/图片智能识别类别【背景图|大图标|小图标|占位图)/智能识别图片符合度(比如andriod 使用-xhdpi 等的推荐大小与图片实际大小进行对比)/当前文件夹的推荐大小】为第三级区域， 2：每一级区域都有打开目录的按钮，但不同的是不使用后台命令，而点击后显示出一个input 和一个复制按钮，将复制explorer命令，3-1：第三级图片详情显示区有下载按钮，将图片下载，3-2：第二级图片区域显示一个压缩按钮，点击后一键压缩并应用图片, 4，针对扫描到的 $PlatformByFlutterDirs 作为一级选区域，该一级区域下的图片集合为二级选区域，开辟一个新的区域，上传一个图按确认后，将直接替换这些图。一级区域可多选，根据一级区域载入二级选区域。4，具有菜单，并有设置、确认后替换 $DevScriptDir/original_config.ini的功能，5:菜单具有 新功能- 开辟的新的区域，根据一级选区和二级选区得到一个[[$sourceFileName=>[$targetFilesList]]]后，根据上传的图片 使用推荐尺寸或自定义输入尺寸直接自动剪切替换.internal_common中的 $sourceFileName, 并参考`b-5`的已存在脚本，给 common/.internal_common 设计一个 同样的 替换规则，6.菜单扩展，能查看本节规范所有的常量信息，并尽可能多的打印规则信息，以更debug时查看代码是否正确. 7,菜单选项，拥有一键清理脚本，独立实现一份 `d` 功能的功能. 同时脚本保留 自动刷新和手动刷新功能。同时建立一个 完整的 andriod/ios/windows/web/andriod12等完整的图片推荐大小map库.

