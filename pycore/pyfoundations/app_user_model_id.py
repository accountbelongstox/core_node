# -*- coding: utf-8 -*-
"""
Windows AppUserModelID Manager

Manages Windows AppUserModelID (AUMID) to prevent duplicate taskbar icons
when running applications as administrator.

This module provides:
1. Set AppUserModelID for current process (Python application)
2. Set AppUserModelID property on shortcuts (.lnk files)

Reference:
- https://learn.microsoft.com/en-us/windows/win32/shell/appids
- https://learn.microsoft.com/en-us/windows/win32/properties/props-system-appusermodel-id
"""

import sys
import platform
from pathlib import Path

import traceback

from pycore.pyfoundations.pybasecommon.color_print import ColorPrint
from pycore.pyfoundations.third_party.api import (
    get_third_package_pythoncom,
    get_third_package_win32com_propsys,
    get_third_package_win32com_pscon,
)
import ctypes




class AppUserModelIDManager:
    """
    Windows AppUserModelID Manager

    Prevents duplicate taskbar icons when application runs as administrator
    by ensuring consistent AppUserModelID across shortcuts and processes.
    """

    def __init__(self):
        """Initialize manager"""
        self._app_id = None
        self._is_windows = platform.system() == "Windows"

    def set_current_process_app_id(self, app_id):
        """
        Set AppUserModelID for current process

        This ensures Windows groups all application windows under single taskbar button.
        Must be called early in application startup.

        Args:
            app_id: AppUserModelID string (e.g., "CompanyName.ProductName.SubProduct.VersionInformation")
                   Format: CompanyName.ProductName[.SubProduct[.VersionInformation]]
                   Max length: 128 characters
                   No spaces allowed

        Example:
            manager = AppUserModelIDManager()
            manager.set_current_process_app_id("XingcanMedia.Matrix.Cloud")

        Returns:
            bool: True if successful, False otherwise
        """
        if not self._is_windows:
            ColorPrint.plain("[AppUserModelID] Not on Windows, skipping")
            return False

        if not app_id:
            ColorPrint.plain("[AppUserModelID] Error: app_id cannot be empty")
            return False

        # Validate format
        if len(app_id) > 128:
            ColorPrint.plain(f"[AppUserModelID] Error: app_id too long ({len(app_id)} > 128)")
            return False

        if ' ' in app_id:
            ColorPrint.plain(f"[AppUserModelID] Error: app_id cannot contain spaces")
            return False

        try:

            # Define HRESULT (not available in Python 3.11's ctypes.wintypes)
            HRESULT = ctypes.c_long

            # Define function signature
            PCWSTR = ctypes.c_wchar_p
            SetCurrentProcessExplicitAppUserModelID = ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID
            SetCurrentProcessExplicitAppUserModelID.argtypes = [PCWSTR]
            SetCurrentProcessExplicitAppUserModelID.restype = HRESULT

            # Call Windows API
            result = SetCurrentProcessExplicitAppUserModelID(app_id)

            if result == 0:  # S_OK
                self._app_id = app_id
                ColorPrint.plain(f"[AppUserModelID] [OK] Set for current process: {app_id}")
                return True
            else:
                ColorPrint.plain(f"[AppUserModelID] [X] Failed to set (HRESULT: {result:#x})")
                return False

        except Exception as e:
            ColorPrint.plain(f"[AppUserModelID] [X] Error setting AppUserModelID: {e}")
            return False

    def set_shortcut_app_id(self, shortcut_path, app_id):
        """
        Set AppUserModelID property on shortcut file

        This ensures shortcut pinned to taskbar uses same AppUserModelID as running application.
        Prevents duplicate icons when running as administrator.

        Args:
            shortcut_path: Path to .lnk file
            app_id: AppUserModelID string (same as used in set_current_process_app_id)

        Returns:
            bool: True if successful, False otherwise
        """
        if not self._is_windows:
            ColorPrint.plain("[AppUserModelID] Not on Windows, skipping")
            return False

        shortcut_path = Path(shortcut_path)
        if not shortcut_path.exists():
            ColorPrint.plain(f"[AppUserModelID] Error: Shortcut not found: {shortcut_path}")
            return False

        if not app_id:
            ColorPrint.plain("[AppUserModelID] Error: app_id cannot be empty")
            return False

        try:
            pythoncom = get_third_package_pythoncom()
            propsys = get_third_package_win32com_propsys()
            pscon = get_third_package_win32com_pscon()

            if pythoncom is None or propsys is None or pscon is None:
                ColorPrint.plain("[AppUserModelID] [X] pywin32 COM support is unavailable")
                return False

            # Initialize COM
            pythoncom.CoInitialize()

            try:
                # Open shortcut's property store
                store = propsys.SHGetPropertyStoreFromParsingName(
                    str(shortcut_path),
                    None,
                    pscon.GPS_READWRITE,
                    propsys.IID_IPropertyStore
                )

                # Create PROPVARIANT with AppUserModelID
                pv = propsys.PROPVARIANTType(app_id, pythoncom.VT_LPWSTR)

                # Set System.AppUserModel.ID property
                # PKEY_AppUserModel_ID = {9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}, 5
                pk = propsys.PROPERTYKEY()
                pk.fmtid = pythoncom.MakeIID("{9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3}")
                pk.pid = 5

                store.SetValue(pk, pv)
                store.Commit()

                ColorPrint.plain(f"[AppUserModelID] [OK] Set on shortcut: {shortcut_path.name}")
                ColorPrint.plain(f"[AppUserModelID]   AppUserModelID: {app_id}")
                return True

            finally:
                pythoncom.CoUninitialize()

        except ImportError as e:
            ColorPrint.plain(f"[AppUserModelID] [X] Missing dependency: {e}")
            ColorPrint.plain("[AppUserModelID] Install: pip install pywin32")
            return False
        except Exception as e:
            ColorPrint.plain(f"[AppUserModelID] [X] Error setting shortcut property: {e}")
            traceback.print_exc()
            return False

    def get_current_process_app_id(self):
        """
        Get AppUserModelID of current process

        Returns:
            str: AppUserModelID or None if not set
        """
        if not self._is_windows:
            return None

        try:

            # Define HRESULT (not available in Python 3.11's ctypes.wintypes)
            HRESULT = ctypes.c_long

            # Define function signature
            PWSTR = ctypes.POINTER(ctypes.c_wchar_p)
            GetCurrentProcessExplicitAppUserModelID = ctypes.windll.shell32.GetCurrentProcessExplicitAppUserModelID
            GetCurrentProcessExplicitAppUserModelID.argtypes = [PWSTR]
            GetCurrentProcessExplicitAppUserModelID.restype = HRESULT

            # Call Windows API
            app_id = ctypes.c_wchar_p()
            result = GetCurrentProcessExplicitAppUserModelID(ctypes.byref(app_id))

            if result == 0:  # S_OK
                return app_id.value
            else:
                return None

        except Exception as e:
            ColorPrint.plain(f"[AppUserModelID] Error getting AppUserModelID: {e}")
            return None

    def get_recommended_app_id(self, company_name, product_name, version=None):
        """
        Generate recommended AppUserModelID format

        Args:
            company_name: Company name (e.g., "XingcanMedia")
            product_name: Product name (e.g., "Matrix")
            version: Optional version (e.g., "Cloud", "1.0")

        Returns:
            str: Formatted AppUserModelID
        """
        # Remove spaces and special characters
        company = company_name.replace(' ', '').replace('-', '')
        product = product_name.replace(' ', '').replace('-', '')

        if version:
            version_clean = version.replace(' ', '').replace('-', '')
            return f"{company}.{product}.{version_clean}"
        else:
            return f"{company}.{product}"


# Singleton instance
_manager = AppUserModelIDManager()


def set_app_user_model_id(app_id):
    """
    Convenience function to set AppUserModelID for current process

    Args:
        app_id: AppUserModelID string

    Returns:
        bool: True if successful
    """
    return _manager.set_current_process_app_id(app_id)


def set_shortcut_app_user_model_id(shortcut_path, app_id):
    """
    Convenience function to set AppUserModelID on shortcut

    Args:
        shortcut_path: Path to .lnk file
        app_id: AppUserModelID string

    Returns:
        bool: True if successful
    """
    return _manager.set_shortcut_app_id(shortcut_path, app_id)


def get_app_user_model_id():
    """
    Get current process AppUserModelID

    Returns:
        str: AppUserModelID or None
    """
    return _manager.get_current_process_app_id()


def get_recommended_app_id(company_name, product_name, version=None):
    """
    Generate recommended AppUserModelID

    Args:
        company_name: Company name
        product_name: Product name
        version: Optional version

    Returns:
        str: Recommended AppUserModelID
    """
    return _manager.get_recommended_app_id(company_name, product_name, version)


def main():
    """Example usage"""
    ColorPrint.plain("=" * 70)
    ColorPrint.plain("AppUserModelID Manager - Example")
    ColorPrint.plain("=" * 70)

    # Generate recommended app ID
    app_id = get_recommended_app_id("XingcanMedia", "Matrix", "Cloud")
    ColorPrint.plain(f"\nRecommended AppUserModelID: {app_id}")

    # Set for current process
    ColorPrint.plain("\nSetting AppUserModelID for current process...")
    if set_app_user_model_id(app_id):
        ColorPrint.plain("[OK] Success")

        # Verify
        current_id = get_app_user_model_id()
        ColorPrint.plain(f"\nCurrent AppUserModelID: {current_id}")
    else:
        ColorPrint.plain("[X] Failed")

    ColorPrint.plain("\n" + "=" * 70)


if __name__ == "__main__":
    main()
