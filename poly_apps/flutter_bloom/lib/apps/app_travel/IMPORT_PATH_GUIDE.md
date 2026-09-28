# Import Path Guide for App Travel

## Directory Structure

```
lib/apps/app_travel/
├── models_app_travel/          # 📦 Centralized Models
│   ├── order_model.dart
│   ├── user_model_app_travel.dart
│   └── ...
├── data/                       # 🧪 Test Data
│   └── test_orders_data.dart
└── features_app_travel/        # 🎨 Feature Modules
    ├── home/
    ├── explore/
    ├── journey/
    │   └── views/
    │       └── journey_screen.dart
    ├── profile/
    └── settings/
```

## Import Path Rules

### From Feature Screens to Models

When importing from a **feature screen** to **models** or **data**:

#### Example: From `journey/views/journey_screen.dart`

**Current Location:**
```
lib/apps/app_travel/features_app_travel/journey/views/journey_screen.dart
```

**To Import Models:**
```dart
import '../../../models_app_travel/order_model.dart';
```
- `../` → go to `journey/`
- `../../` → go to `features_app_travel/`
- `../../../` → go to `app_travel/`
- Then access `models_app_travel/order_model.dart`

**To Import Test Data:**
```dart
import '../../../data/test_orders_data.dart';
```

---

## Quick Reference by Location

### From `features_app_travel/{feature}/views/`

```dart
// Models
import '../../../models_app_travel/{model_name}.dart';

// Data
import '../../../data/{data_name}.dart';
```

### From `features_app_travel/{feature}/widgets/`

```dart
// Models
import '../../../models_app_travel/{model_name}.dart';

// Data
import '../../../data/{data_name}.dart';
```

### From `features_app_travel/{feature}/`

```dart
// Models
import '../../models_app_travel/{model_name}.dart';

// Data
import '../../data/{data_name}.dart';
```

---

## Best Practices

### ✅ DO: Use Relative Imports for Project Files

```dart
// ✅ Good - Relative import
import '../../../models_app_travel/order_model.dart';
```

### ✅ DO: Keep Models Centralized

All data models should be in `models_app_travel/`:
- `order_model.dart`
- `user_model_app_travel.dart`
- `city_model.dart`
- etc.

### ✅ DO: Keep Test Data Centralized

All test/mock data should be in `data/`:
- `test_orders_data.dart`
- Future: `test_user_data.dart`
- Future: `test_city_data.dart`

### ✅ DO: Use Models in Features

Features should import and use models, never define their own:

```dart
// journey_screen.dart
import '../../../models_app_travel/order_model.dart';
import '../../../data/test_orders_data.dart';

class _JourneyScreenState extends State<JourneyScreen> {
  List<OrderModel> _allOrders = [];

  void _loadOrders() {
    _allOrders = TestOrdersData.getTestOrders();
  }
}
```

### ❌ DON'T: Define Models in Feature Files

```dart
// ❌ Bad - Don't do this
class OrderModel {  // Defined in journey_screen.dart
  // ...
}
```

### ❌ DON'T: Use Package Imports for Local Files

```dart
// ❌ Bad - Package import for project file
import 'package:qyflutter/apps/app_travel/models_app_travel/order_model.dart';

// ✅ Good - Relative import
import '../../../models_app_travel/order_model.dart';
```

---

## Common Import Patterns

### Home Screen
```dart
// lib/apps/app_travel/features_app_travel/home/views/home_screen.dart
import '../../../models_app_travel/swiper_item_model.dart';
import '../../../models_app_travel/local_nav_model.dart';
import '../../../models_app_travel/grid_nav_model.dart';
```

### Explore Screen
```dart
// lib/apps/app_travel/features_app_travel/explore/views/explore_screen.dart
import '../../../models_app_travel/city_model.dart';
import '../../../models_app_travel/sight_model.dart';
```

### Journey Screen
```dart
// lib/apps/app_travel/features_app_travel/journey/views/journey_screen.dart
import '../../../models_app_travel/order_model.dart';
import '../../../data/test_orders_data.dart';
```

### Profile Screen
```dart
// lib/apps/app_travel/features_app_travel/profile/views/profile_screen.dart
import '../../../models_app_travel/user_model_app_travel.dart';
```

---

## Troubleshooting

### Error: "The system cannot find the path specified"

**Cause:** Wrong number of `../` in relative path

**Solution:** Count the directory levels carefully:

From `features_app_travel/journey/views/journey_screen.dart`:
- Level 1: `views/`
- Level 2: `journey/`
- Level 3: `features_app_travel/`
- Level 4: `app_travel/` ← Target level for models

So you need: `../../../` (3 ups) to reach `app_travel/`

### Error: "Type 'OrderModel' not found"

**Cause:** Missing or incorrect import statement

**Solution:** Add the correct import at the top of the file:
```dart
import '../../../models_app_travel/order_model.dart';
```

---

## File Organization Checklist

When creating new features, follow this checklist:

- [ ] Models defined in `models_app_travel/`
- [ ] Test data defined in `data/`
- [ ] Feature screens in `features_app_travel/{feature}/views/`
- [ ] Feature widgets in `features_app_travel/{feature}/widgets/`
- [ ] Imports use correct relative paths (`../../../`)
- [ ] No duplicate model definitions
- [ ] No inline data in UI files

---

## Code Reuse Examples

### 1. Shared Order Model

**Model** (single definition):
```dart
// models_app_travel/order_model.dart
class OrderModel {
  final String id;
  final OrderType type;
  final OrderStatus status;
  // ...
}
```

**Used in multiple places:**
```dart
// journey_screen.dart
import '../../../models_app_travel/order_model.dart';
List<OrderModel> orders = [...];

// order_detail_screen.dart (future)
import '../../../models_app_travel/order_model.dart';
void showOrderDetail(OrderModel order) { ... }

// order_history_screen.dart (future)
import '../../../models_app_travel/order_model.dart';
List<OrderModel> getHistory() { ... }
```

### 2. Shared Test Data

**Test Data** (single definition):
```dart
// data/test_orders_data.dart
class TestOrdersData {
  static List<OrderModel> getTestOrders() { ... }
}
```

**Used in multiple places:**
```dart
// journey_screen.dart
orders = TestOrdersData.getTestOrders();

// order_test.dart (future)
final testOrders = TestOrdersData.getTestOrders();
expect(testOrders.length, 8);
```

---

## Summary

**Key Principle:**
> One model, one location, many uses. Never duplicate model definitions.

**Import Pattern:**
> From `features_app_travel/{feature}/views/` → Use `../../../models_app_travel/`

**Benefits:**
- ✅ Single source of truth
- ✅ Easy maintenance
- ✅ Type safety
- ✅ Code reuse
- ✅ Clear dependencies

**Status:** ✅ All imports corrected and working!
