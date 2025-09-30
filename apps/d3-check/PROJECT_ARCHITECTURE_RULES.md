# Project Architecture Rules

## Directory Structure and Dependencies

### 1. State Management (`state/`)
- **Purpose**: Pure state management without business logic
- **Rules**:
  - State managers MUST NOT import from `utils/`
  - State managers MUST NOT import from `controller/`
  - State managers only provide state storage and basic state operations
  - State managers can import from `base/` for common functionality
  - State managers can import from `providor/` for configuration

### 2. Utils (`utils/`)
- **Purpose**: Utility classes and helper functions
- **Rules**:
  - Utils classes MUST NOT import from other `utils/` classes
  - Utils classes MUST NOT import from `controller/`
  - Utils classes MUST NOT import from `state/`
  - Utils classes can import from `base/` for common functionality
  - Utils classes can import from `providor/` for configuration
  - If utils need to interact, use dependency injection through controllers

### 3. Controllers (`controller/`)
- **Purpose**: Business logic and orchestration
- **Rules**:
  - Controllers can import from `utils/`
  - Controllers can import from `state/`
  - Controllers can import from `base/`
  - Controllers handle communication between utils classes
  - Controllers manage state updates
  - Controllers orchestrate complex workflows

### 4. Base Classes (`base/`)
- **Purpose**: Common base classes and shared functionality
- **Rules**:
  - Base classes MUST NOT import from `utils/`
  - Base classes MUST NOT import from `controller/`
  - Base classes MUST NOT import from `state/`
  - Base classes MUST NOT import from other `base/` classes
  - Base classes can import from `providor/` for configuration
  - Base classes provide pure functionality without dependencies

### 5. Providers (`providor/`)
- **Purpose**: Configuration and external data providers
- **Rules**:
  - Providers can be imported by any layer
  - Providers MUST NOT import from other layers except standard libraries
  - Providers provide configuration and external data access

## Dependency Flow

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ controller/ │───▶│   utils/    │    │   state/    │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│    base/    │    │    base/    │    │    base/    │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│ providor/   │    │ providor/   │    │ providor/   │
│             │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
```

## Specific Rules

### State Management
- State classes use `@dataclass` for structure
- State updates through dedicated methods
- No business logic in state classes
- State serialization/deserialization methods allowed
- State validation methods allowed

### Utils Classes
- Each util class has single responsibility
- Utils receive dependencies through constructor injection
- Utils do not maintain state (stateless where possible)
- Utils provide pure functions or single-purpose classes

### Controllers
- Controllers orchestrate workflows
- Controllers inject dependencies into utils
- Controllers manage state updates
- Controllers handle error propagation
- Controllers provide public APIs

### Base Classes
- Provide common functionality (logging, printing, etc.)
- No cross-dependencies between base classes
- Pure functionality without side effects
- Can be inherited by any layer

## Migration Strategy

### Phase 1: Create Base Classes
1. Move `color_print.py` to `base/color_print.py`
2. Create other common base classes as needed
3. Update imports in existing code

### Phase 2: Create State Management
1. Move state-related code from `utils/` to `state/`
2. Remove business logic from state classes
3. Update controllers to use new state classes

### Phase 3: Refactor Utils
1. Remove cross-dependencies between utils
2. Make utils stateless where possible
3. Update controllers to inject dependencies

### Phase 4: Update Controllers
1. Controllers become orchestrators
2. Controllers inject dependencies
3. Controllers manage state updates

## Benefits

1. **Clear Separation of Concerns**: Each layer has specific responsibility
2. **Testability**: Utils and state can be tested independently
3. **Maintainability**: Changes in one layer don't cascade
4. **Scalability**: Easy to add new features without breaking existing code
5. **Dependency Management**: Clear dependency flow prevents circular imports

## Examples

### Good: Controller orchestrating utils
```python
class MonitoringController:
    def __init__(self):
        self.state_manager = ComprehensiveStateManager()
        self.process_detector = GameProcessDetector()
        self.window_activator = WindowActivator()
    
    def monitor_cycle(self):
        # Controller orchestrates the workflow
        processes = self.process_detector.detect_processes()
        self.state_manager.update_process_states(processes)
        if self.state_manager.needs_activation():
            self.window_activator.activate_window(handle)
```

### Bad: Utils importing other utils
```python
# DON'T DO THIS
class GameProcessDetector:
    def __init__(self):
        from utils.window_activator import WindowActivator  # WRONG!
        self.activator = WindowActivator()
```

### Good: Base class usage
```python
# base/color_print.py
class ColorPrint:
    @staticmethod
    def green(message: str):
        print(f"\033[92m{message}\033[0m")

# utils/process_detector.py
from base.color_print import ColorPrint

class GameProcessDetector:
    def detect(self):
        ColorPrint.green("Detection started")
```
