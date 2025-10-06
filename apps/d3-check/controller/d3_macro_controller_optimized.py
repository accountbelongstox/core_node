#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
D3Check Macro Controller - Optimized Version
Main controller using optimized UI with reduced code duplication
"""

import sys
import threading
import time
import logging
from pathlib import Path
from typing import Optional, Callable

# Add the current directory to Python path
current_dir = Path(__file__).parent.parent
sys.path.insert(0, str(current_dir))

# Import from common_imports (unified public library imports)
from providor.common_imports import ColorPrint
from providor.providor_index import CONFIG, load_config
from ui.diablo3_macro_ui_optimized import Diablo3MacroUIOptimized
from controller.game_interface_controller import GameInterfaceController

class D3MacroControllerOptimized:
    """
    Optimized Main controller for Diablo 3 Macro application
    Features:
    - Reduced code duplication
    - Improved error handling
    - Unified shutdown process
    - Better resource management
    """
    
    def __init__(self):
        """Initialize the optimized controller"""
        self.logger = logging.getLogger(__name__)
        
        # Game interface controller
        self.game_interface_controller = GameInterfaceController()
        
        # UI instance
        self.ui: Optional[Diablo3MacroUIOptimized] = None
        
        # Macro state
        self.macro_running = False
        self.macro_thread: Optional[threading.Thread] = None
        self.current_skill_config = 'config1'
        
        # Shutdown flag
        self.shutdown_requested = False
        
        ColorPrint.green("[Controller] Optimized D3MacroController initialized")
    
    def start_macro(self):
        """Start the macro with improved error handling"""
        if self.macro_running:
            ColorPrint.yellow("[Controller] Macro is already running")
            return
        
        try:
            # Load current configuration
            load_config()
            
            # Start macro thread
            self.macro_running = True
            self.macro_thread = threading.Thread(target=self._macro_loop, daemon=True)
            self.macro_thread.start()
            
            ColorPrint.green(f"[Controller] Macro started with config: {self.current_skill_config}")
            
        except Exception as e:
            self.macro_running = False
            ColorPrint.red(f"[Controller] Failed to start macro: {e}")
            self.logger.error(f"Failed to start macro: {e}")
    
    def stop_macro(self):
        """Stop the macro with improved cleanup"""
        if not self.macro_running:
            ColorPrint.yellow("[Controller] Macro is not running")
            return
        
        try:
            # Stop macro
            self.macro_running = False
            
            # Wait for thread to finish
            if self.macro_thread and self.macro_thread.is_alive():
                self.macro_thread.join(timeout=2.0)
                
                if self.macro_thread.is_alive():
                    ColorPrint.yellow("[Controller] Macro thread did not stop gracefully")
                else:
                    ColorPrint.green("[Controller] Macro thread stopped gracefully")
            
            self.macro_thread = None
            ColorPrint.green("[Controller] Macro stopped successfully")
            
        except Exception as e:
            ColorPrint.red(f"[Controller] Error stopping macro: {e}")
            self.logger.error(f"Error stopping macro: {e}")
    
    def switch_skill_config(self, config_name: str):
        """Switch skill configuration with validation"""
        try:
            if config_name == self.current_skill_config:
                ColorPrint.blue(f"[Controller] Already using config: {config_name}")
                return
            
            # Validate config exists
            if config_name not in ['config1', 'config2', 'config3', 'config4']:
                ColorPrint.red(f"[Controller] Invalid config name: {config_name}")
                return
            
            # Switch configuration
            old_config = self.current_skill_config
            self.current_skill_config = config_name
            
            # Restart macro if running
            if self.macro_running:
                ColorPrint.blue(f"[Controller] Restarting macro with new config: {config_name}")
                self.stop_macro()
                time.sleep(0.1)  # Brief pause
                self.start_macro()
            
            ColorPrint.green(f"[Controller] Switched from {old_config} to {config_name}")
            
        except Exception as e:
            ColorPrint.red(f"[Controller] Error switching config: {e}")
            self.logger.error(f"Error switching config: {e}")
    
    def _macro_loop(self):
        """Main macro execution loop with improved error handling"""
        ColorPrint.blue("[Controller] Macro loop started")
        
        try:
            while self.macro_running and not self.shutdown_requested:
                try:
                    # Execute macro logic here
                    # This would contain the actual game automation logic
                    
                    # For now, just a placeholder
                    time.sleep(0.1)
                    
                except Exception as e:
                    ColorPrint.red(f"[Controller] Error in macro loop: {e}")
                    self.logger.error(f"Error in macro loop: {e}")
                    time.sleep(1.0)  # Prevent rapid error loops
                    
        except Exception as e:
            ColorPrint.red(f"[Controller] Fatal error in macro loop: {e}")
            self.logger.error(f"Fatal error in macro loop: {e}")
        finally:
            self.macro_running = False
            ColorPrint.blue("[Controller] Macro loop ended")
    
    def on_ui_macro_start(self):
        """Handle UI macro start request"""
        ColorPrint.blue("[Controller] UI requested macro start")
        self.start_macro()
    
    def on_ui_macro_stop(self):
        """Handle UI macro stop request"""
        ColorPrint.blue("[Controller] UI requested macro stop")
        self.stop_macro()
    
    def on_ui_config_change(self, config_name: str):
        """Handle UI configuration change"""
        ColorPrint.blue(f"[Controller] UI requested config change to: {config_name}")
        # This could be used for general configuration changes
        pass
    
    def on_ui_skill_config_switch(self, config_name: str):
        """Handle UI skill configuration switch"""
        ColorPrint.blue(f"[Controller] UI requested skill config switch to: {config_name}")
        self.switch_skill_config(config_name)
    
    def run(self):
        """Run the optimized application"""
        try:
            ColorPrint.green("[Controller] Starting optimized application...")
            
            # Initialize game interface
            if not self.game_interface_controller.initialize_game_interface():
                ColorPrint.red("[Controller] Failed to initialize game interface")
                self.logger.error("Failed to initialize game interface")
                return
            
            ColorPrint.green("[Controller] Game interface initialized successfully")
            
            # Create optimized UI
            self.ui = Diablo3MacroUIOptimized(self.current_skill_config)
            
            # Set UI callbacks
            self.ui.set_macro_start_callback(self.on_ui_macro_start)
            self.ui.set_macro_stop_callback(self.on_ui_macro_stop)
            self.ui.set_config_change_callback(self.on_ui_config_change)
            self.ui.set_skill_config_switch_callback(self.on_ui_skill_config_switch)
            
            ColorPrint.green("[Controller] UI callbacks configured")
            
            # Run optimized UI
            ColorPrint.green("[Controller] Starting optimized UI...")
            self.ui.run()
            
        except Exception as e:
            ColorPrint.red(f"[Controller] Application error: {e}")
            self.logger.error(f"Application error: {e}")
            import traceback
            traceback.print_exc()
            raise
        finally:
            # Cleanup
            self._cleanup()
    
    def _cleanup(self):
        """Cleanup resources with improved error handling"""
        try:
            ColorPrint.blue("[Controller] Starting cleanup...")
            
            # Stop macro
            if self.macro_running:
                ColorPrint.blue("[Controller] Stopping macro during cleanup...")
                self.stop_macro()
            
            # Cleanup UI
            if self.ui:
                ColorPrint.blue("[Controller] Cleaning up UI...")
                # UI cleanup is handled by the UI's unified exit method
                self.ui = None
            
            # Shutdown game interface
            ColorPrint.blue("[Controller] Shutting down game interface...")
            self.game_interface_controller.shutdown_game_interface()
            
            ColorPrint.green("[Controller] Cleanup completed successfully")
            
        except Exception as e:
            ColorPrint.red(f"[Controller] Error during cleanup: {e}")
            self.logger.error(f"Error during cleanup: {e}")
    
    def shutdown(self):
        """Shutdown the controller gracefully with unified process"""
        try:
            ColorPrint.blue("[Controller] Starting graceful shutdown...")
            self.shutdown_requested = True
            
            # Use UI's unified exit method if available
            if self.ui and hasattr(self.ui, '_unified_exit'):
                ColorPrint.blue("[Controller] Using UI unified exit method...")
                self.ui._unified_exit()
                return
            
            # Fallback to manual shutdown
            ColorPrint.blue("[Controller] Using fallback shutdown method...")
            self._cleanup()
            
        except Exception as e:
            ColorPrint.red(f"[Controller] Error during shutdown: {e}")
            self.logger.error(f"Error during shutdown: {e}")
            # Force exit as last resort
            import os
            os._exit(0)
    
    def get_current_config(self) -> str:
        """Get current skill configuration"""
        return self.current_skill_config
    
    def is_macro_running(self) -> bool:
        """Check if macro is currently running"""
        return self.macro_running
    
    def get_status(self) -> dict:
        """Get controller status information"""
        return {
            'macro_running': self.macro_running,
            'current_config': self.current_skill_config,
            'shutdown_requested': self.shutdown_requested,
            'ui_active': self.ui is not None,
            'game_interface_active': self.game_interface_controller is not None
        }
