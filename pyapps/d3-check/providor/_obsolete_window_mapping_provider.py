#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Window Mapping Provider
Global provider for window analysis data and UI element mappings
Maintains live mappings between analysis data and actual UI elements
"""

import os
import sys
import time
import threading
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field
from datetime import datetime

# Add project root directory to Python path
current_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, current_dir)

# Add ncore path

from providor.common_imports import ColorPrint

@dataclass
class UIElementMapping:
    """Mapping between analysis data and actual UI element"""
    # Analysis data
    element_id: str  # Unique identifier for this element
    element_type: str  # Control type (ButtonControl, ComboBoxControl, etc.)
    element_name: str  # Control name
    automation_id: str  # Automation ID
    class_name: str  # Class name
    
    # Position and size
    rect: Dict[str, int]  # Rectangle coordinates
    
    # State information
    is_enabled: bool = True
    is_visible: bool = True
    
    # Live UI element reference (if available)
    ui_control: Any = None  # Actual UI automation control object
    
    # Metadata
    last_updated: datetime = field(default_factory=datetime.now)
    parent_id: Optional[str] = None
    level: int = 0
    
    def is_valid(self) -> bool:
        """Check if this mapping is still valid"""
        try:
            if self.ui_control:
                # Try to access a property to see if control is still valid
                _ = self.ui_control.Name
                return True
        except:
            pass
        return False
    
    def get_center_point(self) -> Tuple[int, int]:
        """Get center point of the element"""
        if self.rect:
            center_x = self.rect.get('left', 0) + self.rect.get('width', 0) // 2
            center_y = self.rect.get('top', 0) + self.rect.get('height', 0) // 2
            return (center_x, center_y)
        return (0, 0)

@dataclass
class WindowMapping:
    """Complete mapping for a window"""
    window_handle: int
    window_title: str
    process_name: str
    
    # All UI elements in this window
    elements: Dict[str, UIElementMapping] = field(default_factory=dict)
    
    # Analysis metadata
    analysis_timestamp: datetime = field(default_factory=datetime.now)
    json_file_path: str = ""
    screenshot_path: str = ""
    
    # Window state
    is_active: bool = False
    last_refresh: datetime = field(default_factory=datetime.now)
    
    def get_elements_by_type(self, element_type: str) -> List[UIElementMapping]:
        """Get all elements of a specific type"""
        return [elem for elem in self.elements.values() if elem.element_type == element_type]
    
    def get_elements_by_name_contains(self, name_part: str) -> List[UIElementMapping]:
        """Get elements whose name contains the specified text"""
        return [elem for elem in self.elements.values() if name_part in elem.element_name]
    
    def get_element_by_automation_id(self, automation_id: str) -> Optional[UIElementMapping]:
        """Get element by automation ID"""
        for elem in self.elements.values():
            if elem.automation_id == automation_id:
                return elem
        return None
    
    def find_matching_elements(self, criteria: Dict[str, Any]) -> List[UIElementMapping]:
        """Find elements matching the given criteria"""
        matching = []
        for elem in self.elements.values():
            match = True
            
            if 'type' in criteria and elem.element_type != criteria['type']:
                match = False
            if 'name_contains' in criteria and criteria['name_contains'] not in elem.element_name:
                match = False
            if 'automation_id' in criteria and elem.automation_id != criteria['automation_id']:
                match = False
            if 'class_name' in criteria and elem.class_name != criteria['class_name']:
                match = False
            
            if match:
                matching.append(elem)
        
        return matching

class WindowMappingProvider:
    """
    Global provider for window mappings
    Maintains live mappings between analysis data and actual UI elements
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """Singleton pattern"""
        if cls._instance is None:
            with cls._lock:
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        """Initialize window mapping provider"""
        if hasattr(self, '_initialized'):
            return
        
        self._initialized = True
        self.mappings: Dict[int, WindowMapping] = {}  # window_handle -> WindowMapping
        self.lock = threading.Lock()
        
        ColorPrint.green("[INIT] WindowMappingProvider initialized as singleton")
    
    def register_window_mapping(self, window_handle: int, window_title: str, process_name: str, 
                               analysis_data: List[Dict], json_file_path: str = "", 
                               screenshot_path: str = "") -> bool:
        """Register a new window mapping from analysis data"""
        try:
            with self.lock:
                ColorPrint.blue(f"[MAPPING] Registering window mapping for '{window_title}' (handle: {window_handle})")
                
                # Create window mapping
                window_mapping = WindowMapping(
                    window_handle=window_handle,
                    window_title=window_title,
                    process_name=process_name,
                    json_file_path=json_file_path,
                    screenshot_path=screenshot_path
                )
                
                # Convert analysis data to UI element mappings
                for i, control_data in enumerate(analysis_data):
                    element_id = f"{window_handle}_{i}"
                    
                    element_mapping = UIElementMapping(
                        element_id=element_id,
                        element_type=control_data.get('type', ''),
                        element_name=control_data.get('name', ''),
                        automation_id=control_data.get('automation_id', ''),
                        class_name=control_data.get('class_name', ''),
                        rect=control_data.get('rect', {}),
                        is_enabled=control_data.get('is_enabled', True),
                        is_visible=control_data.get('is_visible', True),
                        parent_id=control_data.get('parent_id'),
                        level=control_data.get('level', 0)
                    )
                    
                    window_mapping.elements[element_id] = element_mapping
                
                # Store the mapping
                self.mappings[window_handle] = window_mapping
                
                ColorPrint.green(f"[MAPPING] Registered {len(window_mapping.elements)} UI elements for window '{window_title}'")
                return True
                
        except Exception as e:
            ColorPrint.red(f"[MAPPING_ERROR] Error registering window mapping: {e}")
            return False
    
    def get_window_mapping(self, window_handle: int) -> Optional[WindowMapping]:
        """Get window mapping by handle"""
        with self.lock:
            return self.mappings.get(window_handle)
    
    def get_window_mapping_by_title(self, window_title: str) -> Optional[WindowMapping]:
        """Get window mapping by title"""
        with self.lock:
            for mapping in self.mappings.values():
                if mapping.window_title == window_title:
                    return mapping
            return None
    
    def refresh_window_mapping(self, window_handle: int, new_analysis_data: List[Dict]) -> bool:
        """Refresh an existing window mapping with new analysis data"""
        try:
            with self.lock:
                if window_handle not in self.mappings:
                    ColorPrint.yellow(f"[MAPPING] Window handle {window_handle} not found for refresh")
                    return False
                
                mapping = self.mappings[window_handle]
                ColorPrint.blue(f"[MAPPING] Refreshing mapping for '{mapping.window_title}'")
                
                # Clear old elements
                mapping.elements.clear()
                
                # Add new elements
                for i, control_data in enumerate(new_analysis_data):
                    element_id = f"{window_handle}_{i}"
                    
                    element_mapping = UIElementMapping(
                        element_id=element_id,
                        element_type=control_data.get('type', ''),
                        element_name=control_data.get('name', ''),
                        automation_id=control_data.get('automation_id', ''),
                        class_name=control_data.get('class_name', ''),
                        rect=control_data.get('rect', {}),
                        is_enabled=control_data.get('is_enabled', True),
                        is_visible=control_data.get('is_visible', True),
                        parent_id=control_data.get('parent_id'),
                        level=control_data.get('level', 0)
                    )
                    
                    mapping.elements[element_id] = element_mapping
                
                # Update timestamp
                mapping.last_refresh = datetime.now()
                
                ColorPrint.green(f"[MAPPING] Refreshed {len(mapping.elements)} UI elements")
                return True
                
        except Exception as e:
            ColorPrint.red(f"[MAPPING_ERROR] Error refreshing window mapping: {e}")
            return False
    
    def find_elements(self, window_handle: int, criteria: Dict[str, Any]) -> List[UIElementMapping]:
        """Find elements in a window matching the criteria"""
        with self.lock:
            mapping = self.mappings.get(window_handle)
            if not mapping:
                ColorPrint.yellow(f"[MAPPING] No mapping found for window handle {window_handle}")
                return []
            
            return mapping.find_matching_elements(criteria)
    
    def get_element_by_id(self, element_id: str) -> Optional[UIElementMapping]:
        """Get element by its unique ID"""
        with self.lock:
            for mapping in self.mappings.values():
                if element_id in mapping.elements:
                    return mapping.elements[element_id]
            return None
    
    def remove_window_mapping(self, window_handle: int) -> bool:
        """Remove a window mapping"""
        try:
            with self.lock:
                if window_handle in self.mappings:
                    mapping = self.mappings[window_handle]
                    ColorPrint.blue(f"[MAPPING] Removing mapping for '{mapping.window_title}'")
                    del self.mappings[window_handle]
                    return True
                return False
        except Exception as e:
            ColorPrint.red(f"[MAPPING_ERROR] Error removing window mapping: {e}")
            return False
    
    def get_all_mappings(self) -> Dict[int, WindowMapping]:
        """Get all window mappings"""
        with self.lock:
            return self.mappings.copy()
    
    def print_mapping_summary(self):
        """Print summary of all mappings"""
        with self.lock:
            ColorPrint.print_header("Window Mapping Summary")
            
            if not self.mappings:
                ColorPrint.yellow("No window mappings registered")
                return
            
            for handle, mapping in self.mappings.items():
                ColorPrint.print_section(f"Window: {mapping.window_title}")
                ColorPrint.blue(f"Handle: {handle}")
                ColorPrint.blue(f"Process: {mapping.process_name}")
                ColorPrint.blue(f"Elements: {len(mapping.elements)}")
                ColorPrint.blue(f"Last refresh: {mapping.last_refresh}")
                
                # Show element type summary
                type_counts = {}
                for elem in mapping.elements.values():
                    type_counts[elem.element_type] = type_counts.get(elem.element_type, 0) + 1
                
                ColorPrint.blue("Element types:")
                for elem_type, count in type_counts.items():
                    ColorPrint.gray(f"  {elem_type}: {count}")

# Global instance
WINDOW_MAPPING_PROVIDER = WindowMappingProvider()

def main():
    """Test function"""
    provider = WindowMappingProvider()
    
    # Test data
    test_analysis_data = [
        {
            "type": "ButtonControl",
            "name": "Start botting !",
            "automation_id": "btnStart",
            "class_name": "WindowsForms10.BUTTON.app.0.141b42a_r6_ad1",
            "rect": {"left": 1372, "top": 949, "right": 1510, "bottom": 977, "width": 138, "height": 28},
            "is_enabled": True,
            "is_visible": True,
            "level": 1
        },
        {
            "type": "ComboBoxControl",
            "name": "설명",
            "automation_id": "cmbMasterProfile",
            "class_name": "WindowsForms10.COMBOBOX.app.0.141b42a_r6_ad1",
            "rect": {"left": 1056, "top": 760, "right": 1507, "bottom": 785, "width": 451, "height": 25},
            "is_enabled": True,
            "is_visible": True,
            "level": 4
        }
    ]
    
    # Register mapping
    provider.register_window_mapping(12345, "Test Window", "TestProcess", test_analysis_data)
    
    # Test finding elements
    buttons = provider.find_elements(12345, {"type": "ButtonControl"})
    ColorPrint.green(f"Found {len(buttons)} buttons")
    
    combos = provider.find_elements(12345, {"automation_id": "cmbMasterProfile"})
    ColorPrint.green(f"Found {len(combos)} profile comboboxes")
    
    # Print summary
    provider.print_mapping_summary()

if __name__ == "__main__":
    main()
