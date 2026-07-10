#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Battle.net / Diablo III Click Automation
App-specific Battle.net launcher automation: locate the Diablo III nav button,
locate/click Play buttons, and refresh+re-click.

Extracted from click_handler.py. BattlenetClicker holds a back-reference to the
ClickHandler facade so it can reuse the generic element-click fallback chain
(click_element_generic) and the UI-Automation control enumeration
(enumerate_controls_ui_automation) without duplicating that logic.
"""

import time
from typing import List, Dict

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint

# Battle.net desktop launcher "Play" button automation_id values.
# Canonical source: pyapps/d3-check/providor/constants/d3.py START_GAME_AUTOMATION_IDS.
# NOTE: the original click_handler.find_and_click_play_buttons referenced
# PLAY_BUTTON_AUTOMATION_IDS but never defined it (latent NameError); it is
# defined here so the moved method actually resolves.
PLAY_BUTTON_AUTOMATION_IDS = ("play-btn-main", "play-btn")


class BattlenetClicker:
    """Battle.net launcher automation; delegates generic click/enum to ClickHandler."""

    def __init__(self, click_handler):
        # Back-reference to the ClickHandler facade for click_element_generic and
        # enumerate_controls_ui_automation (avoids duplicating the fallback chain).
        self.click_handler = click_handler

    def find_and_click_diablo3_button(self, window, controls: List[Dict]) -> bool:
        """
        Find and click the Diablo III button using multiple methods

        Args:
            window: Battle.net window object
            controls: List of UI controls

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.yellow("🎮 Looking for Diablo III button to click...")

        # Find the Diablo III button with automation_id "game-nav-btn-D3"
        diablo3_button = None
        diablo3_button_index = -1
        for i, control in enumerate(controls):
            if control.get('automation_id') == 'game-nav-btn-D3':
                diablo3_button = control
                diablo3_button_index = i
                ColorPrint.green(f"✅ Found Diablo III button: {control.get('name', 'No name')}")
                break

        if not diablo3_button:
            ColorPrint.yellow("⚠️  Diablo III button not found with automation_id 'game-nav-btn-D3'")
            ColorPrint.yellow("🔍 Searching for alternative Diablo III buttons...")

            # Try to find by name or other properties
            for i, control in enumerate(controls):
                name = control.get('name', '') or ''
                automation_id = control.get('automation_id', '') or ''
                value = control.get('value', '') or ''

                name = name.lower()
                automation_id = automation_id.lower()
                value = value.lower()

                if any(keyword in name or keyword in automation_id or keyword in value
                       for keyword in ['diablo', 'd3']):
                    diablo3_button = control
                    diablo3_button_index = i
                    ColorPrint.green(f"✅ Found alternative Diablo III button: {control.get('name', 'No name')}")
                    break

        if not diablo3_button:
            ColorPrint.red("❌ Could not find Diablo III button")
            ColorPrint.yellow("📋 Available buttons/controls:")
            for i, control in enumerate(controls[:20]):  # Show first 20 controls
                if 'type' in control:
                    ColorPrint.gray(f"   {i}: {control.get('type', 'Unknown')} - {control.get('name', 'No name')} (ID: {control.get('automation_id', 'No ID')})")
                else:
                    ColorPrint.gray(f"   {i}: {control.get('class_name', 'Unknown')} - {control.get('title', 'No title')}")
            return False

        # Find the first ImageControl after the Diablo III button
        target_image_control = None
        if diablo3_button_index >= 0:
            ColorPrint.yellow("🔍 Looking for first ImageControl after Diablo III button...")
            for i in range(diablo3_button_index + 1, len(controls)):
                control = controls[i]
                if control.get('type') == 'ImageControl':
                    target_image_control = control
                    ColorPrint.green(f"✅ Found target ImageControl: {control.get('name', 'No name')} (ID: {control.get('automation_id', 'No ID')})")
                    break

        if not target_image_control:
            ColorPrint.yellow("⚠️  No imageControl found after Diablo III button, using button position")
            target_image_control = diablo3_button

        # Get target position
        rect = target_image_control.get('rect', {})
        if not rect:
            ColorPrint.red("❌ Could not get target position")
            return False

        # Calculate center position of the target
        center_x = rect['left'] + (rect['right'] - rect['left']) // 2
        center_y = rect['top'] + (rect['bottom'] - rect['top']) // 2

        ColorPrint.green(f"🖱️  Target position: ({center_x}, {center_y})")
        ColorPrint.gray(f"   Target info: {target_image_control.get('name', 'No name')} - {target_image_control.get('automation_id', 'No ID')}")

        # Use the generic click function on the facade
        return self.click_handler.click_element_generic(target_image_control, window)

    def find_and_click_play_buttons(self, window, controls: List[Dict]) -> bool:
        """
        Find and click play buttons (called after first click)

        Args:
            window: Battle.net window object
            controls: UI controls list

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.yellow("🎮 Looking for play buttons to click...")

        # Find play buttons using automation IDs array
        play_buttons = []
        for control in controls:
            automation_id = control.get('automation_id', '')
            if automation_id in PLAY_BUTTON_AUTOMATION_IDS:
                play_buttons.append(control)
                ColorPrint.green(f"✅ Found play button: {control.get('name', 'No name')} (ID: {automation_id})")

        if not play_buttons:
            ColorPrint.yellow(f"⚠️  No play buttons found with automation_ids: {PLAY_BUTTON_AUTOMATION_IDS}")
            return False

        # Click found play buttons
        success_count = 0
        for i, button in enumerate(play_buttons):
            ColorPrint.yellow(f"🖱️  Clicking play button {i+1}/{len(play_buttons)}...")
            if self.click_handler.click_element_generic(button, window):
                success_count += 1
                time.sleep(1)  # Wait 1 second after click

        if success_count > 0:
            ColorPrint.green(f"✅ Successfully clicked {success_count}/{len(play_buttons)} play buttons")
            return True
        else:
            ColorPrint.red("❌ Failed to click any play buttons")
            return False

    def refresh_and_click_play_buttons(self, window) -> bool:
        """
        Refresh window and re-find play buttons for clicking

        Args:
            window: Battle.net window object

        Returns:
            True if successful, False otherwise
        """
        ColorPrint.yellow("🔄 Refreshing window and looking for play buttons...")

        try:
            # Re-activate window
            window.activate()
            time.sleep(2)  # Wait for window to fully activate

            # Re-enumerate controls via the facade (delegates to WindowAnalyzer)
            controls = self.click_handler.enumerate_controls_ui_automation(window)
            if not controls:
                ColorPrint.yellow("⚠️  No UI Automation controls found after refresh")
                return False

            ColorPrint.green(f"✅ Found {len(controls)} controls after refresh")

            # Find and click play buttons
            return self.find_and_click_play_buttons(window, controls)

        except Exception as e:
            ColorPrint.red(f"❌ Error refreshing window and clicking play buttons: {e}")
            return False
