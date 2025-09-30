# Diablo 3 Macro UI Library

This is a UI library that creates a graphical interface similar to the Diablo 3 Skill Clicker application.

## Features

- **4 Configuration Namespaces**: Support for 4 independent skill macro configurations
- **Global Auxiliary Functions**: Shared auxiliary functions across all configurations
- **Skill Settings**: Configure 6 different skills (4 main skills + left/right click) per namespace
- **Strategy Options**: Different execution strategies for each skill
- **Additional Settings**: Quick switch, macro start method, pause options, movement and potion assists
- **Auxiliary Functions**: Various helper functions for game automation (global)
- **Real-time Status**: Live status display and macro control buttons

## Usage

### Basic Usage

```python
from ui.diablo3_macro_ui import Diablo3MacroUI

# Create UI instance
ui = Diablo3MacroUI()

# Set callbacks
def on_macro_start():
    print("Macro started!")

def on_macro_stop():
    print("Macro stopped!")

def on_config_change():
    print("Configuration changed!")

ui.set_macro_start_callback(on_macro_start)
ui.set_macro_stop_callback(on_macro_stop)
ui.set_config_change_callback(on_config_change)

# Run the UI
ui.run()
```

### Using with Main Controller

```python
from main import D3MacroController

# Create and run the application
app = D3MacroController()
app.run()
```

## UI Components

### 1. Title Bar
- Application title and version information
- Back button (placeholder)

### 2. Configuration Tabs
- 4 configuration tabs (配置1-4)
- Click to switch between different macro setups

### 3. Left Panel - Skill Settings
- **Skill Configuration Table**:
  - Hotkey input for each skill
  - Strategy dropdown (禁用, 按住不放, 连点, 保持Buff)
  - Execution interval (milliseconds)
  - Delay settings
  - Random delay checkbox

- **Additional Settings**:
  - Quick switch configuration
  - Macro start method
  - Quick pause settings
  - Movement assist
  - Potion assist

### 4. Right Panel - Auxiliary Functions
- Combat macro hotkey settings
- Assistant macro settings
- Animation speed control
- Blood shard gambling assistant
- Quick pickup assistant
- Blacksmith salvage assistant
- Kanai's Cube assistants
- Drop equipment assistant

### 5. Bottom Bar
- Macro control buttons (Start/Stop)
- Status indicator
- Configuration status
- Custom key settings
- GitHub link

## Configuration Structure

### Namespace System

The UI uses a **namespace system** where:

- **4 Skill Configuration Namespaces**: Each tab (配置1-4) has its own independent skill settings
- **1 Global Auxiliary Configuration**: All auxiliary functions are shared across all configurations

### Skill Configuration (4 Namespaces)

Each skill configuration contains:

```python
{
    'skills': {
        'skill1': {'key': '1', 'strategy': '禁用', 'interval': 300, 'delay': 10, 'random': False},
        'skill2': {'key': '2', 'strategy': '按住不放', 'interval': 300, 'delay': 10, 'random': False},
        'skill3': {'key': '3', 'strategy': '连点', 'interval': 300, 'delay': 10, 'random': True},
        'skill4': {'key': '4', 'strategy': '保持Buff', 'interval': 5000, 'delay': 10, 'random': True},
        'left_click': {'key': 'LButton', 'strategy': '禁用', 'interval': 300, 'delay': 10, 'random': False},
        'right_click': {'key': 'RButton', 'strategy': '禁用', 'interval': 300, 'delay': 10, 'random': False}
    },
    'quick_switch': {'key': '无', 'auto_start': False},
    'macro_start': {'method': '懒人模式', 'single_thread': False, 'queue_delay': 200},
    'quick_pause': {'enabled': False, 'key': '鼠标左键', 'delay': 1500},
    'movement': {'strategy': '强制走位 (连点)', 'interval': 100},
    'potion': {'strategy': '保持药水CD', 'interval': 500}
}
```

### Auxiliary Configuration (Global)

The auxiliary configuration is shared across all skill configurations:

```python
{
    'combat_hotkey': 'F2',
    'assistant_hotkey': 'F5',
    'animation_speed': '中等',
    'blood_shard': {'enabled': True, 'count': 15},
    'quick_pickup': {'enabled': True, 'count': 30},
    'blacksmith': {'enabled': False, 'strategy': '快速分解'},
    'kanai_reforge': {'enabled': False, 'strategy': '重铸一次'},
    'kanai_upgrade': {'enabled': False},
    'kanai_convert': {'enabled': False},
    'drop_equipment': {'enabled': False},
    'sound_feedback': True,
    'smart_pause': True,
    'custom_stand': {'enabled': False, 'key': 'Shift'},
    'custom_move': {'enabled': False, 'key': 'E'},
    'custom_potion': {'enabled': False, 'key': 'Q'}
}
```

## Methods

### Core Methods
- `run()`: Start the UI main loop
- `destroy()`: Destroy the UI window
- `get_current_config()`: Get current configuration data (merged)
- `show_message(title, message, msg_type)`: Show message box

### Namespace Methods
- `get_skill_config(config_name=None)`: Get skill configuration for specific namespace
- `get_auxiliary_config()`: Get global auxiliary configuration
- `_switch_config(config_name)`: Switch between skill configuration namespaces

### Callback Methods
- `set_macro_start_callback(callback)`: Set macro start callback
- `set_macro_stop_callback(callback)`: Set macro stop callback
- `set_config_change_callback(callback)`: Set configuration change callback

## Testing

### Basic UI Test
Run the test script to see the UI in action:

```bash
python test_ui.py
```

Or use the batch file:

```bash
start_ui.bat
```

### Namespace Functionality Test
Test the namespace system:

```bash
python test_namespace.py
```

This will verify:
- ✓ 4 skill configuration namespaces work correctly
- ✓ Auxiliary functions are global (shared)
- ✓ Configuration switching preserves individual settings
- ✓ Configuration retrieval works properly

## Dependencies

- Python 3.6+
- tkinter (included with Python)
- threading (included with Python)

## Notes

- The UI is designed to match the original Diablo 3 Skill Clicker interface
- All text is in Chinese to match the original application
- The UI uses a dark theme similar to the original
- Macro execution logic is handled by the main controller, not the UI
- The UI is purely for configuration and control, actual key simulation would need additional libraries like `pynput` or `pyautogui`
