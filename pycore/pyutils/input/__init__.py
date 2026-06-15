"""
pyutils.input - input simulation: clicks, field typing, IME, tray clicking.

    from pycore.pyutils.input.click_handler import ClickHandler
    from pycore.pyutils.input.field_input import type_into_field, FieldInputSimulator
    from pycore.pyutils.input.ime_switch import save_and_switch_ime_to_english, restore_ime
    from pycore.pyutils.input.tray_clicker import TrayClicker

field_input pastes Unicode through the generic clipboard primitive in
pyutils.common.clipboard_text, so this group depends only on pyutils.common -
never on the clipboard domain package.
"""
