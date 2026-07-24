"""Foundation-level device namespace.

Concrete device implementations belong to ``pycore.pyutils.device``. This
foundation package deliberately exports none of them so the dependency cannot
point from the base layer back into a higher layer.
"""

__all__ = []
