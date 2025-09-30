#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3Check New Features Demo
Demonstrates the newly implemented features and improvements
"""

import sys
import time
from pathlib import Path

# Add project root to Python path
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from provider.config_provider import CONFIG
from utils.color_print import ColorPrint
from utils.process_manager import ProcessManager
from utils.bot_scanner import BotScanner
from utils.dependency_checker import DependencyChecker
from controller.bot_state_manager import BotStateManager, BotState


def demo_dependency_checker():
    """Demonstrate fast dependency checking"""
    ColorPrint.blue("🎯 === New Feature: Fast Dependency Checker ===")
    
    checker = DependencyChecker()
    result = checker.check_dependencies()
    
    ColorPrint.green(f"📊 Dependency Check Results:")
    ColorPrint.green(f"   Total packages: {result['total_packages']}")
    ColorPrint.green(f"   Available: {result['available_count']}")
    ColorPrint.green(f"   Missing: {result['missing_count']}")
    ColorPrint.green(f"   Status: {'✅ All OK' if result['success'] else '⚠️  Missing deps'}")
    
    if result['missing_packages']:
        commands = checker.get_pip_install_commands(result['missing_packages'])
        ColorPrint.blue("📦 Would need to install:")
        for cmd in commands:
            ColorPrint.white(f"   {cmd}")
    
    ColorPrint.blue("💡 This checker uses Python imports for speed instead of pip")
    print()


def demo_improved_process_manager():
    """Demonstrate improved process manager with force restart"""
    ColorPrint.blue("🎯 === Improved Feature: Process Manager ===")
    
    pm = ProcessManager()
    
    ColorPrint.green("🔧 New Features:")
    ColorPrint.green("   ✅ Force restart option")
    ColorPrint.green("   ✅ Detailed error reporting")
    ColorPrint.green("   ✅ Correct explorer command format")
    ColorPrint.green("   ✅ Better process detection")
    
    # Show force restart configuration
    force_restart = CONFIG.get("bot_settings.force_restart", True)
    ColorPrint.blue(f"⚙️  Force restart enabled: {force_restart}")
    
    ColorPrint.blue("💡 Process manager now uses: explorer \"path\" (not complex commands)")
    ColorPrint.blue("💡 Provides detailed error messages when startup fails")
    print()


def demo_improved_bot_scanner():
    """Demonstrate improved bot scanner with other exe priority"""
    ColorPrint.blue("🎯 === Improved Feature: Bot Scanner Priority Logic ===")
    
    bot_base_dir = CONFIG.get_bot_base_dir()
    
    if bot_base_dir and Path(bot_base_dir).exists():
        scanner = BotScanner(bot_base_dir)
        result = scanner.scan_for_bot_directory()
        
        if result["success"]:
            ColorPrint.green("🎯 New Priority Logic:")
            ColorPrint.green("   1️⃣ First priority: Use other exe if available")
            ColorPrint.green("   2️⃣ Second priority: Start RoS-BoT.exe to generate other exe")
            ColorPrint.green("   3️⃣ Fallback: Use RoS-BoT.exe directly")
            
            ColorPrint.blue(f"📁 Bot directory: {result['bot_dir']}")
            ColorPrint.blue(f"🎯 RoS-BoT.exe: {result['bot_exe_path']}")
            
            if result['boot_exe_name']:
                ColorPrint.green(f"⭐ Other exe found: {result['boot_exe_name']} (PRIORITY)")
                ColorPrint.blue("💡 System will try to start this directly first")
            else:
                ColorPrint.yellow("⚠️  No other exe found yet")
                ColorPrint.blue("💡 System will start RoS-BoT.exe and wait for other exe generation")
        else:
            ColorPrint.red(f"❌ Bot scan failed: {result['error']}")
    else:
        ColorPrint.yellow(f"⚠️  Bot base directory not configured: {bot_base_dir}")
    
    print()


def demo_startup_scripts():
    """Demonstrate new startup script chain"""
    ColorPrint.blue("🎯 === New Feature: Startup Script Chain ===")
    
    ColorPrint.green("🔗 New Startup Chain:")
    ColorPrint.green("   1️⃣ start.bat - Entry point (checks PowerShell)")
    ColorPrint.green("   2️⃣ start.ps1 - PowerShell launcher (checks admin + deps)")
    ColorPrint.green("   3️⃣ dependency_checker.py - Fast dependency check")
    ColorPrint.green("   4️⃣ main.py - Main application")
    
    ColorPrint.blue("🛡️  Security Features:")
    ColorPrint.blue("   ✅ Administrator privilege check")
    ColorPrint.blue("   ✅ Python availability check")
    ColorPrint.blue("   ✅ Fast dependency verification")
    ColorPrint.blue("   ✅ Automatic dependency installation (with -Force)")
    
    ColorPrint.blue("📋 Available Commands:")
    ColorPrint.white("   start.bat                 - Standard startup")
    ColorPrint.white("   powershell start.ps1      - PowerShell direct")
    ColorPrint.white("   powershell start.ps1 -Force - Auto-install deps")
    ColorPrint.white("   install.bat               - Manual installation")
    
    print()


def demo_improved_bot_logic():
    """Demonstrate improved bot startup logic"""
    ColorPrint.blue("🎯 === Improved Feature: Bot Startup Logic ===")
    
    ColorPrint.green("🧠 Smart Startup Logic:")
    ColorPrint.green("   1️⃣ Check if other exe is already running → Use it")
    ColorPrint.green("   2️⃣ Try to start other exe directly → If success, use it")
    ColorPrint.green("   3️⃣ Start RoS-BoT.exe → Wait for other exe generation")
    ColorPrint.green("   4️⃣ Fallback to RoS-BoT.exe if other exe not generated")
    
    # Simulate the logic
    state_manager = BotStateManager(repeat_login_time=10, run_duration=120)
    
    ColorPrint.blue("🔄 Simulating startup sequence...")
    
    # Show state transitions
    state_manager.print_state_info()
    time.sleep(0.5)
    
    state_manager.transition_to_state(BotState.STARTING, "Attempting other exe startup")
    ColorPrint.blue("🎯 Trying other exe first...")
    time.sleep(0.5)
    
    state_manager.transition_to_state(BotState.RUNNING, "Other exe started successfully")
    ColorPrint.green("✅ Other exe is now running (priority achieved)")
    state_manager.print_state_info()
    
    ColorPrint.blue("💡 This logic ensures other exe is always preferred over RoS-BoT.exe")
    print()


def demo_configuration_improvements():
    """Demonstrate configuration improvements"""
    ColorPrint.blue("🎯 === Improved Feature: Configuration Management ===")
    
    ColorPrint.green("⚙️  New Configuration Options:")
    
    # Show new force_restart setting
    force_restart = CONFIG.get("bot_settings.force_restart", True)
    ColorPrint.green(f"   force_restart: {force_restart}")
    ColorPrint.blue("     → Automatically kills existing processes before starting")
    
    # Show updated run_duration
    run_duration = CONFIG.get("bot_settings.run_duration", 3600)
    ColorPrint.green(f"   run_duration: {run_duration}s ({run_duration/60:.1f} minutes)")
    ColorPrint.blue("     → Updated to shorter duration for testing")
    
    # Show operation examples
    operation_ids = CONFIG.get("bot_settings.operation_ids", [])
    ColorPrint.green(f"   operation_ids: {len(operation_ids)} configured")
    for i, op in enumerate(operation_ids[:3]):  # Show first 3
        ColorPrint.blue(f"     {i+1}. {op}")
    if len(operation_ids) > 3:
        ColorPrint.blue(f"     ... and {len(operation_ids)-3} more")
    
    ColorPrint.blue("💡 All settings are hot-reloadable and well-documented")
    print()


def main():
    """Run all new feature demos"""
    ColorPrint.green("🎉 D3Check New Features Demo!")
    ColorPrint.blue("=" * 60)
    ColorPrint.blue("Showcasing the latest improvements and new features")
    ColorPrint.blue("=" * 60)
    print()
    
    demos = [
        ("Fast Dependency Checker", demo_dependency_checker),
        ("Improved Process Manager", demo_improved_process_manager),
        ("Bot Scanner Priority Logic", demo_improved_bot_scanner),
        ("Startup Script Chain", demo_startup_scripts),
        ("Smart Bot Startup Logic", demo_improved_bot_logic),
        ("Configuration Improvements", demo_configuration_improvements),
    ]
    
    for demo_name, demo_func in demos:
        try:
            demo_func()
        except Exception as e:
            ColorPrint.red(f"❌ Error in {demo_name} demo: {e}")
            print()
    
    ColorPrint.blue("=" * 60)
    ColorPrint.green("🎉 New Features Demo Completed!")
    ColorPrint.blue("🚀 Key Improvements:")
    ColorPrint.blue("   • Other exe priority logic")
    ColorPrint.blue("   • Force restart capability")
    ColorPrint.blue("   • Fast dependency checking")
    ColorPrint.blue("   • Admin privilege validation")
    ColorPrint.blue("   • Detailed error reporting")
    ColorPrint.blue("   • Improved startup scripts")
    ColorPrint.blue("=" * 60)


if __name__ == "__main__":
    main()
