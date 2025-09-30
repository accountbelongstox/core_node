# D3Check New Architecture

## Overview

The D3Check application has been refactored to use a clean architecture with configuration management, separation of concerns, and proper data persistence.

## Architecture Components

### 1. Configuration Manager (`providor/d3_config_manager.py`)

**Purpose**: Manages all configuration data with file persistence and namespace support using resources from `providor_index.py`.

**Key Features**:
- **Data Directory**: `C:\Users\用户名\.core_node\.d3check`
- **4 Skill Configuration Namespaces**: Independent configurations for config1-config4
- **1 Global Auxiliary Configuration**: Shared across all skill configurations
- **Template Configuration**: Uses `template_config.json` for initialization
- **Automatic File Management**: Creates, loads, merges, and updates configuration files
- **Error Recovery**: Rebuilds configuration if file is corrupted
- **Real-time Updates**: Every configuration change is immediately saved to file
- **Integration with providor_index**: Uses existing configuration infrastructure

**Methods**:
- `get_skill_config(config_name)`: Get skill configuration for specific namespace
- `get_auxiliary_config()`: Get global auxiliary configuration
- `get_current_config(current_skill_config)`: Get merged configuration
- `update_skill_config(config_name, config_data)`: Update skill configuration
- `update_auxiliary_config(config_data)`: Update auxiliary configuration
- `switch_skill_config(config_name)`: Switch between skill configurations

### 2. Controller (`controller/d3_macro_controller.py`)

**Purpose**: Main application controller that coordinates between UI and configuration.

**Key Features**:
- **Macro Management**: Start/stop macro execution
- **Configuration Coordination**: Manages configuration switching and updates
- **UI Integration**: Handles UI callbacks and events
- **Thread Management**: Manages macro execution threads

**Methods**:
- `start_macro()` / `stop_macro()`: Control macro execution
- `switch_skill_config(config_name)`: Switch skill configuration namespace
- `get_current_config()`: Get current merged configuration
- `update_skill_config()` / `update_auxiliary_config()`: Update configurations
- `run()`: Start the application

### 3. UI (`ui/diablo3_macro_ui.py`)

**Purpose**: User interface that displays and manages configuration settings.

**Key Features**:
- **No Hard-coded Configuration**: All data comes from configuration manager
- **Namespace Support**: 4 independent skill configuration tabs
- **Global Auxiliary Functions**: Shared auxiliary settings
- **Real-time Updates**: Configuration changes are immediately saved
- **Callback System**: Notifies controller of user actions
- **Test Buttons Area**: 10 test buttons at the bottom for future functionality
- **Log Output Window**: Real-time log display with color support
- **Increased Window Height**: 1000x900 to accommodate new features

**Methods**:
- `get_current_config()`: Get current merged configuration
- `get_skill_config(config_name)`: Get specific skill configuration
- `get_auxiliary_config()`: Get auxiliary configuration
- `set_*_callback()`: Set callback functions for events

### 4. Main Entry Point (`main.py`)

**Purpose**: Simple entry point that starts the application.

**Code**:
```python
from controller.d3_macro_controller import D3MacroController

if __name__ == "__main__":
    D3MacroController().run()
```

## Configuration Structure

### Skill Configuration (4 Namespaces)
Each skill configuration contains:
```json
{
  "skills": {
    "skill1": {"key": "1", "strategy": "禁用", "interval": 300, "delay": 10, "random": false},
    "skill2": {"key": "2", "strategy": "按住不放", "interval": 300, "delay": 10, "random": false},
    "skill3": {"key": "3", "strategy": "连点", "interval": 300, "delay": 10, "random": true},
    "skill4": {"key": "4", "strategy": "保持Buff", "interval": 5000, "delay": 10, "random": true},
    "left_click": {"key": "LButton", "strategy": "禁用", "interval": 300, "delay": 10, "random": false},
    "right_click": {"key": "RButton", "strategy": "禁用", "interval": 300, "delay": 10, "random": false}
  },
  "quick_switch": {"key": "无", "auto_start": false},
  "macro_start": {"method": "懒人模式", "single_thread": false, "queue_delay": 200},
  "quick_pause": {"enabled": false, "key": "鼠标左键", "delay": 1500},
  "movement": {"strategy": "强制走位 (连点)", "interval": 100},
  "potion": {"strategy": "保持药水CD", "interval": 500}
}
```

### Auxiliary Configuration (Global)
```json
{
  "combat_hotkey": "F2",
  "assistant_hotkey": "F5",
  "animation_speed": "中等",
  "blood_shard": {"enabled": true, "count": 15},
  "quick_pickup": {"enabled": true, "count": 30},
  "blacksmith": {"enabled": false, "strategy": "快速分解"},
  "kanai_reforge": {"enabled": false, "strategy": "重铸一次"},
  "kanai_upgrade": {"enabled": false},
  "kanai_convert": {"enabled": false},
  "drop_equipment": {"enabled": false},
  "sound_feedback": true,
  "smart_pause": true,
  "custom_stand": {"enabled": false, "key": "Shift"},
  "custom_move": {"enabled": false, "key": "E"},
  "custom_potion": {"enabled": false, "key": "Q"}
}
```

## Data Flow

1. **Application Start**:
   - Controller creates configuration provider
   - Configuration provider loads/creates configuration file
   - UI is created with configuration provider reference
   - UI loads initial configuration from provider

2. **Configuration Changes**:
   - User modifies settings in UI
   - UI saves changes to configuration provider
   - Configuration provider immediately updates file
   - Controller is notified of changes

3. **Configuration Switching**:
   - User clicks configuration tab
   - UI saves current configuration
   - UI loads new configuration from provider
   - Controller is notified of switch

4. **Macro Execution**:
   - Controller gets current configuration from provider
   - Controller executes macro based on configuration
   - Configuration changes are automatically saved

## File Management

### Configuration File Location
- **Path**: `C:\Users\用户名\.core_node\.d3check\d3check_config.json`
- **Format**: JSON with UTF-8 encoding
- **Structure**: Contains both skill configurations and auxiliary configuration
- **Template**: `providor/template_config.json` provides initial configuration structure

### Error Handling
- **File Corruption**: Automatically rebuilds with default values
- **Missing File**: Creates new file with default configuration
- **Invalid Data**: Merges valid data with defaults, discards invalid data
- **Permission Issues**: Logs errors and continues with in-memory configuration

## Testing

### Test Suite
Run the comprehensive test suite:
```bash
python test_new_architecture.py
```

### Individual Tests
- **Configuration Provider Test**: Tests file management, configuration switching, and data persistence
- **Controller Test**: Tests configuration coordination and macro management
- **UI Integration Test**: Tests UI integration with configuration provider

### Manual Testing
```bash
# Run main application
python main.py

# Or use batch file
start_main.bat

# Test UI with test buttons
python test_ui_with_test_buttons.py

# Or use batch file
start_ui_test.bat

# Test log output functionality
python test_log_output.py

# Or use batch file
start_log_test.bat

# Test screenshot functionality
python test_screenshot.py
```

## Benefits of New Architecture

1. **Separation of Concerns**: Each component has a single responsibility
2. **Data Persistence**: All configuration changes are automatically saved
3. **Error Recovery**: Robust error handling and file corruption recovery
4. **Namespace Support**: 4 independent skill configurations with shared auxiliary functions
5. **Real-time Updates**: Configuration changes are immediately persisted
6. **Clean Code**: No hard-coded configuration, all data comes from provider
7. **Testability**: Each component can be tested independently
8. **Maintainability**: Clear structure makes code easy to understand and modify

## Migration from Old Architecture

The new architecture is fully backward compatible:
- Existing configuration files are automatically migrated
- UI behavior remains the same
- All features are preserved
- Performance is improved with better data management

## Test Buttons Area

The UI now includes a test buttons area at the bottom with 10 test buttons:

1. **测试1**: 截屏测试 (Screenshot Test) - 调用 screenshot_controller.py 的 main 方法
2. **测试2**: 技能配置测试
3. **测试3**: 辅助功能测试
4. **测试4**: 命名空间切换测试
5. **测试5**: 文件保存测试
6. **测试6**: 配置加载测试
7. **测试7**: 宏执行测试
8. **测试8**: UI状态测试
9. **测试9**: 错误处理测试
10. **测试10**: 性能测试

These buttons are placeholders for future functionality and can be easily hidden or modified as needed.

## Log Output System

### ColorPrint Extension
- **Callback Support**: Extended `color_print.py` with callback functionality
- **Real-time Logging**: All ColorPrint output is automatically captured
- **Color Preservation**: Log messages maintain their original colors

### LogOutputWidget
- **Real-time Display**: Shows all ColorPrint output in real-time
- **Auto-scroll**: Automatically scrolls to show latest messages
- **Manual Scroll Control**: Pauses auto-scroll when user scrolls up
- **Color Support**: Displays messages with their original colors
- **Line Limit**: Automatically removes old lines to prevent memory issues
- **Timestamp**: Adds timestamps to all log messages

### Integration
- **Automatic Registration**: LogOutputWidget automatically registers with ColorPrint
- **Seamless Operation**: No changes needed to existing ColorPrint usage
- **Error Handling**: Graceful fallback if log widget fails

## Future Enhancements

- Configuration import/export
- Configuration validation
- Configuration versioning
- Remote configuration synchronization
- Configuration templates
- Test button functionality implementation
