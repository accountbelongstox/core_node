# Router Library

A complete routing library for the application using [Decompose](https://arkivanov.github.io/Decompose/) framework.

## Features

- Type-safe navigation with sealed classes
- Stack-based navigation with back button support
- Compose integration with animations
- Multiplatform support (Android, iOS, Desktop)

## Usage

### 1. Create Router Instance

```kotlin
import com.escodro.router.RouterFactory
import com.escodro.router.Screen

val router = RouterFactory.create(
    componentContext = componentContext,
    initialScreen = Screen.Home
)
```

### 2. Use Router in Composable

```kotlin
import com.escodro.router.RouterContent
import com.escodro.router.Screen

@Composable
fun AppContent(router: AppRouter) {
    RouterContent(router = router) { screen ->
        when (screen) {
            is Screen.Home -> HomeScreen(router)
            is Screen.TaskList -> TaskListScreen(router)
            is Screen.TaskDetail -> TaskDetailScreen(screen.taskId, router)
            is Screen.WordFlowLogin -> WordFlowLoginScreen(router)
            // ... other screens
        }
    }
}
```

### 3. Navigate Between Screens

```kotlin
// Navigate to a screen
router.navigateTo(Screen.TaskDetail(taskId = 123))

// Navigate and replace current screen
router.navigateTo(Screen.Search, replaceCurrent = true)

// Navigate back
router.navigateBack()

// Navigate back to a specific screen
router.navigateBackTo(Screen.Home)

// Navigate to root and clear stack
router.navigateToRoot(Screen.Home)
```

## Available Screens

### Home Screens
- `Screen.Home`
- `Screen.TaskList`
- `Screen.Search`
- `Screen.CategoryList`
- `Screen.Preferences`

### Task Screens
- `Screen.TaskDetail(taskId: Long)`
- `Screen.AddTaskBottomSheet`

### Category Screens
- `Screen.CategoryBottomSheet(categoryId: Long?)`

### Preference Screens
- `Screen.About`
- `Screen.Licenses`
- `Screen.Tracker`

### WordFlow Screens
- `Screen.WordFlowLogin`
- `Screen.WordFlowDashboard`
- `Screen.WordFlowCourses`
- `Screen.WordFlowCourseDetail(groupId: String)`

## Dependencies

- Decompose: 3.4.0 (Kotlin: 2.1.0, Compose: 1.8.2)
- Kotlinx Serialization: For screen serialization

## Version Information

This router library is built with Decompose 3.4.0, which includes:
- Kotlin 2.1.0 support
- Compose 1.8.2 support
- Improved performance and stability
- Enhanced navigation APIs

## Documentation

For more information, see the [Decompose documentation](https://arkivanov.github.io/Decompose/).

