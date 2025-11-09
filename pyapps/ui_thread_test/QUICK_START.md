# UI Thread Test - Quick Start Guide

## 🚀 Fastest Way to Start

From project root directory:

```bash
python pymain.py app=ui_thread
```

That's it! The application will:
1. Load configuration from `config/launcher_config.json`
2. Create and start NativeUIThread via pylauncher
3. Display interactive UI window

## 🎯 Fuzzy Matching

AppLauncher supports fuzzy matching, so you can use:

```bash
# All of these work:
python pymain.py app=ui_thread_test  # Exact match
python pymain.py app=ui_thread       # Prefix match ✅
python pymain.py app=ui              # Contains match ✅
python pymain.py app=thread          # Contains match ✅
```

## 📋 Other Launch Methods

### Method 2: Interactive Menu

```bash
python pymain.py
```

Will show:
```
Available Python applications:
  [1] mcpserver
  [2] ui_thread_test

Select an application by number or name:
```

### Method 3: Deployment Scripts

```powershell
cd pyapps/ui_thread_test
.\scripts\start.ps1
```

### Method 4: Direct Module

```bash
python -m pyapps.ui_thread_test.main
```

## 🔧 Configuration

Edit `pyapps/ui_thread_test/config/launcher_config.json`:

```json
{
  "ui_service": {
    "app_name": "UI Thread Test Application",
    "window_size": [1000, 700],
    "frameless": true,
    "theme": "dark",
    "enabled": true
  }
}
```

Changes take effect immediately on next start.

## ⌨️ UI Features

The test application includes:
- **Counter Display**: Large number display
- **Increment Button**: Click to increment counter
- **Decrement Button**: Click to decrement counter
- **Reset Button**: Reset counter to 0
- **Status Bar**: Shows operation status with timestamp

## 🛑 How to Stop

Press `Ctrl+C` in the terminal where the application is running.

## 📚 More Information

- Full documentation: `README.md`
- Implementation details: `IMPLEMENTATION_SUMMARY.md`
- Python development guide: `../../development-guides/PYTHON_PYCORE_BASE_GUIDE_THIS_FILE_NO_AI_EDIT.md`

## 🐛 Troubleshooting

### "No application found matching 'ui_thread'"

Make sure you're in the project root directory:
```bash
cd D:/programing/core_node
python pymain.py app=ui_thread
```

### Configuration file not found

The application will create default configuration on first run at:
`pyapps/ui_thread_test/config/launcher_config.json`

### Window not showing

Check configuration:
```json
{
  "ui_service": {
    "show_on_start": true  // Must be true
  }
}
```

## ✨ What's Happening Under the Hood

```
1. pymain.py
   └─> AppLauncher.start()
       └─> Finds pyapps/ui_thread_test/ui_thread_test_main.py
           └─> Calls main() function
               └─> Delegates to main.py start() function
                   └─> UIThreadTestApp.start()
                       ├─> Loads launcher_config.json
                       ├─> Creates UnifiedLauncher
                       ├─> Registers custom UI service
                       └─> Starts NativeUIThread
                           └─> UI window appears!
```
