"""
pyutils.desktop - desktop shortcut managers & taskbar helpers.

    from pycore.pyutils.desktop.shortcut_manager import DesktopShortcutManager
    from pycore.pyutils.desktop.universal_shortcut import ShortcutManager
    from pycore.pyutils.desktop.tk_taskbar import ensure_tk_root_in_taskbar

The reusable shortcut/icon engine (DesktopIconGenerator, AppUserModelID) lives
in pyutils.common (it is shared by launchers and installers), so these managers
depend only on pyutils.common - never on a sibling domain package. Inject an
i18n manager for localized names; none is imported here.
"""
