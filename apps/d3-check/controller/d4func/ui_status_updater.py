#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
UI Status Updater for D4 Panel
Updates UI status display with data from shared memory
"""

import sys
from pathlib import Path
from typing import Optional, Dict, Any

# Add project paths
current_dir = Path(__file__).parent.parent.parent
sys.path.insert(0, str(current_dir))

from providor.common_imports import ColorPrint
from providor.providor_index import DEBUG
from d3utils.i18n_manager import I18nManager
from share.game_interface_data import get_d4_interface_data
# D4State functionality now integrated into D4InterfaceData


class UIStatusUpdater:
    """
    UI Status Updater for D4 Panel
    
    Reads data from shared memory (D4InterfaceData) and updates UI status display
    Called at the end of each tick to ensure UI reflects latest detection results
    """
    
    def __init__(self):
        """Initialize UI status updater"""
        self.i18n = I18nManager()
        self.d4_data = get_d4_interface_data()
        # D4State functionality now integrated into D4InterfaceData
        
        # UI callback reference (will be set by D4Panel)
        self.ui_update_callback: Optional[callable] = None
        
        ColorPrint.blue("[UIStatusUpdater] Initialized")
    
    def set_ui_update_callback(self, callback: callable):
        """
        Set UI update callback function
        
        Args:
            callback: Function to call for UI updates
        """
        self.ui_update_callback = callback
        ColorPrint.blue("[UIStatusUpdater] UI update callback registered")
    
    def update_ui_status(self):
        """
        Update UI status display with current shared data
        
        Called at the end of each tick to ensure UI reflects latest state
        """
        try:
            if not self.ui_update_callback:
                return
            
            # Get current data from shared memory
            status_data = self._collect_status_data()
            
            # Update UI via callback
            self.ui_update_callback(status_data)
            
            # Print summary if DEBUG mode is enabled
            if DEBUG:
                self._print_status_summary(status_data)
            
        except Exception as e:
            ColorPrint.red(f"[UIStatusUpdater] Error updating UI status: {e}")
    
    def _collect_status_data(self) -> Dict[str, Any]:
        """
        Collect current status data from shared memory
        
        Returns:
            Dictionary with current status information
        """
        status_data = {}
        
        # D4 Running Status
        status_data['d4_running_status'] = self._get_d4_running_status()
        
        # Screen Information
        status_data['screen_coordinates'] = self._get_screen_coordinates()
        status_data['screen_size'] = self._get_screen_size()
        
        # Game Information
        status_data['current_map'] = self._get_current_map()
        status_data['game_state'] = self._get_game_state()
        status_data['team_count'] = self._get_team_count()
        status_data['dungeon_progress'] = self._get_dungeon_progress()
        
        # Reserved values (for future expansion)
        for i in range(1, 11):
            status_data[f'reserved_{i}'] = self._get_reserved_value(i)
        
        return status_data
    
    def _get_d4_running_status(self) -> str:
        """Get D4 running status"""
        if self.d4_data.is_exp_farming_running():
            return "Running"
        else:
            return "Stopped"
    
    def _get_screen_coordinates(self) -> str:
        """Get screen coordinates information"""
        if self.d4_data.window_offset and self.d4_data.window_offset != (0, 0):
            x, y = self.d4_data.window_offset
            return f"({x}, {y})"
        else:
            return "Unknown"
    
    def _get_screen_size(self) -> str:
        """Get screen size information"""
        if self.d4_data.game_window_size and self.d4_data.game_window_size != (0, 0):
            width, height = self.d4_data.game_window_size
            mode = self._get_display_mode()
            return f"{width}x{height} ({mode})"
        else:
            return "Unknown"
    
    def _get_display_mode(self) -> str:
        """Get display mode (windowed/fullscreen)"""
        if self.d4_data.is_windowed_mode():
            return "Windowed"
        else:
            return "Fullscreen"
    
    def _get_current_map(self) -> str:
        """Get current map information"""
        if self.d4_data.detected_regions and 'map_name' in self.d4_data.detected_regions:
            return self.d4_data.detected_regions['map_name']
        else:
            return "Unknown"
    
    def _get_game_state(self) -> str:
        """Get game state information"""
        return self.d4_data.get_game_state()
    
    def _get_team_count(self) -> str:
        """Get team count information"""
        if self.d4_data.team_health_info:
            total_members = self.d4_data.team_health_info.get('total_members', 0)
            local_map_count = self.d4_data.team_health_info.get('local_map_members', 0)
            non_local_map_count = self.d4_data.team_health_info.get('non_local_map_members', 0)
            return f"{total_members} ({local_map_count}/{non_local_map_count})"
        else:
            return "0 (0/0)"
    
    def _get_dungeon_progress(self) -> str:
        """Get dungeon progress information"""
        if self.d4_data.detected_regions and 'dungeon_progress' in self.d4_data.detected_regions:
            return self.d4_data.detected_regions['dungeon_progress']
        else:
            return "Unknown"
    
    def _get_reserved_value(self, index: int) -> str:
        """
        Get reserved value
        
        Args:
            index: Reserved value index (1-10)
            
        Returns:
            Reserved value string
        """
        # For now, return placeholder values
        # These can be extended in the future for additional status information
        reserved_values = {
            1: "-",  # Reserved for future use
            2: "-",  # Reserved for future use
            3: "-",  # Reserved for future use
            4: "-",  # Reserved for future use
            5: "-",  # Reserved for future use
            6: "-",  # Reserved for future use
            7: "-",  # Reserved for future use
            8: "-",  # Reserved for future use
            9: "-",  # Reserved for future use
            10: "-"  # Reserved for future use
        }
        return reserved_values.get(index, "-")

    def _print_status_summary(self, status_data: Dict[str, Any]):
        """
        Print status summary in DEBUG mode
        
        Args:
            status_data: Dictionary with status information
        """
        try:
            ColorPrint.blue("\n" + "="*60)
            ColorPrint.blue("[UIStatusUpdater] Status Summary (DEBUG)")
            ColorPrint.blue("="*60)
            
            # D4 Running Status
            ColorPrint.green(f"D4 Running Status: {status_data.get('d4_running_status', 'Unknown')}")
            
            # Screen Information
            ColorPrint.green(f"Screen Coordinates: {status_data.get('screen_coordinates', 'Unknown')}")
            ColorPrint.green(f"Screen Size: {status_data.get('screen_size', 'Unknown')}")
            
            # Game Information
            ColorPrint.green(f"Current Map: {status_data.get('current_map', 'Unknown')}")
            ColorPrint.green(f"Game State: {status_data.get('game_state', 'Unknown')}")
            ColorPrint.green(f"Team Count: {status_data.get('team_count', 'Unknown')}")
            ColorPrint.green(f"Dungeon Progress: {status_data.get('dungeon_progress', 'Unknown')}")
            
            # Team Health Details (if available)
            if self.d4_data.team_health_info:
                team_info = self.d4_data.team_health_info
                total_members = team_info.get('total_members', 0)
                local_map_count = team_info.get('local_map_members', 0)
                non_local_map_count = team_info.get('non_local_map_members', 0)
                
                ColorPrint.yellow(f"Team Health Details:")
                ColorPrint.yellow(f"  Total Members: {total_members}")
                ColorPrint.yellow(f"  Local Map: {local_map_count}")
                ColorPrint.yellow(f"  Non-Local Map: {non_local_map_count}")
                
                # Show individual member details
                members = team_info.get('members', [])
                if members:
                    ColorPrint.yellow(f"  Member Details:")
                    for i, member in enumerate(members):
                        hp_offset = member.get('hp_screen_offset', {})
                        absolute_x = hp_offset.get('absolute_x', 0)
                        absolute_y = hp_offset.get('absolute_y', 0)
                        is_local = member.get('is_local_map', False)
                        group = member.get('group', 'Unknown')
                        scan_direction = member.get('scan_direction', 'Unknown')
                        
                        local_status = "Local" if is_local else "Non-Local"
                        ColorPrint.yellow(f"    Member {i+1}: {local_status} ({group}) - HP:({absolute_x},{absolute_y}) - Scan:{scan_direction}")
            
            # Detection Timestamps
            if self.d4_data.region_detection_timestamp:
                ColorPrint.blue(f"Region Detection: {self.d4_data.region_detection_timestamp}")
            
            if self.d4_data.team_health_detection_timestamp:
                ColorPrint.blue(f"Team Health Detection: {self.d4_data.team_health_detection_timestamp}")
            
            # Screenshot Information
            if self.d4_data.last_annotated_screenshot_path:
                ColorPrint.blue(f"Last Annotated Screenshot: {self.d4_data.last_annotated_screenshot_path}")
            
            ColorPrint.blue("="*60)
            
        except Exception as e:
            ColorPrint.red(f"[UIStatusUpdater] Error printing status summary: {e}")


# Global UI status updater instance (singleton)
_ui_status_updater = None


def get_ui_status_updater() -> UIStatusUpdater:
    """
    Get global UI status updater instance (singleton)
    
    Returns:
        Global UIStatusUpdater instance
    """
    global _ui_status_updater
    
    if _ui_status_updater is None:
        _ui_status_updater = UIStatusUpdater()
        ColorPrint.green("[Global] UI status updater initialized")
    
    return _ui_status_updater
