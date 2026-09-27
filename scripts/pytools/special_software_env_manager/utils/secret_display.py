"""
Secret display rule shared by every launcher generator.

A variable whose name contains one of SECRET_NAME_MARKERS is printed masked by
the generated launchers (ai_cli_mask_secret / Get-AiCliMaskedSecret).
"""

SECRET_NAME_MARKERS = ('TOKEN', 'KEY', 'SECRET', 'PASSWORD')


def is_secret_name(name: str) -> bool:
    upper_name = (name or '').upper()
    return any(marker in upper_name for marker in SECRET_NAME_MARKERS)
