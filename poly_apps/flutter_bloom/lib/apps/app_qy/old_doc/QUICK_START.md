# QY App - Quick Start Guide

## 🚀 5-Minute Setup

### 1. Understand the Architecture (2 min)

```
View → Controller → Service → Model
  ↓         ↓          ↓        ↓
  UI    State Mgmt   API     Data
```

### 2. See an Example (1 min)

Look at: `home/views/home_study_screen_refactored_app_qy.dart`

This is the **perfect example** of our architecture.

### 3. Read the Rules (2 min)

#### ✅ DO
```dart
// Colors
ThemeColors.primary

// Text
QyAppLocalizationKeys.qyLogin.tr(context)

// Dimensions
Dimensions.paddingMedium

// Text Styles
TextStyles.h3.copyWith(color: ThemeColors.textPrimary)
```

#### ❌ DON'T
```dart
Color(0xFF123456)  // NO!
'Login'            // NO!
16.0               // NO!
TextStyle(...)     // NO!
```

---

## 💻 Create a New Page (10 min)

### Step 1: Create Model (2 min)

```dart
// feature/domain/model/xxx_model.dart
class XxxModel {
  final String id;
  final String name;

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

  XxxModel copyWith({String? id, String? name}) {
    return XxxModel(
      id: id ?? this.id,
      name: name ?? this.name,
    );
  }
}
```

### Step 2: Create Service (2 min)

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
      // Return mock data for development
      return [
        XxxModel(id: '1', name: 'Mock Item 1'),
        XxxModel(id: '2', name: 'Mock Item 2'),
      ];
    }
  }
}
```

### Step 3: Create Controller (2 min)

```dart
// feature/controllers/xxx_controller_app_qy.dart
class XxxControllerAppQy extends ChangeNotifier {
  final XxxService _service;
  List<XxxModel> _data;
  bool _isLoading;

  XxxControllerAppQy({required XxxService service})
      : _service = service,
        _data = [],
        _isLoading = false;

  List<XxxModel> get data => _data;
  bool get isLoading => _isLoading;

  Future<void> loadData() async {
    _isLoading = true;
    notifyListeners();

    try {
      _data = await _service.getData();
    } catch (e) {
      // Handle error
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

### Step 4: Create View (4 min)

```dart
// feature/views/xxx_screen_refactored_app_qy.dart
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
          QyAppLocalizationKeys.qyTitle.tr(context),
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

          return RefreshIndicator(
            onRefresh: controller.loadData,
            color: ThemeColors.primary,
            child: ListView.builder(
              padding: EdgeInsets.all(Dimensions.paddingMedium),
              itemCount: controller.data.length,
              itemBuilder: (context, index) {
                final item = controller.data[index];
                return Container(
                  margin: EdgeInsets.only(
                    bottom: Dimensions.spacingMedium
                  ),
                  padding: EdgeInsets.all(Dimensions.paddingMedium),
                  decoration: BoxDecoration(
                    color: ThemeColors.surface,
                    borderRadius: BorderRadius.circular(
                      Dimensions.radiusMedium
                    ),
                    border: Border.all(color: ThemeColors.border),
                  ),
                  child: Text(
                    item.name,
                    style: TextStyles.body1.copyWith(
                      color: ThemeColors.textPrimary,
                    ),
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
```

---

## 🔌 Add Provider (2 min)

In your provider setup file:

```dart
ChangeNotifierProvider<XxxControllerAppQy>(
  create: (_) => XxxControllerAppQy(
    xxxService: XxxService(
      apiService: ApiServiceAppQy(),
    ),
  ),
)
```

---

## 📖 Common Patterns

### Loading State
```dart
if (controller.isLoading) {
  return Center(
    child: CircularProgressIndicator(
      color: ThemeColors.primary,
    ),
  );
}
```

### Empty State
```dart
if (controller.data.isEmpty) {
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          Icons.inbox,
          size: 64,
          color: ThemeColors.textTertiary.withOpacity(0.5),
        ),
        SizedBox(height: Dimensions.spacingMedium),
        Text(
          QyAppLocalizationKeys.qyNoData.tr(context),
          style: TextStyles.body1.copyWith(
            color: ThemeColors.textSecondary,
          ),
        ),
      ],
    ),
  );
}
```

### Error Handling
```dart
if (controller.errorMessage != null) {
  ScaffoldMessenger.of(context).showSnackBar(
    SnackBar(content: Text(controller.errorMessage!)),
  );
  controller.clearError();
}
```

### Pull to Refresh
```dart
RefreshIndicator(
  onRefresh: controller.loadData,
  color: ThemeColors.primary,
  child: YourScrollableWidget(),
)
```

### Button with Loading
```dart
ElevatedButton(
  onPressed: controller.isLoading ? null : () {
    controller.performAction();
  },
  style: ElevatedButton.styleFrom(
    backgroundColor: ThemeColors.primary,
    disabledBackgroundColor: ThemeColors.primary.withOpacity(0.5),
    padding: EdgeInsets.symmetric(
      vertical: Dimensions.paddingMedium
    ),
    shape: RoundedRectangleBorder(
      borderRadius: BorderRadius.circular(
        Dimensions.radiusMedium
      ),
    ),
  ),
  child: controller.isLoading
      ? SizedBox(
          height: 20,
          width: 20,
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation<Color>(
              ThemeColors.surface
            ),
          ),
        )
      : Text(
          QyAppLocalizationKeys.qySubmit.tr(context),
          style: TextStyles.button.copyWith(
            color: ThemeColors.surface,
            fontWeight: FontWeight.bold,
          ),
        ),
)
```

---

## 🎨 Theme Quick Reference

### Colors
```dart
ThemeColors.primary          // Brand color
ThemeColors.secondary        // Secondary color
ThemeColors.background       // Page bg
ThemeColors.surface          // Card bg
ThemeColors.textPrimary      // Main text
ThemeColors.textSecondary    // Sub text
ThemeColors.textTertiary     // Hint text
ThemeColors.border           // Borders
ThemeColors.error            // Errors
ThemeColors.success          // Success
```

### Text Styles
```dart
TextStyles.display1          // 48px+
TextStyles.h1                // 32px
TextStyles.h2                // 24px
TextStyles.h3                // 20px
TextStyles.h4                // 18px
TextStyles.body1             // 16px
TextStyles.body2             // 14px
TextStyles.caption           // 12px
```

### Dimensions
```dart
Dimensions.paddingSmall      // 8
Dimensions.paddingMedium     // 16
Dimensions.paddingLarge      // 24
Dimensions.spacingSmall      // 8
Dimensions.spacingMedium     // 16
Dimensions.spacingLarge      // 24
Dimensions.radiusSmall       // 4
Dimensions.radiusMedium      // 8
Dimensions.radiusLarge       // 16
```

---

## 📚 Learn More

1. **Architecture:** Read `ARCHITECTURE_GUIDE.md`
2. **Examples:** Study `home_study_screen_refactored_app_qy.dart`
3. **Provider:** See `PROVIDER_SETUP_EXAMPLE.dart`
4. **Status:** Check `IMPLEMENTATION_STATUS.md`

---

## ⚡ Pro Tips

1. **Always start with Model** - Data structure first
2. **Mock data is your friend** - Develop without backend
3. **Use Consumer wisely** - Only wrap what needs to rebuild
4. **context.read for actions** - One-time operations
5. **context.watch for data** - Reactive updates
6. **Dispose everything** - Controllers, TextEditingControllers
7. **Test early** - Write tests as you code
8. **Follow the pattern** - Consistency is key

---

## 🆘 Common Issues

### "Provider not found"
```dart
// Wrap your MaterialApp with providers
MultiProvider(
  providers: [...],
  child: MaterialApp(...),
)
```

### "Hardcoded value warning"
Replace with:
- `ThemeColors.*` for colors
- `QyAppLocalizationKeys.*.tr(context)` for text
- `Dimensions.*` for sizes
- `TextStyles.*` for text styles

### "State not updating"
Remember to call:
```dart
notifyListeners(); // in Controller
```

### "Memory leak"
Always dispose:
```dart
@override
void dispose() {
  _controller.dispose();
  super.dispose();
}
```

---

**Ready to code!** 🚀

Start with the examples, follow the patterns, and create amazing features!
