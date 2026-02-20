# Re-export from single place (providor). Use "from providor.i18n_manager import i18n_manager" in new code.
from providor.i18n_manager import I18nManager, i18n_manager

__all__ = ["I18nManager", "i18n_manager"]
