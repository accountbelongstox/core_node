# Common Widgets Library

A comprehensive collection of reusable Flutter widgets for the VIP Club application. This library provides 50+ customizable components following Material Design principles and integrating with the app's theme system.

## Quick Start

### Import

```dart
// Import all widgets
import 'package:qyflutter/common/widgets/widgets.dart';

// Or import specific categories
import 'package:qyflutter/common/widgets/buttons/primary_button.dart';
import 'package:qyflutter/common/widgets/cards/custom_cards.dart';
```

### Theme Integration

All widgets use the app's centralized theme system:
- `ThemeColors` - Color palette
- `ThemeTextStyles` - Typography
- `ThemeDimensions` - Spacing and sizing

## Widget Categories

### 1. Buttons (5 types)

#### PrimaryButton
Solid background button with loading state support.

```dart
PrimaryButton(
  text: 'Submit',
  onPressed: () {},
  isLoading: false,
  isFullWidth: true,
  icon: Icons.check,
)
```

#### GradientButton
Premium button with gradient background.

```dart
GradientButton(
  text: 'Upgrade to VIP',
  onPressed: () {},
  gradientColors: [ThemeColors.primaryBlue, ThemeColors.accentGold],
)
```

#### SecondaryButton
Outlined button for secondary actions.

```dart
SecondaryButton(
  text: 'Cancel',
  onPressed: () {},
  borderColor: ThemeColors.neutralGrey,
)
```

#### IconActionButton
Icon-only button with circular background.

```dart
IconActionButton(
  icon: Icons.favorite,
  onPressed: () {},
  backgroundColor: ThemeColors.errorRed,
  tooltip: 'Add to favorites',
)
```

#### FloatingButton
Floating action button with shadow.

```dart
FloatingButton(
  icon: Icons.add,
  onPressed: () {},
  backgroundColor: ThemeColors.primaryBlue,
)
```

### 2. Progress Indicators (6 types)

#### LabeledLinearProgress
Linear progress bar with label and percentage.

```dart
LabeledLinearProgress(
  value: 0.75,
  label: 'Profile Completion',
  showPercentage: true,
  color: ThemeColors.successGreen,
)
```

#### GradientProgressBar
Progress bar with gradient fill.

```dart
GradientProgressBar(
  value: 0.6,
  gradientColors: [ThemeColors.primaryBlue, ThemeColors.accentGold],
  height: 12,
)
```

#### CircularProgressWithLabel
Circular progress with center text.

```dart
CircularProgressWithLabel(
  value: 0.45,
  size: 100,
  centerWidget: Text('45%'),
  color: ThemeColors.primaryBlue,
)
```

#### StepProgressIndicator
Multi-step progress indicator.

```dart
StepProgressIndicator(
  totalSteps: 4,
  currentStep: 2,
  activeColor: ThemeColors.primaryBlue,
)
```

#### ShimmerLoading
Animated shimmer effect for loading states.

```dart
ShimmerLoading(
  width: double.infinity,
  height: 100,
)
```

#### DotsLoadingIndicator
Animated dots for loading.

```dart
DotsLoadingIndicator(
  color: ThemeColors.primaryBlue,
  size: 12,
)
```

### 3. Cards (6 types)

#### StyledCard
Basic card with customizable styling.

```dart
StyledCard(
  child: Text('Content'),
  padding: EdgeInsets.all(16),
  backgroundColor: ThemeColors.neutralWhite,
  elevation: 2,
  onTap: () {},
)
```

#### GradientCard
Card with gradient background.

```dart
GradientCard(
  child: Text('Premium Content'),
  gradientColors: [ThemeColors.primaryBlue, ThemeColors.accentGold],
  padding: EdgeInsets.all(20),
)
```

#### InfoCard
Icon-based information card.

```dart
InfoCard(
  icon: Icons.info,
  title: 'Info Title',
  description: 'Description text',
  iconColor: ThemeColors.primaryBlue,
  onTap: () {},
)
```

#### StatCard
Statistics display card.

```dart
StatCard(
  icon: Icons.people,
  value: '1,234',
  label: 'Total Members',
  backgroundColor: ThemeColors.primaryBlue.withOpacity(0.1),
)
```

#### FeatureCard
Feature showcase with image.

```dart
FeatureCard(
  imageUrl: 'https://example.com/image.jpg',
  title: 'Feature Title',
  subtitle: 'Feature description',
  badge: StatusBadge(text: 'New'),
  onTap: () {},
)
```

#### PricingCard
Membership tier or pricing card.

```dart
PricingCard(
  title: 'Gold Membership',
  price: '\$99',
  period: '/month',
  features: ['Feature 1', 'Feature 2', 'Feature 3'],
  isPopular: true,
  onSelect: () {},
)
```

### 4. Input Fields (6 types)

#### StyledTextField
Customizable text input field.

```dart
StyledTextField(
  controller: controller,
  labelText: 'Name',
  hintText: 'Enter your name',
  prefixIcon: Icons.person,
  validator: (value) => value?.isEmpty ?? true ? 'Required' : null,
)
```

#### SearchField
Search input with clear button.

```dart
SearchField(
  controller: searchController,
  hintText: 'Search members...',
  onChanged: (value) => performSearch(value),
)
```

#### PasswordField
Password input with visibility toggle.

```dart
PasswordField(
  controller: passwordController,
  labelText: 'Password',
  validator: (value) => value?.length < 6 ? 'Too short' : null,
)
```

#### EmailField
Email input with validation.

```dart
EmailField(
  controller: emailController,
  labelText: 'Email Address',
)
```

#### PhoneField
Phone number input with validation.

```dart
PhoneField(
  controller: phoneController,
  labelText: 'Phone Number',
)
```

#### TextAreaField
Multi-line text input.

```dart
TextAreaField(
  controller: descriptionController,
  labelText: 'Description',
  maxLines: 5,
  maxLength: 500,
)
```

### 5. Badges & Chips (6 types)

#### StatusBadge
Status indicator badge.

```dart
StatusBadge(
  text: 'Active',
  backgroundColor: ThemeColors.successGreen,
  icon: Icons.check_circle,
)
```

#### OutlinedBadge
Outlined badge variant.

```dart
OutlinedBadge(
  text: 'Pending',
  borderColor: ThemeColors.warningYellow,
  icon: Icons.schedule,
)
```

#### VipBadge
Premium VIP badge with gold gradient.

```dart
VipBadge(
  text: 'VIP Gold',
)
```

#### NotificationBadge
Notification count indicator.

```dart
NotificationBadge(
  count: 5,
  color: ThemeColors.errorRed,
)
```

#### SelectableChip
Selectable filter chip.

```dart
SelectableChip(
  label: 'Category',
  isSelected: true,
  onTap: () {},
  icon: Icons.category,
)
```

#### FilterChip
Filter chip with checkmark.

```dart
FilterChip(
  label: 'Active',
  isSelected: isActive,
  onTap: () => setState(() => isActive = !isActive),
)
```

### 6. Dialogs & Modals (7 functions)

#### showConfirmDialog
Confirmation dialog with yes/no options.

```dart
final result = await showConfirmDialog(
  context: context,
  title: 'Confirm Action',
  message: 'Are you sure you want to continue?',
  confirmText: 'Yes',
  cancelText: 'No',
  icon: Icons.warning,
);
if (result == true) {
  // User confirmed
}
```

#### showSuccessDialog
Success confirmation dialog.

```dart
await showSuccessDialog(
  context: context,
  title: 'Success',
  message: 'Your booking has been confirmed!',
  onPressed: () => Navigator.pop(context),
);
```

#### showErrorDialog
Error message dialog.

```dart
await showErrorDialog(
  context: context,
  title: 'Error',
  message: 'Something went wrong. Please try again.',
);
```

#### showLoadingDialog
Non-dismissible loading dialog.

```dart
showLoadingDialog(
  context: context,
  message: 'Processing...',
);
// Later: Navigator.pop(context) to dismiss
```

#### showCustomBottomSheet
Custom bottom sheet modal.

```dart
await showCustomBottomSheet(
  context: context,
  child: Container(
    padding: EdgeInsets.all(20),
    child: Text('Bottom sheet content'),
  ),
);
```

#### showActionSheet
Action selector bottom sheet.

```dart
final result = await showActionSheet<String>(
  context: context,
  title: 'Choose an option',
  actions: [
    ActionSheetItem(
      title: 'Edit',
      value: 'edit',
      icon: Icons.edit,
    ),
    ActionSheetItem(
      title: 'Delete',
      value: 'delete',
      icon: Icons.delete,
      isDestructive: true,
    ),
  ],
);
if (result == 'delete') {
  // Handle delete
}
```

#### showCustomSnackbar
Toast/snackbar notification.

```dart
showCustomSnackbar(
  context: context,
  message: 'Item added to cart',
  type: SnackbarType.success,
  actionLabel: 'Undo',
  onAction: () {},
);
```

### 7. State Widgets (6 types)

#### EmptyState
Empty data placeholder.

```dart
EmptyState(
  icon: Icons.inbox,
  title: 'No Items',
  message: 'You have no items yet',
  buttonText: 'Add Item',
  onButtonPressed: () {},
)
```

#### ErrorState
Error display with retry.

```dart
ErrorState(
  title: 'Something Went Wrong',
  message: 'Please try again later',
  buttonText: 'Retry',
  onRetry: () => loadData(),
)
```

#### LoadingState
Centered loading indicator.

```dart
LoadingState(
  message: 'Loading data...',
  color: ThemeColors.primaryBlue,
)
```

#### NoConnectionState
No internet connection state.

```dart
NoConnectionState(
  onRetry: () => retryConnection(),
)
```

#### MaintenanceState
Maintenance mode display.

```dart
MaintenanceState(
  message: 'We will be back soon!',
)
```

#### ComingSoonState
Coming soon feature placeholder.

```dart
ComingSoonState(
  title: 'New Feature',
  message: 'Stay tuned for upcoming features!',
)
```

### 8. List Items (9 types)

#### StyledListTile
Enhanced list tile.

```dart
StyledListTile(
  leading: Icon(Icons.person),
  title: 'John Doe',
  subtitle: 'Member since 2024',
  trailing: Icon(Icons.arrow_forward),
  onTap: () {},
)
```

#### IconListTile
List tile with circular icon.

```dart
IconListTile(
  icon: Icons.settings,
  title: 'Settings',
  subtitle: 'Configure your preferences',
  onTap: () {},
)
```

#### SettingsSwitchTile
Switch toggle list item.

```dart
SettingsSwitchTile(
  title: 'Notifications',
  subtitle: 'Receive push notifications',
  value: isEnabled,
  onChanged: (value) => setState(() => isEnabled = value),
  icon: Icons.notifications,
)
```

#### ExpandableListTile
Expandable accordion list item.

```dart
ExpandableListTile(
  title: 'FAQ Question',
  icon: Icons.help,
  initiallyExpanded: false,
  children: [
    Padding(
      padding: EdgeInsets.all(16),
      child: Text('Answer content'),
    ),
  ],
)
```

#### StyledRadioListTile
Radio button list item.

```dart
StyledRadioListTile<String>(
  title: 'Option 1',
  subtitle: 'Description',
  value: 'option1',
  groupValue: selectedValue,
  onChanged: (value) => setState(() => selectedValue = value!),
)
```

#### DismissibleListItem
Swipeable list item.

```dart
DismissibleListItem(
  itemKey: 'item_1',
  child: ListTile(title: Text('Swipe to delete')),
  onDismissed: (direction) => deleteItem(),
  confirmDismiss: (direction) async {
    return await showConfirmDialog(
      context: context,
      title: 'Delete',
      message: 'Are you sure?',
    );
  },
)
```

#### ListSectionHeader
Section header for grouped lists.

```dart
ListSectionHeader(
  title: 'Recent',
  action: 'See All',
  onActionTap: () {},
)
```

#### DividerWithText
Divider with centered text.

```dart
DividerWithText(
  text: 'OR',
  color: ThemeColors.neutralGrey,
)
```

#### CustomSeparator
Simple horizontal separator.

```dart
CustomSeparator(
  height: 1,
  thickness: 1,
  color: ThemeColors.neutralGrey.withOpacity(0.2),
)
```

## Best Practices

### 1. Consistent Theming
Always use theme constants for colors, text styles, and dimensions:

```dart
// Good
PrimaryButton(
  text: 'Submit',
  backgroundColor: ThemeColors.primaryBlue,
)

// Avoid
PrimaryButton(
  text: 'Submit',
  backgroundColor: Color(0xFF0066CC),
)
```

### 2. Loading States
Use loading indicators for async operations:

```dart
PrimaryButton(
  text: 'Submit',
  isLoading: isSubmitting,
  onPressed: isSubmitting ? null : () => handleSubmit(),
)
```

### 3. Error Handling
Display appropriate error states:

```dart
if (hasError) {
  return ErrorState(
    title: 'Failed to Load',
    onRetry: () => loadData(),
  );
}
```

### 4. Form Validation
Use built-in validators:

```dart
EmailField(
  controller: emailController,
  // Validator is built-in
)

StyledTextField(
  validator: (value) {
    if (value?.isEmpty ?? true) return 'Required field';
    if (value!.length < 3) return 'Too short';
    return null;
  },
)
```

### 5. Responsive Design
Use flexible sizing:

```dart
PrimaryButton(
  text: 'Submit',
  isFullWidth: true, // Adapts to container width
)

StyledCard(
  padding: EdgeInsets.all(ThemeDimensions.defaultPadding),
  // Uses theme dimensions
)
```

## Common Patterns

### Loading → Error → Success Flow

```dart
class MyWidget extends StatefulWidget {
  @override
  _MyWidgetState createState() => _MyWidgetState();
}

class _MyWidgetState extends State<MyWidget> {
  bool isLoading = true;
  bool hasError = false;
  List<Item> items = [];

  @override
  void initState() {
    super.initState();
    loadData();
  }

  Future<void> loadData() async {
    setState(() {
      isLoading = true;
      hasError = false;
    });

    try {
      final data = await fetchData();
      setState(() {
        items = data;
        isLoading = false;
      });
    } catch (e) {
      setState(() {
        hasError = true;
        isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (isLoading) {
      return LoadingState(message: 'Loading items...');
    }

    if (hasError) {
      return ErrorState(
        title: 'Failed to Load',
        onRetry: loadData,
      );
    }

    if (items.isEmpty) {
      return EmptyState(
        title: 'No Items',
        message: 'Add your first item',
        buttonText: 'Add Item',
        onButtonPressed: () => navigateToAdd(),
      );
    }

    return ListView.builder(
      itemCount: items.length,
      itemBuilder: (context, index) {
        return StyledListTile(
          title: items[index].name,
          onTap: () => viewDetails(items[index]),
        );
      },
    );
  }
}
```

### Form with Validation

```dart
class MyForm extends StatefulWidget {
  @override
  _MyFormState createState() => _MyFormState();
}

class _MyFormState extends State<MyForm> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool isSubmitting = false;

  Future<void> handleSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => isSubmitting = true);

    try {
      await submitForm(
        email: _emailController.text,
        password: _passwordController.text,
      );

      showCustomSnackbar(
        context: context,
        message: 'Success!',
        type: SnackbarType.success,
      );
    } catch (e) {
      showErrorDialog(
        context: context,
        title: 'Error',
        message: e.toString(),
      );
    } finally {
      setState(() => isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: _formKey,
      child: Column(
        children: [
          EmailField(controller: _emailController),
          SizedBox(height: 16),
          PasswordField(controller: _passwordController),
          SizedBox(height: 24),
          PrimaryButton(
            text: 'Sign In',
            isLoading: isSubmitting,
            onPressed: handleSubmit,
            isFullWidth: true,
          ),
        ],
      ),
    );
  }
}
```

## Widget Combinations

### Profile Card Example

```dart
GradientCard(
  gradientColors: [ThemeColors.primaryBlue, ThemeColors.accentGold],
  child: Column(
    children: [
      CircleAvatar(
        radius: 40,
        backgroundImage: NetworkImage(user.avatarUrl),
      ),
      SizedBox(height: 12),
      Text(
        user.name,
        style: ThemeTextStyles.headlineMedium.copyWith(
          color: ThemeColors.neutralWhite,
        ),
      ),
      SizedBox(height: 4),
      VipBadge(text: 'VIP Gold'),
      SizedBox(height: 16),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          StatCard(
            icon: Icons.star,
            value: '150',
            label: 'Points',
            backgroundColor: Colors.white.withOpacity(0.2),
          ),
          StatCard(
            icon: Icons.local_offer,
            value: '12',
            label: 'Offers',
            backgroundColor: Colors.white.withOpacity(0.2),
          ),
        ],
      ),
    ],
  ),
)
```

### Settings Screen Example

```dart
Column(
  children: [
    ListSectionHeader(title: 'Account'),
    IconListTile(
      icon: Icons.person,
      title: 'Profile',
      subtitle: 'Manage your profile',
      onTap: () => navigateToProfile(),
    ),
    IconListTile(
      icon: Icons.lock,
      title: 'Privacy',
      subtitle: 'Privacy settings',
      onTap: () => navigateToPrivacy(),
    ),
    CustomSeparator(),
    ListSectionHeader(title: 'Preferences'),
    SettingsSwitchTile(
      title: 'Push Notifications',
      value: notificationsEnabled,
      onChanged: (value) => updateNotifications(value),
      icon: Icons.notifications,
    ),
    SettingsSwitchTile(
      title: 'Dark Mode',
      value: darkModeEnabled,
      onChanged: (value) => updateDarkMode(value),
      icon: Icons.dark_mode,
    ),
  ],
)
```

## Migration Guide

### Replacing Standard Widgets

Replace standard Flutter widgets with themed equivalents:

```dart
// Before
ElevatedButton(
  onPressed: () {},
  child: Text('Submit'),
)

// After
PrimaryButton(
  text: 'Submit',
  onPressed: () {},
)
```

```dart
// Before
TextField(
  decoration: InputDecoration(
    labelText: 'Email',
    hintText: 'Enter email',
  ),
)

// After
EmailField(
  labelText: 'Email',
  controller: emailController,
)
```

```dart
// Before
Center(
  child: CircularProgressIndicator(),
)

// After
LoadingState(
  message: 'Loading...',
)
```

## Contributing

When adding new widgets:

1. Follow existing naming conventions
2. Use theme constants for styling
3. Include customization parameters
4. Add documentation comments
5. Provide usage examples
6. Test on different screen sizes
7. Update this README with examples

## Support

For issues or questions about these widgets, please refer to:
- Theme documentation: `lib/common/theme/README.md`
- App architecture: `DEVELOPMENT_GUIDE.md`
- Component examples in existing screens
