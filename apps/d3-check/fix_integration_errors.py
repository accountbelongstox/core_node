#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fix Integration Errors
Quick fix script for integration errors in the monitoring system
"""

import os
import sys

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

from base.color_print import ColorPrint


def test_imports():
    """Test all critical imports"""
    ColorPrint.print_header("Testing Critical Imports")
    
    try:
        from controller.game_management_controller import GameManagementController
        ColorPrint.green("✓ GameManagementController import successful")
    except Exception as e:
        ColorPrint.red(f"✗ GameManagementController import failed: {e}")
    
    try:
        from controller.monitoring_controller import MonitoringController
        ColorPrint.green("✓ MonitoringController import successful")
    except Exception as e:
        ColorPrint.red(f"✗ MonitoringController import failed: {e}")
    
    try:
        from utils.game_process_detector import GameProcessDetector
        detector = GameProcessDetector()
        
        # Test required methods
        if hasattr(detector, 'detect_diablo_process'):
            ColorPrint.green("✓ GameProcessDetector.detect_diablo_process exists")
        else:
            ColorPrint.red("✗ GameProcessDetector.detect_diablo_process missing")
            
        if hasattr(detector, 'detect_rosbot_process'):
            ColorPrint.green("✓ GameProcessDetector.detect_rosbot_process exists")
        else:
            ColorPrint.red("✗ GameProcessDetector.detect_rosbot_process missing")
            
        if hasattr(detector, 'detect_other_exe_processes'):
            ColorPrint.green("✓ GameProcessDetector.detect_other_exe_processes exists")
        else:
            ColorPrint.red("✗ GameProcessDetector.detect_other_exe_processes missing")
            
    except Exception as e:
        ColorPrint.red(f"✗ GameProcessDetector test failed: {e}")


def test_controller_integration():
    """Test controller integration"""
    ColorPrint.print_header("Testing Controller Integration")
    
    try:
        from controller.game_management_controller import GameManagementController
        controller = GameManagementController()
        
        # Test required attributes
        if hasattr(controller, 'game_state_manager'):
            ColorPrint.green("✓ GameManagementController.game_state_manager exists")
        else:
            ColorPrint.red("✗ GameManagementController.game_state_manager missing")
            
        if hasattr(controller, 'comprehensive_state_manager'):
            ColorPrint.green("✓ GameManagementController.comprehensive_state_manager exists")
        else:
            ColorPrint.red("✗ GameManagementController.comprehensive_state_manager missing")
            
        if hasattr(controller, 'process_detector'):
            ColorPrint.green("✓ GameManagementController.process_detector exists")
        else:
            ColorPrint.red("✗ GameManagementController.process_detector missing")
            
        # Test required methods
        if hasattr(controller, 'update_all_process_states'):
            ColorPrint.green("✓ GameManagementController.update_all_process_states exists")
        else:
            ColorPrint.red("✗ GameManagementController.update_all_process_states missing")
            
        if hasattr(controller, 'perform_rosbot_management'):
            ColorPrint.green("✓ GameManagementController.perform_rosbot_management exists")
        else:
            ColorPrint.red("✗ GameManagementController.perform_rosbot_management missing")
            
    except Exception as e:
        ColorPrint.red(f"✗ GameManagementController test failed: {e}")
        import traceback
        traceback.print_exc()


def test_monitoring_controller():
    """Test monitoring controller"""
    ColorPrint.print_header("Testing Monitoring Controller")
    
    try:
        from controller.monitoring_controller import MonitoringController
        controller = MonitoringController()
        
        # Test required attributes
        if hasattr(controller, 'game_management_controller'):
            ColorPrint.green("✓ MonitoringController.game_management_controller exists")
        else:
            ColorPrint.red("✗ MonitoringController.game_management_controller missing")
            
        # Test required methods
        if hasattr(controller, 'update_system_status'):
            ColorPrint.green("✓ MonitoringController.update_system_status exists")
        else:
            ColorPrint.red("✗ MonitoringController.update_system_status missing")
            
        if hasattr(controller, 'print_system_status'):
            ColorPrint.green("✓ MonitoringController.print_system_status exists")
        else:
            ColorPrint.red("✗ MonitoringController.print_system_status missing")
            
    except Exception as e:
        ColorPrint.red(f"✗ MonitoringController test failed: {e}")
        import traceback
        traceback.print_exc()


def test_process_detection():
    """Test process detection functionality"""
    ColorPrint.print_header("Testing Process Detection")
    
    try:
        from utils.game_process_detector import GameProcessDetector
        detector = GameProcessDetector()
        
        # Test Diablo detection
        ColorPrint.blue("[TEST] Testing Diablo process detection...")
        diablo_result = detector.detect_diablo_process()
        if diablo_result:
            ColorPrint.green(f"✓ Diablo process detected: {diablo_result.get('title', 'Unknown')}")
        else:
            ColorPrint.yellow("○ Diablo process not running (expected if not launched)")
        
        # Test RoS-BoT detection
        ColorPrint.blue("[TEST] Testing RoS-BoT process detection...")
        rosbot_result = detector.detect_rosbot_process()
        if rosbot_result:
            ColorPrint.green(f"✓ RoS-BoT process detected: {rosbot_result.get('title', 'Unknown')}")
        else:
            ColorPrint.yellow("○ RoS-BoT process not running (expected if not launched)")
        
        # Test other exe detection
        ColorPrint.blue("[TEST] Testing other exe process detection...")
        other_result = detector.detect_other_exe_processes()
        ColorPrint.blue(f"○ Other exe processes: {len(other_result)} found")
        
    except Exception as e:
        ColorPrint.red(f"✗ Process detection test failed: {e}")
        import traceback
        traceback.print_exc()


def test_full_integration():
    """Test full system integration"""
    ColorPrint.print_header("Testing Full System Integration")
    
    try:
        from controller.game_management_controller import GameManagementController
        controller = GameManagementController()
        
        # Test process state update
        ColorPrint.blue("[TEST] Testing process state update...")
        controller.update_all_process_states()
        ColorPrint.green("✓ Process state update completed")
        
        # Test system status
        ColorPrint.blue("[TEST] Testing system status...")
        status = controller.get_system_status()
        ColorPrint.green(f"✓ System status retrieved: {list(status.keys())}")
        
        # Test status printing
        ColorPrint.blue("[TEST] Testing status printing...")
        controller.print_system_status(force_print=True)
        ColorPrint.green("✓ Status printing completed")
        
    except Exception as e:
        ColorPrint.red(f"✗ Full integration test failed: {e}")
        import traceback
        traceback.print_exc()


def run_monitoring_test():
    """Run a quick monitoring test"""
    ColorPrint.print_header("Running Monitoring Test")
    
    try:
        from controller.monitoring_controller import MonitoringController
        controller = MonitoringController()
        
        ColorPrint.blue("[TEST] Running one monitoring cycle...")
        controller.run_single_cycle()
        ColorPrint.green("✓ Monitoring cycle completed successfully")
        
    except Exception as e:
        ColorPrint.red(f"✗ Monitoring test failed: {e}")
        import traceback
        traceback.print_exc()


def main():
    """Main fix and test function"""
    ColorPrint.print_header("D3CHECK INTEGRATION ERROR FIX AND TEST")
    
    try:
        # Test 1: Critical imports
        test_imports()
        ColorPrint.print_separator()
        
        # Test 2: Controller integration
        test_controller_integration()
        ColorPrint.print_separator()
        
        # Test 3: Monitoring controller
        test_monitoring_controller()
        ColorPrint.print_separator()
        
        # Test 4: Process detection
        test_process_detection()
        ColorPrint.print_separator()
        
        # Test 5: Full integration
        test_full_integration()
        ColorPrint.print_separator()
        
        # Test 6: Monitoring test
        run_monitoring_test()
        
        ColorPrint.print_header("INTEGRATION FIX AND TEST COMPLETED")
        ColorPrint.green("🎉 All integration tests completed!")
        
        ColorPrint.print_section("Next Steps")
        ColorPrint.blue("1. Run main.py to start the full monitoring system")
        ColorPrint.blue("2. Check logs for any remaining issues")
        ColorPrint.blue("3. Test with actual RoS-BoT and Diablo processes")
        
    except Exception as e:
        ColorPrint.red(f"[ERROR] Fix and test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
