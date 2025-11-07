# QY App Architecture Guide

## 完整架构模式

每个功能模块应遵循以下架构：

```
feature_module/
├── domain/
│   ├── model/          # 数据模型
│   │   └── xxx_model.dart
│   └── service/        # API 服务层
│       └── xxx_service.dart
├── controllers/        # 状态管理控制器
│   └── xxx_controller.dart
└── views/             # UI 视图
    └── xxx_screen_refactored.dart
```

## 实现步骤

### 1. 创建数据模型 (Model)

```dart
// feature/domain/model/xxx_model.dart
class XxxModel {
  final String id;
  final String name;
  // ... 其他字段

  const XxxModel({
    required this.id,
    required this.name,
  });

  factory XxxModel.fromJson(Map<String, dynamic> json) {
    return XxxModel(
      id: json['id'] as String,
      name: json['name'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
    };
  }

  XxxModel copyWith({...}) {...}
}
```

### 2. 创建 API 服务 (Service)

```dart
// feature/domain/service/xxx_service.dart
class XxxService {
  final ApiServiceAppQy _apiService;

  const XxxService({required ApiServiceAppQy apiService})
      : _apiService = apiService;

  Future<List<XxxModel>> getData() async {
    try {
      final response = await _apiService.get('/api/v1/xxx');
      final data = response.data as List<dynamic>;
      return data.map((json) =>
        XxxModel.fromJson(json as Map<String, dynamic>)
      ).toList();
    } catch (e) {
      return []; // 或返回 mock 数据
    }
  }
}
```

### 3. 创建状态控制器 (Controller)

```dart
// feature/controllers/xxx_controller.dart
class XxxControllerAppQy extends ChangeNotifier {
  final XxxService _service;
  List<XxxModel> _data;
  bool _isLoading;
  String? _errorMessage;

  XxxControllerAppQy({required XxxService service})
      : _service = service,
        _data = [],
        _isLoading = false;

  List<XxxModel> get data => _data;
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> loadData() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      _data = await _service.getData();
    } catch (e) {
      _errorMessage = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  @override
  void dispose() {
    super.dispose();
  }
}
```

### 4. 创建 UI 视图 (View)

```dart
// feature/views/xxx_screen_refactored.dart
class XxxScreenRefactoredAppQy extends StatefulWidget {
  const XxxScreenRefactoredAppQy({super.key});

  @override
  State<XxxScreenRefactoredAppQy> createState() =>
      _XxxScreenRefactoredAppQyState();
}

class _XxxScreenRefactoredAppQyState
    extends State<XxxScreenRefactoredAppQy> {

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<XxxControllerAppQy>().loadData();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: ThemeColors.background,
      appBar: AppBar(
        title: Text(
          QyAppLocalizationKeys.qyXxxTitle.tr(context),
          style: TextStyles.h3.copyWith(
            color: ThemeColors.textPrimary
          ),
        ),
        backgroundColor: ThemeColors.surface,
        elevation: 0,
      ),
      body: Consumer<XxxControllerAppQy>(
        builder: (context, controller, child) {
          if (controller.isLoading) {
            return Center(
              child: CircularProgressIndicator(
                color: ThemeColors.primary,
              ),
            );
          }

          return SafeArea(
            child: RefreshIndicator(
              onRefresh: controller.loadData,
              color: ThemeColors.primary,
              child: ListView.builder(
                padding: EdgeInsets.all(Dimensions.paddingMedium),
                itemCount: controller.data.length,
                itemBuilder: (context, index) {
                  return _buildItem(controller.data[index]);
                },
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildItem(XxxModel item) {
    return Container(
      margin: EdgeInsets.only(bottom: Dimensions.spacingMedium),
      padding: EdgeInsets.all(Dimensions.paddingMedium),
      decoration: BoxDecoration(
        color: ThemeColors.surface,
        borderRadius: BorderRadius.circular(Dimensions.radiusMedium),
        border: Border.all(color: ThemeColors.border),
      ),
      child: Text(
        item.name,
        style: TextStyles.body1.copyWith(
          color: ThemeColors.textPrimary,
        ),
      ),
    );
  }
}
```

## 关键原则

### ✅ 必须遵循

1. **零硬编码**
   - ❌ `Color(0xFF1234567)`
   - ✅ `ThemeColors.primary`

   - ❌ `fontSize: 16`
   - ✅ `TextStyles.body1`

   - ❌ `padding: 8.0`
   - ✅ `Dimensions.paddingSmall`

   - ❌ `'登录'`
   - ✅ `QyAppLocalizationKeys.qyLogin.tr(context)`

2. **分层架构**
   - View 只负责 UI
   - Controller 管理状态
   - Service 处理 API
   - Model 定义数据结构

3. **状态管理**
   - 使用 Provider
   - 所有状态在 Controller 中
   - View 通过 Consumer 监听变化

4. **错误处理**
   - Service 捕获网络错误
   - Controller 处理业务逻辑错误
   - View 显示错误信息

5. **资源管理**
   - Controller 实现 dispose
   - TextEditingController 需要 dispose
   - 取消未完成的请求

### ❌ 禁止事项

1. 在 View 中直接调用 API
2. 硬编码任何值（颜色、文本、尺寸、数据）
3. 在构造函数外声明变量
4. 使用 setState 管理复杂状态
5. 忽略错误处理

## 已完成示例

查看以下文件作为参考：

- `home/domain/model/learning_stats_model.dart`
- `home/domain/service/learning_service.dart`
- `home/controllers/learning_controller_app_qy.dart`
- `home/views/home_study_screen_refactored_app_qy.dart`
- `home/views/home_search_screen_refactored_app_qy.dart`
- `word/views/word_book_screen_refactored_app_qy.dart`

## Provider 配置

在 app 入口配置所有 Provider：

```dart
MultiProvider(
  providers: [
    ChangeNotifierProvider(
      create: (_) => LearningControllerAppQy(
        learningService: LearningService(
          apiService: ApiServiceAppQy(),
        ),
      ),
    ),
    ChangeNotifierProvider(
      create: (_) => WordControllerAppQy(
        wordService: WordService(
          apiService: ApiServiceAppQy(),
        ),
      ),
    ),
    // ... 其他 providers
  ],
  child: MaterialApp(...),
)
```

## 测试数据

在开发阶段，Service 层应提供 mock 数据：

```dart
Future<List<XxxModel>> getData() async {
  try {
    final response = await _apiService.get('/api/v1/xxx');
    // ...
  } catch (e) {
    return _getMockData(); // 返回 mock 数据
  }
}

List<XxxModel> _getMockData() {
  return [
    XxxModel(id: '1', name: 'Mock Item 1'),
    XxxModel(id: '2', name: 'Mock Item 2'),
  ];
}
```

这样即使 API 未就绪，UI 也可以正常开发和测试。
