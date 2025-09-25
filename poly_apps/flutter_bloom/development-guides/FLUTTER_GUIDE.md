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

# 重要提示

当你看到本文档时，可能是多个AI协同工作，所以文档、代码都是实时更新，你将尽可能更新代码和文档的最新内容。

# Flutter 聚合应用 - 基本规范

**必须遵守基本规范**

## 项目概述

- **项目模式**: 本项目是一个**多应用聚合 (Multi-App Aggregation)** 的 Flutter 应用，通过单一代码库支持多个业务模块
- **目标平台**: 当前优先支持 **Android**、**iOS** 移动端以及**手机 Web 端**
- **开发规范**: 代码全英文，除了多语言脚本，开发中禁止运行测试命令，禁止写测试脚本，禁止写总结
- **输出要求**: 任何要求本规范开发的，都输出一个开发结果到 `./{your Ai Name}_devlop_result.md` 文件，你可以持续更新该文件


## 多入口模式 ✅ COMPLETED

### 架构规范
```
双入口模式结构:
├── lib/main.dart                        ✅ 虚入口 (轻量级代理)，将引用特殊APP `lib/apps/app_main/`
├── lib/common/app/main_common.dart      ✅ 通用入口 (完整启动逻辑)
└── lib/apps/app_{name}/main_app_{name}.dart ✅ 独立入口 (APP专用)
```

### 入口说明

**主入口 (lib/main.dart)**
- 轻量级虚入口，直接调用 `lib/apps/app_main/`
- 由 app_main 调用通用入口 `main_common.dart`
- 启动后会引用所有APP的路由总集、多语言总集、静态资源总集

**通用入口 (lib/common/app/main_common.dart)**
- 包含完整启动逻辑
- 对外提供一个 runCommonApp 方法
- 可以传入一个或多个的多语言、路由等资源

**独立入口示例**
- `lib/apps/app_qy/main_app_{appname A}.dart`: A应用独立入口，仅包括本APP的代码和资源
- `lib/apps/app_bloom/main_app_{appname A}.dart`: B应用独立入口

**功能特性**
- `lib/main.dart` 用于统一调试所有 APP 的特殊APP `lib/apps/app_main/`

## 示例APP

本项目包含一个示例APP，该APP将遵守本规范开发，并作为后续基于此flutter创建新APP时的蓝本。当要求开发示例APP时，你可以在 `lib/apps/app_example/` 其中开发。

## 主入口 main.dart 特殊APP `app_main`

### 特殊性说明
本项目将会同时有一个入口 `lib/apps/app_main/`，其特殊性在于其由main.dart主入口直接调用。

### 目录结构特点
- 目录结构与普通APP一致
- 主要不同在于其路由组件会加入硬编码引入其他app
- 有一个页面(feature) `lib/apps/app_main/features_app_main/views/all_apps_showcase_screen.dart`
- 该页会设计成一个多标题->列表的方式
- 会引入其他所有APP，标题将显示为其他APP的名字
- 列表则为其他APP的各个页APP的页面、资源等
- 在主页上能跳转到任何一个其他APP页进行总体调试

### 设计规范
- 特殊APP `app_main` 将按规范设计路由，但会硬编码引入其他APP的路由
- 特殊APP `app_main` 遵守本范围中的页面(feature)规范
- 特殊APP `app_main` 将按规范设计settings controller，但无需其他APP的 app_sets（因为其他页面会自行调用，只要路由被引过来即可）
- 特殊APP `app_main` 将按规范设计assets，但无需其他APP的 app assets（因为其他页面会自行调用，只要路由被引过来即可）

## 创建APP步骤

1. 阅读本文档全部内容，遵守全部规则
2. 参考 `lib/apps/app_example/` 的结构
3. 按照下方的APP文件设置、结构化标准进行开发

## APP 文件设计、结构标准化

### 目录结构规范

```
lib/apps/app_{name}/ 需要加`app_` 前缀
├── main_app_{name}.dart
├── controller_app_{name}/
├── config_app_{name}/
│   ├── app_config.dart
│   └── constants.dart
├── resources_app_{name}/
│   ├── assets_icons_app_{name}.dart
│   ├── assets_images_app_{name}.dart
│   └── assets_fonts_app_{name}.dart
├── models_app_{name}/
│   └── user_model_app_{name}.dart
├── features_app_{name}/
│   └── {feature}/
│       ├── views/
│       ├── widgets/
│       └── controllers/
├── services_app_{name}/
│   ├── {name}_service.dart
│   ├── {name}_auth_api_service.dart
│   └── {name}_public_api_service.dart
├── repositories_app_{name}/
│   └── {name}_repository.dart
├── utils_app_{name}/
│   └── app_utils.dart
├── localization_app_{name}/
│   ├── en_app_{name}.dart
│   ├── zh_app_{name}.dart
│   └── localization_keys_app_{appname}.dart
├── router_app_{name}/
│   └── router_app_{name}.dart
└── otherdir_app_{name}/
```

### 文件说明

**main_app_{name}.dart**
- 在文件加附上appname的信息，是为了让AI打开多个文件时不会因为文件同名而混淆

**resources_app_{name}/**
- APP专属图标定义、需要参考公共common assets的写法
- assetsKey前缀需要有 {appname}

**services_app_{name}/**
- `{name}_auth_api_service.dart`: 方法包括登陆/注册/注销/是否登陆/用户信息/POST发送/GET,PUT,DELETE发送等方法
- `{name}_public_api_service.dart`: 方法包括POST发送/GET,PUT,DELETE发送等方法

**localization_app_{name}/**
- `localization_keys_app_{appname}.dart`: app专属TextKey定义,必须, en_app / zh_app 基于此key定义
- textKey需要有`{appname}`作为前缀

**router_app_{name}/**
- 路由的KEY定义在路由代码中，不要定义在常量文件中，这样修改路由的时候不必要同时打开两个文件
- 需要在其中实现`createRouter`方法传给runCommonApp

### 功能特性

- `lib/common/` 内提供所有公共类库，向各个APP进行服务提供
- 在文件夹/文件上附上 {appname} 的信息，是为了让AI打开多个文件时不会因为文件同名而混淆

## Flutter Bloom - API 指导

**全局配置**: `../../../config/base.config.json`

开发API时，**必须**参考全局配置文件，根据提示词使用合适的api，并硬编码到本项目中。

## 页面 / feature 设置规范

### 文件结构要求

无论在任何地方，特殊app或app设计页面(feature)都要遵循下面的文件结构：

```
├── ... 上级目录 (如上级目录也有规范，遵守规范)
│   └── {feature}/
│       ├── views/
│       ├── widgets/
│       ├── controllers/
│       └── models/
```

**注意事项**
- 数据模型请统一放置读取 `app_{name}/models_app_{name}`

## 多国语言模块

### 基础架构

基于 `package:flutter_localization/flutter_localization.dart` 包实现。

多国语言由于特殊性，需要先载入，所以在各个app中(包括 app_main )由硬编码引入 en/zh.dart后，则runCommonApp最终传递给：

### 公共语言模块

```
lib/common/localization/
├── localization_manager.dart
├── map_locales.dart
├── common_en.dart
├── common_zh.dart
└── localization_keys.dart
```

**localization_manager.dart 功能**
- 扩展一个方法 `TextKey`.tr(content)，在任何页面调用
- 会自动根据Setting controller中的语言设置改变而进行改变
- 提供一个setAppTranslations可以追加一个或多个 en/zh 的语言包
- localization_manager.dart 已经自动截入了 common_en.dart/common_zh.dart

### APP语言扩展实现

```
lib/apps/{name}/localization_app_{name}/
├── en_app_{appname}.dart
├── zh_app_{appname}.dart
└── localization_keys_app_{appname}.dart
```

**注意**: 原来为 `partition_locals_app_{name}`，如有旧文件需要合并到 `localization_app_{name}`

### app_main 特殊APP语言扩展实现

```
lib/apps/{name}/localization_app_{name}/
├── ...
└── app_locales_main.dart
```

### 功能特性

1. **主入口语言集成**
   - 在main.dart引用的 `lib/apps/app_main/app_main_main.dart` 主入口中硬编码引入所有app的语言包
   - 通过文件 `lib/apps/app_main/partition_locals_app__main/app_locales_main.dart` 集中引入
   - 通过 runCommonApp 最终传递给 localization_manager 合并
   - 得到一个扩展了所有app多语言的集合，并由 `TextKey`.tr(content) 函数供所有APP调用

2. **专属APP语言集成**
   - 在main_app_xx.dart的APP专属APP中只硬编码引入专属的app语言包
   - 同样通过 runCommonApp 最终传递给 localization_manager 合并
   - 得到一个只有专属app的语言集合，不包含其他app的key

3. **Key命名规范**
   - `common/localization/` 中的strKey要有前缀，表示是公共的
   - 专属app中的 `en/zh_app_{appname}.dart`，key要带有 appname的前缀，表示是专属的


## 存储管理模块设计规范 ✅ COMPLETED

### 目录结构

```
lib/common/storage/
├── interfaces/                       ✅ 存储接口
│   └── storage_interface.dart        ✅ 统一存储接口定义
├── implementations/                  ✅ 具体实现
│   ├── hive_storage.dart            ✅ Hive数据库实现 (主要存储)
│   ├── shared_prefs_storage.dart    ✅ SharedPreferences实现
│   └── sqlite_storage.dart          ✅ SQLite数据库实现
├── models/                          ✅ 存储模型
│   └── storage_models.dart          ✅ 存储相关数据模型
└── storage_manager.dart             ✅ 存储管理器 (单例模式)
```

### Hive存储特性

- **高性能**: NoSQL键值对数据库，比SharedPreferences快10倍+ ✅
- **类型安全**: 支持所有Dart基础类型和复杂对象 ✅
- **跨平台**: 支持移动端、Web、桌面端 ✅
- **Box管理**: 独立的数据容器，支持多Box隔离 ✅
- **事务支持**: 原子操作和批量操作 ✅

### 设置系统集成

- **专用Box**: 设置存储在独立的'app_settings' Box中 ✅
- **错误恢复**: 存储失败时自动降级到默认值 ✅

## 网络类库模块设计规范 ✅ COMPLETED

### 目录结构

```
lib/common/network/
├── client/
│   ├── api_client.dart
│   └── interceptors/
│       ├── auth_interceptor.dart
│       ├── error_interceptor.dart
│       └── logging_interceptor.dart
├── models/
│   ├── api_response.dart
│   └── error_response.dart
├── services/
│   └── base_service.dart
└── utils/
    └── network_utils.dart
```

### 功能特性

- **拦截器**: 认证管理/错误处理/请求日志/自动重试
- **响应模型**: 泛型支持/分页响应/错误封装
- **基础服务**: RESTful API/拦截器集成/Mock支持
- **网络工具**: 连接监测/URL验证/平台检测
- **安全性**: 敏感信息脱敏/Token自动刷新

### 迁移说明

重构现有网络模块，添加拦截器和基础服务 ✅

## 配置管理模块

### 应用于多入口设计规范

```
lib/common/config/
├── app_config.dart
├── environment_config.dart
├── api_config.dart
└── constants.dart
```

## 主题系统模块 / Styles 调用及 APP 扩展规范

### 目录结构

```
lib/common/theme/
├── base/
│   ├── theme_colors.dart
│   ├── theme_text_styles.dart
│   ├── theme_dimensions.dart
│   └── theme_constants.dart
├── extensions/
│   ├── gradient_extensions.dart
│   ├── platform_extensions.dart
│   └── custom_extensions.dart
├── platforms/
│   ├── mobile/
│   │   ├── mobile_light_theme.dart
│   │   └── mobile_dark_theme.dart
│   ├── web/
│   │   ├── web_light_theme.dart
│   │   └── web_dark_theme.dart
│   └── desktop/
│       ├── desktop_light_theme.dart
│       └── desktop_dark_theme.dart
└── theme_manager.dart
```

**注意**: 每个平台至少包含一个dark/light主题，这些主题受本文档的 `Setting controller` 中对应的变量影响，请在代码开发中注意。

### APP专属调用及扩展styles

App中由以下几个文件调用 `lib/common/theme/base/` 中的颜色、字体等基本设置，为了减小二次包装: 无manager文件。

```
lib/apps/app_{name}/
├── resources_app_{name}/
│   ├── colors_app_{name}.dart
│   ├── text_styles_app_{name}.dart
│   └── dimensions_app_{name}.dart
```

**注意**: 这些是在app有特别扩展的情况下，如果不需要扩展，直接在view文件中引用 `lib/common/theme/base/`

### 废弃目录

```
lib/common/theme/ 以下废弃 (因为已经定义在 `lib/common/theme/base/`)
├── styles/common_styles.dart
├── styles/common_text_styles.dart
├── styles/common_theme_extensions
└── 其他废弃 styles 目录
```

### 迁移规则

目前在移置过程中，遵循以下规则：

1. **Key扩展优先**: 如果发现view中有的key而 `lib/common/theme/base/` 没有，则优先在 `lib/common/theme/base/` 目录中扩展出key，而不是将view中的key替换成base中的

2. **Dimensions适配**: 需要将所有view页中的Dimensions适配 `package:qyflutter/common/theme/base/theme_dimensions.dart` 中的，但如果 theme_dimensions 中的key不存在，优先扩展 theme_dimensions.dart

3. **Styles适配**: 需要将所有view页中的styles适配 `package:qyflutter/common/theme/base/` 中的，但如果 theme_text_styles/ theme_colors 中的key不存在，优先扩展 `theme/base`

4. **Colors适配**: 需要将所有view页中的colors适配 `package:qyflutter/common/theme/base/` 中的，但如果 theme_colors 中的key不存在，优先扩展 `theme/base`

## 公共组件模块

### 目录结构

```
lib/common/widgets/
├── buttons/
│   ├── custom_button.dart
│   └── swipeable_button/
├── inputs/
│   ├── custom_text_field.dart
│   └── custom_search_input.dart
├── dialogs/
│   ├── animated_custom_dialog.dart
│   ├── confirmation_dialog.dart
│   └── image_dialog.dart
├── navigation/
│   ├── custom_app_bar.dart
│   └── custom_bottom_navigation.dart
├── layouts/
│   ├── responsive_layout.dart
│   └── paginated_list_view.dart
└── common/
    ├── custom_image.dart
    ├── custom_loader.dart
    └── no_data_screen.dart
```

### 迁移说明

按功能分类重组现有widgets

## 工具类模块

### 目录结构重组

**当前状态**: `lib/helper/` 和 `lib/util/`

**目标结构**:
```
lib/common/utils/
├── date/
│   └── date_converter.dart
├── validation/
│   └── email_checker.dart
├── image/
│   ├── image_loader.dart
│   └── image_size_checker.dart
├── display/
│   ├── display_helper.dart
│   └── responsive_helper.dart
├── platform/
│   └── get_platform.dart
└── common/
    ├── price_converter.dart
    └── toaster_helper.dart
```

### 迁移说明

合并helper和util目录，按功能分类

## 新增模块

### 文件操作模块

```
lib/common/file/
├── file_manager.dart
├── file_picker_service.dart
└── file_utils.dart
```

### 地图模块 ✅ COMPLETED

#### 目录结构
```
lib/common/map/
├── map_service.dart         ✅ 地图服务 (地图显示/标记/路线)
├── location_service.dart    ✅ 定位服务 (GPS/权限/位置流)
└── map_utils.dart           ✅ 地图工具 (距离/方位/边界计算)
```

#### 功能特性
- **地图**: 交互式地图组件/标记管理/路线规划/地址搜索
- **定位**: GPS定位/权限管理/位置流/精度控制
- **工具**: 距离计算/方位计算/坐标转换/边界检测
- **跨平台**: Web和Native平台适配
- **算法**: Haversine公式/Douglas-Peucker简化/坐标验证

### 音视频模块 ✅ COMPLETED

#### 目录结构
```
lib/common/media/
├── audio/
│   ├── audio_player.dart
│   └── audio_recorder.dart
├── video/
│   ├── video_player.dart
│   └── video_recorder.dart
└── media_utils.dart
```

#### 功能特性
- **音频**: 播放/录制/格式转换/音量控制
- **视频**: 播放/录制/摄像头切换/质量设置
- **工具**: 文件验证/格式检测/大小计算/MIME类型
- **跨平台**: Web和Native平台适配

### 数据库模块 ✅ COMPLETED

#### 目录结构重组

**当前状态**: `lib/util/idb_shim/` 和 `lib/util/sqlite/`

**目标结构**:
```
lib/common/database/
├── interfaces/
│   └── database_interface.dart
├── sqlite/
│   └── sqlite_service.dart
├── idb/
│   └── idb_service.dart
├── models/
│   └── base_model.dart
└── database_manager.dart
```

#### 功能特性

- **接口抽象**: 统一的CRUD接口/事务支持/迁移管理
- **SQLite**: 跨平台支持/事务处理/表管理/查询构建
- **IndexedDB**: Web优化/对象存储/索引支持
- **模型系统**: 基础模型/时间戳/验证/关系映射
- **管理器**: 多数据库类型/自动迁移/健康检查/统计信息
- **类型安全**: 泛型支持/编译时检查

#### 迁移说明

重组现有数据库相关代码 ✅

## 通用设置系统模块 ✅ COMPLETED

### 设计方案

硬编码传递设置配置实现代码隔离，设置模块是供各个APP的设置页面使用的基本类库。

#### 核心思路
基于每个APP都要进行基本设置这个需求：
1. 首先会有一个公共的设置对象
2. 之后会在各个入口硬编码APP专属的设置对象
3. 每个APP得到一个包含基本设置(如isDark)等的集合
4. 设置会被持久化保存

#### 设置对象特性
设置对象将有特殊的信息指导页面如何设计：
- 某个设置 → 期望设置为select选项
- 某设置 → 期望设置为toggle等
- 附有可选项、默认值(会被持久化数据覆盖)、Label字符(可选)等信息

### 架构组成

#### 公共设置架构
```
lib/common/settings/
├── models/
│   └── setting_item.dart              ✅ 通用设置模板 (支持toggle/select/checkbox/slider/textInput等)
├── configs/
│   └── base_settings.dart             ✅ 基础设置 (base_sets: 主题/语言/字体等)
└── storage/
    └── settings_storage_manager.dart  ✅ 设置持久化存储管理器 (基于Hive)
```

**base_settings.dart 说明**: 这是考虑到大部分APP都必备的设计，同时专属的APP设置也要基于此编码格式

#### Settings公共控制器
```
lib/common/controller/
└── settings_controller.dart           ✅ 通用设置管理类库
```

**功能说明**:
- 该库自动先附加base_settings
- 通过构造方法可以传入多个base_settings规范的语言编码
- 合并为一个可用的设置类，直接供页面使用

### APP专属设置 (app_sets)

```
lib/apps/app_{appname}/settings_app_{appname}/
└── settings_app_{appname}.dart
```

#### 实现要求
- 将实现一个与base_settings.dart编码格式一致的设置扩充
- 比如是否每日更新等功能
- 注意：需要以{appname}为setting_key的前缀
- 同时引入 `lib/common/controller/settings_controller.dart` 进行追加 `app_sets` 的封装
- 最终由 settings_app_{appname}.dart 提供一个可供feature(页面)等使用的setting实例



## 路由系统及适配双入口模式设计

### 目录结构调整

**当前状态**: `lib/app_{name}/`

**目标结构**: `lib/apps/app_{name}/` (需要加`app_`前缀)

### APP路由实现

```
lib/apps/app_{name}/
└── router_app_{name}.dart
```

#### 实现要求
- 基于 `package:go_router`
- 例如: `static const String routeHome = '/{name}/home';`
- 废弃旧方法：不要再对路由使用provider进行二次包装
- 需要在其中实现 `createRouter` 方法传给runCommonApp

### 总入口路由集成

```
lib/apps/app_main/
└── apps_bootstrap_main.dart
```

#### 功能说明
硬编码所有其他APP的路由，比如 import `lib/apps/app_{name}/router_app_{name}.dart`

## `lib/common/utils` 工具类库设计

### 架构迁移

根据新的架构设计，所有工具类和辅助类已从分散的 `lib/util/` 和 `lib/helper/` 目录迁移到统一的 `lib/common/utils/` 目录下。

### 旧代码兼容

1. `display_helper.dart` 中 DeviceType 更名为 DisplayDeviceType

### 模块说明

工具类模块位于 `lib/common/utils/` 目录下，提供应用程序所需的各种工具类和辅助函数。

### 目录结构

```
lib/common/utils/
├── utils.dart
├── compatibility/
├── date/
├── validation/
├── image/
├── display/
├── platform/
├── common/
├── web/
└── text/
```

### 推荐导入方式

```dart
import 'package:qyflutter/common/utils/utils.dart';
```

## 网络使用规范

### 使用流程

1. **网络对象定义**: 在 `config_app_{name}` 目录定义网络对象
   - 注意网络对象不是一个url字符串
   - 而是包含了url/认证方式等因素的一个对象 from `lib/common/network/models/api_config.dart`

2. **数据结构定义**: 在同目录定义数据结构

3. **控制器传递**: 将网络对象/数据结构传递给 `auth_controller.dart`
   - 返回一个包含了isLogin/getUserInfoData/post/get/put/delete等方法且支持数据持久化的网络客户端对象

4. **服务层实现**: 在 `services_app_{name}` 目录下建立相应的服务文件进行传递

5. **方法导出**: 在server.dart方法中导出 post / isLogin / get 等方法，多个 `service` 方法供不同的页面调用

### 目录结构

#### 公共控制器
```
lib/common/controller/
└── auth_controller.dart
```

#### APP专属配置和服务
```
lib/apps/app_{name}/
├── config_app_{name}/
│   ├── api_config_app_{name}.dart
│   ├── api_endpoints_app_{name}.dart
│   └── api_data_models_app_{name}.dart
└── services_app_{name}/
    ├── auth_api_app_{name}_service.dart
    ├── user_api_app_{name}_service.dart
    └── product_api_app_{name}_service.dart
```

## 统一持久化架构设计

### 问题解决方案

我已经设计并实现了一个完整的统一持久化架构，解决了以下问题：

#### 解决的问题 ✅

- **异步/同步混用问题**: AppStorage.isFirstLaunch() 异步方法被同步调用
- **架构不统一**: 存在两套持久化系统（AppStorage + CacheOperations）
- **缺乏APP扩展机制**: 没有为不同APP提供扩展持久化的标准方式
- **类型安全问题**: 缺乏强类型的持久化键值管理

### 新架构组件

#### 1. 核心基础层
```
lib/common/storage/
├── unified_storage.dart
├── app_storage_base.dart
├── storage_provider.dart
├── storage_usage_examples.dart
├── storage_manager.dart
├── interfaces/storage_interface.dart
└── implementations/hive_storage.dart
```

#### 2. APP特定实现层
```
lib/apps/app_{name}/config_app_{name}/
└── storage_app_{name}.dart
```

### 核心特性

#### 1. 统一存储系统 (UnifiedStorage)
- **同步访问**: 频繁访问的数据（如isFirstLaunch, locale, themeMode）
- **异步访问**: 所有数据的完整访问
- **内存缓存集成**: 临时数据缓存
- **自动持久化**: 同步设置自动持久化到存储

#### 2. APP扩展基类 (AppStorageBase)
- **通用方法**: 所有APP共享的基础存储方法
- **APP特定存储**: 每个APP有独立的存储空间
- **缓存命名空间**: 避免不同APP的缓存冲突
- **生命周期管理**: 统一的初始化和清理

#### 3. 具体APP实现
- **Example App (StorageAppExample)**: 书签、阅读历史、用户偏好等
- **QY App (StorageAppQy)**: 祈祷历史、单词卡进度、QY等级等
### 使用方式

#### 1. 基础使用（同步访问）
```dart
final storage = StorageAppExample.instance;
await storage.initAppStorage();

// 同步访问频繁使用的数据
final isFirstLaunch = storage.isFirstLaunch();
final locale = storage.getLocale();
final themeMode = storage.getThemeMode();

// 同步设置（自动持久化）
storage.setNotFirstLaunch();
```

#### 2. APP特定功能（异步访问）
```dart
// Example App
final exampleStorage = StorageAppExample.instance;
await exampleStorage.addBookmark('item_123');
final bookmarks = await exampleStorage.getBookmarks();
final userPrefs = await exampleStorage.getUserPreferences();

// QY App
final qyStorage = StorageAppQy.instance;
await qyStorage.addPrayerToHistory({'id': 'prayer_123'});
await qyStorage.addQyPoints(10);
```

#### 3. Provider模式使用

#### 4. 缓存使用

## 状态管理

### 技术选型

- 本项目使用 `package:provider/provider.dart` / `package:flutter/foundation.dart` 作为状态管理
- 对于某些需要持久化的数据，使用数据库
- 状态管理将要一个通用的类实现在 `lib/common` 中

### Get框架说明

- 本项目已经没有使用Get作为状态管理
- Get仅在本项目中提供获取系统常的基本功能，无其他用处
- 可能旧代码中会包含请修改过来
- 现在使用provider包来作为状态管理，且在 `lib/common` 中实现通用类
- 你可以先查看 `lib/common` 是否有对应的代码

### APP状态管理要求

任何APP都至少要提供：

1. **UserProvider对象**: 在APP中实现 `lib/apps/app_{appname}/models_app_{name}/user_model_app_{name}.dart`，用于存放APP的用户登陆状态

2. **Setting持久化controller**: 用于供各个VIEW调用设置、设置全局settingKey等


// -----------------------------------------------------------------------------------------------------

## Profile 使用规范

待添加

// ----------------------------------------------------------------------------------------------------------

## 创建APP步骤

1. 根据assets规范，在 pubspec.yaml中添加静态资源，并创建对应目录，对应assets app中的dart文件，以及参考 example代码编码assets 资源类库

## APP迁移计划

### 目录重命名和合并
- 旧的app目录内的 locationze / controller 等文件夹，按{appname}这种新的命名规范移动和合并（注意：有可能同时存在旧的文件夹和新的文件夹，这是由于某个AI移动了一半造成的，你可以进行合并“旧的合并到新的”）
### 架构结构调整
- 目录结构层级修改为新的构架结构
- 如果旧的文件和新的文件重复（比如新的文件已经正确、但忘记删除旧的文件），你可以检查完毕确认安全后移除旧的文件
### 桥接文件清理
- 不需要旧的文件和新的构架的桥接文件，比如 `legacy`
- 你将检查是否有文件调用了此类桥接代码，然后全部移动为新的构架

## flutter bloom 框架更新

### 文件删除和重构
- `lib/common/provider_status/prefs.dart` 文件删除，改由app的config中提供 prefs 给runCommonApp，这样做的好处是如果在主main中调用所有app则每个app都有独立的prefs
- `lib/common/modole/user_model.dart` 文件删除，user_model改为由专属APP提供，任何APP都至少要提供一个 UserProvider 对象，在APP中实现`user_model.dart`，用于存放APP的用户登陆状态，以及一个Setting的持久化 controller 用于供各个VIEW调用设置、设置全局 settingKey等

## prefs 的全局使用

### Provider文件创建要求
- 在 `lib/common/app_{name}/provider_app_{name}` 目录下创建 provider_app_{name}.dart 文件
- 这个文件至少要导出一个实例化的 PrefsApp{name} 对象

### 实例对象使用
- 导出的实例对象要提供给 main_app_{name}.dart，在 runCommonApp 中传入
- settings_controller 中也可以调用这个实例

### 实现要求
- PrefsApp{name} 实现要求至少要实现 AppPrefsBase 中要求的方法
- 添加一个 initSharedPreferences 方法，该方法应该返回一个 prefs 而不是传入，这样 appPrefs 就有 prefs 了
- 在 main_app_{name}.dart 中合适的地方调用 PrefsApp{name} 的 initSharedPreferences 完成初始化工作，runCommonApp 内部会自动调用


## assets 静态资源构架

### 资源组成说明
公共资源及专属app的静态文件组成（所有app都有可能引用的通用资源），禁止往assets/common中添加。

### 目录结构
```
lib/assets/
├── common/
│   ├── icons/
│   ├── images/
│   ├── fonts/
│   └── launch/
├── .internal_common
└── apps/
    ├── app_{name}/
    │   ├── icons/
    │   ├── images/
    │   ├── launch/
    │   └── fonts/
    ├── other app
    ├── .internal_{appname}
    └── other internal for app
```

**注意**: `.internal_{appname}` 因为此类资源打包时实际只在 flutter 项目的 `$RootDir/android | ios` 里起作用，不放在 `app_{name}` 是防止打包时被打包到apk中，或者ai分不清写到assets dart代码中。

### 资源代码组成
为减少二次包装，以下构架设计中不要使用 manager 文件。

#### 通用资源编码
```
lib/common/assets/
├── common_assets_icons.dart
├── common_assets_images.dart
└── common_assets_launch.dart
```

#### APP专属assets
```
lib/apps/app_{name}/
└── resources_app_{name}/
    ├── assets_icons_app_{name}
    ├── assets_images_app_{name}
    └── assets_fonts_app_{name}
```

## “调试及编译逻辑” 
### 设计思路

为了在调试和编译时支持对多app入口的静态资源切换, 参考本规范 `assets` 目录规范.
### 主要实现流程

#### 1. 入口点和基础架构

由 `$FlutterBloomRootDir/winStart.bat` -> `$FlutterBloomRootDir/scripts($FlutterPublicScriptDir)/dev($DevScriptDir)/startDevByWin.ps` 作为入口点. 脚本根据自身位置定位 `$FlutterBloomRootDir` 目录和 `$ScriptDev` 目录, 并使用 `$ScriptDev/win_common/Gvar.ps1`(全局变量, 常量) 和 `BCommon.ps1`(通用方法) 配合.

#### 2. 菜单系统功能

根据 `startDevByWin.ps` 可扩展出一系列功能:

**a. APP扫描和菜单显示**
- 扫描 `$FlutterBloomRootDir/lib/apps` 目录, 得到app表
- 其中 `$app_main = lib/apps/app_main/` 能同时调试所有APP的特殊APPNAME
- 显示为一个菜单: 上下箭头选择不同的flutter-app, 左右箭头toggle可选项
- 使用 `win_common` 中的文件变量系统交换变量
- 对于菜单toggle的选项将要保存在文件变量中, 下次运行时将要预设(以免每次选择)
- flutter-app 每个的可选项为[调试 | 编译], 菜单扩展一个触发"辅助开发图标可视系统"

**编译选项配置**
在 `$DevScriptDir/build_option.ini($build_option)` 中建立每个app的编译选项:
- APP名 = [外挂目录 = dir or $null or $true | 随机ID = $boolean | 随机APP显示名 = $boolean | 固定ID值(xxx.xxx.xxx) | 固定APP显示名值 | 是否优化压缩图片 | 调试平台 | 调试端口(仅对web有效) | 编译平台(android/ios/win/全部) | 是否使用外挂目录安全编译]

#### 3. 常量目录和变量系统

**b. 确保有常量目录**
- `$BuildDir = D:\programing\.build_dir`
- `$assets_plugin_dir = $BuildDir\assets_{app-name}`
- `$assets_internal_plugin_dir = $FlutterBloomRootDir/assets/.internal_{appname}`
- `$DevTmpDir = $FlutterBloomRootDir/.dev_tmp/`
- `$CacheDir = $DevTmpDir/.cache/`
- `$BackupDirRule = $DevTmpDir/.backup/$BackupNamespaceDir/$BackupName_$timestamp`
- Gvar变量交换目录及相关功能
- Debug常量 `$Debug`
- `[$OriginalAppName/$OriginalAppPackageId] = $DevScriptDir/original_config.ini`

**变量交换系统**
通过Gvar交换常量/变量, 实现Gvar一套交换规则.ps1/.py共用, 别分实际ps1Gvar / PyGvar / ps1Common / PyCommon 逻辑. 并由 `$FlutterBloomRootDir/scripts/dev/py_helper | powershell_helper` 中的一系列*.py / .ps1脚本辅助实现.

#### 4. 调试模式规则

当 `$Debug` 开启时, 所有脚本都遵循:
- 打印即将操作的信息-等待按Y
- 打印即将操作目录-等待按Y
- 所有操作都有备份可恢复溯源

**脚本编写规范**
同时所有脚本任何条件下都遵循:
- 只能修改不能删除文件/文件夹
- 任何单一脚本功能不能太复杂保持代码300行内
- 代码全英文
- ps1脚本 `$varname` 后禁止紧跟字符串 `$varname:`[error] -> `$varname :`[ok]
- 所有备份都要有 `$BackupDirRule`
- 所有脚本.ps1/.py都要在脚本执行前打印尽可能多的使用变量信息以便调试
#### 5. 辅助预编译脚本系列

**b-1: 外挂目录安全编译脚本**
*.py 辅助预编译脚本[适配$Debug, 遵循之前述的规则]. 根据 $build_option 如果是"使用外挂目录安全编译", 在编译模式下:
- 将 $FlutterBloomRootDir 整个复制到 $BuildDir 并加上index
- 将修改 $FlutterBloomRootDir => $Build/$FlutterBloomRootDir_$index
- 使用Gvar交换$FlutterBloomRootDir
- 后面的$FlutterBloomRootDir都是指经过Gvar读取的变量$FlutterBloomRootDirByGvar

**b-2: 包ID信息收集脚本**
*.py 辅助预编译脚本[适配$Debug, 遵循之前述的规则] 信息收集. 通过以下正则规则组遍历:
- `namespace "xxx.xxx.xxx"`
- `applicationId "xxx.xxx.xxx"`
- `"package_name": "xxx.xxx.xxx"`
- `-keep class xxx.xxx.xxx`
- `package="xxx.xxx.xxx"`
- `package xxx.xxx.xxx`

在 $FlutterBloomRootDirByGvar/android | ios | windows => ($PlatformByFlutterDirs) 查找得到所有的包ID. 为防止有AI改一个漏掉一个你需要全部查找, 记录找到的文件. 如果有多个不同的ID需要打印, 将ID or IDs 放入Gvar 交换区.

**b-3: ID替换脚本**
*.py 辅助预编译脚本[适配$Debug, 遵循之前述的规则] ID替换. 根据 $build_option 是使用Gvar交换区IDs 还是随机ID, 生成随机ID或使用$OriginalAppPackageId替换上一步所查找到的文件.

**b-4: APP显示名查找及替换脚本**
辅助预编译脚本[适配$Debug, 遵循之前述的规则] APP显示名查找及替换. 在$PlatformByFlutterDirs 中找到可能的appname, 同样根据 $build_option 中的选项是否生成随机名和$OriginalAppName进行处理和替换.

**b-5: 图片资源处理脚本**
*.py 辅助预编译脚本[适配$Debug, 遵循之前述的规则] 设置一个$sourceFileImageName -> [$TargetImageNameList]. 根据 $build_option:
- 优先根据 $assets_plugin_dir 未找到则 $assets_internal_plugin_dir 找到 $sourceFileImageName
- 遍历使用 $TargetImageFileNameList 查找 $PlatformByFlutterDirs
- 分析每个$targetImage得到尺寸/大小
- 将$sourceFileImageName等比例缩放到至少能适配$targetImage并裁掉多余的部分
- 如果已经满足直接裁剪合适, 然后替换$TargetFileName
- 为了防止图片位置的不固定, 本脚本所有文件查找使用递归搜索, 禁止直接使用路径
- 同时根据 $build_option 选择是否压缩图片

**b-5-1: YAML操作类实现**
*.py 辅助预编译脚本[适配$Debug, 遵循之前述的规则] 需要先实现一个独立的yaml操作类($yamlClassByPy):
- 禁止使用python yaml相关第三方库
- 而是使用读取为文件并使用\n分割字符串
- 并使用统计行首到第一个字符串的空格数来区分是否是几级标题的方法
- 必须以此方法来操作pubspec.yaml和其他相关yaml文件

**b5-2: Assets目录管理**
使用$yamlClassByPy 并同时参考$FlutterBloomRootDirByGvar/pubspec.yaml 中的assets规则:
- 根据{appname}确保assets目录存在
- 确保其他assets目录被注释
- 如果是主入口(能同时调试所有APP的特殊APP 的$app_main)则保证所有app 的assets目录被添加
- 便编译时不引用其他资源/调试也可以看到资源是否引入正确

#### 6. PowerShell主脚本功能

**c-1: 主脚本执行逻辑**
回到 startDevByWin.ps, 使用 powershell 环境, 扩展辅助功能配合基本脚本:
- 在使用$build_option 执行是否调试, 编译的功能
- 并使用对应web/android/ios的命令
- 以及对app 编译是否添加进行压缩的命令
- 调试/编译将在try中进行, 以使无论是否调试/编译成功, 都能finally最终执行清理命令

**c-2: 脚本功能拆分**
根据c-1的要求, 将主脚本的主要功能拆分出来放到$DevScriptDir/powershell_helper 目录中, 主脚本只保留调用和if判断进行分支的功能.

#### 7. 清理和恢复

**d: 清理脚本**
*.py 清理脚本[适配$Debug, 遵循之前述的规则] 使用pubspec.yaml 最后时间戳的备份, 以及$DevScriptDir/original_config.ini 和 `lib/common/.internal_common` 中的资源, 反向照抄一份 b1-bx 步骤的脚本, 进行恢复.

**e: 环境恢复**
再次回到powershell环境, 切换最初目录[脚本开始前需要备份].
### 开发记录要求

如果以上脚本还未开发, 请在开发时全部重构当前代码并写入一份开发记录 `$FlutterBloomRootDirByGvar/docs/DevScriptDebugBuild.md`. 如果该文件已经存在, 我还同时叫你开发, 你可以先查看其中的进度和实际代码.
### 辅助开发图标可视系统

#### 系统概述

本项目作为一个关联的web项目, 启动后监听一个40017端口并调用浏览器打开. 但将使用以上规范中的一些信息, 但注意和以上脚本不关联.

**原型参考**: `$FlutterPublicScriptDir/flutter_icons_view($FlutterIconViewDir)/flutter_icon_scanner.py`

**功能**: 开发 `$FlutterIconViewDir/main.py` 及辅助功能

**启动脚本**: 同时建立一个启动脚本 ps1, cmd触发脚本[注意不要同名]. 对于本项目用到的包打印pip 安装提示用于复制, 但不安装打印即可只是用于提示. 同时ps1也可用 `$FlutterBloomRootDir/startDevByWin.ps` 中的追加菜单启动.

#### 核心功能

**1. 图片信息扫描和显示**
启动后扫描 `$PlatformByFlutterDirs` 下的所有图片信息, 并分几大组 Android/ios/windows/web 分别显示:
- 路径文件名作为二级标题
- 图片显示预览/大小/图片智能识别类别[背景图|大图标|小图标|占位图]
- 智能识别图片符合度(比如android 使用-xhdpi 等的推荐大小与图片实际大小进行对比)
- 当前文件夹的推荐大小为第三级区域

**2. 目录操作功能**
每一级区域都有打开目录的按钮, 但不同的是不使用后台命令, 而点击后显示出一个input 和一个复制按钮, 将复制explorer命令.

**3. 图片操作功能**
- **3-1**: 第三级图片详情显示区有下载按钮, 将图片下载
- **3-2**: 第二级图片区域显示一个压缩按钮, 点击后一键压缩并应用图片

#### 高级功能

**4. 图片替换系统**
针对扫描到的 `$PlatformByFlutterDirs` 作为一级选区域, 该一级区域下的图片集合为二级选区域:
- 开辟一个新的区域, 上传一个图按确认后, 将直接替换这些图
- 一级区域可多选, 根据一级区域载入二级选区域
- 具有菜单, 并有设置, 确认后替换 `$DevScriptDir/original_config.ini` 的功能

**5. 自动剪切替换功能**
菜单具有新功能 - 开辟的新的区域:
- 根据一级选区和二级选区得到一个[[$sourceFileName=>[$targetFilesList]]]
- 根据上传的图片使用推荐尺寸或自定义输入尺寸直接自动剪切替换.internal_common中的 $sourceFileName
- 并参考`b-5`的已存在脚本, 给 common/.internal_common 设计一个同样的替换规则

**6. 调试和信息查看**
菜单扩展, 能查看本节规范所有的常量信息, 并尽可能多的打印规则信息, 以便debug时查看代码是否正确.

**7. 清理功能**
菜单选项, 拥有一键清理脚本, 独立实现一份 `d` 功能的功能.

#### 系统特性

**刷新功能**: 同时脚本保留自动刷新和手动刷新功能.

**图片推荐大小库**: 同时建立一个完整的 android/ios/windows/web/android12等完整的图片推荐大小map库.

